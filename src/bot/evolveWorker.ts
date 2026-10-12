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
    const result = evaluateWeights(job.weights, {
      reference: (seat, seed) =>
        new GreedyBot({
          name: "Reference",
          rng: createSeededRng(seed * 13 + seat),
          weights: job.referenceWeights,
        }),
      seeds: job.seeds,
    });
    reply = { id: job.id, result };
  } catch (err) {
    reply = { id: job.id, error: String((err as Error).stack || err) };
  }
  process.send!(reply);
});
