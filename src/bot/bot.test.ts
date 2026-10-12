import expect from "expect.js";
import { GameState } from "../model/gameState";
import { Game } from "../model/game";
import { Card } from "../model/card";
import { createPlayer } from "../model/player";
import { testInitialGameState } from "../model/testHelpers";
import {
  CardName,
  GameInput,
  GameInputPlayCard,
  GameInputType,
  GameOptions,
  LocationName,
  ResourceType,
} from "../model/types";
import {
  createSeededRng,
  random,
  sample,
  seedRng,
  setRng,
  shuffle,
  withRng,
} from "../model/random";
import { RandomBot, createBot } from "./bot";
import { getLegalMoves, legalMovesInternals } from "./legalMoves";
import { playGame, runArena } from "./arena";
import { determinize } from "./determinize";
import { playBotTurns } from "./botRunner";

const NEWLEAF_OPTIONS: Partial<GameOptions> = {
  newleaf: {
    cards: true,
    forestLocations: true,
    basicEvents: true,
    specialEvents: true,
    station: true,
    ticket: true,
    knoll: true,
    reserving: true,
    visitors: true,
  },
};

function playCardMovesFor(
  gameState: GameState,
  cardName: CardName
): GameInputPlayCard[] {
  return getLegalMoves(gameState).filter(
    (move): move is GameInputPlayCard =>
      move.inputType === GameInputType.PLAY_CARD &&
      move.clientOptions.card === cardName
  );
}

function paymentsFor(gameState: GameState, cardName: CardName) {
  return playCardMovesFor(gameState, cardName).map(
    (move) => move.clientOptions.paymentOptions
  );
}

function runRandomGames(
  numGames: number,
  gameOptions: Partial<GameOptions>,
  numPlayers = 2
) {
  const bots = [];
  for (let i = 0; i < numPlayers; i++) {
    bots.push(new RandomBot({ name: `R${i}`, rng: createSeededRng(100 + i) }));
  }
  return runArena({ bots, numGames, seed: 42, gameOptions });
}

describe("random", () => {
  afterEach(() => setRng(null));

  it("seeded rng is reproducible and in [0, 1)", () => {
    const a = createSeededRng(123);
    const b = createSeededRng(123);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).to.be(b());
      expect(x >= 0 && x < 1).to.be(true);
    }
    expect(createSeededRng(1)()).to.not.be(createSeededRng(2)());
  });

  it("shuffle returns a permutation of a copy", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = shuffle(items, createSeededRng(5));
    expect(shuffled).to.not.be(items);
    expect(items).to.eql([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort((a, b) => a - b)).to.eql(items);
    expect(shuffle(items, createSeededRng(5))).to.eql(shuffled);
  });

  it("seedRng drives the engine's shuffles", () => {
    seedRng(99);
    const deckA = testInitialGameState({ shuffleDeck: true }).deck.toJSON(true);
    seedRng(99);
    const deckB = testInitialGameState({ shuffleDeck: true }).deck.toJSON(true);
    expect(deckA.cards).to.eql(deckB.cards);
  });

  it("withRng restores the previous rng", () => {
    seedRng(1);
    const expected = createSeededRng(1)();
    withRng(createSeededRng(2), () => random());
    expect(random()).to.be(expected);
  });

  it("sample picks an element", () => {
    expect([1, 2, 3].indexOf(sample([1, 2, 3], createSeededRng(3)))).to.not.be(
      -1
    );
    expect(() => sample([])).to.throwException();
  });
});

