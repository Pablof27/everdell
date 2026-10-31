import expect from "expect.js";
import cloneDeep from "lodash/cloneDeep";
import { GameState } from "../model/gameState";
import { testInitialGameState } from "../model/testHelpers";
import {
  CardName,
  EventName,
  GameInputType,
  LocationName,
  Season,
} from "../model/types";
import { createSeededRng, withRng } from "../model/random";
import { RandomBot, createBot } from "./bot";
import { playGame } from "./arena";
import { runMcts } from "./mcts";
import {
  EverdellSearchGame,
  LinearEvaluator,
  linearValues,
  terminalValues,
} from "./everdellGame";
import { MctsBot, pickMove } from "./mctsBot";
import { evaluate, handTunedWeights } from "./evaluations";
import { randomPlayPositions } from "./botTestHelpers";

// Autumn, last worker each: the mover leads 5-4 VP, both can claim the
// "4 PRODUCTION" event (+3). Claiming it wins; anything else lets the opponent
// claim it and win, unless the search wrongly assumes the opponent helps us.
function lastWorkerPosition(moverSeat: number): GameState {
  const gameState = testInitialGameState({
    meadowCards: [
      CardName.CASTLE,
      CardName.PALACE,
      CardName.EVERTREE,
      CardName.KING,
      CardName.QUEEN,
      CardName.THEATRE,
      CardName.SCHOOL,
      CardName.UNIVERSITY,
    ],
  });
  gameState.players.forEach((player, seat) => {
    const farms = seat === moverSeat ? 5 : 4;
    for (let i = 0; i < farms; i++) {
      player.addToCity(gameState, CardName.FARM);
    }
  });
  (Object.keys(gameState.locationsMap) as LocationName[]).forEach((loc) => {
    if (
      loc !== LocationName.BASIC_ONE_BERRY &&
      loc !== LocationName.BASIC_THREE_TWIGS
    ) {
      delete gameState.locationsMap[loc];
    }
  });
  const json = gameState.toJSON({ includePrivate: true, isRoot: false });
  json.players.forEach((p) => {
    p.currentSeason = Season.AUTUMN;
    p.numWorkers = 1;
    p.placedWorkers = [];
  });
  json.activePlayerId = json.players[moverSeat].playerId;
  return GameState.fromJSON(json);
}

