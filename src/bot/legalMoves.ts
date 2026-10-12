import { GameState } from "../model/gameState";
import { Player } from "../model/player";
import { Card } from "../model/card";
import { Location } from "../model/location";
import { sumResources } from "../model/gameStatePlayHelpers";
import { Rng, random, shuffle } from "../model/random";
import { assertUnreachable } from "../utils";
import {
  CardCost,
  CardName,
  CardPaymentOptions,
  CardWithSource,
  EventName,
  GameInput,
  GameInputMultiStep,
  GameInputPlayCard,
  GameInputType,
  LocationName,
  ResourceType,
  RiverDestinationName,
} from "../model/types";

export type LegalMovesOptions = {
  // Cap on the number of moves generated for a single combinatorial input
  // (card subsets, resource splits). Above the cap, moves are sampled.
  maxPerInput?: number;
  rng?: Rng;
};

const DEFAULT_MAX_PER_INPUT = 64;

// Their play() throws with an empty hand, but the engine lists them anyway.
const LOCATIONS_NEEDING_CARDS_IN_HAND: LocationName[] = [
  LocationName.HAVEN,
  LocationName.FOREST_DISCARD_ANY_THEN_DRAW_TWO_PER_CARD,
  LocationName.FOREST_DISCARD_UP_TO_THREE_CARDS_TO_GAIN_WILD_PER_CARD,
];

// Order used for the resource vectors below.
const PAYABLE_RESOURCES = [
  ResourceType.TWIG,
  ResourceType.RESIN,
  ResourceType.PEBBLE,
  ResourceType.BERRY,
] as const;
type PayableResource = typeof PAYABLE_RESOURCES[number];
type ResourceVec = number[];

type PaymentDiscount = "ANY 3" | "ANY 1" | "BERRY" | null;

/**
 * Expands the input templates returned by `gameState.getPossibleGameInputs()`
 * into concrete `GameInput`s that `gameState.next()` will accept.
 */
export function getLegalMoves(
  gameState: GameState,
  opts: LegalMovesOptions = {}
): GameInput[] {
  const { maxPerInput = DEFAULT_MAX_PER_INPUT, rng = random } = opts;
  if (gameState.isGameOver()) {
    return [];
  }
  const player = gameState.getActivePlayer();
  const moves: GameInput[] = [];

  if (gameState.pendingGameInputs.length !== 0) {
    gameState.pendingGameInputs.forEach((pendingInput) => {
      moves.push(
        ...getPendingInputMoves(gameState, pendingInput, maxPerInput, rng)
      );
    });
    return dedupeMoves(moves);
  }

  gameState.getPossibleGameInputs().forEach((template) => {
    switch (template.inputType) {
      case GameInputType.PLACE_WORKER:
        gameState
          .getPlayableLocations()
          .filter((location) => canTriggerLocation(gameState, location))
          .forEach((location) => {
            moves.push({
              inputType: GameInputType.PLACE_WORKER,
              clientOptions: { location },
            });
          });
        break;
      case GameInputType.VISIT_DESTINATION_CARD:
        gameState.getVisitableDestinationCards().forEach((playedCard) => {
          moves.push({
            inputType: GameInputType.VISIT_DESTINATION_CARD,
            clientOptions: { playedCard },
          });
        });
        break;
      case GameInputType.CLAIM_EVENT:
        gameState.getClaimableEvents().forEach((event) => {
          moves.push({
            inputType: GameInputType.CLAIM_EVENT,
            clientOptions: { event },
          });
        });
        break;
      case GameInputType.PLAY_CARD:
        gameState.getPlayableCards().forEach((cardWithSource) => {
          moves.push(...getPlayCardMoves(player, cardWithSource));
        });
        break;
      case GameInputType.PLAY_ADORNMENT:
        gameState.getPlayableAdornments().forEach((adornment) => {
          moves.push({
            inputType: GameInputType.PLAY_ADORNMENT,
            clientOptions: { adornment },
          });
        });
        break;
      case GameInputType.PLACE_AMBASSADOR:
        gameState.getPlayableAmbassadorLocations().forEach((loc) => {
          moves.push({
            inputType: GameInputType.PLACE_AMBASSADOR,
            clientOptions: { loc },
          });
        });
        break;
      case GameInputType.PLAY_TRAIN_TICKET:
        player.getRecallableWorkers().forEach((selectedOption) => {
          moves.push({
            inputType: GameInputType.PLAY_TRAIN_TICKET,
            clientOptions: { selectedOption },
          });
        });
        break;
      case GameInputType.RESERVE_CARD:
        gameState.getCardsWithSource(false, false).forEach((selectedOption) => {
          moves.push({
            inputType: GameInputType.RESERVE_CARD,
            clientOptions: { selectedOption },
          });
        });
        break;
      case GameInputType.PREPARE_FOR_SEASON:
      case GameInputType.GAME_END:
        moves.push(template);
        break;
      case GameInputType.UNDO:
        // Never offered to bots.
        break;
      default:
        // Multi-step inputs only appear via pendingGameInputs (handled above).
        break;
    }
  });

  return dedupeMoves(moves);
}

