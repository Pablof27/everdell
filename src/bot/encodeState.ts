// Network input: the game from the point of view of one seat (the player to
// move). Every feature is a small non-negative integer (a count or a flag),
// stored as-is in self-play files (Uint8) and divided by its scale for the
// network. Never encodes hidden information: other players' hands, the deck
// and the discard pile only contribute their sizes.
import { GameState } from "../model/gameState";
import { Player } from "../model/player";
import {
  CardName,
  EventName,
  GameInputMultiStep,
  GameInputType,
  LocationName,
  PlayerStatus,
  ResourceType,
  Season,
} from "../model/types";

const CARDS = Object.values(CardName);
const LOCATIONS = Object.values(LocationName);
const EVENTS = Object.values(EventName);
const SEASONS = [Season.WINTER, Season.SPRING, Season.SUMMER, Season.AUTUMN];
const STATUSES = [
  PlayerStatus.DURING_SEASON,
  PlayerStatus.PREPARING_FOR_SEASON,
  PlayerStatus.GAME_ENDED,
];
const RESOURCES = Object.values(ResourceType);
const PENDING_TYPES: (GameInputMultiStep["inputType"] | "none")[] = [
  "none",
  GameInputType.SELECT_CARDS,
  GameInputType.SELECT_CARDS_WITH_SOURCE,
  GameInputType.SELECT_PLAYED_CARDS,
  GameInputType.SELECT_PLAYER,
  GameInputType.SELECT_RESOURCES,
  GameInputType.SELECT_LOCATION,
  GameInputType.SELECT_WORKER_PLACEMENT,
  GameInputType.DISCARD_CARDS,
  GameInputType.SELECT_PAYMENT_FOR_CARD,
  GameInputType.SELECT_OPTION_GENERIC,
  GameInputType.SELECT_PLAYED_ADORNMENT,
  GameInputType.SELECT_RIVER_DESTINATION,
  GameInputType.SELECT_TRAIN_CAR_TILE,
  GameInputType.SELECT_VISITOR,
];

const CARD_INDEX = new Map(CARDS.map((c, i) => [c, i]));
const EVENT_INDEX = new Map(EVENTS.map((e, i) => [e, i]));
const LOCATION_INDEX = new Map(LOCATIONS.map((l, i) => [l, i]));

type Block = { name: string; size: number; scale: number; labels?: string[] };

function playerBlocks(prefix: string, withHand: boolean): Block[] {
  return [
    { name: `${prefix}.season`, size: 4, scale: 1, labels: SEASONS },
    { name: `${prefix}.status`, size: 3, scale: 1, labels: STATUSES },
    { name: `${prefix}.availableWorkers`, size: 1, scale: 6 },
    { name: `${prefix}.handSize`, size: 1, scale: 8 },
    { name: `${prefix}.points`, size: 1, scale: 50 },
    { name: `${prefix}.resources`, size: 6, scale: 10, labels: RESOURCES },
    { name: `${prefix}.city`, size: CARDS.length, scale: 3, labels: CARDS },
    {
      name: `${prefix}.citySize`,
      size: 3,
      scale: 15,
      labels: ["occupiedSpaces", "critters", "constructions"],
    },
    ...(withHand
      ? [
          {
            name: `${prefix}.hand`,
            size: CARDS.length,
            scale: 3,
            labels: CARDS,
          },
        ]
      : []),
    {
      name: `${prefix}.claimedEvents`,
      size: EVENTS.length,
      scale: 1,
      labels: EVENTS,
    },
  ];
}

const BOARD_BLOCKS: Block[] = [
  { name: "board.meadow", size: CARDS.length, scale: 3, labels: CARDS },
  {
    name: "board.myWorkers",
    size: LOCATIONS.length,
    scale: 2,
    labels: LOCATIONS,
  },
  {
    name: "board.otherWorkers",
    size: LOCATIONS.length,
    scale: 3,
    labels: LOCATIONS,
  },
  {
    name: "board.unclaimedEvents",
    size: EVENTS.length,
    scale: 1,
    labels: EVENTS,
  },
  { name: "board.deckSize", size: 1, scale: 60 },
  { name: "board.discardSize", size: 1, scale: 60 },
  { name: "board.station", size: CARDS.length, scale: 3, labels: CARDS },
  {
    name: "decision.type",
    size: PENDING_TYPES.length,
    scale: 1,
    labels: PENDING_TYPES,
  },
  { name: "decision.card", size: CARDS.length, scale: 1, labels: CARDS },
  {
    name: "decision.location",
    size: LOCATIONS.length,
    scale: 1,
    labels: LOCATIONS,
  },
  { name: "decision.event", size: EVENTS.length, scale: 1, labels: EVENTS },
  {
    name: "decision.select",
    size: 2,
    scale: 8,
    labels: ["min", "max"],
  },
];

function layout(numPlayers: number): Block[] {
  const blocks = playerBlocks("me", true);
  for (let i = 1; i < numPlayers; i++) {
    blocks.push(...playerBlocks(`opp${i}`, false));
  }
  return blocks.concat(BOARD_BLOCKS);
}

export function stateDim(numPlayers: number): number {
  return layout(numPlayers).reduce((n, b) => n + b.size, 0);
}

// 2-player base game: 852.
export const STATE_DIM = stateDim(2);

export function featureNames(numPlayers: number): string[] {
  return layout(numPlayers).flatMap(({ name, size, labels }) =>
    labels ? labels.map((l) => `${name}.${l}`) : size === 1 ? [name] : []
  );
}

// Divisor of each raw feature: the scaling table shared with the trainer.
export function featureScales(numPlayers: number): number[] {
  return layout(numPlayers).flatMap(({ size, scale }) =>
    new Array(size).fill(scale)
  );
}

