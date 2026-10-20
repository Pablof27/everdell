import { generate as uuid } from "short-uuid";
import { Player, createPlayer } from "./player";
import { GameState } from "./gameState";
import { BotType, GameOptions, GameInput } from "./types";
import { GameJSON } from "./jsonTypes";
import { getGameJSONById, saveGameJSONById } from "./db";
import {
  Rng,
  createSeededRng,
  deriveSeed,
  random,
  randomSeed,
  shuffle,
  withRng,
} from "./random";
import cloneDeep from "lodash/cloneDeep";

// Salts of the independent random streams derived from a game's seed.
const RNG_STREAMS = { engine: 1, bot: 2, playerOrder: 3 };

export class Game {
  public gameId: string;
  private gameSecret: string;
  private gameState: GameState;
  private gameOptionsDeprecated: Partial<GameOptions>;
  // Null for games created before seeds existed: those use Math.random.
  private seed: number | null;
  // Evaluation weights of GREEDY bots by playerId (missing: hand-tuned).
  private botWeights: Record<string, number[][]>;

  constructor({
    gameId,
    gameSecret,
    gameState,
    gameOptions = null,
    seed = null,
    botWeights = {},
  }: {
    gameId: string;
    gameSecret: string;
    gameState: GameState;
    gameOptions?: Partial<GameOptions> | null;
    seed?: number | null;
    botWeights?: Record<string, number[][]>;
  }) {
    this.gameId = gameId;
    this.gameSecret = gameSecret;
    this.gameState = gameState;
    this.gameOptionsDeprecated = gameOptions || {};
    this.seed = seed;
    this.botWeights = botWeights;
  }

  get gameSecretUNSAFE(): string {
    return this.gameSecret;
  }

  isGameOver(): boolean {
    return this.gameState.isGameOver();
  }

  getPlayer(playerId: string): Player {
    return this.gameState.getPlayer(playerId);
  }

  getActivePlayer(): Player {
    return this.gameState.getActivePlayer();
  }

  getGameInputs(): GameInput[] {
    return this.gameState.getPossibleGameInputs();
  }

  getGameState(): GameState {
    return this.gameState;
  }

  getGameStateId(): number {
    return this.gameState.gameStateId;
  }

  getBotWeights(playerId: string): number[][] | undefined {
    return this.botWeights[playerId];
  }

  // Runs fn with the engine rng (also passed to fn) seeded from (seed, stream,
  // gameStateId): replaying the same inputs replays the same shuffles and bot moves.
  withGameRng<T>(stream: "engine" | "bot", fn: (rng: Rng) => T): T {
    if (this.seed === null) {
      return fn(random);
    }
    const rng = createSeededRng(
      deriveSeed(this.seed, RNG_STREAMS[stream], this.gameState.gameStateId)
    );
    return withRng(rng, () => fn(rng));
  }

  applyGameInput(gameInput: GameInput): void {
    this.gameState = this.withGameRng("engine", () =>
      this.gameState.next(gameInput)
    );
  }

  async save(): Promise<void> {
    await saveGameJSONById(this.gameId, this.toJSON(true /* includePrivate */));
  }

  toJSON(includePrivate: boolean): GameJSON {
    return cloneDeep({
      gameId: this.gameId,
      gameSecret: "",
      gameState: this.gameState.toJSON({ includePrivate, isRoot: true }),
      // Deprecated, remove after 3/1/21
      gameOptions: this.gameOptionsDeprecated,
      ...(includePrivate
        ? {
            gameSecret: this.gameSecret,
            seed: this.seed,
            botWeights: this.botWeights,
          }
        : {}),
    });
  }

  getPlayerBySecret(playerSecret: string): Player | undefined {
    return this.gameState.players.find(
      (p) => p.playerSecretUNSAFE === playerSecret
    );
  }

  static fromJSON(gameJSON: GameJSON): Game {
    return new Game({
      ...gameJSON,
      gameState: GameState.fromJSON(gameJSON.gameState),
    });
  }
}

function generateNewGameId(): string {
  return `v3:${uuid()}`;
}

export const createGameFromGameState = async (
  gameState: GameState,
  opts: { seed?: number | null; botWeights?: Record<string, number[][]> } = {}
): Promise<Game> => {
  const game = new Game({
    gameId: generateNewGameId(),
    gameSecret: uuid(),
    gameState,
    ...opts,
  });
  await game.save();
  return game;
};

export type NewGamePlayer = {
  name: string;
  botType?: BotType | null;
  // GREEDY evaluation weights; omit for the hand-tuned ones.
  botWeights?: number[][] | null;
};

export const createGame = async (
  playersToCreate: NewGamePlayer[],
  gameOptions: Partial<GameOptions> = {
    realtimePoints: false,
  },
  {
    seed = randomSeed(),
    randomizePlayerOrder = false,
  }: { seed?: number; randomizePlayerOrder?: boolean } = {}
): Promise<Game> => {
  if (playersToCreate.length < 2 || playersToCreate.length > 4) {
    throw new Error(
      `Unable to create a game with ${playersToCreate.length} players`
    );
  }
  const seating = randomizePlayerOrder
    ? shuffle(
        playersToCreate,
        createSeededRng(deriveSeed(seed, RNG_STREAMS.playerOrder))
      )
    : playersToCreate;
  const players = seating.map(({ name, botType }) =>
    createPlayer(name, { botType })
  );
  const botWeights: Record<string, number[][]> = {};
  seating.forEach(({ botWeights: weights }, idx) => {
    if (weights) {
      botWeights[players[idx].playerId] = weights;
    }
  });
  // Seeded like arena.ts playGame, so a seed deals the same setup in both.
  const gameState = withRng(createSeededRng(seed), () =>
    GameState.initialGameState({ players, gameOptions })
  );
  const game = await createGameFromGameState(gameState, { seed, botWeights });
  console.log(`Game created: ${game.gameId} (seed ${seed})`);
  return game;
};

export const getGameById = async (gameId: string): Promise<Game | null> => {
  const gameJSON = await getGameJSONById(gameId);
  return gameJSON ? Game.fromJSON(gameJSON) : null;
};
