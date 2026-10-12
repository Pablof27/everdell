// Evolves GreedyBot weights with CMA-ES against a frozen reference bot.
//
//   npm run evolve -- [--generations=60] [--games=64] [--curveGames=64] [--sigma=0.15]
//                     [--minSigma=0.001] [--lambda=N] [--seed=1] [--workers=N]
//                     [--reference=weights/greedy.json] [--out=weights/run1]
//                     [--resume=weights/run1/checkpoints/gen-010.json]
//
// Writes <out>/progress.csv, <out>/checkpoints/gen-XXX.json and <out>/greedy-evolved.json.
import { fork, ChildProcess } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { CMAESOptimizer, CMAESState } from "./cmaesOptimizer";
import {
  Weights,
  fromFree,
  handTunedWeights,
  toFree,
  weightsFromJSON,
  weightsToJSON,
} from "./evaluations";
import type { FitnessResult } from "./fitness";
import type { WorkerJob, WorkerReply } from "./evolveWorker";

// Game seeds per generation live in [gen*1000, gen*1000+1000): first half tuning, second half curve.
const MAX_PAIRS = 500;

type WeightsJSON = ReturnType<typeof weightsToJSON>;

type Checkpoint = {
  generation: number;
  seed: number;
  mean: WeightsJSON;
  reference: WeightsJSON;
  es: CMAESState;
};

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  argv.forEach((arg) => {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (match) {
      args[match[1]] = match[2] === undefined ? true : match[2];
    }
  });
  return args;
}

class WorkerPool {
  private readonly workers: ChildProcess[];
  private idle: ChildProcess[];
  private queue: {
    job: Omit<WorkerJob, "id">;
    resolve: (r: FitnessResult) => void;
    reject: (e: Error) => void;
  }[] = [];
  private pending = new Map<
    number,
    { resolve: (r: FitnessResult) => void; reject: (e: Error) => void }
  >();
  private nextId = 0;
  private closed = false;

  constructor(size: number) {
    this.workers = Array.from({ length: size }, () => {
      const worker = fork(path.join(__dirname, "evolveWorker.ts"), [], {
        execArgv: ["-r", "ts-eager/register"],
      });
      worker.on("message", (reply: WorkerReply) => {
        const job = this.pending.get(reply.id)!;
        this.pending.delete(reply.id);
        this.idle.push(worker);
        if ("error" in reply) {
          job.reject(new Error(reply.error));
        } else {
          job.resolve(reply.result);
        }
        this.dispatch();
      });
      worker.on("exit", (code) => {
        if (!this.closed) {
          console.error(`Worker exited unexpectedly (code ${code})`);
          process.exit(1);
        }
      });
      return worker;
    });
    this.idle = this.workers.slice();
  }

  run(job: Omit<WorkerJob, "id">): Promise<FitnessResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ job, resolve, reject });
      this.dispatch();
    });
  }

  close(): void {
    this.closed = true;
    this.workers.forEach((w) => w.disconnect());
  }

  private dispatch(): void {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.pop()!;
      const { job, resolve, reject } = this.queue.shift()!;
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      worker.send({ ...job, id });
    }
  }
}

// Splits the seeds into chunks so a single evaluation (e.g. the learning curve) also uses every worker.
async function evaluateParallel(
  pool: WorkerPool,
  weights: Weights,
  referenceWeights: Weights,
  seeds: number[],
  chunkSize: number
): Promise<FitnessResult> {
  const chunks: number[][] = [];
  for (let i = 0; i < seeds.length; i += chunkSize) {
    chunks.push(seeds.slice(i, i + chunkSize));
  }
  const parts = await Promise.all(
    chunks.map((chunk) => pool.run({ weights, referenceWeights, seeds: chunk }))
  );
  const games = parts.reduce((s, p) => s + p.games, 0);
  return {
    meanMargin: parts.reduce((s, p) => s + p.meanMargin * p.games, 0) / games,
    winRate: parts.reduce((s, p) => s + p.winRate * p.games, 0) / games,
    games,
  };
}

function range(start: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => start + i);
}

