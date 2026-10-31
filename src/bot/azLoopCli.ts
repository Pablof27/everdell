// The AlphaZero loop: self-play with the best network, train a candidate on
// the newest games, gate it against the best, and measure it against fixed
// anchors.
//
//   npm run az-loop -- --run=run1 [--generations=10] [--games=1000] [--sims=200]
//       [--window=3000] [--epochs=1] [--lr=0.001] [--hidden=256,128]
//       [--fullProb=1] [--fastSims=50] [--alpha=1] [--tempMoves=30]
//       [--gateGames=200] [--gateThreshold=0.55] [--gateSims=<sims>]
//       [--anchorGames=100] [--anchors=RANDOM,GREEDY:<weights>,MCTS_V:<weights>:vmode=root]
//       [--warmGames=0] [--warmBot=GREEDY:<weights>] [--warmTemp=0] [--warmEpochs=3]
//       [--workers=N] [--seed=1] [--python=train/.venv/bin/python]
//
// Generation 0 is an untrained network, or (with --warmGames > 0) one trained
// on the warm bot's games. Each generation then:
//   1. plays --games self-play games with the best network (noise, τ schedule)
//   2. trains a candidate on the newest --window games, from the previous
//      candidate's weights (learning continues even when a gate fails)
//   3. gates: candidate vs best, --gateGames games on paired seeds; the
//      candidate becomes the best if it wins >= --gateThreshold
//   4. plays the candidate against every anchor (Elo = 400 log10(p / (1-p)))
//
// Files: data/az/<run>/{warm,gen-XXX}/*.bin (self-play), weights/az/<run>/
// gen-XXX/ (models), weights/az/<run>/best/ (current best), progress.csv and
// state.json (the loop resumes from it).
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { parseArgs } from "./cliArgs";
import { BotSpec, formatBotSpec, parseBotSpec } from "./botSpecs";
import {
  ParallelArenaSummary,
  createBotWorkerPool,
  eloFromWinRate,
  runArenaParallel,
} from "./matches";
import {
  runSelfPlay,
  summarizeSelfPlay,
  writeEncodingFile,
} from "./selfplayCli";
import { SelfPlayResult } from "./botWorker";
import { MctsSelfPlayOptions } from "./selfplay";

type LoopState = {
  generation: number;
  best: string;
  latest: string;
};

const DEFAULT_ANCHORS = [
  "RANDOM",
  "GREEDY:weights/run4/greedy-evolved.json",
  "MCTS_V:weights/run4/greedy-evolved.json:sims=200",
];

function genName(gen: number): string {
  return `gen-${String(gen).padStart(3, "0")}`;
}

function copyModel(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  ["model.json", "model.bin", "test_vectors.json", "metrics.json"].forEach(
    (file) => {
      if (fs.existsSync(path.join(from, file))) {
        fs.copyFileSync(path.join(from, file), path.join(to, file));
      }
    }
  );
}

function runPython(python: string, args: string[]): Promise<void> {
  console.log(`$ ${python} ${args.join(" ")}`);
  return new Promise((resolve, reject) => {
    const child = spawn(python, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`train.py exited with ${code}`))
    );
  });
}

