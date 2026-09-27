import { GameState } from "../model/gameState";
import { GameInput, BotType } from "../model/types";
import { Rng, random, sample } from "../model/random";

export interface Bot {
  readonly name: string;
  // `legalMoves` is `getLegalMoves(gameState)`, precomputed by the caller.
  chooseMove(gameState: GameState, legalMoves: GameInput[]): GameInput;
}

export class RandomBot implements Bot {
  readonly name: string;
  private rng: Rng;

  constructor({
    name = "Random",
    rng = random,
  }: { name?: string; rng?: Rng } = {}) {
    this.name = name;
    this.rng = rng;
  }

  chooseMove(_gameState: GameState, legalMoves: GameInput[]): GameInput {
    if (legalMoves.length === 0) {
      throw new Error("No legal moves to choose from");
    }
    return sample(legalMoves, this.rng);
  }
}

export function createBot(botType: BotType, opts: { rng?: Rng } = {}): Bot {
  switch (botType) {
    case "RANDOM":
      return new RandomBot(opts);
    default:
      throw new Error(`Unknown bot type: ${botType}`);
  }
}