// ---------------------------------------------------------------------------
// PLAY_CARD payments
// ---------------------------------------------------------------------------

function getPlayCardMoves(
  player: Player,
  cardWithSource: CardWithSource
): GameInputPlayCard[] {
  const card = Card.fromName(cardWithSource.card);
  const cost = toResourceVec(card.baseCost);
  const have = PAYABLE_RESOURCES.map((r) => player.getNumResourcesByType(r));
  const hasJudge = player.hasCardInCity(CardName.JUDGE);
  const payments: CardPaymentOptions[] = [];

  const addResourcePayments = (
    discount: PaymentDiscount,
    extra: Omit<CardPaymentOptions, "resources"> = {}
  ) => {
    getResourcePayments(cost, have, discount, hasJudge).forEach((vec) => {
      payments.push({ ...extra, resources: toCardCost(vec) });
    });
  };

  addResourcePayments(cardWithSource.source === "RESERVED" ? "ANY 1" : null);

  if (card.isCritter) {
    const associated = card.associatedCard;
    if (
      player.hasUnoccupiedConstruction(CardName.EVERTREE) ||
      (associated.type === "CARD" &&
        player.hasUnoccupiedConstruction(associated.cardName))
    ) {
      payments.push({ useAssociatedCard: true, resources: {} });
    }
    uniq(player.getUnoccupiedConstructionUsingGoldenLeaf(card.name)).forEach(
      (occupyCardWithGoldenLeaf) => {
        payments.push({ occupyCardWithGoldenLeaf, resources: {} });
      }
    );
    if (
      player.hasCardInCity(CardName.INNKEEPER) &&
      (card.baseCost[ResourceType.BERRY] || 0) > 0
    ) {
      addResourcePayments("BERRY", { cardToUse: CardName.INNKEEPER });
    }
  }
  if (card.isConstruction && player.hasCardInCity(CardName.CRANE)) {
    addResourcePayments("ANY 3", { cardToUse: CardName.CRANE });
  }
  if (player.hasCardInCity(CardName.INVENTOR)) {
    addResourcePayments("ANY 3", { cardToUse: CardName.INVENTOR });
  }
  if (
    card.baseVP <= 3 &&
    player.hasCardInCity(CardName.QUEEN) &&
    player.canPlaceWorkerOnCard(player.getFirstPlayedCard(CardName.QUEEN))
  ) {
    payments.push({ cardToUse: CardName.QUEEN, resources: {} });
  }
  if (player.canInvokeDungeon()) {
    const dungeon = player.getFirstPlayedCard(CardName.DUNGEON);
    const isSecondSpot = (dungeon.pairedCards?.length || 0) === 1;
    uniq(player.getPlayedCritters().map((x) => x.cardName))
      .filter((name) => !(isSecondSpot && name === CardName.RANGER))
      .forEach((cardToDungeon) => {
        addResourcePayments("ANY 3", { cardToDungeon });
      });
  }

  const fitsAfterRemoving = new Map<CardName, boolean>();
  const fitsInCity = (paymentOptions: CardPaymentOptions): boolean => {
    if (player.canAddToCity(card.name, true /* strict */)) {
      return true;
    }
    // A full city only accepts payments that remove a card that actually frees a space
    // (not e.g. a Wanderer, or a Husband sharing a space with a Wife).
    const removed =
      paymentOptions.cardToDungeon ??
      (paymentOptions.cardToUse === CardName.INNKEEPER ||
      paymentOptions.cardToUse === CardName.CRANE ||
      paymentOptions.cardToUse === CardName.INVENTOR
        ? paymentOptions.cardToUse
        : undefined);
    if (!removed) {
      return false;
    }
    if (!fitsAfterRemoving.has(removed)) {
      const json = player.toJSON(true);
      const after = Player.fromJSON({
        ...json,
        playedCards: {
          ...json.playedCards,
          [removed]: (json.playedCards[removed] || []).slice(1),
        },
      });
      fitsAfterRemoving.set(removed, after.canAddToCity(card.name, true));
    }
    return fitsAfterRemoving.get(removed)!;
  };

  return payments
    .filter(fitsInCity)
    .map((paymentOptions) => ({
      inputType: GameInputType.PLAY_CARD,
      clientOptions: {
        card: cardWithSource.card,
        source: cardWithSource.source,
        ...(cardWithSource.sourceIdx !== undefined
          ? { sourceIdx: cardWithSource.sourceIdx }
          : {}),
        paymentOptions,
      },
    }));
}