function readMetrics(modelDir: string): Record<string, any> {
  const file = path.join(modelDir, "metrics.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const num = (key: string, def: number) =>
    args[key] === undefined ? def : Number(args[key]);
  const str = (key: string, def: string) =>
    args[key] === undefined || args[key] === true ? def : String(args[key]);

  const run = str("run", "run1");
  const modelRoot = path.join("weights", "az", run);
  const dataRoot = path.join("data", "az", run);
  const python = str("python", "train/.venv/bin/python");
  const generations = num("generations", 10);
  const numGames = num("games", 1000);
  const sims = num("sims", 200);
  const gateSims = num("gateSims", sims);
  const window = num("window", 3000);
  const seed = num("seed", 1);
  const numWorkers = Math.max(1, num("workers", os.cpus().length - 1));
  const search: MctsSelfPlayOptions = {
    simulations: sims,
    determinizations: 1,
    dirichletAlpha: num("alpha", 1),
    dirichletEpsilon: num("epsilon", 0.25),
    temperatureDecisions: num("tempMoves", 30),
    fullSearchProb: num("fullProb", 1),
    fastSimulations: num("fastSims", Math.round(sims / 4)),
  };
  const anchors: BotSpec[] = str("anchors", DEFAULT_ANCHORS.join(","))
    .split(",")
    .filter((s) => s)
    .map(parseBotSpec);
  const trainArgs = [
    "--window",
    String(window),
    "--epochs",
    str("epochs", "1"),
    "--lr",
    str("lr", "0.001"),
    "--batch",
    str("batch", "1024"),
  ];

  fs.mkdirSync(modelRoot, { recursive: true });
  writeEncodingFile(dataRoot);
  const stateFile = path.join(modelRoot, "state.json");
  const csvFile = path.join(modelRoot, "progress.csv");
  const pool = createBotWorkerPool(numWorkers);
  const azSpec = (dir: string, simulations: number): BotSpec => ({
    botType: "AZ",
    modelFile: dir,
    simulations,
    determinizations: 1,
  });
  const match = async (
    specs: BotSpec[],
    games: number,
    matchSeed: number
  ): Promise<ParallelArenaSummary> =>
    runArenaParallel({
      pool,
      specs,
      numGames: games,
      seed: matchSeed,
      pairedSeeds: true,
    });

  try {
    let state: LoopState;
    if (fs.existsSync(stateFile)) {
      state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      console.log(`Resuming ${run} after generation ${state.generation}`);
    } else {
      const gen0 = path.join(modelRoot, genName(0));
      const warmGames = num("warmGames", 0);
      const warmDir = path.join(dataRoot, "warm");
      if (warmGames > 0) {
        const warmBot = parseBotSpec(
          str("warmBot", "GREEDY:weights/run4/greedy-evolved.json")
        );
        const existing = fs.existsSync(warmDir)
          ? fs.readdirSync(warmDir).filter((f) => f.endsWith(".bin")).length
          : 0;
        if (existing > 0) {
          console.log(
            `Warm start: reusing the ${existing} files in ${warmDir}`
          );
        } else {
          console.log(
            `Warm start: ${warmGames} games of ${formatBotSpec(warmBot)}`
          );
          const results = await runSelfPlay({
            pool,
            spec: warmBot,
            numGames: warmGames,
            seed: seed * 7919,
            batchSize: 8,
            outDir: warmDir,
            search,
            greedyTemperature: num("warmTemp", 0),
            info: { generation: 0, warm: formatBotSpec(warmBot) },
          });
          console.log(summarizeSelfPlay(results));
        }
        await runPython(python, [
          "train/train.py",
          "--data",
          warmDir,
          "--out",
          gen0,
          "--hidden",
          str("hidden", "256,128"),
          "--tag",
          `${run}/warm`,
          ...trainArgs,
          "--window",
          "0",
          "--epochs",
          str("warmEpochs", "3"),
        ]);
      } else {
        await runPython(python, [
          "train/train.py",
          "--random-init",
          "--encoding",
          path.join(dataRoot, "encoding.json"),
          "--out",
          gen0,
          "--hidden",
          str("hidden", "256,128"),
          "--seed",
          String(seed),
          "--tag",
          `${run}/random`,
        ]);
      }
      copyModel(gen0, path.join(modelRoot, "best"));
      state = { generation: 0, best: genName(0), latest: genName(0) };
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n");
    }
    if (!fs.existsSync(csvFile)) {
      const labels = anchors.map((a, i) =>
        anchors.filter((b) => b.botType === a.botType).length > 1
          ? `${a.botType}${i}`
          : a.botType
      );
      fs.writeFileSync(
        csvFile,
        [
          "gen",
          "best",
          "accepted",
          "gateWinRate",
          "games",
          "positions",
          "selfplayVP",
          "selfplayMoves",
          "policyCE",
          "policyKL",
          "valueMSE",
          "signAcc",
          "endgameSignAcc",
          "policyEntropy",
          ...labels.flatMap((l) => [`winRate_${l}`, `elo_${l}`]),
          "minutes",
        ].join(",") + "\n"
      );
      fs.writeFileSync(
        path.join(modelRoot, "anchors.txt"),
        anchors.map(formatBotSpec).join("\n") + "\n"
      );
    }

    while (state.generation < generations) {
      const gen = state.generation + 1;
      const start = Date.now();
      const name = genName(gen);
      const bestDir = path.join(modelRoot, "best");
      console.log(`\n=== Generation ${gen} (best: ${state.best})`);

      // 1. Self-play with the best network.
      const selfPlay: SelfPlayResult[] = await runSelfPlay({
        pool,
        spec: azSpec(bestDir, sims),
        numGames,
        seed: seed * 1000003 + gen,
        batchSize: 4,
        outDir: path.join(dataRoot, name),
        search,
        info: { generation: gen, model: state.best },
        onBatch: (_, done) => {
          const s = (Date.now() - start) / 1000;
          process.stdout.write(
            `\rself-play ${done}/${numGames} games, ${s.toFixed(0)}s   `
          );
        },
      });
      console.log("\n" + summarizeSelfPlay(selfPlay));

      // 2. Train a candidate from the latest candidate.
      const candidateDir = path.join(modelRoot, name);
      await runPython(python, [
        "train/train.py",
        "--data",
        dataRoot,
        "--out",
        candidateDir,
        "--init",
        path.join(modelRoot, state.latest, "model.json"),
        "--seed",
        String(seed + gen),
        "--tag",
        `${run}/${name}`,
        ...trainArgs,
      ]);
      const metrics = readMetrics(candidateDir).heldOut || {};

      // 3. Gate against the best.
      const gate = await match(
        [azSpec(candidateDir, gateSims), azSpec(bestDir, gateSims)],
        num("gateGames", 200),
        1_000_000 * gen + 1
      );
      const gateWinRate = gate.wins[0] / Math.max(1, gate.numGames);
      const accepted = gateWinRate >= num("gateThreshold", 0.55);
      console.log(
        `gate: ${name} wins ${(100 * gateWinRate).toFixed(1)}% of ` +
          `${gate.numGames} games against ${state.best} -> ` +
          (accepted ? "accepted" : "rejected")
      );
      if (accepted) {
        copyModel(candidateDir, bestDir);
        state.best = name;
      }
      state.latest = name;

      // 4. Anchors.
      const anchorCols: string[] = [];
      for (let i = 0; i < anchors.length; i++) {
        const games = num("anchorGames", 100);
        if (games <= 0) {
          anchorCols.push("", "");
          continue;
        }
        const result = await match(
          [azSpec(candidateDir, gateSims), { ...anchors[i] }],
          games,
          1_000_000 * gen + 100_000 * (i + 1)
        );
        const p = result.wins[0] / Math.max(1, result.numGames);
        const elo = eloFromWinRate(p, result.numGames);
        console.log(
          `vs ${formatBotSpec(anchors[i])}: ${(100 * p).toFixed(1)}% ` +
            `(Elo ${elo >= 0 ? "+" : ""}${elo.toFixed(0)}), mean VP ` +
            `${result.meanPoints[0].toFixed(
              1
            )} vs ${result.meanPoints[1].toFixed(1)}`
        );
        anchorCols.push(p.toFixed(3), elo.toFixed(0));
      }

      const games = selfPlay.reduce((n, r) => n + r.games, 0);
      const row = [
        gen,
        state.best,
        accepted ? 1 : 0,
        gateWinRate.toFixed(3),
        games,
        selfPlay.reduce((n, r) => n + r.positions, 0),
        mean(selfPlay.flatMap((r) => r.points.flat())).toFixed(2),
        mean(selfPlay.flatMap((r) => r.numMoves)).toFixed(1),
        ...[
          "policyCE",
          "policyKL",
          "valueMSE",
          "valueSignAcc",
          "endgameSignAcc",
          "policyEntropy",
        ].map((k) => (metrics[k] === undefined ? "" : metrics[k].toFixed(4))),
        ...anchorCols,
        ((Date.now() - start) / 60000).toFixed(1),
      ];
      fs.appendFileSync(csvFile, row.join(",") + "\n");
      state.generation = gen;
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n");
    }
  } finally {
    pool.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
