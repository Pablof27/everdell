// Inference of the policy/value MLP trained by train/train.py: a hand-written,
// synchronous forward pass over Float32Arrays (fits Bot.chooseMove).
//
// Export format: a JSON manifest plus one binary file of little-endian float32
// parameters. Offsets are in float32 elements; like PyTorch's nn.Linear,
// weights have shape (out, in), row-major: output j = b[j] + sum_i W[j*in+i] x[i].
import { GameState } from "../model/gameState";
import { GameInput } from "../model/types";
import { Evaluation, Evaluator } from "./mcts";
import { ACTION_KEYS, ACTION_KEY_INDEX } from "./actionKey";
import { encodeStateRaw, featureScales, stateDim } from "./encodeState";

export const MODEL_FORMAT = "everdell-az-mlp";

export type LayerSpec = {
  name: string;
  in: number;
  out: number;
  offsetW: number;
  offsetB: number;
  activation: "relu" | "tanh" | "linear";
};

export type ModelManifest = {
  format: typeof MODEL_FORMAT;
  version: 1;
  numPlayers: number;
  stateDim: number;
  // Action vocabulary (policy outputs) and feature scaling table the model
  // was trained with: loading fails unless they match the code's.
  keys: string[];
  scales: number[];
  // Trunk layers in order, then the heads.
  layers: LayerSpec[];
  heads: { policy: string; value: string; margin?: string };
  // Parameters file, relative to the manifest.
  weightsFile: string;
  numParams: number;
  // Provenance (generation, training metrics, ...).
  info?: Record<string, unknown>;
};

export type ForwardOutput = {
  logits: Float32Array;
  // tanh, the value for the player to move.
  value: number;
  // Predicted final VP margin / 20 (0 without a margin head).
  margin: number;
};

function arraysEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export class AzModel {
  readonly manifest: ModelManifest;
  readonly numPlayers: number;
  readonly stateDim: number;
  private readonly params: Float32Array;
  private readonly trunk: LayerSpec[];
  private readonly policy: LayerSpec;
  private readonly value: LayerSpec;
  private readonly margin: LayerSpec | null;
  // First trunk layer transposed to (in, out): sparse inputs touch one row each.
  private readonly firstT: Float32Array;
  private readonly invScales: Float32Array;
  private readonly hidden: Float32Array[];

  constructor(manifest: ModelManifest, params: Float32Array) {
    if (manifest.format !== MODEL_FORMAT || manifest.version !== 1) {
      throw new Error(
        `Unsupported model format ${manifest.format} v${manifest.version}`
      );
    }
    if (!arraysEqual(manifest.keys, ACTION_KEYS)) {
      throw new Error(
        `The model's action vocabulary (${manifest.keys.length} keys) differs ` +
          `from the current one (${ACTION_KEYS.length} keys)`
      );
    }
    const dim = stateDim(manifest.numPlayers);
    if (
      manifest.stateDim !== dim ||
      !arraysEqual(manifest.scales, featureScales(manifest.numPlayers))
    ) {
      throw new Error(
        `The model's state encoding (${manifest.stateDim} features) differs ` +
          `from the current one (${dim} features)`
      );
    }
    if (params.length !== manifest.numParams) {
      throw new Error(
        `Expected ${manifest.numParams} parameters, got ${params.length}`
      );
    }
    const byName = new Map(manifest.layers.map((l) => [l.name, l]));
    const head = (name: string | undefined, out: number): LayerSpec | null => {
      if (name === undefined) {
        return null;
      }
      const layer = byName.get(name);
      if (!layer || layer.out !== out) {
        throw new Error(`Bad head layer ${name}`);
      }
      return layer;
    };
    const headNames = Object.values(manifest.heads);
    this.trunk = manifest.layers.filter((l) => !headNames.includes(l.name));
    this.policy = head(manifest.heads.policy, ACTION_KEYS.length)!;
    this.value = head(manifest.heads.value, 1)!;
    this.margin = head(manifest.heads.margin, 1);
    let width = dim;
    this.trunk.forEach((layer) => {
      if (layer.in !== width) {
        throw new Error(
          `Layer ${layer.name} expects ${layer.in} inputs, gets ${width}`
        );
      }
      width = layer.out;
    });
    [this.policy, this.value, this.margin].forEach((layer) => {
      if (layer && layer.in !== width) {
        throw new Error(
          `Head ${layer.name} expects ${layer.in} inputs, gets ${width}`
        );
      }
    });
    manifest.layers.forEach((l) => {
      if (
        l.offsetW + l.in * l.out > params.length ||
        l.offsetB + l.out > params.length
      ) {
        throw new Error(`Layer ${l.name} is out of the parameter range`);
      }
    });
    if (this.trunk.length === 0) {
      throw new Error("The model has no hidden layer");
    }

    this.manifest = manifest;
    this.numPlayers = manifest.numPlayers;
    this.stateDim = dim;
    this.params = params;
    const first = this.trunk[0];
    this.firstT = new Float32Array(first.in * first.out);
    for (let j = 0; j < first.out; j++) {
      for (let i = 0; i < first.in; i++) {
        this.firstT[i * first.out + j] =
          params[first.offsetW + j * first.in + i];
      }
    }
    this.invScales = Float32Array.from(manifest.scales, (s) => 1 / s);
    this.hidden = this.trunk.map((l) => new Float32Array(l.out));
  }

  // Dense forward pass of a scaled input, every logit (for tests and tools).
  forward(x: Float32Array): ForwardOutput {
    let h = x;
    this.trunk.forEach((layer) => {
      const out = new Float32Array(layer.out);
      this.linear(layer, h, out);
      h = out;
    });
    const logits = new Float32Array(this.policy.out);
    this.linear(this.policy, h, logits);
    return this.heads(h, logits);
  }

  /**
   * Forward pass of raw (unscaled) features, computing the logits of the
   * given vocabulary indices only (the legal keys).
   */
  evaluateRaw(raw: Uint8Array, keyIndices: readonly number[]): ForwardOutput {
    const first = this.trunk[0];
    const p = this.params;
    let h = this.hidden[0];
    for (let j = 0; j < first.out; j++) {
      h[j] = p[first.offsetB + j];
    }
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] !== 0) {
        const xi = raw[i] * this.invScales[i];
        const row = i * first.out;
        for (let j = 0; j < first.out; j++) {
          h[j] += this.firstT[row + j] * xi;
        }
      }
    }
    activate(first.activation, h);
    for (let l = 1; l < this.trunk.length; l++) {
      this.linear(this.trunk[l], h, this.hidden[l]);
      h = this.hidden[l];
    }
    const policy = this.policy;
    const logits = new Float32Array(keyIndices.length);
    keyIndices.forEach((k, idx) => {
      let s = p[policy.offsetB + k];
      const row = policy.offsetW + k * policy.in;
      for (let i = 0; i < policy.in; i++) {
        s += p[row + i] * h[i];
      }
      logits[idx] = s;
    });
    return this.heads(h, logits);
  }

  private heads(h: Float32Array, logits: Float32Array): ForwardOutput {
    const value = new Float32Array(1);
    this.linear(this.value, h, value);
    const margin = new Float32Array(1);
    if (this.margin) {
      this.linear(this.margin, h, margin);
    }
    return { logits, value: Math.tanh(value[0]), margin: margin[0] };
  }

  private linear(layer: LayerSpec, x: Float32Array, out: Float32Array): void {
    const p = this.params;
    for (let j = 0; j < layer.out; j++) {
      let s = p[layer.offsetB + j];
      const row = layer.offsetW + j * layer.in;
      for (let i = 0; i < layer.in; i++) {
        s += p[row + i] * x[i];
      }
      out[j] = s;
    }
    activate(layer.activation, out);
  }
}