// Every distinct payment the player can afford that
// `Player.validatePaidResources` accepts for the given discount.
function getResourcePayments(
  cost: ResourceVec,
  have: ResourceVec,
  discount: PaymentDiscount,
  hasJudge: boolean
): ResourceVec[] {
  let candidates: ResourceVec[];
  switch (discount) {
    case "ANY 3":
      candidates = getWildDiscountPayments(cost, 3);
      break;
    case "ANY 1":
      candidates = getWildDiscountPayments(cost, 1);
      break;
    case "BERRY": {
      const berryIdx = PAYABLE_RESOURCES.indexOf(ResourceType.BERRY);
      const reduced = cost.slice();
      reduced[berryIdx] = Math.max(0, reduced[berryIdx] - 3);
      candidates = [reduced];
      break;
    }
    case null:
      candidates = [cost, ...(hasJudge ? getJudgePayments(cost) : [])];
      break;
    default:
      assertUnreachable(discount, `Unexpected discount: ${discount}`);
  }
  return dedupeVecs(
    candidates.filter((vec) => vec.every((n, i) => n <= have[i]))
  );
}

// All ways of paying `cost` with `k` fewer resources of any type.
function getWildDiscountPayments(cost: ResourceVec, k: number): ResourceVec[] {
  if (sum(cost) <= k) {
    return [cost.map(() => 0)];
  }
  const ret: ResourceVec[] = [];
  const recurse = (idx: number, remaining: number, acc: ResourceVec) => {
    if (idx === cost.length) {
      if (remaining === 0) {
        ret.push(acc.slice());
      }
      return;
    }
    const maxDrop = Math.min(cost[idx], remaining);
    for (let drop = 0; drop <= maxDrop; drop++) {
      acc.push(cost[idx] - drop);
      recurse(idx + 1, remaining - drop, acc);
      acc.pop();
    }
  };
  recurse(0, k, []);
  return ret;
}

// Judge: replace exactly 1 resource of the cost with 1 of another type.
function getJudgePayments(cost: ResourceVec): ResourceVec[] {
  const ret: ResourceVec[] = [];
  cost.forEach((count, fromIdx) => {
    if (count === 0) {
      return;
    }
    cost.forEach((_, toIdx) => {
      if (toIdx === fromIdx) {
        return;
      }
      const vec = cost.slice();
      vec[fromIdx] -= 1;
      vec[toIdx] += 1;
      ret.push(vec);
    });
  });
  return ret;
}

// ---------------------------------------------------------------------------
// Pending (multi-step) inputs
// ---------------------------------------------------------------------------

