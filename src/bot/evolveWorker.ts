// Child process for evolveCli.ts: evaluates one (weights, seeds) job per message.
import { createSeededRng } from "../model/random";
import { Weights } from "./evaluations";
import { evaluateWeights, FitnessResult } from "./fitness";
import { GreedyBot } from "./greedyBot";

export type WorkerJob = {
  id: number;
  weights: Weights;
  referenceWeights: Weights;
  seeds: number[];
};

export type WorkerReply =
  | { id: number; result: FitnessResult }
  | { id: number; error: string };

process.on("message", (job: WorkerJob) => {
  let reply: WorkerReply;
  try {
    const parts = job.seeds.flatMap((seed) => {
      try {
        return [evaluateSeed(job, seed)];
      } catch (err) {
        // Skips both seat orders of the seed so the remaining games stay paired.
        const msg = String((err as Error).message).split("\n")[0];
        console.warn(`Skipped seed ${seed}: ${msg}`);
        return [];
      }
    });
    const games = parts.reduce((s, p) => s + p.games, 0);
    if (games === 0) {
      throw new Error(`Every seed failed: ${job.seeds}`);
    }
    reply = {
      id: job.id,
      result: {
        meanMargin: parts.reduce((s, p) => s + p.meanMargin * p.games, 0) / games,
        winRate: parts.reduce((s, p) => s + p.winRate * p.games, 0) / games,
        games,
        points: parts.flatMap((p) => p.points),
      },
    };
  } catch (err) {
    reply = { id: job.id, error: String((err as Error).stack || err) };
  }
  // The callback swallows EPIPE when the parent has already exited.
  process.send!(reply, () => undefined);
});

process.on("disconnect", () => process.exit(0));

function evaluateSeed(job: WorkerJob, seed: number): FitnessResult {
  return evaluateWeights(job.weights, {
    reference: (seat, s) =>
      new GreedyBot({
        name: "Reference",
        rng: createSeededRng(s * 13 + seat),
        weights: job.referenceWeights,
      }),
    seeds: [seed],
  });
}
