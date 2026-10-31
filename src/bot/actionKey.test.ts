import expect from "expect.js";
import { testInitialGameState } from "../model/testHelpers";
import {
  CardName,
  GameInput,
  GameInputType,
  ResourceType,
} from "../model/types";
import {
  ACTION_KEYS,
  ACTION_KEY_INDEX,
  NUM_ACTION_KEYS,
  actionKey,
} from "./actionKey";
import { getLegalMoves } from "./legalMoves";
import { randomPlayPositions } from "./botTestHelpers";

describe("actionKey", () => {
  it("builds a vocabulary of unique keys from the enums", () => {
    expect(NUM_ACTION_KEYS).to.be(868);
    expect(new Set(ACTION_KEYS).size).to.be(NUM_ACTION_KEYS);
    expect(ACTION_KEY_INDEX.get(ACTION_KEYS[100])).to.be(100);
  });

  const expansions: [string, object, number][] = [
    ["base game", {}, 200],
    ["Pearlbrook", { pearlbrook: true }, 20],
    [
      "Newleaf",
      {
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
      },
      20,
    ],
  ];

  expansions.forEach(([label, gameOptions, numGames]) => {
    it(`keys every legal move of ${numGames} random games (${label}) deterministically`, function () {
      this.timeout(120000);
      const positions = randomPlayPositions({
        numGames,
        seed: 11,
        gameOptions,
      });
      let numDecisions = 0;
      let numUnkeyed = 0;
      const byType: Record<string, number> = {};
      positions.forEach(({ gameState, legalMoves }) => {
        if (legalMoves.length === 0) {
          return;
        }
        numDecisions++;
        const keys = legalMoves.map((m) => actionKey(gameState, m));
        keys.forEach((key, i) => {
          if (key !== null && !ACTION_KEY_INDEX.has(key)) {
            throw new Error(
              `Key ${key} is not in the vocabulary: ${JSON.stringify(
                legalMoves[i]
              )}`
            );
          }
        });
        expect(legalMoves.map((m) => actionKey(gameState, m))).to.eql(keys);
        if (keys.every((k) => k === null)) {
          numUnkeyed++;
          const type = legalMoves[0].inputType;
          byType[type] = (byType[type] || 0) + 1;
        }
      });
      console.log(
        `      ${label}: ${numDecisions} decisions, ` +
          `${((100 * numUnkeyed) / numDecisions).toFixed(1)}% set-valued ` +
          JSON.stringify(byType)
      );
      expect(numUnkeyed > 0).to.be(true);
      expect(numUnkeyed < numDecisions / 2).to.be(true);
    });
  });

  it("collapses the source and payment of a card into one key", () => {
    const gameState = testInitialGameState({
      cardsInHand: [CardName.FARM],
      meadowCards: [CardName.FARM, CardName.MINE],
    });
    const player = gameState.getActivePlayer();
    player.addToCity(gameState, CardName.JUDGE);
    player.gainResources(gameState, {
      [ResourceType.TWIG]: 3,
      [ResourceType.RESIN]: 2,
    });
    const farmMoves = getLegalMoves(gameState).filter(
      (m) =>
        m.inputType === GameInputType.PLAY_CARD &&
        m.clientOptions.card === CardName.FARM
    );
    const sources = new Set(
      farmMoves.map((m: any) => m.clientOptions.source as string)
    );
    expect(sources.has("HAND") && sources.has("MEADOW")).to.be(true);
    expect(farmMoves.length > 2).to.be(true);
    farmMoves.forEach((m) =>
      expect(actionKey(gameState, m)).to.be("PLAY:Farm")
    );
  });

  it("tells own and opponents' destination cards apart", () => {
    const gameState = testInitialGameState();
    const [me, opponent] = gameState.players;
    me.addToCity(gameState, CardName.INN);
    opponent.addToCity(gameState, CardName.INN);
    const visit = (owner: string): GameInput => ({
      inputType: GameInputType.VISIT_DESTINATION_CARD,
      clientOptions: {
        playedCard: { cardOwnerId: owner, cardName: CardName.INN, workers: [] },
      },
    });
    expect(actionKey(gameState, visit(me.playerId))).to.be("VISIT:Inn:own");
    expect(actionKey(gameState, visit(opponent.playerId))).to.be(
      "VISIT:Inn:opp"
    );
  });
});