function getPendingInputMoves(
  gameState: GameState,
  pending: GameInputMultiStep,
  maxPerInput: number,
  rng: Rng
): GameInputMultiStep[] {
  const player = gameState.getActivePlayer();
  switch (pending.inputType) {
    case GameInputType.SELECT_OPTION_GENERIC:
      return pending.options.map((selectedOption) => ({
        ...pending,
        clientOptions: { selectedOption },
      }));
    case GameInputType.SELECT_PLAYER: {
      const choices: (string | null)[] = [...pending.playerOptions];
      if (!pending.mustSelectOne) {
        choices.push(null);
      }
      return choices.map((selectedPlayer) => ({
        ...pending,
        clientOptions: { selectedPlayer },
      }));
    }
    case GameInputType.SELECT_LOCATION:
      // Selecting a location always means "activate it".
      return pending.locationOptions
        .filter((location) => canTriggerLocation(gameState, location))
        .map((selectedLocation) => ({
          ...pending,
          clientOptions: { selectedLocation },
        }));
    case GameInputType.SELECT_VISITOR:
      return pending.visitorOptions.map((selectedVisitor) => ({
        ...pending,
        clientOptions: { selectedVisitor },
      }));
    case GameInputType.SELECT_PLAYED_ADORNMENT:
      return [...pending.adornmentOptions, null].map((adornment) => ({
        ...pending,
        clientOptions: { adornment },
      }));
    case GameInputType.SELECT_RIVER_DESTINATION:
      return pending.options.map((riverDestination) => ({
        ...pending,
        clientOptions: { riverDestination },
      }));
    case GameInputType.SELECT_TRAIN_CAR_TILE:
      return pending.options
        .map((tile, trainCarTileIdx) =>
          tile ? { ...pending, clientOptions: { trainCarTileIdx } } : null
        )
        .filter((x): x is NonNullable<typeof x> => !!x);
    case GameInputType.SELECT_WORKER_PLACEMENT: {
      // Clock Tower, train ticket and Ranger's second step activate the chosen spot;
      // Ranger's first step and A Wee Run City only pick a worker to recall.
      const activatesSpot =
        pending.prevInputType !== GameInputType.PLAY_CARD &&
        pending.prevInputType !== GameInputType.CLAIM_EVENT;
      const choices = [
        ...pending.options.filter(
          (option) =>
            !activatesSpot ||
            !option.location ||
            canTriggerLocation(gameState, option.location)
        ),
        ...(pending.mustSelectOne ? [] : [null]),
      ];
      return choices.map((selectedOption) => ({
        ...pending,
        clientOptions: { selectedOption },
      }));
    }
    case GameInputType.SELECT_CARDS: {
      let minToSelect = pending.minToSelect;
      // River destinations: discard exactly N matching cards, or none.
      const allOrNothing =
        !!pending.riverDestinationContext &&
        pending.prevInputType === GameInputType.PLACE_AMBASSADOR &&
        pending.minToSelect === 0;
      if (allOrNothing) {
        minToSelect = pending.maxToSelect;
      }
      // Giving 0 re-asks the same question forever; declining is the SELECT_PLAYER null option.
      if (pending.eventContext === EventName.SPECIAL_MASQUERADE_INVITATIONS) {
        minToSelect = Math.max(1, minToSelect);
      }
      // Filtered below, so enumerate every pair first: capping before filtering can leave nothing.
      const drawTwoFromMeadow =
        pending.locationContext ===
          LocationName.FOREST_DRAW_TWO_MEADOW_PLAY_ONE_FOR_ONE_LESS &&
        pending.prevInputType === GameInputType.PLACE_WORKER;
      let subsets = pickSubsets(
        pending.cardOptions,
        minToSelect,
        pending.maxToSelect,
        drawTwoFromMeadow ? Infinity : maxPerInput,
        rng
      );
      if (allOrNothing) {
        if (
          pending.riverDestinationContext ===
          RiverDestinationName.BOSLEY_THE_ARTIST
        ) {
          subsets = subsets.filter(
            (cards) =>
              uniq(cards.map((c) => Card.fromName(c).cardType)).length ===
              cards.length
          );
        }
        subsets.push([]);
      }
      if (drawTwoFromMeadow) {
        // The location insists that one of the 2 drawn cards is playable.
        subsets = capList(
          subsets.filter((cards) =>
            cards.some(
              (cardName) =>
                player.canAffordCard(cardName, null, "ANY 1") &&
                Card.fromName(cardName).canPlayIgnoreCostAndSource(gameState)
            )
          ),
          maxPerInput,
          rng
        );
      }
      return subsets.map((selectedCards) => ({
        ...pending,
        clientOptions: { selectedCards },
      }));
    }
    case GameInputType.SELECT_CARDS_WITH_SOURCE: {
      // Options are computed when the input is queued and can go stale
      // (eg. 2 Lamplighters producing in the same turn).
      const cardOptions = pending.cardOptions.filter((option) => {
        if (option === "FROM_DECK") {
          return true;
        }
        switch (option.source) {
          case "MEADOW":
            return gameState.meadowCards.indexOf(option.card) !== -1;
          case "STATION":
            return (
              option.sourceIdx !== undefined &&
              gameState.stationCards[option.sourceIdx] === option.card
            );
          default:
            return true;
        }
      });
      return pickSubsets(
        cardOptions,
        pending.minToSelect,
        pending.maxToSelect,
        maxPerInput,
        rng
      ).map((selectedCards) => ({
        ...pending,
        clientOptions: { selectedCards },
      }));
    }
    case GameInputType.SELECT_PLAYED_CARDS:
      return pickSubsets(
        pending.cardOptions,
        pending.minToSelect,
        pending.maxToSelect,
        maxPerInput,
        rng
      ).map((selectedCards) => ({
        ...pending,
        clientOptions: { selectedCards },
      }));
    case GameInputType.DISCARD_CARDS:
      return pickSubsets(
        player.getCardsInHand(),
        pending.minCards,
        pending.maxCards,
        maxPerInput,
        rng
      ).map((cardsToDiscard) => ({
        ...pending,
        clientOptions: { cardsToDiscard },
      }));
    case GameInputType.SELECT_RESOURCES: {
      const types: PayableResource[] = pending.specificResource
        ? [pending.specificResource as PayableResource]
        : PAYABLE_RESOURCES.filter((r) => r !== pending.excludeResource);
      // Freight Car hands out what is stored on the card, not from the supply.
      const onCard =
        pending.cardContext === CardName.FREIGHT_CAR &&
        pending.playedCardContext?.resources &&
        sumResources(pending.playedCardContext.resources) > 0
          ? pending.playedCardContext.resources
          : null;
      const limits = types.map((r) =>
        pending.toSpend
          ? player.getNumResourcesByType(r)
          : onCard
          ? onCard[r] || 0
          : pending.maxResources
      );
      // Donating 0 re-asks the same question forever; declining is the SELECT_PLAYER null option.
      const minResources =
        pending.eventContext === EventName.SPECIAL_A_BRILLIANT_MARKETING_PLAN
          ? Math.max(1, pending.minResources)
          : pending.minResources;
      return capList(
        getResourceSplits(limits, minResources, pending.maxResources),
        maxPerInput,
        rng
      ).map((vec) => {
        const resources: CardCost = {};
        vec.forEach((n, i) => {
          if (n > 0) {
            resources[types[i]] = n;
          }
        });
        return { ...pending, clientOptions: { resources } };
      });
    }
    case GameInputType.SELECT_PAYMENT_FOR_CARD: {
      // Inn / Hotel / Locomotive give 3 fewer ANY, the forest location 1 fewer.
      const discount: PaymentDiscount = pending.cardContext ? "ANY 3" : "ANY 1";
      const cost = toResourceVec(Card.fromName(pending.card).baseCost);
      const have = PAYABLE_RESOURCES.map((r) =>
        player.getNumResourcesByType(r)
      );
      return getResourcePayments(cost, have, discount, false).map((vec) => ({
        ...pending,
        clientOptions: {
          card: pending.card,
          paymentOptions: { resources: toCardCost(vec) },
        },
      }));
    }
    default:
      assertUnreachable(
        pending,
        `Unhandled pending input: ${JSON.stringify(pending)}`
      );
  }
}