function readJSON<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function writeJSON(file: string, data: unknown): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const int = (key: string, def: number) =>
    args[key] === undefined ? def : parseInt(String(args[key]), 10);
  const num = (key: string, def: number) =>
    args[key] === undefined ? def : parseFloat(String(args[key]));

  const generations = int("generations", 60);
  const pairs = Math.max(1, Math.floor(int("games", 64) / 2));
  const curvePairs = Math.max(1, Math.floor(int("curveGames", pairs * 2) / 2));
  const numWorkers = Math.max(1, int("workers", os.cpus().length - 1));
  if (pairs > MAX_PAIRS || curvePairs > MAX_PAIRS) {
    throw new Error(`At most ${MAX_PAIRS * 2} games per candidate`);
  }

  let es: CMAESOptimizer;
  let referenceWeights: Weights;
  let seed: number;
  if (args.resume) {
    const checkpoint = readJSON<Checkpoint>(String(args.resume));
    es = CMAESOptimizer.fromState(checkpoint.es);
    referenceWeights = weightsFromJSON(checkpoint.reference);
    seed = checkpoint.seed;
  } else {
    referenceWeights = args.reference
      ? weightsFromJSON(readJSON<WeightsJSON>(String(args.reference)))
      : handTunedWeights();
    seed = int("seed", 1);
    es = new CMAESOptimizer({
      mean: toFree(referenceWeights),
      sigma: num("sigma", 0.15),
      minSigma: num("minSigma", 1e-3),
      lambda: args.lambda === undefined ? undefined : int("lambda", 0),
      seed,
    });
  }

  const out = String(args.out || `weights/run-${seed}`);
  const checkpointDir = path.join(out, "checkpoints");
  fs.mkdirSync(checkpointDir, { recursive: true });
  const csvFile = path.join(out, "progress.csv");
  if (!fs.existsSync(csvFile)) {
    fs.writeFileSync(
      csvFile,
      "gen,bestF,medianF,curveMargin,curveWinRate,sigma,seconds\n"
    );
  }

  const chunkPairs = Math.max(1, Math.ceil(Math.max(pairs, curvePairs) / numWorkers));
  console.log(
    `CMA-ES on ${es.mean.length} weights, ${pairs * 2} games/candidate, ` +
      `${numWorkers} workers, seed=${seed}, out=${out}`
  );

  const pool = new WorkerPool(numWorkers);
  try {
    while (es.generation < generations) {
      const gen = es.generation + 1;
      const start = Date.now();
      const genSeedBase = seed * 1000000 + gen * 1000;
      const seeds = range(genSeedBase, pairs);
      const curveSeeds = range(genSeedBase + MAX_PAIRS, curvePairs);

      const candidates = es.ask();
      const results = await Promise.all(
        candidates.map((x) =>
          evaluateParallel(pool, fromFree(x), referenceWeights, seeds, chunkPairs)
        )
      );
      const fitness = results.map((r) => -r.meanMargin);
      es.tell(candidates, fitness);

      const meanWeights = fromFree(es.mean);
      const curve = await evaluateParallel(
        pool,
        meanWeights,
        referenceWeights,
        curveSeeds,
        chunkPairs
      );

      const sorted = fitness.slice().sort((a, b) => a - b);
      const seconds = (Date.now() - start) / 1000;
      const row = [
        gen,
        sorted[0].toFixed(3),
        sorted[Math.floor(sorted.length / 2)].toFixed(3),
        curve.meanMargin.toFixed(3),
        curve.winRate.toFixed(3),
        es.sigma.toFixed(5),
        seconds.toFixed(1),
      ];
      fs.appendFileSync(csvFile, row.join(",") + "\n");
      console.log(
        `gen ${gen}: best f=${row[1]} median f=${row[2]} ` +
          `curve margin=${row[3]} win=${row[4]} sigma=${row[5]} (${row[6]}s)`
      );

      const checkpoint: Checkpoint = {
        generation: gen,
        seed,
        mean: weightsToJSON(meanWeights),
        reference: weightsToJSON(referenceWeights),
        es: es.getState(),
      };
      writeJSON(
        path.join(checkpointDir, `gen-${String(gen).padStart(3, "0")}.json`),
        checkpoint
      );
    }
  } finally {
    pool.close();
  }

  const finalFile = path.join(out, "greedy-evolved.json");
  writeJSON(finalFile, weightsToJSON(fromFree(es.mean)));
  console.log(`Saved ${finalFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