const PLAYER_BLOCK_SIZE = playerBlocks("x", false).reduce(
  (n, b) => n + b.size,
  0
);

function writePlayer(
  out: Uint8Array,
  offset: number,
  gameState: GameState,
  player: Player,
  withHand: boolean
): number {
  const put = (idx: number, value: number) => {
    out[idx] = value <= 0 ? 0 : value >= 255 ? 255 : Math.round(value);
  };
  let o = offset;
  put(o + SEASONS.indexOf(player.currentSeason), 1);
  o += SEASONS.length;
  put(o + STATUSES.indexOf(player.getStatus()), 1);
  o += STATUSES.length;
  put(o++, player.numAvailableWorkers);
  put(o++, player.numCardsInHand);
  put(o++, player.getPoints(gameState));
  RESOURCES.forEach((r, i) => put(o + i, player.getNumResourcesByType(r)));
  o += RESOURCES.length;
  player.forEachPlayedCard(({ cardName }) => {
    out[o + CARD_INDEX.get(cardName)!]++;
  });
  o += CARDS.length;
  put(o++, player.getNumOccupiedSpacesInCity());
  put(o++, player.getNumPlayedCritters());
  put(o++, player.getNumPlayedConstructions());
  if (withHand) {
    player.getCardsInHand().forEach((cardName) => {
      out[o + CARD_INDEX.get(cardName)!]++;
    });
    o += CARDS.length;
  }
  (Object.keys(player.claimedEvents) as EventName[]).forEach((event) => {
    put(o + EVENT_INDEX.get(event)!, 1);
  });
  o += EVENTS.length;
  return o;
}

/**
 * Raw (unscaled) features of `gameState` seen by `seat`: "me" first, then the
 * other players in turn order starting after me, then the board and the
 * pending decision.
 */
export function encodeStateRaw(gameState: GameState, seat: number): Uint8Array {
  const players = gameState.players;
  const n = players.length;
  const out = new Uint8Array(stateDim(n));
  const me = players[seat];
  let o = writePlayer(out, 0, gameState, me, true);
  for (let i = 1; i < n; i++) {
    o = writePlayer(out, o, gameState, players[(seat + i) % n], false);
  }
  const put = (idx: number, value: number) => {
    out[idx] = value <= 0 ? 0 : value >= 255 ? 255 : Math.round(value);
  };

  gameState.meadowCards.forEach((cardName) => {
    out[o + CARD_INDEX.get(cardName)!]++;
  });
  o += CARDS.length;
  (Object.keys(gameState.locationsMap) as LocationName[]).forEach((loc) => {
    const idx = LOCATION_INDEX.get(loc)!;
    gameState.locationsMap[loc]!.forEach((playerId) => {
      if (playerId === me.playerId) {
        out[o + idx]++;
      } else {
        out[o + LOCATIONS.length + idx]++;
      }
    });
  });
  o += 2 * LOCATIONS.length;
  (Object.keys(gameState.eventsMap) as EventName[]).forEach((event) => {
    if (!gameState.eventsMap[event]) {
      put(o + EVENT_INDEX.get(event)!, 1);
    }
  });
  o += EVENTS.length;
  put(o++, gameState.deck.length);
  put(o++, gameState.discardPile.length);
  gameState.stationCards.forEach((cardName) => {
    if (cardName) {
      out[o + CARD_INDEX.get(cardName)!]++;
    }
  });
  o += CARDS.length;

  const pending = gameState.pendingGameInputs[0];
  put(o + PENDING_TYPES.indexOf(pending ? pending.inputType : "none"), 1);
  o += PENDING_TYPES.length;
  if (pending?.cardContext) {
    put(o + CARD_INDEX.get(pending.cardContext)!, 1);
  }
  o += CARDS.length;
  if (pending?.locationContext) {
    put(o + LOCATION_INDEX.get(pending.locationContext)!, 1);
  }
  o += LOCATIONS.length;
  if (pending?.eventContext) {
    put(o + EVENT_INDEX.get(pending.eventContext)!, 1);
  }
  o += EVENTS.length;
  const [min, max] = pending ? selectionBounds(pending) : [0, 0];
  put(o++, min);
  put(o++, max);
  return out;
}

function selectionBounds(pending: GameInputMultiStep): [number, number] {
  switch (pending.inputType) {
    case GameInputType.SELECT_CARDS:
    case GameInputType.SELECT_CARDS_WITH_SOURCE:
    case GameInputType.SELECT_PLAYED_CARDS:
      return [pending.minToSelect, pending.maxToSelect];
    case GameInputType.DISCARD_CARDS:
      return [pending.minCards, pending.maxCards];
    case GameInputType.SELECT_RESOURCES:
      return [pending.minResources, pending.maxResources];
    default:
      return [0, 0];
  }
}

const SCALES_BY_PLAYERS = new Map<number, Float32Array>();

function inverseScales(numPlayers: number): Float32Array {
  let inv = SCALES_BY_PLAYERS.get(numPlayers);
  if (!inv) {
    inv = Float32Array.from(featureScales(numPlayers), (s) => 1 / s);
    SCALES_BY_PLAYERS.set(numPlayers, inv);
  }
  return inv;
}

// Raw features divided by their scales: the network input.
export function scaleFeatures(
  raw: Uint8Array,
  numPlayers: number
): Float32Array {
  const inv = inverseScales(numPlayers);
  const x = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    x[i] = raw[i] * inv[i];
  }
  return x;
}

export function encodeState(gameState: GameState, seat: number): Float32Array {
  return scaleFeatures(
    encodeStateRaw(gameState, seat),
    gameState.players.length
  );
}

// Offsets of the per-player blocks, for tests.
export const encodeStateInternals = { PLAYER_BLOCK_SIZE, layout };
