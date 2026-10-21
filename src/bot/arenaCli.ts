// Bot-vs-bot arena.
//
//   npm run arena -- [--games=100] [--seed=1] [--bots=RANDOM,RANDOM]
//                    [--pearlbrook] [--newleaf] [--bellfaire] [--verbose]
//
// A GREEDY bot can load weights: --bots=GREEDY:weights/run1/greedy-evolved.json,GREEDY
//
// The arena page (/arena) runs the same arenas in the browser.
import fs from "fs";
import { BotType } from "../model/types";
import { arenaGameOptions, createArenaBots, runArena } from "./arena";
import { weightsFromJSON } from "./evaluations";

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
  const botSpecs = String(args.bots || "RANDOM,RANDOM")
    .split(",")
    .map((spec) => {
      const [botType, weightsFile] = spec.split(":");
      return { botType: botType as BotType, weightsFile };
    });
  const verbose = !!args.verbose;

  const gameOptions = arenaGameOptions({
    pearlbrook: !!args.pearlbrook,
    newleaf: !!args.newleaf,
    bellfaire: !!args.bellfaire,
  });

  const bots = createArenaBots(
    botSpecs.map(({ botType, weightsFile }) => ({
      botType,
      weights: weightsFile
        ? weightsFromJSON(JSON.parse(fs.readFileSync(weightsFile, "utf8")))
        : null,
    })),
    seed
  );
  const names = bots.map((bot, idx) => `${bot.name}#${idx + 1}`);

  console.log(
    `Playing ${numGames} games: ${names.join(" vs ")} ` +
      `(seed=${seed}, options=${JSON.stringify(gameOptions)})`
  );
  botSpecs.forEach(({ weightsFile }, idx) => {
    if (weightsFile) {
      console.log(`  ${names[idx]} weights: ${weightsFile}`);
    }
  });

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
