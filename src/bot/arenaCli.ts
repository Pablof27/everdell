// Bot-vs-bot arena.
//
//   npm run arena -- [--games=100] [--seed=1] [--bots=RANDOM,RANDOM]
//                    [--pearlbrook] [--newleaf] [--bellfaire] [--verbose]
import { BotType, GameOptions } from "../model/types";
import { createSeededRng } from "../model/random";
import { createBot } from "./bot";
import { runArena } from "./arena";

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

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const numGames = parseInt(String(args.games || "100"), 10);
  const seed = parseInt(String(args.seed || "1"), 10);
  const botTypes = String(args.bots || "RANDOM,RANDOM").split(",") as BotType[];
  const verbose = !!args.verbose;

  const gameOptions: Partial<GameOptions> = {};
  if (args.pearlbrook) {
    gameOptions.pearlbrook = true;
  }
  if (args.newleaf) {
    gameOptions.newleaf = {
      cards: true,
      forestLocations: true,
      basicEvents: true,
      specialEvents: true,
      station: true,
      ticket: true,
      knoll: true,
      reserving: true,
      visitors: true,
    };
  }
  if (args.bellfaire) {
    gameOptions.bellfaire = {
      forestLocations: true,
      specialEvents: true,
      basicEvents: true,
    };
  }

  const bots = botTypes.map((botType, idx) =>
    createBot(botType, { rng: createSeededRng(seed * 1000 + idx) })
  );
  const names = bots.map((bot, idx) => `${bot.name}#${idx + 1}`);

  console.log(
    `Playing ${numGames} games: ${names.join(" vs ")} ` +
      `(seed=${seed}, options=${JSON.stringify(gameOptions)})`
  );

  const rejected: Record<string, number> = {};
  const summary = runArena({
    bots,
    numGames,
    seed,
    gameOptions,
    onGameEnd: (result, gameIdx) => {
      if (verbose) {
        console.log(
          `game ${gameIdx + 1}: seed=${result.seed} points=[${
            result.points
          }] ` +
            `moves=${result.numMoves} rejected=${result.numRejectedMoves} ` +
            `${result.durationMs}ms`
        );
      }
    },
    onRejectedMove: (_gameState, _move, err) => {
      const key = String((err as Error).message).split("\n")[0];
      rejected[key] = (rejected[key] || 0) + 1;
    },
  });

  console.log("");
  console.log("bot                 wins    win%   mean VP");
  bots.forEach((_, idx) => {
    console.log(
      names[idx].padEnd(18) +
        summary.wins[idx].toFixed(1).padStart(7) +
        ((100 * summary.wins[idx]) / numGames).toFixed(1).padStart(7) +
        "%" +
        summary.meanPoints[idx].toFixed(2).padStart(9)
    );
  });
  console.log("");
  console.log(
    `mean moves/game: ${summary.meanMoves.toFixed(1)}, ` +
      `rejected moves: ${summary.numRejectedMoves}, ` +
      `time: ${(summary.durationMs / 1000).toFixed(1)}s ` +
      `(${(summary.durationMs / numGames).toFixed(1)}ms/game)`
  );
  if (summary.numRejectedMoves) {
    console.log("rejected move reasons:", rejected);
  }
}

main();
