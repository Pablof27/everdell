"""Trains the Everdell AlphaZero-style network on self-play data.

    train/.venv/bin/python train/train.py --data data/az/run1 --window 3000 \
        --out weights/az/run1/gen-003 [--init weights/az/run1/gen-002/model.json]

Reads the binary files written by src/bot/selfplay.ts (newest first, until the
window holds --window games), trains an MLP with a policy head (masked
softmax over the legal action keys), a value head (tanh, outcome z for the
player to move) and an auxiliary margin head (final VP margin / 20), and
exports it in the format src/bot/network.ts loads:

    <out>/model.json         manifest (keys, scaling table, layer offsets)
    <out>/model.bin          parameters, little-endian float32
    <out>/test_vectors.json  inputs and PyTorch outputs, for the TS forward pass
    <out>/metrics.json       training / held-out metrics

Other modes:
    --random-init            export an untrained network (generation 0)
    --overfit 64 --steps 200 sanity check: fit 64 positions, report the losses
    --export-fixture DIR     tiny random model + test vectors for network.test.ts
"""

import argparse
import glob
import json
import math
import os
import struct
import sys
import time

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

MODEL_FORMAT = "everdell-az-mlp"
SELFPLAY_FORMAT = "everdell-az-selfplay"


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------


def encoding_hash(enc):
    """FNV-1a of the encoding, identical to encodingHash() in selfplay.ts
    (over the UTF-16 code units of JSON.stringify's output)."""
    text = json.dumps(
        [enc["numPlayers"], enc["stateDim"], enc["scales"], enc["keys"]],
        separators=(",", ":"),
        ensure_ascii=False,
    )
    units = text.encode("utf-16-le")
    h = 0x811C9DC5
    for i in range(0, len(units), 2):
        h ^= units[i] | (units[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return "%08x" % h


def read_header(path):
    with open(path, "rb") as f:
        pre = f.read(12)
        if pre[:4] != b"AZSP":
            raise ValueError(f"{path} is not a self-play file")
        version, header_bytes = struct.unpack("<II", pre[4:12])
        if version != 1:
            raise ValueError(f"{path}: unsupported version {version}")
        header = json.loads(f.read(header_bytes).decode("utf-8"))
    return header, 12 + header_bytes


def read_file(path):
    header, data_start = read_header(path)
    buf = np.fromfile(path, dtype=np.uint8)
    out = {}
    for sec in header["sections"]:
        dtype = np.dtype(sec["dtype"])
        start = data_start + sec["offset"]
        out[sec["name"]] = buf[start : start + sec["count"] * dtype.itemsize].view(dtype)
    return header, out


def find_encoding(path, roots):
    d = os.path.dirname(os.path.abspath(path))
    stops = {os.path.abspath(r) for r in roots}
    while True:
        candidate = os.path.join(d, "encoding.json")
        if os.path.exists(candidate):
            return candidate
        if d in stops or os.path.dirname(d) == d:
            raise FileNotFoundError(f"No encoding.json above {path}")
        d = os.path.dirname(d)


class Dataset:
    """Every position of the chosen files, as numpy arrays."""

    def __init__(self, files, encoding):
        self.encoding = encoding
        self.dim = encoding["stateDim"]
        self.num_keys = len(encoding["keys"])
        self.mask_bytes = (self.num_keys + 7) // 8
        expected_hash = encoding_hash(encoding)
        parts = {k: [] for k in ["states", "seat", "hasPolicy", "legalMask", "z",
                                 "margin", "rootValue", "game", "move"]}
        pol_keys, pol_probs, pol_counts = [], [], []
        game_offset = 0
        self.games = []
        for path in files:
            header, sec = read_file(path)
            if header["encodingHash"] != expected_hash:
                raise ValueError(
                    f"{path} was written with another state encoding / vocabulary "
                    f"({header['encodingHash']} != {expected_hash})"
                )
            n = header["numPositions"]
            parts["states"].append(sec["states"].reshape(n, self.dim))
            parts["legalMask"].append(sec["legalMask"].reshape(n, self.mask_bytes))
            for k in ["seat", "hasPolicy", "z", "margin", "rootValue", "move"]:
                parts[k].append(sec[k])
            parts["game"].append(sec["game"].astype(np.int64) + game_offset)
            offsets = sec["policyOffsets"].astype(np.int64)
            pol_counts.append(offsets[1:] - offsets[:-1])
            pol_keys.append(sec["policyKeys"])
            pol_probs.append(sec["policyProbs"])
            for g in header["games"]:
                self.games.append({**g, "file": path})
            game_offset += len(header["games"])
        if not files:
            raise ValueError("No self-play files")
        self.states = np.concatenate(parts["states"])
        self.legal_mask = np.concatenate(parts["legalMask"])
        self.seat = np.concatenate(parts["seat"])
        self.has_policy = np.concatenate(parts["hasPolicy"]).astype(bool)
        self.z = np.concatenate(parts["z"]).astype(np.float32)
        self.margin = np.concatenate(parts["margin"]).astype(np.float32)
        self.root_value = np.concatenate(parts["rootValue"]).astype(np.float32)
        self.game = np.concatenate(parts["game"])
        self.move = np.concatenate(parts["move"]).astype(np.int64)
        counts = np.concatenate(pol_counts)
        self.pol_offsets = np.concatenate([[0], np.cumsum(counts)]).astype(np.int64)
        self.pol_keys = np.concatenate(pol_keys).astype(np.int64)
        self.pol_probs = np.concatenate(pol_probs).astype(np.float32)
        self.inv_scales = (1.0 / np.asarray(encoding["scales"], dtype=np.float32))
        # Position index within its game, as a fraction of the game length.
        lengths = np.bincount(self.game)
        self.progress = (self.move + 1) / np.maximum(1, lengths[self.game])

    def __len__(self):
        return len(self.z)

    def batch(self, idx, device, q_weight=0.0):
        x = torch.from_numpy(self.states[idx].astype(np.float32) * self.inv_scales)
        mask = np.unpackbits(self.legal_mask[idx], axis=1, bitorder="little")
        mask = torch.from_numpy(mask[:, : self.num_keys].astype(bool))
        # Sparse policy targets -> dense rows.
        starts = self.pol_offsets[idx]
        counts = self.pol_offsets[idx + 1] - starts
        total = int(counts.sum())
        target = torch.zeros(len(idx), self.num_keys)
        if total:
            rows = np.repeat(np.arange(len(idx)), counts)
            first = np.repeat(np.cumsum(counts) - counts, counts)
            pos = np.arange(total) - first + np.repeat(starts, counts)
            target[torch.from_numpy(rows), torch.from_numpy(self.pol_keys[pos])] = (
                torch.from_numpy(self.pol_probs[pos])
            )
        z = self.z[idx]
        if q_weight > 0:
            q = self.root_value[idx]
            z = np.where(np.isnan(q), z, (1 - q_weight) * z + q_weight * q)
        return (
            x.to(device),
            mask.to(device),
            target.to(device),
            torch.from_numpy(self.has_policy[idx]).to(device),
            torch.from_numpy(np.asarray(z, dtype=np.float32)).to(device),
            torch.from_numpy(self.margin[idx] / 20.0).to(device),
        )


def select_files(data_dirs, window_games):
    """Newest files first until the window holds `window_games` games."""
    files = []
    for d in data_dirs:
        if os.path.isfile(d):
            files.append(d)
        else:
            files.extend(glob.glob(os.path.join(d, "**", "batch-*.bin"), recursive=True))
    files.sort(key=lambda f: (os.path.getmtime(f), f), reverse=True)
    chosen, games = [], 0
    for f in files:
        if window_games and games >= window_games:
            break
        header, _ = read_header(f)
        chosen.append(f)
        games += len(header["games"])
    return sorted(chosen), games


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------


class Net(nn.Module):
    def __init__(self, state_dim, num_keys, hidden=(256, 128)):
        super().__init__()
        layers, width = [], state_dim
        for h in hidden:
            layers.append(nn.Linear(width, h))
            width = h
        self.trunk = nn.ModuleList(layers)
        self.policy = nn.Linear(width, num_keys)
        self.value = nn.Linear(width, 1)
        self.margin = nn.Linear(width, 1)

    def forward(self, x):
        for layer in self.trunk:
            x = F.relu(layer(x))
        return self.policy(x), torch.tanh(self.value(x)).squeeze(-1), self.margin(x).squeeze(-1)


def json_default(o):
    """numpy scalars and arrays (in the metrics) as plain JSON values."""
    if hasattr(o, "tolist"):
        return o.tolist()
    raise TypeError(f"{type(o).__name__} is not JSON serializable")


def export_model(net, encoding, out_dir, info, test_inputs=None):
    """model.json + model.bin (+ test_vectors.json) in the format of network.ts."""
    os.makedirs(out_dir, exist_ok=True)
    named = [(f"fc{i + 1}", layer, "relu") for i, layer in enumerate(net.trunk)]
    named += [("policy", net.policy, "linear"), ("value", net.value, "linear"),
              ("margin", net.margin, "linear")]
    chunks, layers, offset = [], [], 0
    for name, layer, activation in named:
        w = layer.weight.detach().cpu().numpy().astype("<f4")  # (out, in), row-major
        b = layer.bias.detach().cpu().numpy().astype("<f4")
        layers.append({
            "name": name, "in": int(w.shape[1]), "out": int(w.shape[0]),
            "offsetW": offset, "offsetB": offset + w.size, "activation": activation,
        })
        chunks += [w.ravel(), b.ravel()]
        offset += w.size + b.size
    params = np.concatenate(chunks).astype("<f4")
    params.tofile(os.path.join(out_dir, "model.bin"))
    manifest = {
        "format": MODEL_FORMAT,
        "version": 1,
        "numPlayers": encoding["numPlayers"],
        "stateDim": encoding["stateDim"],
        "keys": encoding["keys"],
        "scales": encoding["scales"],
        "layers": layers,
        "heads": {"policy": "policy", "value": "value", "margin": "margin"},
        "weightsFile": "model.bin",
        "numParams": int(params.size),
        "info": info,
    }
    with open(os.path.join(out_dir, "model.json"), "w") as f:
        json.dump(manifest, f, default=json_default)
    if test_inputs is not None:
        net.eval()
        with torch.no_grad():
            x = torch.as_tensor(test_inputs, dtype=torch.float32)
            logits, value, margin = net(x.to(next(net.parameters()).device))
        with open(os.path.join(out_dir, "test_vectors.json"), "w") as f:
            json.dump({
                "inputs": test_inputs.tolist(),
                "logits": logits.cpu().numpy().tolist(),
                "value": value.cpu().numpy().tolist(),
                "margin": margin.cpu().numpy().tolist(),
            }, f)
    return manifest


def load_exported(net, manifest_path):
    with open(manifest_path) as f:
        manifest = json.load(f)
    params = np.fromfile(os.path.join(os.path.dirname(manifest_path),
                                      manifest["weightsFile"]), dtype="<f4")
    by_name = {l["name"]: l for l in manifest["layers"]}
    modules = [(f"fc{i + 1}", layer) for i, layer in enumerate(net.trunk)]
    modules += [("policy", net.policy), ("value", net.value), ("margin", net.margin)]
    with torch.no_grad():
        for name, layer in modules:
            spec = by_name[name]
            if (spec["out"], spec["in"]) != tuple(layer.weight.shape):
                raise ValueError(f"{manifest_path}: layer {name} has another shape")
            w = params[spec["offsetW"] : spec["offsetW"] + spec["in"] * spec["out"]]
            b = params[spec["offsetB"] : spec["offsetB"] + spec["out"]]
            layer.weight.copy_(torch.from_numpy(w.reshape(spec["out"], spec["in"]).copy()))
            layer.bias.copy_(torch.from_numpy(b.copy()))
    return manifest


def hidden_sizes_of(manifest_path):
    with open(manifest_path) as f:
        manifest = json.load(f)
    heads = set(manifest["heads"].values())
    return tuple(l["out"] for l in manifest["layers"] if l["name"] not in heads)


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------


def losses(net, batch, margin_weight):
    x, mask, target, has_policy, z, margin = batch
    logits, value, pred_margin = net(x)
    # Masked softmax over the legal keys. A large finite fill (not -inf) keeps
    # rows without any legal key (set-valued decisions) free of NaNs.
    logp = torch.log_softmax(logits.masked_fill(~mask, -1e9), dim=1)
    # Targets are 0 outside the legal keys.
    ce_rows = -(target * logp).sum(dim=1)
    n_pol = has_policy.sum()
    policy_loss = (ce_rows * has_policy).sum() / n_pol.clamp(min=1)
    value_loss = F.mse_loss(value, z)
    margin_loss = F.huber_loss(pred_margin, margin)
    total = policy_loss + value_loss + margin_weight * margin_loss
    return total, policy_loss, value_loss, margin_loss, logp, value


@torch.no_grad()
def evaluate(net, data, idx, device, batch_size=4096):
    net.eval()
    sums = {"ce": 0.0, "kl": 0.0, "n_pol": 0, "mse": 0.0, "n": 0, "sign_ok": 0,
            "n_sign": 0, "end_ok": 0, "n_end": 0, "entropy": 0.0, "n_ent": 0}
    bins = np.linspace(-1, 1, 6)
    calib = [[0.0, 0] for _ in range(len(bins) - 1)]
    for s in range(0, len(idx), batch_size):
        b = idx[s : s + batch_size]
        batch = data.batch(b, device)
        x, mask, target, has_policy, z, margin = batch
        _, pl, vl, _, logp, value = losses(net, batch, 0.0)
        hp = has_policy.cpu().numpy()
        if hp.any():
            t = target[has_policy]
            ce = -(t * logp[has_policy]).sum(dim=1)
            ent_t = -(t * torch.log(t.clamp(min=1e-12))).sum(dim=1)
            sums["ce"] += float(ce.sum())
            sums["kl"] += float((ce - ent_t).sum())
            sums["n_pol"] += int(hp.sum())
        multi = mask.sum(dim=1) > 1
        p = logp.exp().masked_fill(~mask, 0.0)
        ent = -(p * logp).sum(dim=1)
        sums["entropy"] += float(ent[multi].sum())
        sums["n_ent"] += int(multi.sum())
        v = value.cpu().numpy()
        zz = z.cpu().numpy()
        sums["mse"] += float(((v - zz) ** 2).sum())
        sums["n"] += len(b)
        decided = zz != 0
        sums["sign_ok"] += int((np.sign(v[decided]) == np.sign(zz[decided])).sum())
        sums["n_sign"] += int(decided.sum())
        end = decided & (data.progress[b] > 0.8)
        sums["end_ok"] += int((np.sign(v[end]) == np.sign(zz[end])).sum())
        sums["n_end"] += int(end.sum())
        which = np.clip(np.digitize(v, bins) - 1, 0, len(calib) - 1)
        for i, zi in zip(which, zz):
            calib[i][0] += float(zi)
            calib[i][1] += 1
    net.train()
    n_pol = max(1, sums["n_pol"])
    return {
        "policyCE": sums["ce"] / n_pol,
        "policyKL": sums["kl"] / n_pol,
        "valueMSE": sums["mse"] / max(1, sums["n"]),
        "valueSignAcc": sums["sign_ok"] / max(1, sums["n_sign"]),
        "endgameSignAcc": sums["end_ok"] / max(1, sums["n_end"]),
        "policyEntropy": sums["entropy"] / max(1, sums["n_ent"]),
        "calibration": [
            {"v": f"[{bins[i]:.1f},{bins[i + 1]:.1f})", "meanZ": c[0] / c[1], "n": c[1]}
            for i, c in enumerate(calib) if c[1] > 0
        ],
    }


def split_by_game(data, holdout, rng):
    games = np.unique(data.game)
    if holdout <= 0 or len(games) < 2:
        return np.arange(len(data)), np.arange(0)
    held = rng.choice(games, size=max(1, int(round(holdout * len(games)))), replace=False)
    is_held = np.isin(data.game, held)
    return np.where(~is_held)[0], np.where(is_held)[0]


def train(args):
    torch.manual_seed(args.seed)
    rng = np.random.default_rng(args.seed)
    device = torch.device(args.device)
    files, num_games = select_files(args.data, args.window)
    if not files:
        sys.exit(f"No self-play files under {args.data}")
    with open(find_encoding(files[0], args.data)) as f:
        encoding = json.load(f)
    start = time.time()
    data = Dataset(files, encoding)
    print(f"Loaded {len(data)} positions from {num_games} games in {len(files)} files "
          f"({time.time() - start:.1f}s); {data.has_policy.mean() * 100:.0f}% with a policy target")

    hidden = tuple(int(h) for h in args.hidden.split(","))
    if args.init:
        hidden = hidden_sizes_of(args.init)
    net = Net(encoding["stateDim"], len(encoding["keys"]), hidden).to(device)
    if args.init:
        load_exported(net, args.init)
        print(f"Initialized from {args.init}")

    if args.overfit:
        train_idx = rng.choice(len(data), size=min(args.overfit, len(data)), replace=False)
        train_idx = train_idx[data.has_policy[train_idx]] if data.has_policy[train_idx].any() else train_idx
        held_idx = train_idx
    else:
        train_idx, held_idx = split_by_game(data, args.holdout, rng)
    opt = torch.optim.AdamW(net.parameters(), lr=args.lr, weight_decay=args.wd)
    before = evaluate(net, data, held_idx, device) if len(held_idx) else None

    steps = 0
    stats = []
    if args.overfit:
        batch = data.batch(train_idx, device, args.q_weight)
        for steps in range(1, args.steps + 1):
            total, pl, vl, ml, _, _ = losses(net, batch, args.margin_weight)
            opt.zero_grad()
            total.backward()
            opt.step()
        stats.append((pl.item(), vl.item(), ml.item()))
    else:
        for epoch in range(args.epochs):
            perm = rng.permutation(train_idx)
            for s in range(0, len(perm), args.batch):
                b = perm[s : s + args.batch]
                if len(b) < args.batch // 4 and s > 0:
                    break
                total, pl, vl, ml, _, _ = losses(net, data.batch(b, device, args.q_weight),
                                                 args.margin_weight)
                opt.zero_grad()
                total.backward()
                opt.step()
                steps += 1
                stats.append((pl.item(), vl.item(), ml.item()))
            n = max(1, len(stats) // (epoch + 1))
            recent = np.mean(stats[-n:], axis=0)
            print(f"epoch {epoch + 1}: {steps} steps, train policy CE {recent[0]:.3f} "
                  f"value MSE {recent[1]:.3f} margin {recent[2]:.3f}")

    after = evaluate(net, data, held_idx, device) if len(held_idx) else None
    metrics = {
        "positions": len(data), "games": num_games, "files": len(files),
        "trainPositions": int(len(train_idx)), "heldOutPositions": int(len(held_idx)),
        "steps": steps, "seconds": time.time() - start, "args": vars(args),
        "train": dict(zip(["policyCE", "valueMSE", "marginHuber"],
                          np.mean(stats[-max(1, len(stats) // 10):], axis=0).tolist()))
        if stats else None,
        "heldOutBefore": before, "heldOut": after,
    }
    if after:
        label = "fit positions" if args.overfit else "held-out"
        print(f"{label}: policy CE {before['policyCE']:.3f} -> {after['policyCE']:.3f} "
              f"(KL {after['policyKL']:.3f}), value MSE {before['valueMSE']:.3f} -> "
              f"{after['valueMSE']:.3f}, sign acc {after['valueSignAcc']:.3f} "
              f"(endgame {after['endgameSignAcc']:.3f}), policy entropy {after['policyEntropy']:.3f}")
        print("calibration (predicted v -> mean z): " + ", ".join(
            f"{c['v']}: {c['meanZ']:+.2f} (n={c['n']})" for c in after["calibration"]))
    if args.overfit:
        ok = after["policyKL"] < 0.05 and after["valueMSE"] < 0.05
        print("OVERFIT TEST " + ("PASSED" if ok else "FAILED"))
        if not ok:
            sys.exit(1)
        return

    sample = rng.choice(len(data), size=min(8, len(data)), replace=False)
    test_inputs = data.states[sample].astype(np.float32) * data.inv_scales
    info = {"createdAt": time.strftime("%Y-%m-%dT%H:%M:%S"), "init": args.init,
            "games": num_games, "positions": len(data), "heldOut": after,
            "tag": args.tag}
    export_model(net.cpu(), encoding, args.out, info, test_inputs)
    with open(os.path.join(args.out, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=1, default=json_default)
    print(f"Exported {args.out}/model.json")


def random_init(args, encoding):
    torch.manual_seed(args.seed)
    hidden = tuple(int(h) for h in args.hidden.split(","))
    net = Net(encoding["stateDim"], len(encoding["keys"]), hidden)
    rng = np.random.default_rng(args.seed)
    # Sparse non-negative counts like real positions, plus a dense row.
    raw = rng.integers(0, 4, size=(8, encoding["stateDim"])) * (rng.random((8, encoding["stateDim"])) < 0.1)
    raw[0] = rng.integers(0, 6, size=encoding["stateDim"])
    inputs = raw.astype(np.float32) / np.asarray(encoding["scales"], dtype=np.float32)
    export_model(net, encoding, args.out,
                 {"createdAt": time.strftime("%Y-%m-%dT%H:%M:%S"), "randomInit": True,
                  "tag": args.tag}, inputs)
    print(f"Exported an untrained network to {args.out}/model.json")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data", nargs="*", default=[], help="self-play directories or files")
    p.add_argument("--encoding", help="encoding.json (default: found next to the data)")
    p.add_argument("--window", type=int, default=3000, help="newest games to train on (0: all)")
    p.add_argument("--out", default="weights/az/model")
    p.add_argument("--init", help="model.json to start from (keeps its layer sizes)")
    p.add_argument("--hidden", default="256,128")
    p.add_argument("--epochs", type=int, default=1)
    p.add_argument("--batch", type=int, default=1024)
    p.add_argument("--lr", type=float, default=1e-3)
    p.add_argument("--wd", type=float, default=1e-4)
    p.add_argument("--margin-weight", type=float, default=0.5)
    p.add_argument("--q-weight", type=float, default=0.0,
                   help="value target = (1-q) z + q * root search value")
    p.add_argument("--holdout", type=float, default=0.05)
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--device", default="cpu")
    p.add_argument("--tag", default=None, help="free-form label stored in the manifest")
    p.add_argument("--overfit", type=int, default=0)
    p.add_argument("--steps", type=int, default=200)
    p.add_argument("--random-init", action="store_true")
    p.add_argument("--export-fixture", help="write a tiny random model + test vectors here")
    args = p.parse_args()
    torch.set_num_threads(max(1, os.cpu_count() or 1))

    if args.random_init or args.export_fixture:
        if args.encoding:
            enc_path = args.encoding
        elif args.data:
            files, _ = select_files(args.data, 0)
            enc_path = find_encoding(files[0], args.data) if files else os.path.join(args.data[0], "encoding.json")
        else:
            sys.exit("--random-init / --export-fixture need --encoding or --data")
        with open(enc_path) as f:
            encoding = json.load(f)
        if args.export_fixture:
            args.out = args.export_fixture
            if args.hidden == "256,128":
                args.hidden = "16,8"
        random_init(args, encoding)
        return
    if not args.data:
        sys.exit("--data is required")
    train(args)


if __name__ == "__main__":
    main()
