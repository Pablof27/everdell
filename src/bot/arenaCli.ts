// Bot-vs-bot arena.
//
//   npm run arena -- [--games=100] [--seed=1] [--bots=RANDOM,RANDOM]
//                    [--sims=200] [--k=1] [--workers=1] [--paired]
//                    [--pearlbrook] [--newleaf] [--bellfaire] [--verbose]
//
// Bots are specs (see botSpecs.ts), eg. a GREEDY bot with weights:
//   --bots=GREEDY:weights/run1/greedy-evolved.json,GREEDY
// or search bots, whose simulations / determinizations default to --sims / --k:
//   --bots=MCTS_V:weights/run4/greedy-evolved.json:sims=400,GREEDY
//   --bots=AZ:weights/az/run1/best:k=3,MCTS_V
//
// --workers > 1 plays the games in parallel processes; every bot then gets a
// fresh rng per game, so results differ from the sequential run (which the
// arena page (/arena) replays exactly). --paired (parallel only) deals the same
// cards to every seating: less noisy comparisons.
import os from "os";
import { createSeededRng } from "../model/random";
import { arenaGameOptions, runArena } from "./arena";
import { BotSpec, botFromSpec, formatBotSpec, parseBotSpec } from "./botSpecs";
import {
  BotTiming,
  TimedBot,
  createBotWorkerPool,
  eloFromWinRate,
  runArenaParallel,
} from "./matches";
import { parseArgs } from "./cliArgs";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const numGames = parseInt(String(args.games || "100"), 10);
  const seed = parseInt(String(args.seed || "1"), 10);
  const numWorkers =
    args.workers === true
      ? os.cpus().length - 1
      : parseInt(String(args.workers || "1"), 10);
  const specs: BotSpec[] = String(args.bots || "RANDOM,RANDOM")
    .split(",")
    .map((text) => {
      const spec = parseBotSpec(text);
      if (spec.botType === "MCTS_V" || spec.botType === "AZ") {
        if (args.sims !== undefined && spec.simulations === undefined) {
          spec.simulations = Number(args.sims);
        }
        if (args.k !== undefined && spec.determinizations === undefined) {
          spec.determinizations = Number(args.k);
        }
      }
      return spec;
    });
  const verbose = !!args.verbose;

  const gameOptions = arenaGameOptions({
    pearlbrook: !!args.pearlbrook,
    newleaf: !!args.newleaf,
    bellfaire: !!args.bellfaire,
  });

  const names = specs.map(
    (spec, idx) => `${spec.name || spec.botType}#${idx + 1}`
  );
  console.log(
    `Playing ${numGames} games: ${names.join(" vs ")} ` +
      `(seed=${seed}, workers=${numWorkers}, options=${JSON.stringify(
        gameOptions
      )})`
  );
  specs.forEach((spec, idx) => {
    console.log(`  ${names[idx]}: ${formatBotSpec(spec)}`);
  });

  let wins: number[];
  let meanPoints: number[];
  let meanMoves: number;
  let numRejectedMoves: number;
  let durationMs: number;
  let timing: BotTiming[];
  let playedGames = numGames;
  const rejected: Record<string, number> = {};
  const logGame = (
    gameIdx: number,
    r: {
      seed: number;
      points: number[];
      numMoves: number;
      numRejectedMoves: number;
      durationMs: number;
    }
  ) => {
    if (verbose) {
      console.log(
        `game ${gameIdx + 1}: seed=${r.seed} points=[${r.points}] ` +
          `moves=${r.numMoves} rejected=${r.numRejectedMoves} ` +
          `${r.durationMs}ms`
      );
    }
  };

  if (numWorkers > 1) {
    const pool = createBotWorkerPool(numWorkers);
    try {
      const summary = await runArenaParallel({
        pool,
        specs,
        numGames,
        seed,
        pairedSeeds: !!args.paired,
        gameOptions,
        onGameEnd: (result, gameIdx) => logGame(gameIdx, result),
      });
      ({
        wins,
        meanPoints,
        meanMoves,
        numRejectedMoves,
        durationMs,
        timing,
      } = summary);
      playedGames = summary.numGames;
    } finally {
      pool.close();
    }
  } else {
    // Bot i's rng is seeded from (seed, i) like createArenaBots, so the arena
    // page replays the same games.
    const bots = specs.map(
      (spec, idx) =>
        new TimedBot(botFromSpec(spec, createSeededRng(seed * 1000 + idx)))
    );
    const summary = runArena({
      bots,
      numGames,
      seed,
      gameOptions,
      onGameEnd: (result, gameIdx) => logGame(gameIdx, result),
      onRejectedMove: (_gameState, _move, err) => {
        const key = String((err as Error).message).split("\n")[0];
        rejected[key] = (rejected[key] || 0) + 1;
      },
    });
    ({ wins, meanPoints, meanMoves, numRejectedMoves, durationMs } = summary);
    timing = bots.map(({ decisions, searches, thinkMs }) => ({
      decisions,
      searches,
      thinkMs,
    }));
  }

  const totalWins = wins.reduce((a, b) => a + b, 0);
  console.log("");
  console.log(
    "bot                 wins    win%   mean VP     Elo  ms/decision  ms/search"
  );
  specs.forEach((_, idx) => {
    const t = timing[idx];
    // Head-to-head Elo difference, for 2-bot arenas.
    const elo =
      specs.length === 2
        ? eloFromWinRate(wins[idx] / Math.max(1e-9, totalWins), playedGames)
        : NaN;
    console.log(
      names[idx].padEnd(18) +
        wins[idx].toFixed(1).padStart(7) +
        ((100 * wins[idx]) / playedGames).toFixed(1).padStart(7) +
        "%" +
        meanPoints[idx].toFixed(2).padStart(9) +
        (Number.isNaN(elo) ? "" : elo.toFixed(0)).padStart(8) +
        (t.thinkMs / Math.max(1, t.decisions)).toFixed(1).padStart(13) +
        (t.thinkMs / Math.max(1, t.searches)).toFixed(1).padStart(11)
    );
  });
  console.log("");
  console.log(
    `mean moves/game: ${meanMoves.toFixed(1)}, ` +
      `rejected moves: ${numRejectedMoves}, ` +
      `time: ${(durationMs / 1000).toFixed(1)}s ` +
      `(${(durationMs / playedGames).toFixed(1)}ms/game)`
  );
  if (Object.keys(rejected).length) {
    console.log("rejected move reasons:", rejected);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
