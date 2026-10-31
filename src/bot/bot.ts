import { GameState } from "../model/gameState";
import { GameInput, BotType } from "../model/types";
import { Rng, random, sample } from "../model/random";
import { GreedyBot } from "./greedyBot";
import { Weights, handTunedWeights } from "./evaluations";
import { MctsBot } from "./mctsBot";
import { LinearEvaluator, LinearValueMode } from "./everdellGame";
import { AzModel, NetworkEvaluator } from "./network";

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

export type CreateBotOptions = {
  name?: string;
  rng?: Rng;
  // GREEDY evaluation / MCTS_V leaf evaluation (default: hand-tuned).
  weights?: Weights;
  // MCTS_V and AZ: simulations per search, searches (determinizations) per move.
  simulations?: number;
  determinizations?: number;
  cPuct?: number;
  // MCTS_V: temperature of tanh(ΔV / temperature), value mode, and whether to
  // resolve pending sub-inputs greedily at the leaves (see LinearEvaluator).
  valueTemperature?: number;
  valueMode?: LinearValueMode;
  resolvePending?: boolean;
  greedyPriors?: "none" | "pending" | "all";
  priorTemperature?: number;
  // AZ: the policy/value network.
  model?: AzModel;
};

export function createBot(botType: BotType, opts: CreateBotOptions = {}): Bot {
  const { name, rng, simulations, determinizations, cPuct } = opts;
  switch (botType) {
    case "RANDOM":
      return new RandomBot(opts);
    case "GREEDY":
      return new GreedyBot({ name: opts.name, rng: opts.rng, weights: opts.weights ?? handTunedWeights() });
    case "MCTS_V":
      return new MctsBot({
        name: name ?? "MCTS_V",
        rng,
        simulations,
        determinizations,
        cPuct,
        evaluator: new LinearEvaluator(opts.weights ?? handTunedWeights(), {
          temperature: opts.valueTemperature,
          mode: opts.valueMode,
          resolvePending: opts.resolvePending,
          greedyPriors: opts.greedyPriors,
          priorTemperature: opts.priorTemperature,
          rng,
        }),
      });
    case "AZ":
      if (!opts.model) {
        throw new Error("An AZ bot needs a model");
      }
      return new MctsBot({
        name: name ?? "AZ",
        rng,
        simulations,
        determinizations,
        cPuct,
        evaluator: new NetworkEvaluator(opts.model),
      });
    default:
      throw new Error(`Unknown bot type: ${botType}`);
  }
}
