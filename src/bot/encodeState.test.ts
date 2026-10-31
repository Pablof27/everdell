import expect from "expect.js";
import { GameState } from "../model/gameState";
import { testInitialGameState } from "../model/testHelpers";
import {
  CardName,
  GameInputType,
  LocationName,
  ResourceType,
} from "../model/types";
import {
  STATE_DIM,
  encodeState,
  encodeStateRaw,
  featureNames,
  featureScales,
  stateDim,
} from "./encodeState";
import { randomPlayPositions } from "./botTestHelpers";

const NAMES = featureNames(2);

function blockRange(prefix: string): [number, number] {
  const first = NAMES.findIndex((n) => n.startsWith(prefix + "."));
  let last = first;
  while (last + 1 < NAMES.length && NAMES[last + 1].startsWith(prefix + ".")) {
    last++;
  }
  return [first, last + 1];
}

function slice(x: ArrayLike<number>, [a, b]: [number, number]): number[] {
  return Array.from(x).slice(a, b);
}

describe("encodeState", () => {
  let positions: { gameState: GameState }[];

  before(function () {
    this.timeout(60000);
    positions = randomPlayPositions({ numGames: 20, seed: 3 });
  });

  it("has the documented size and one name and scale per feature", () => {
    expect(STATE_DIM).to.be(852);
    expect(stateDim(3)).to.be(852 + 150);
    expect(NAMES.length).to.be(STATE_DIM);
    expect(new Set(NAMES).size).to.be(STATE_DIM);
    expect(featureScales(2).length).to.be(STATE_DIM);
  });

  it("encodes every position of 20 random games into small finite values", () => {
    expect(positions.length > 1000).to.be(true);
    positions.forEach(({ gameState }) => {
      gameState.players.forEach((_, seat) => {
        const x = encodeState(gameState, seat);
        expect(x.length).to.be(STATE_DIM);
        x.forEach((v, i) => {
          if (!(Number.isFinite(v) && v >= 0 && v <= 3.5)) {
            throw new Error(`${NAMES[i]} = ${v}`);
          }
        });
      });
    });
  });

  it("does not leak the opponent's hand", () => {
    const gameState = testInitialGameState({
      cardsInHand: [CardName.FARM, CardName.KING],
    });
    const opponent = gameState.players[1];
    const before = encodeStateRaw(gameState, 0);

    // Different cards, same hand size: nothing changes.
    opponent.removeCardFromHand(gameState, CardName.FARM, false);
    opponent.addCardToHand(gameState, CardName.QUEEN);
    expect(Array.from(encodeStateRaw(gameState, 0))).to.eql(Array.from(before));

    // 3 more cards: only their hand size changes.
    [CardName.CASTLE, CardName.PALACE, CardName.WIFE].forEach((c) =>
      opponent.addCardToHand(gameState, c)
    );
    const after = encodeStateRaw(gameState, 0);
    const changed = NAMES.filter((_, i) => after[i] !== before[i]);
    expect(changed).to.eql(["opp1.handSize"]);
  });

  it("swaps the me and opponent blocks between the two seats", () => {
    positions.slice(0, 300).forEach(({ gameState }) => {
      const x0 = encodeStateRaw(gameState, 0);
      const x1 = encodeStateRaw(gameState, 1);
      const meNoHand = (x: Uint8Array) =>
        NAMES.map((n, i) =>
          n.startsWith("me.") && !n.startsWith("me.hand.") ? x[i] : -1
        ).filter((v) => v !== -1);
      expect(meNoHand(x0)).to.eql(slice(x1, blockRange("opp1")));
      expect(meNoHand(x1)).to.eql(slice(x0, blockRange("opp1")));
      expect(slice(x0, blockRange("board.myWorkers"))).to.eql(
        slice(x1, blockRange("board.otherWorkers"))
      );
      expect(slice(x0, blockRange("board.meadow"))).to.eql(
        slice(x1, blockRange("board.meadow"))
      );
    });
  });

  it("fills the decision block exactly when an input is pending", () => {
    let numPending = 0;
    positions.forEach(({ gameState }) => {
      const seat = gameState.players.findIndex(
        (p) => p.playerId === gameState.activePlayerId
      );
      const x = encodeStateRaw(gameState, seat);
      const decision = NAMES.map((n, i) =>
        n.startsWith("decision.") && n !== "decision.type.none" ? x[i] : 0
      );
      const pending = gameState.pendingGameInputs.length > 0;
      numPending += pending ? 1 : 0;
      expect(x[NAMES.indexOf("decision.type.none")]).to.be(pending ? 0 : 1);
      expect(decision.some((v) => v > 0)).to.be(pending);
    });
    expect(numPending > 100).to.be(true);
  });

  it("counts cards, resources, workers and pending selections", () => {
    const gameState = testInitialGameState({
      cardsInHand: [CardName.FARM, CardName.FARM],
      meadowCards: [CardName.MINE, CardName.MINE, CardName.KING],
    });
    const player = gameState.players[0];
    player.addToCity(gameState, CardName.FARM);
    player.addToCity(gameState, CardName.FARM);
    player.gainResources(gameState, { [ResourceType.BERRY]: 4 });
    const x = encodeStateRaw(gameState, 0);
    const at = (name: string) => x[NAMES.indexOf(name)];
    expect(at("me.hand.Farm")).to.be(2);
    expect(at("me.city.Farm")).to.be(2);
    expect(at("me.citySize.occupiedSpaces")).to.be(2);
    expect(at("me.resources.BERRY")).to.be(4);
    expect(at("me.season.Winter")).to.be(1);
    expect(at("me.availableWorkers")).to.be(2);
    expect(at("board.meadow.Mine")).to.be(2);
    expect(at("board.meadow.King")).to.be(1);
    expect(at("opp1.city.Farm")).to.be(0);

    const next = gameState.next({
      inputType: GameInputType.PLACE_WORKER,
      clientOptions: { location: LocationName.BASIC_ONE_BERRY },
    });
    const y = encodeStateRaw(next, 0);
    expect(y[NAMES.indexOf("board.myWorkers.ONE_BERRY")]).to.be(1);
    expect(
      encodeStateRaw(next, 1)[NAMES.indexOf("board.otherWorkers.ONE_BERRY")]
    ).to.be(1);
  });
});
