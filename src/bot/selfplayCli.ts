// Self-play data for the AZ trainer (train/train.py).
//
//   npm run selfplay -- --games=200 --out=data/az/run1/gen-001
//                       [--bot=AZ:weights/az/run1/best] [--sims=200] [--k=1]
//                       [--alpha=1] [--epsilon=0.25] [--tempMoves=30]
//                       [--fullProb=1] [--fastSims=50] [--greedyTemp=0]
//                       [--batch=4] [--seed=1] [--workers=N]
//
// --bot is a bot spec (see botSpecs.ts): AZ:<model> searches with the network,
// MCTS_V:<weights> with the linear value, and GREEDY:<weights> records the
// greedy bot's moves (warm start; --greedyTemp > 0 softens the targets).
// --fullProb < 1 enables playout cap randomization: the other decisions get
// --fastSims simulations and no policy target.
//
// Writes <out>/batch-XXXXX.bin (one per --batch games) and <out>/encoding.json.
import fs from "fs";
import os from "os";
import path from "path";
import { deriveSeed } from "../model/random";
import { BotSpec, parseBotSpec } from "./botSpecs";
import { createBotWorkerPool, BotWorkerPool } from "./matches";
import { SelfPlayJob, SelfPlayResult } from "./botWorker";
import { MctsSelfPlayOptions, encodingInfo } from "./selfplay";
import { parseArgs } from "./cliArgs";

export type SelfPlayRunOptions = {
  pool: BotWorkerPool;
  spec: BotSpec;
  numGames: number;
  // Games of batch b have seeds deriveSeed(seed, b, i).
  seed: number;
  batchSize: number;
  outDir: string;
  search: MctsSelfPlayOptions;
  greedyTemperature?: number;
  info?: Record<string, unknown>;
  onBatch?: (result: SelfPlayResult, done: number) => void;
};

export function writeEncodingFile(dir: string, numPlayers = 2): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "encoding.json"),
    JSON.stringify(encodingInfo(numPlayers)) + "\n"
  );
}

export async function runSelfPlay({
  pool,
  spec,
  numGames,
  seed,
  batchSize,
  outDir,
  search,
  greedyTemperature,
  info,
  onBatch,
}: SelfPlayRunOptions): Promise<SelfPlayResult[]> {
  writeEncodingFile(outDir);
  const numBatches = Math.ceil(numGames / batchSize);
  let done = 0;
  return Promise.all(
    Array.from({ length: numBatches }, async (_, b) => {
      const count = Math.min(batchSize, numGames - b * batchSize);
      const job: SelfPlayJob = {
        type: "selfplay",
        spec,
        seeds: Array.from({ length: count }, (_, i) => deriveSeed(seed, b, i)),
        botSeed: deriveSeed(seed, b, 1000003),
        outFile: path.join(outDir, `batch-${String(b).padStart(5, "0")}.bin`),
        search,
        greedyTemperature,
        info,
      };
      const result = (await pool.run(job)) as SelfPlayResult;
      done += result.games;
      onBatch?.(result, done);
      return result;
    })
  );
}

export function summarizeSelfPlay(results: SelfPlayResult[]): string {
  const games = results.reduce((n, r) => n + r.games, 0);
  const failed = results.reduce((n, r) => n + r.failedGames, 0);
  const positions = results.reduce((n, r) => n + r.positions, 0);
  const policy = results.reduce((n, r) => n + r.policyPositions, 0);
  const points = results.flatMap((r) => r.points.flat());
  const moves = results.flatMap((r) => r.numMoves);
  const mean = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
  return (
    `${games} games (${failed} failed), ${positions} positions ` +
    `(${(positions / Math.max(1, games)).toFixed(1)}/game, ` +
    `${((100 * policy) / Math.max(1, positions)).toFixed(
      0
    )}% with a policy target), ` +
    `mean VP ${mean(points).toFixed(1)}, mean moves ${mean(moves).toFixed(1)}`
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const num = (key: string, def: number) =>
    args[key] === undefined ? def : Number(args[key]);
  const numGames = num("games", 100);
  const outDir = String(args.out || "data/az/selfplay");
  const spec = parseBotSpec(String(args.bot || "MCTS_V"));
  const search: MctsSelfPlayOptions = {
    simulations: num("sims", spec.simulations ?? 200),
    determinizations: num("k", spec.determinizations ?? 1),
    dirichletAlpha: num("alpha", 1),
    dirichletEpsilon: num("epsilon", 0.25),
    temperatureDecisions: num("tempMoves", 30),
    fullSearchProb: num("fullProb", 1),
    fastSimulations: num("fastSims", Math.round(num("sims", 200) / 4)),
  };
  const numWorkers = Math.max(1, num("workers", os.cpus().length - 1));
  const pool = createBotWorkerPool(numWorkers);
  const start = Date.now();
  console.log(
    `Self-play: ${numGames} games with ${JSON.stringify(spec)}, ` +
      `${JSON.stringify(search)}, ${numWorkers} workers -> ${outDir}`
  );
  try {
    const results = await runSelfPlay({
      pool,
      spec,
      numGames,
      seed: num("seed", 1),
      batchSize: num("batch", 4),
      outDir,
      search,
      greedyTemperature: num("greedyTemp", 0),
      info: { cli: process.argv.slice(2).join(" ") },
      onBatch: (_, done) => {
        const s = (Date.now() - start) / 1000;
        process.stdout.write(
          `\r${done}/${numGames} games, ${s.toFixed(0)}s ` +
            `(${(s / Math.max(1, done)).toFixed(2)} s/game)   `
        );
      },
    });
    console.log("\n" + summarizeSelfPlay(results));
  } finally {
    pool.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
