// Web Worker behind the arena page (components/Arena.tsx): plays the arena off
// the main thread and posts every game as soon as it ends.
import {
  ArenaBotSpec,
  ArenaExpansions,
  arenaGameOptions,
  createArenaBots,
  runArena,
} from "./arena";
import { AzModel, ModelManifest, decodeParams } from "./network";

export type ArenaWorkerRequest = {
  // AZ bots name a model (under weights/), fetched from /api/bot-model.
  bots: (Omit<ArenaBotSpec, "model"> & { name: string; modelFile?: string })[];
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

async function fetchModel(modelFile: string): Promise<AzModel> {
  const url = (part: string) =>
    `/api/bot-model?file=${encodeURIComponent(modelFile)}&part=${part}`;
  const [manifest, params] = await Promise.all([
    fetch(url("manifest")).then((r) => {
      if (!r.ok) {
        throw new Error(`Unable to load the model ${modelFile}`);
      }
      return r.json() as Promise<ModelManifest>;
    }),
    fetch(url("params")).then((r) => r.arrayBuffer()),
  ]);
  return new AzModel(manifest, decodeParams(params));
}

ctx.onmessage = async ({ data }: MessageEvent<ArenaWorkerRequest>) => {
  try {
    const specs: ArenaBotSpec[] = await Promise.all(
      data.bots.map(async ({ modelFile, ...spec }) => ({
        ...spec,
        model: modelFile ? await fetchModel(modelFile) : null,
      }))
    );
    runArena({
      bots: createArenaBots(specs, data.seed),
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