// ---------------------------------------------------------------------------
// Combinatorics helpers
// ---------------------------------------------------------------------------

// Whether triggering the location's effect would be accepted by the engine.
// Ignores occupancy / worker availability (irrelevant when copying).
function canTriggerLocation(
  gameState: GameState,
  location: LocationName
): boolean {
  if (
    LOCATIONS_NEEDING_CARDS_IN_HAND.indexOf(location) !== -1 &&
    gameState.getActivePlayer().numCardsInHand < 1
  ) {
    return false;
  }
  return !Location.fromName(location).canPlayCheck(gameState, {
    inputType: GameInputType.PLACE_WORKER,
    clientOptions: { location },
  });
}

// Subsets of `items` (treated as a multiset, by index) with a size in
// [minSize, maxSize]. Enumerates everything when small enough, else samples.
function pickSubsets<T>(
  items: readonly T[],
  minSize: number,
  maxSize: number,
  cap: number,
  rng: Rng
): T[][] {
  const n = items.length;
  const lo = Math.max(0, minSize);
  const hi = Math.min(n, maxSize);
  if (lo > hi) {
    return [];
  }
  let total = 0;
  for (let k = lo; k <= hi; k++) {
    total += binomial(n, k);
  }
  const indexSubsets: number[][] = [];
  if (total <= cap) {
    const recurse = (start: number, acc: number[]) => {
      if (acc.length >= lo) {
        indexSubsets.push(acc.slice());
      }
      if (acc.length === hi) {
        return;
      }
      for (let i = start; i < n; i++) {
        acc.push(i);
        recurse(i + 1, acc);
        acc.pop();
      }
    };
    recurse(0, []);
  } else {
    const seen = new Set<string>();
    const allIdx = items.map((_, i) => i);
    for (let attempt = 0; attempt < cap * 4 && seen.size < cap; attempt++) {
      const k = lo + Math.floor(rng() * (hi - lo + 1));
      const subset = shuffle(allIdx, rng)
        .slice(0, k)
        .sort((a, b) => a - b);
      const key = subset.join(",");
      if (!seen.has(key)) {
        seen.add(key);
        indexSubsets.push(subset);
      }
    }
  }
  return indexSubsets.map((subset) => subset.map((i) => items[i]));
}

