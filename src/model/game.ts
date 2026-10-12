import { generate as uuid } from "short-uuid";
import { Player, createPlayer } from "./player";
import { GameState } from "./gameState";
import { BotType, GameOptions, GameInput } from "./types";
import { GameJSON } from "./jsonTypes";
import { getGameJSONById, saveGameJSONById } from "./db";
import cloneDeep from "lodash/cloneDeep";

export class Game {
  public gameId: string;
  private gameSecret: string;
  private gameState: GameState;
  private gameOptionsDeprecated: Partial<GameOptions>;

  constructor({
    gameId,
    gameSecret,
    gameState,
    gameOptions = null,
  }: {
    gameId: string;
    gameSecret: string;
    gameState: GameState;
    gameOptions?: Partial<GameOptions> | null;
  }) {
    this.gameId = gameId;
    this.gameSecret = gameSecret;
    this.gameState = gameState;
    this.gameOptionsDeprecated = gameOptions || {};
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

  applyGameInput(gameInput: GameInput): void {
    this.gameState = this.gameState.next(gameInput);
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
  gameState: GameState
): Promise<Game> => {
  const game = new Game({
    gameId: generateNewGameId(),
    gameSecret: uuid(),
    gameState,
  });
  await game.save();
  return game;
};

export type NewGamePlayer = { name: string; botType?: BotType | null };

export const createGame = async (
  playersToCreate: NewGamePlayer[],
  gameOptions: Partial<GameOptions> = {
    realtimePoints: false,
  }
): Promise<Game> => {
  if (playersToCreate.length < 2 || playersToCreate.length > 4) {
    throw new Error(
      `Unable to create a game with ${playersToCreate.length} players`
    );
  }
  const players = playersToCreate.map(({ name, botType }) =>
    createPlayer(name, { botType })
  );
  const gameState = GameState.initialGameState({ players, gameOptions });
  const game = await createGameFromGameState(gameState);
  console.log(`Game created: ${game.gameId}`);
  return game;
};

export const getGameById = async (gameId: string): Promise<Game | null> => {
  const gameJSON = await getGameJSONById(gameId);
  return gameJSON ? Game.fromJSON(gameJSON) : null;
};