describe("legalMoves", () => {
  describe("payment helpers", () => {
    const {
      getWildDiscountPayments,
      getJudgePayments,
      getResourceSplits,
      pickSubsets,
    } = legalMovesInternals;

    it("wild discount drops exactly k resources", () => {
      // TWIG, RESIN, PEBBLE, BERRY
      expect(getWildDiscountPayments([2, 1, 0, 0], 3)).to.eql([[0, 0, 0, 0]]);
      expect(getWildDiscountPayments([2, 1, 0, 0], 1)).to.eql([
        [2, 0, 0, 0],
        [1, 1, 0, 0],
      ]);
      const payments = getWildDiscountPayments([3, 2, 1, 0], 3);
      payments.forEach((p) => {
        expect(p.reduce((a, b) => a + b, 0)).to.be(3);
        p.forEach((n, i) => expect(n <= [3, 2, 1, 0][i]).to.be(true));
      });
      expect(payments.length).to.be(6);
    });

    it("judge swaps exactly one resource", () => {
      expect(getJudgePayments([1, 0, 0, 0])).to.eql([
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ]);
      expect(getJudgePayments([0, 0, 0, 0])).to.eql([]);
    });

    it("resource splits respect limits and totals", () => {
      expect(getResourceSplits([1, 1], 2, 2)).to.eql([[1, 1]]);
      expect(getResourceSplits([5, 5, 5, 5], 1, 1).length).to.be(4);
      expect(getResourceSplits([5, 5, 5, 5], 0, 2).length).to.be(1 + 4 + 10);
      expect(getResourceSplits([0, 0], 1, 1)).to.eql([]);
    });

    it("pickSubsets enumerates when small and samples when large", () => {
      const rng = createSeededRng(1);
      expect(pickSubsets(["a", "b", "c"], 0, 1, 64, rng)).to.eql([
        [],
        ["a"],
        ["b"],
        ["c"],
      ]);
      expect(pickSubsets(["a", "b", "c"], 2, 2, 64, rng)).to.eql([
        ["a", "b"],
        ["a", "c"],
        ["b", "c"],
      ]);
      const many = pickSubsets("abcdefghij".split(""), 0, 10, 20, rng);
      expect(many.length).to.be(20);
      const keys = many.map((s) => s.join(","));
      expect(new Set(keys).size).to.be(20);
      expect(pickSubsets(["a"], 2, 3, 64, rng)).to.eql([]);
    });
  });

  describe("PLAY_CARD payments", () => {
    let gameState: GameState;

    beforeEach(() => {
      gameState = testInitialGameState({
        meadowCards: [],
        cardsInHand: [CardName.FARM, CardName.HUSBAND],
      });
    });

    it("offers the exact cost when affordable", () => {
      const player = gameState.getActivePlayer();
      const farm = Card.fromName(CardName.FARM);
      expect(paymentsFor(gameState, CardName.FARM)).to.eql([]);
      player.gainResources(gameState, farm.baseCost);
      expect(paymentsFor(gameState, CardName.FARM)).to.eql([
        { resources: farm.baseCost },
      ]);
    });

    it("offers Judge substitutions", () => {
      const player = gameState.getActivePlayer();
      player.addToCity(gameState, CardName.JUDGE);
      // Husband costs 3 BERRY.
      player.gainResources(gameState, {
        [ResourceType.BERRY]: 2,
        [ResourceType.TWIG]: 1,
      });
      expect(paymentsFor(gameState, CardName.HUSBAND)).to.eql([
        { resources: { [ResourceType.TWIG]: 1, [ResourceType.BERRY]: 2 } },
      ]);
      player.gainResources(gameState, { [ResourceType.BERRY]: 1 });
      expect(paymentsFor(gameState, CardName.HUSBAND)).to.eql([
        { resources: { [ResourceType.BERRY]: 3 } },
        { resources: { [ResourceType.TWIG]: 1, [ResourceType.BERRY]: 2 } },
      ]);
    });

    it("offers the associated construction and Innkeeper for critters", () => {
      const player = gameState.getActivePlayer();
      player.addToCity(gameState, CardName.FARM);
      player.addToCity(gameState, CardName.INNKEEPER);
      const payments = paymentsFor(gameState, CardName.HUSBAND);
      expect(payments).to.eql([
        { useAssociatedCard: true, resources: {} },
        { cardToUse: CardName.INNKEEPER, resources: {} },
      ]);
    });

    it("offers Crane / Inventor wild discounts and Dungeon", () => {
      const player = gameState.getActivePlayer();
      player.addToCity(gameState, CardName.CRANE);
      player.addToCity(gameState, CardName.INVENTOR);
      player.addToCity(gameState, CardName.DUNGEON);
      player.addToCity(gameState, CardName.WIFE);
      // Farm costs 2 TWIG 1 RESIN, so 3 fewer ANY is free.
      const payments = paymentsFor(gameState, CardName.FARM);
      expect(payments).to.eql([
        { cardToUse: CardName.CRANE, resources: {} },
        { cardToUse: CardName.INVENTOR, resources: {} },
        { cardToDungeon: CardName.INVENTOR, resources: {} },
        { cardToDungeon: CardName.WIFE, resources: {} },
      ]);
    });

    it("offers the Queen for cheap cards only", () => {
      const player = gameState.getActivePlayer();
      player.addToCity(gameState, CardName.QUEEN);
      player.addCardToHand(gameState, CardName.KING);
      expect(paymentsFor(gameState, CardName.HUSBAND)).to.eql([
        { cardToUse: CardName.QUEEN, resources: {} },
      ]);
      expect(paymentsFor(gameState, CardName.KING)).to.eql([]);
    });

    it("only offers space-freeing payments when the city is full", () => {
      const player = gameState.getActivePlayer();
      player.addToCity(gameState, CardName.INNKEEPER);
      while (player.getNumOccupiedSpacesInCity() < player.maxCitySize) {
        player.addToCity(gameState, CardName.FARM);
      }
      player.gainResources(gameState, { [ResourceType.BERRY]: 5 });
      expect(paymentsFor(gameState, CardName.HUSBAND)).to.eql([
        { cardToUse: CardName.INNKEEPER, resources: {} },
      ]);
    });
  });

  describe("templates", () => {
    it("expands worker placements, events and season actions", () => {
      const gameState = testInitialGameState({ meadowCards: [] });
      const moves = getLegalMoves(gameState);
      const locations = moves
        .filter((m) => m.inputType === GameInputType.PLACE_WORKER)
        .map((m: any) => m.clientOptions.location);
      expect(locations).to.eql(
        gameState.getPlayableLocations().filter((l) => l !== LocationName.HAVEN)
      );
      expect(
        moves.some((m) => m.inputType === GameInputType.PREPARE_FOR_SEASON)
      ).to.be(false);
      expect(moves.some((m) => m.inputType === GameInputType.UNDO)).to.be(
        false
      );
    });

    it("returns nothing once the game is over", () => {
      const result = playGame({
        bots: [new RandomBot(), new RandomBot()],
        seed: 1,
      });
      expect(getLegalMoves(result.finalState)).to.eql([]);
    });
  });

  describe("pending inputs", () => {
    it("expands a pending SELECT_RESOURCES into every valid split", () => {
      const gameState = testInitialGameState({
        meadowCards: [],
        forestLocations: [LocationName.FOREST_TWO_WILD],
      });
      const next = gameState.next({
        inputType: GameInputType.PLACE_WORKER,
        clientOptions: { location: LocationName.FOREST_TWO_WILD },
      });
      expect(next.pendingGameInputs.length).to.be(1);
      const moves = getLegalMoves(next);
      // 2 resources over 4 types: 4 doubles + 6 pairs.
      expect(moves.length).to.be(10);
      moves.forEach((move) => {
        expect(() => next.next(move)).to.not.throwException();
      });
    });
  });
});