// Vectors v with 0 <= v[i] <= limits[i] and minTotal <= sum(v) <= maxTotal.
function getResourceSplits(
  limits: number[],
  minTotal: number,
  maxTotal: number
): ResourceVec[] {
  const ret: ResourceVec[] = [];
  const recurse = (idx: number, total: number, acc: ResourceVec) => {
    if (idx === limits.length) {
      if (total >= minTotal && total <= maxTotal) {
        ret.push(acc.slice());
      }
      return;
    }
    const maxHere = Math.min(limits[idx], maxTotal - total);
    for (let n = 0; n <= maxHere; n++) {
      acc.push(n);
      recurse(idx + 1, total + n, acc);
      acc.pop();
    }
  };
  recurse(0, 0, []);
  return ret;
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) {
    return 0;
  }
  let ret = 1;
  for (let i = 1; i <= k; i++) {
    ret = (ret * (n - k + i)) / i;
  }
  return ret;
}

function capList<T>(items: T[], cap: number, rng: Rng): T[] {
  return items.length <= cap ? items : shuffle(items, rng).slice(0, cap);
}

function toResourceVec(cost: CardCost): ResourceVec {
  return PAYABLE_RESOURCES.map((r) => cost[r] || 0);
}

function toCardCost(vec: ResourceVec): CardCost {
  const ret: CardCost = {};
  vec.forEach((n, i) => {
    if (n > 0) {
      ret[PAYABLE_RESOURCES[i]] = n;
    }
  });
  return ret;
}

function sum(vec: ResourceVec): number {
  return vec.reduce((a, b) => a + b, 0);
}

function uniq<T>(items: T[]): T[] {
  return items.filter((x, i) => items.indexOf(x) === i);
}

function dedupeVecs(vecs: ResourceVec[]): ResourceVec[] {
  const seen = new Set<string>();
  return vecs.filter((vec) => {
    const key = vec.join(",");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupeMoves<T extends GameInput>(moves: T[]): T[] {
  const seen = new Set<string>();
  return moves.filter((move) => {
    const key = JSON.stringify(move);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Exposed for unit tests.
export const legalMovesInternals = {
  getWildDiscountPayments,
  getJudgePayments,
  getResourceSplits,
  pickSubsets,
};