function activate(activation: LayerSpec["activation"], v: Float32Array): void {
  if (activation === "relu") {
    for (let i = 0; i < v.length; i++) {
      if (v[i] < 0) {
        v[i] = 0;
      }
    }
  } else if (activation === "tanh") {
    for (let i = 0; i < v.length; i++) {
      v[i] = Math.tanh(v[i]);
    }
  }
}

// Parses the parameters file (little-endian float32, any alignment).
export function decodeParams(bytes: ArrayBuffer | Uint8Array): Float32Array {
  const view =
    bytes instanceof Uint8Array
      ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      : new DataView(bytes);
  const params = new Float32Array(view.byteLength / 4);
  for (let i = 0; i < params.length; i++) {
    params[i] = view.getFloat32(i * 4, true);
  }
  return params;
}

// Softmax restricted to the given logits (the legal keys).
export function softmax(logits: ArrayLike<number>): number[] {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) {
    max = Math.max(max, logits[i]);
  }
  const exps = Array.from(logits, (l) => Math.exp(l - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / total);
}

/**
 * Priors from the masked softmax over the legal keys (moves sharing a key
 * split its probability) and the value head for the player to move: [v, -v]
 * in a 2-player game.
 */
export class NetworkEvaluator implements Evaluator<GameState, GameInput> {
  private readonly model: AzModel;

  constructor(model: AzModel) {
    this.model = model;
  }

  evaluate(
    s: GameState,
    legal: GameInput[],
    keys: (string | null)[]
  ): Evaluation {
    const n = s.players.length;
    if (n !== this.model.numPlayers) {
      throw new Error(
        `The model plays ${this.model.numPlayers}-player games, not ${n}`
      );
    }
    const seat = s.players.findIndex((p) => p.playerId === s.activePlayerId);
    const slotOfKey = new Map<string, number>();
    const keyIndices: number[] = [];
    const counts: number[] = [];
    keys.forEach((key) => {
      const k = key === null ? undefined : ACTION_KEY_INDEX.get(key);
      if (k === undefined) {
        return;
      }
      const slot = slotOfKey.get(key!);
      if (slot === undefined) {
        slotOfKey.set(key!, keyIndices.length);
        keyIndices.push(k);
        counts.push(1);
      } else {
        counts[slot]++;
      }
    });
    const { logits, value } = this.model.evaluateRaw(
      encodeStateRaw(s, seat),
      keyIndices
    );
    const probs = softmax(logits);
    const priors = keys.map((key) => {
      const slot = key === null ? undefined : slotOfKey.get(key);
      return slot === undefined ? 0 : probs[slot] / counts[slot];
    });
    const values = s.players.map((_, i) =>
      i === seat ? value : -value / (n - 1)
    );
    return { priors, values };
  }
}
