// Server-only: arena games described by serializable jobs, so they can run in
// worker processes (botWorker.ts). Used by arenaCli.ts and the AZ loop.
import path from "path";
import { GameState } from "../model/gameState";
import { GameInput, GameOptions } from "../model/types";
import { createSeededRng, deriveSeed } from "../model/random";
import { Bot } from "./bot";
import { playGame } from "./arena";
import { BotSpec, botFromSpec } from "./botSpecs";
import { WorkerPool } from "./workerPool";
import type { WorkerJob, WorkerResult } from "./botWorker";

export const BOT_WORKER_SCRIPT = path.join(__dirname, "botWorker.ts");

export type BotWorkerPool = WorkerPool<WorkerJob, WorkerResult>;

export function createBotWorkerPool(size: number): BotWorkerPool {
  return new WorkerPool<WorkerJob, WorkerResult>(BOT_WORKER_SCRIPT, size);
}

// Wraps a bot to measure its thinking time.
export class TimedBot implements Bot {
  readonly name: string;
  private readonly inner: Bot;
  decisions = 0;
  // Decisions with more than one legal move.
  searches = 0;
  thinkMs = 0;

  constructor(inner: Bot) {
    this.inner = inner;
    this.name = inner.name;
  }

  chooseMove(gameState: GameState, legalMoves: GameInput[]): GameInput {
    const start = Date.now();
    try {
      return this.inner.chooseMove(gameState, legalMoves);
    } finally {
      this.thinkMs += Date.now() - start;
      this.decisions++;
      if (legalMoves.length > 1) {
        this.searches++;
      }
    }
  }
}

export type BotTiming = {
  decisions: number;
  searches: number;
  thinkMs: number;
};

export type MatchJob = {
  type: "match";
  // One per bot (not per seat).
  specs: BotSpec[];
  // botBySeat[seat] = index in specs.
  botBySeat: number[];
  seed: number;
  // Rng seed of each bot (by index in specs).
  botSeeds: number[];
  gameOptions?: Partial<GameOptions>;
};

export type MatchResult = {
  seed: number;
  botBySeat: number[];
  points: number[];
  winnerSeats: number[];
  numMoves: number;
  numRejectedMoves: number;
  durationMs: number;
  // By bot index.
  timing: BotTiming[];
};

export function playMatch(job: MatchJob): MatchResult {
  const bots = job.specs.map(
    (spec, idx) =>
      new TimedBot(botFromSpec(spec, createSeededRng(job.botSeeds[idx])))
  );
  const result = playGame({
    bots: job.botBySeat.map((idx) => bots[idx]),
    seed: job.seed,
    gameOptions: job.gameOptions,
  });
  return {
    seed: job.seed,
    botBySeat: job.botBySeat,
    points: result.points,
    winnerSeats: result.winnerSeats,
    numMoves: result.numMoves,
    numRejectedMoves: result.numRejectedMoves,
    durationMs: result.durationMs,
    timing: bots.map(({ decisions, searches, thinkMs }) => ({
      decisions,
      searches,
      thinkMs,
    })),
  };
}

export type ParallelArenaSummary = {
  numGames: number;
  // By bot index. Ties award 1/numTied to each tied bot.
  wins: number[];
  meanPoints: number[];
  meanMoves: number;
  numRejectedMoves: number;
  numFailedGames: number;
  durationMs: number;
  timing: BotTiming[];
  results: MatchResult[];
};

/**
 * Plays numGames games on the pool, rotating seats like runArena: game g has
 * seed `seed + g` (with pairedSeeds, `seed + floor(g / numBots)`: every bot
 * plays every seat of the same deal) and seat s is played by bot
 * (s + g) % numBots. Each bot's rng is derived from (seed, g, bot), so results
 * do not depend on the number of workers (but differ from the sequential
 * runArena, whose bots keep one rng across games).
 */
export async function runArenaParallel({
  pool,
  specs,
  numGames,
  seed = 1,
  pairedSeeds = false,
  gameOptions,
  onGameEnd,
}: {
  pool: BotWorkerPool;
  specs: BotSpec[];
  numGames: number;
  seed?: number;
  pairedSeeds?: boolean;
  gameOptions?: Partial<GameOptions>;
  onGameEnd?: (result: MatchResult, gameIdx: number) => void;
}): Promise<ParallelArenaSummary> {
  const start = Date.now();
  const n = specs.length;
  let numFailedGames = 0;
  const results = await Promise.all(
    Array.from({ length: numGames }, async (_, gameIdx) => {
      const offset = gameIdx % n;
      const job: MatchJob = {
        type: "match",
        specs,
        botBySeat: specs.map((_, seat) => (seat + offset) % n),
        seed: seed + (pairedSeeds ? Math.floor(gameIdx / n) : gameIdx),
        botSeeds: specs.map((_, idx) => deriveSeed(seed, gameIdx, idx)),
        gameOptions,
      };
      try {
        const result = (await pool.run(job)) as MatchResult;
        onGameEnd?.(result, gameIdx);
        return result;
      } catch (err) {
        numFailedGames++;
        console.warn(
          `Game ${gameIdx} (seed ${job.seed}) failed: ` +
            String((err as Error).message).split("\n")[0]
        );
        return null;
      }
    })
  );
  const done = results.filter((r): r is MatchResult => !!r);
  const wins = specs.map(() => 0);
  const totalPoints = specs.map(() => 0);
  const timing = specs.map(() => ({ decisions: 0, searches: 0, thinkMs: 0 }));
  done.forEach((r) => {
    r.points.forEach((pts, seat) => (totalPoints[r.botBySeat[seat]] += pts));
    r.winnerSeats.forEach(
      (seat) => (wins[r.botBySeat[seat]] += 1 / r.winnerSeats.length)
    );
    r.timing.forEach((t, idx) => {
      timing[idx].decisions += t.decisions;
      timing[idx].searches += t.searches;
      timing[idx].thinkMs += t.thinkMs;
    });
  });
  const numDone = Math.max(1, done.length);
  return {
    numGames: done.length,
    wins,
    meanPoints: totalPoints.map((p) => p / numDone),
    meanMoves: done.reduce((s, r) => s + r.numMoves, 0) / numDone,
    numRejectedMoves: done.reduce((s, r) => s + r.numRejectedMoves, 0),
    numFailedGames,
    durationMs: Date.now() - start,
    timing,
    results: done,
  };
}

// Elo difference implied by a win rate (clamped away from 0 and 1).
export function eloFromWinRate(p: number, numGames = 1000): number {
  const eps = 0.5 / Math.max(1, numGames);
  const q = Math.min(1 - eps, Math.max(eps, p));
  return 400 * Math.log10(q / (1 - q));
}