describe("arena", () => {
  it("plays deterministic games for a given seed", () => {
    const play = () =>
      playGame({
        bots: [
          new RandomBot({ rng: createSeededRng(1) }),
          new RandomBot({ rng: createSeededRng(2) }),
        ],
        seed: 7,
      });
    const a = play();
    const b = play();
    expect(a.finalState.isGameOver()).to.be(true);
    expect(a.points).to.eql(b.points);
    expect(a.numMoves).to.be(b.numMoves);
    expect(a.winnerSeats.length >= 1).to.be(true);
  });

  it("random bots only generate moves the engine accepts (base game)", () => {
    const summary = runRandomGames(25, {});
    expect(summary.numRejectedMoves).to.be(0);
    expect(summary.wins.reduce((a, b) => a + b, 0)).to.be(25);
  });

  it("random bots only generate moves the engine accepts (Pearlbrook)", () => {
    const summary = runRandomGames(15, { pearlbrook: true });
    expect(summary.numRejectedMoves).to.be(0);
  });

  it("random bots only generate moves the engine accepts (Bellfaire)", () => {
    const summary = runRandomGames(15, {
      bellfaire: {
        forestLocations: true,
        specialEvents: true,
        basicEvents: true,
      },
    });
    expect(summary.numRejectedMoves).to.be(0);
  });

  it("random bots finish Newleaf games (stale card options may be retried)", () => {
    const summary = runRandomGames(10, NEWLEAF_OPTIONS);
    expect(summary.numGames).to.be(10);
    expect(summary.numRejectedMoves <= 3).to.be(true);
  });

  it("supports 3 and 4 players", () => {
    expect(runRandomGames(4, {}, 3).numRejectedMoves).to.be(0);
    expect(runRandomGames(3, {}, 4).numRejectedMoves).to.be(0);
  });
});

