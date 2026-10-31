// A Bot that searches with MCTS on K determinizations of the hidden
// information and plays the most visited move (MCTS_V and AZ).
import { GameState } from "../model/gameState";
import { GameInput } from "../model/types";
import { Rng, random, withRng } from "../model/random";
import { Bot } from "./bot";
import { determinize } from "./determinize";
import { Evaluator, runMcts, sampleIndex, visitPolicy } from "./mcts";
import { EverdellSearchGame, SEARCH_MAX_PER_INPUT } from "./everdellGame";

export const DEFAULT_SIMULATIONS = 200;
export const DEFAULT_C_PUCT = 1.5;

export type MctsBotOptions = {
  name?: string;
  rng?: Rng;
  evaluator: Evaluator<GameState, GameInput>;
  // Per determinization.
  simulations?: number;
  determinizations?: number;
  cPuct?: number;
  fpuValue?: "parent" | "zero";
  maxPerInput?: number;
};

export type SearchOverrides = {
  simulations?: number;
  determinizations?: number;
  // Root exploration noise (self-play only).
  dirichletAlpha?: number;
  dirichletEpsilon?: number;
};

export type MctsSearch = {
  // The root moves, as passed in.
  moves: GameInput[];
  keys: (string | null)[];
  // Summed over determinizations.
  visits: number[];
  // Mean value of each move for the player to move (null: never visited).
  moveValues: (number | null)[];
  // Mean value per seat at the root, averaged over determinizations.
  rootValue: number[];
  // Seat to move.
  player: number;
};

export class MctsBot implements Bot {
  readonly name: string;
  private readonly rng: Rng;
  private readonly evaluator: Evaluator<GameState, GameInput>;
  private readonly simulations: number;
  private readonly determinizations: number;
  private readonly cPuct: number;
  private readonly fpuValue: "parent" | "zero";
  private readonly maxPerInput: number;

  constructor({
    name = "MCTS",
    rng = random,
    evaluator,
    simulations = DEFAULT_SIMULATIONS,
    determinizations = 1,
    cPuct = DEFAULT_C_PUCT,
    fpuValue = "parent",
    maxPerInput = SEARCH_MAX_PER_INPUT,
  }: MctsBotOptions) {
    this.name = name;
    this.rng = rng;
    this.evaluator = evaluator;
    this.simulations = simulations;
    this.determinizations = determinizations;
    this.cPuct = cPuct;
    this.fpuValue = fpuValue;
    this.maxPerInput = maxPerInput;
  }

  chooseMove(gameState: GameState, legalMoves: GameInput[]): GameInput {
    if (legalMoves.length === 0) {
      throw new Error("No legal moves to choose from");
    }
    if (legalMoves.length === 1) {
      return legalMoves[0];
    }
    const search = this.search(gameState, legalMoves);
    return legalMoves[pickMove(search, 0, this.rng)];
  }

  /**
   * Runs one search per determinization of what the active player cannot see,
   * every one rooted at `legalMoves`, and sums the root visits by move.
   */
  search(
    gameState: GameState,
    legalMoves: GameInput[],
    overrides: SearchOverrides = {}
  ): MctsSearch {
    const {
      simulations = this.simulations,
      determinizations = this.determinizations,
      dirichletAlpha,
      dirichletEpsilon,
    } = overrides;
    const me = gameState.activePlayerId;
    const visits = legalMoves.map(() => 0);
    const valueSums = legalMoves.map(() => 0);
    const rootValue = gameState.players.map(() => 0);
    let keys: (string | null)[] = legalMoves.map(() => null);
    let player = gameState.players.findIndex((p) => p.playerId === me);

    // Engine randomness during the search (eg. reshuffling the discard pile)
    // must come from the bot, not from the game being played.
    withRng(this.rng, () => {
      for (let k = 0; k < determinizations; k++) {
        const root = determinize(gameState, me, this.rng);
        const game = new EverdellSearchGame(root, {
          rng: this.rng,
          maxPerInput: this.maxPerInput,
        });
        const result = runMcts(game, this.evaluator, root, {
          simulations,
          cPuct: this.cPuct,
          fpuValue: this.fpuValue,
          rootDirichletAlpha: dirichletAlpha,
          rootDirichletEpsilon: dirichletEpsilon,
          rng: this.rng,
          rootActions: legalMoves,
        });
        keys = result.keys;
        player = result.player;
        result.visits.forEach((n, i) => {
          visits[i] += n;
          const value = result.childValues[i];
          if (value) {
            valueSums[i] += value[player] * n;
          }
        });
        result.rootValue.forEach((v, seat) => {
          rootValue[seat] += v / determinizations;
        });
      }
    });

    return {
      moves: legalMoves,
      keys,
      visits,
      moveValues: visits.map((n, i) => (n > 0 ? valueSums[i] / n : null)),
      rootValue,
      player,
    };
  }
}

/**
 * Index of the move to play: temperature 0 = most visited (ties broken by
 * value, then at random), otherwise sampled from N^(1/temperature).
 */
export function pickMove(
  search: MctsSearch,
  temperature: number,
  rng: Rng
): number {
  const { visits, moveValues } = search;
  if (temperature > 0) {
    return sampleIndex(visitPolicy(visits, temperature), rng);
  }
  const maxVisits = Math.max(...visits);
  const value = (i: number) => moveValues[i] ?? -Infinity;
  const mostVisited = visits
    .map((_, i) => i)
    .filter((i) => visits[i] === maxVisits);
  const maxValue = Math.max(...mostVisited.map(value));
  const best = mostVisited.filter((i) => value(i) === maxValue);
  // Without any signal (eg. equal values everywhere) the first enumerated
  // move would always win the tie: a strong systematic bias.
  return best.length === 1 ? best[0] : best[Math.floor(rng() * best.length)];
}
