// Child process behind matches.ts / selfplayCli.ts / azLoopCli.ts: plays arena
// matches and self-play batches. Never imports model/game.ts (db.ts exits
// without a DB_PATH).
import fs from "fs";
import path from "path";
import { GameOptions } from "../model/types";
import { createSeededRng } from "../model/random";
import { serveJobs } from "./workerPool";
import { MatchJob, MatchResult, playMatch } from "./matches";
import { BotSpec, botFromSpec, loadWeights } from "./botSpecs";
import { MctsBot } from "./mctsBot";
import { GreedyBot } from "./greedyBot";
import { handTunedWeights } from "./evaluations";
import {
  GameRecord,
  GreedySelfPlayer,
  MctsSelfPlayOptions,
  MctsSelfPlayer,
  SelfPlayer,
  encodeSelfPlayFile,
  playSelfPlayGame,
} from "./selfplay";

export type SelfPlayJob = {
  type: "selfplay";
  // AZ or MCTS_V (searched moves and visit targets), or GREEDY (warm start).
  spec: BotSpec;
  // One game per seed.
  seeds: number[];
  botSeed: number;
  outFile: string;
  search: MctsSelfPlayOptions;
  // GREEDY: softmax temperature over the moves' scores (0: one-hot target).
  greedyTemperature?: number;
  gameOptions?: Partial<GameOptions>;
  // Provenance, stored in the file header.
  info?: Record<string, unknown>;
};

export type SelfPlayResult = {
  file: string | null;
  games: number;
  failedGames: number;
  positions: number;
  policyPositions: number;
  points: number[][];
  numMoves: number[];
  durationMs: number;
};

export type WorkerJob = MatchJob | SelfPlayJob;
export type WorkerResult = MatchResult | SelfPlayResult;

function selfPlayer(job: SelfPlayJob): SelfPlayer {
  const rng = createSeededRng(job.botSeed);
  if (job.spec.botType === "GREEDY") {
    const weights = job.spec.weightsFile
      ? loadWeights(job.spec.weightsFile)
      : handTunedWeights();
    return new GreedySelfPlayer(
      new GreedyBot({ rng, weights }),
      job.greedyTemperature ?? 0
    );
  }
  const bot = botFromSpec(job.spec, rng);
  if (!(bot instanceof MctsBot)) {
    throw new Error(`Self-play needs an AZ, MCTS_V or GREEDY bot`);
  }
  return new MctsSelfPlayer(bot, rng, job.search);
}

export function playSelfPlayBatch(job: SelfPlayJob): SelfPlayResult {
  const start = Date.now();
  const player = selfPlayer(job);
  const games: GameRecord[] = [];
  let failedGames = 0;
  job.seeds.forEach((seed) => {
    try {
      games.push(
        playSelfPlayGame({ player, seed, gameOptions: job.gameOptions })
      );
    } catch (err) {
      failedGames++;
      console.warn(
        `Self-play game ${seed} failed: ` +
          String((err as Error).message).split("\n")[0]
      );
    }
  });
  let file: string | null = null;
  if (games.length > 0) {
    const bytes = encodeSelfPlayFile(games, {
      ...job.info,
      spec: job.spec,
      search: job.search,
    });
    fs.mkdirSync(path.dirname(job.outFile), { recursive: true });
    fs.writeFileSync(job.outFile + ".tmp", bytes);
    fs.renameSync(job.outFile + ".tmp", job.outFile);
    file = job.outFile;
  }
  return {
    file,
    games: games.length,
    failedGames,
    positions: games.reduce((n, g) => n + g.positions.length, 0),
    policyPositions: games.reduce(
      (n, g) => n + g.positions.filter((p) => p.policy).length,
      0
    ),
    points: games.map((g) => g.points),
    numMoves: games.map((g) => g.numMoves),
    durationMs: Date.now() - start,
  };
}

if (require.main === module) {
  serveJobs<WorkerJob, WorkerResult>((job) =>
    job.type === "match" ? playMatch(job) : playSelfPlayBatch(job)
  );
}