describe("determinize", () => {
  it("re-deals hidden information only", () => {
    const gameState = testInitialGameState({ shuffleDeck: true });
    gameState.players.forEach((p) => p.drawCards(gameState, 5));
    const viewer = gameState.players[0];
    const opponent = gameState.players[1];

    const det = determinize(gameState, viewer.playerId, createSeededRng(3));
    expect(det).to.not.be(gameState);

    const detViewer = det.getPlayer(viewer.playerId);
    const detOpponent = det.getPlayer(opponent.playerId);
    expect(detViewer.getCardsInHand()).to.eql(viewer.getCardsInHand());
    expect(detOpponent.numCardsInHand).to.be(opponent.numCardsInHand);
    expect(det.meadowCards).to.eql(gameState.meadowCards);
    expect(det.deck.length).to.be(gameState.deck.length);

    const hidden = (gs: GameState) =>
      [...gs.deck.toJSON(true).cards, ...gs.players[1].getCardsInHand()].sort();
    expect(hidden(det)).to.eql(hidden(gameState));

    const unchanged: GameInput[] = getLegalMoves(gameState);
    expect(getLegalMoves(det)).to.eql(unchanged);
  });

  it("changes the deck order", () => {
    const gameState = testInitialGameState({ shuffleDeck: true });
    const before = gameState.deck.toJSON(true).cards;
    const after = determinize(
      gameState,
      gameState.players[0].playerId,
      createSeededRng(11)
    ).deck.toJSON(true).cards;
    expect(after).to.not.eql(before);
  });
});

describe("botRunner", () => {
  it("plays bot turns until a human is active", async () => {
    const gameState = GameState.initialGameState({
      players: [
        createPlayer("Bot", { botType: "RANDOM" }),
        createPlayer("Human"),
      ],
      gameOptions: {},
    });
    const game = new Game({ gameId: "test-bot", gameSecret: "s", gameState });

    const numMoves = await playBotTurns(game);
    expect(numMoves > 0).to.be(true);
    expect(game.getActivePlayer().name).to.be("Human");
    expect(game.getActivePlayer().isBot).to.be(false);
    expect(
      game.getGameState().getPlayer(gameState.players[0].playerId).isBot
    ).to.be(true);
  });

  it("createBot rejects unknown bot types", () => {
    expect(() => createBot("NOPE" as any)).to.throwException();
  });
});
