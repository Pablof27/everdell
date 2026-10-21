// Web Worker behind the arena page (components/Arena.tsx): plays the arena off
// the main thread and posts every game as soon as it ends.
import {
  ArenaBotSpec,
  ArenaExpansions,
  arenaGameOptions,
  createArenaBots,
  runArena,
} from "./arena";

export type ArenaWorkerRequest = {
  bots: (ArenaBotSpec & { name: string })[];
  numGames: number;
  seed: number;
  expansions: ArenaExpansions;
};

export type ArenaGame = {
  gameIdx: number;
  seed: number;
  // Per seat (turn order): the index of the bot playing it, its player name
  // and its points.
  botBySeat: number[];
  playerNames: string[];
  points: number[];
  winnerSeats: number[];
  numMoves: number;
  numRejectedMoves: number;
  durationMs: number;
  // GameLogEntry[] and GameStateJSON, kept as strings until a game is opened
  // (much smaller than the parsed objects).
  logJSON: string;
  finalStateJSON: string;
};

export type ArenaWorkerMessage =
  | { type: "game"; game: ArenaGame }
  | { type: "done" }
  | { type: "error"; message: string };

const ctx = (self as unknown) as Worker;
const post = (message: ArenaWorkerMessage) => ctx.postMessage(message);

ctx.onmessage = ({ data }: MessageEvent<ArenaWorkerRequest>) => {
  try {
    runArena({
      bots: createArenaBots(data.bots, data.seed),
      numGames: data.numGames,
      seed: data.seed,
      gameOptions: arenaGameOptions(data.expansions),
      recordLog: true,
      onGameEnd: ({ finalState, log, ...result }, gameIdx, botBySeat) =>
        post({
          type: "game",
          game: {
            ...result,
            gameIdx,
            botBySeat,
            playerNames: finalState.players.map((p) => p.name),
            logJSON: JSON.stringify(log),
            finalStateJSON: JSON.stringify(
              finalState.toJSON({ includePrivate: false, isRoot: true })
            ),
          },
        }),
    });
    post({ type: "done" });
  } catch (e) {
    console.error(e);
    post({ type: "error", message: (e as Error).message });
  }
};