describe("MCTS on Everdell", () => {
  it("terminal values: winner +1, loser -1, ties 0", () => {
    expect(terminalValues([10, 7])).to.eql([1, -1]);
    expect(terminalValues([7, 10])).to.eql([-1, 1]);
    expect(terminalValues([9, 9])).to.eql([0, 0]);
    expect(terminalValues([9, 9, 3])).to.eql([0, 0, -1]);
  });

  it("linear values are antisymmetric for 2 players", () => {
    const weights = handTunedWeights();
    randomPlayPositions({ numGames: 2, seed: 4 }).forEach(({ gameState }) => {
      const [v0, v1] = linearValues(gameState, weights);
      expect(Math.abs(v0 + v1) < 1e-12).to.be(true);
      expect(Math.abs(v0) <= 1).to.be(true);
    });
  });

  it("evaluator modes: root-relative, zero and greedy priors", () => {
    const weights = handTunedWeights();
    const gameState = lastWorkerPosition(1);
    const legal = new EverdellSearchGame(gameState, {
      rng: createSeededRng(1),
    }).legalActions(gameState);

    const root = new LinearEvaluator(weights, { mode: "rootPlayer" });
    root.beginSearch(gameState);
    // Relative to the root: 0 at the root, antisymmetric elsewhere.
    expect(root.evaluate(gameState, legal).values).to.eql([-0, 0]);
    const child = gameState.next(cloneDeep(legal[0]), true, true);
    const [c0, c1] = root.evaluate(child, []).values;
    expect(c0).to.be(-c1);

    const zero = new LinearEvaluator(weights, { mode: "zero" });
    expect(zero.evaluate(gameState, legal).values).to.eql([0, 0]);

    // Greedy priors rank the moves like the mover's V one move ahead.
    const greedy = new LinearEvaluator(weights, { greedyPriors: "all" });
    const priors = greedy.evaluate(gameState, legal).priors;
    const mover = gameState.activePlayerId;
    const oneply = legal.map((m) =>
      evaluate(gameState.next(cloneDeep(m), true, true), mover, weights)
    );
    const order = (xs: number[]) =>
      xs.map((_, i) => i).sort((a, b) => xs[b] - xs[a]);
    expect(order(priors)).to.eql(order(oneply));
    expect(Math.max(...priors)).to.be(1);
    const uniform = new LinearEvaluator(weights).evaluate(gameState, legal);
    expect(uniform.priors).to.eql(legal.map(() => 1));
  });

  it("runs 200 simulations on random positions, rooted at moves the engine accepts", function () {
    this.timeout(120000);
    const positions = randomPlayPositions({ numGames: 3, seed: 8 }).filter(
      (_, i) => i % 15 === 0
    );
    const evaluator = new LinearEvaluator(handTunedWeights());
    positions.forEach(({ gameState, legalMoves }) => {
      if (legalMoves.length === 0) {
        return;
      }
      const rng = createSeededRng(1);
      const game = new EverdellSearchGame(gameState, { rng });
      const result = withRng(rng, () =>
        runMcts(game, evaluator, gameState, {
          simulations: 200,
          cPuct: 1.5,
          rng,
        })
      );
      expect(result.visits.reduce((a, b) => a + b, 0)).to.be(200);
      expect(result.player).to.be(game.playerToMove(gameState));
      result.actions.forEach((move, i) => {
        if (result.valid[i]) {
          expect(() =>
            gameState.next(cloneDeep(move), true, true)
          ).to.not.throwException();
        }
      });
      result.childValues.forEach((v) => {
        if (v) {
          expect(Math.abs(v[0] + v[1]) < 1e-9).to.be(true);
        }
      });
    });
  });

  [0, 1].forEach((moverSeat) => {
    it(`plays the winning event for seat ${moverSeat} (perspective test)`, () => {
      const gameState = lastWorkerPosition(moverSeat);
      const rng = createSeededRng(3);
      const game = new EverdellSearchGame(gameState, { rng });
      expect(game.playerToMove(gameState)).to.be(moverSeat);
      const result = withRng(rng, () =>
        runMcts(game, new LinearEvaluator(handTunedWeights()), gameState, {
          simulations: 200,
          cPuct: 1.5,
          rng,
        })
      );
      const event = result.actions.findIndex(
        (m) =>
          m.inputType === GameInputType.CLAIM_EVENT &&
          m.clientOptions.event === EventName.BASIC_FOUR_PRODUCTION
      );
      expect(event).to.not.be(-1);
      expect(result.actions.length).to.be(3);
      const q = result.childValues.map((v) => (v ? v[moverSeat] : -Infinity));
      expect(q.indexOf(Math.max(...q))).to.be(event);
      expect(result.visits.indexOf(Math.max(...result.visits))).to.be(event);
      // Its mean also counts the evaluator's values from the expansions.
      expect(q[event] > 0.9).to.be(true);
      result.childValues.forEach((v, i) => {
        expect(v![1 - moverSeat]).to.be(-v![moverSeat]);
        if (i !== event) {
          // The opponent answers by claiming the event.
          expect(v![moverSeat] < 0).to.be(true);
        }
      });
    });
  });

  it("MctsBot picks the winning event with several determinizations", () => {
    const gameState = lastWorkerPosition(1);
    const bot = new MctsBot({
      rng: createSeededRng(5),
      evaluator: new LinearEvaluator(handTunedWeights()),
      simulations: 50,
      determinizations: 3,
    });
    const legalMoves = new EverdellSearchGame(gameState, {
      rng: createSeededRng(1),
    }).legalActions(gameState);
    const search = bot.search(gameState, legalMoves);
    expect(search.visits.reduce((a, b) => a + b, 0)).to.be(150);
    expect(search.player).to.be(1);
    const move = legalMoves[pickMove(search, 0, createSeededRng(1))];
    expect(move.inputType).to.be(GameInputType.CLAIM_EVENT);
    expect(bot.chooseMove(gameState, legalMoves)).to.be(move);
    expect(search.rootValue[1] > 0.5).to.be(true);
  });

  it("MCTS_V plays complete games against a random bot, reproducibly", function () {
    this.timeout(120000);
    const play = () =>
      playGame({
        bots: [
          createBot("MCTS_V", { rng: createSeededRng(1), simulations: 16 }),
          new RandomBot({ rng: createSeededRng(2) }),
        ],
        seed: 11,
      });
    const a = play();
    expect(a.finalState.isGameOver()).to.be(true);
    expect(a.numRejectedMoves).to.be(0);
    expect(play().points).to.eql(a.points);
  });

  it("does not consume the game's rng while searching", () => {
    const gameState = lastWorkerPosition(0);
    const legalMoves = new EverdellSearchGame(gameState, {
      rng: createSeededRng(1),
    }).legalActions(gameState);
    const gameRng = createSeededRng(77);
    const expected = createSeededRng(77)();
    withRng(gameRng, () =>
      createBot("MCTS_V", {
        rng: createSeededRng(1),
        simulations: 30,
      }).chooseMove(gameState, legalMoves)
    );
    expect(gameRng()).to.be(expected);
  });
});
