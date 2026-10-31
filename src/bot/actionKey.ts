// The policy head's fixed output layer: every legal move maps to a key of a
// fixed vocabulary (or null for set-valued decisions, which get uniform priors
// and no policy target). Moves that only differ by how they are paid share
// their card's key.
import { GameState } from "../model/gameState";
import {
  AdornmentName,
  CardName,
  EventName,
  GameInput,
  GameInputType,
  LocationName,
  RiverDestinationName,
  RiverDestinationSpotName,
  VisitorName,
  WorkerPlacementInfo,
} from "../model/types";
import { getPaymentForCardOptions } from "./legalMoves";

const MAX_GENERIC_OPTIONS = 8;
const MAX_PAYMENT_VARIANTS = 4;
const MAX_RELATIVE_SEAT = 3;
const NUM_STATION_TILES = 3;

const CARDS = Object.values(CardName);
const LOCATIONS = Object.values(LocationName);
const EVENTS = Object.values(EventName);

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const workerPlacementKeys = (prefix: string) => [
  ...LOCATIONS.map((l) => `${prefix}:${l}`),
  ...CARDS.map((c) => `${prefix}CARD:${c}`),
  ...EVENTS.map((e) => `${prefix}EVENT:${e}`),
  `${prefix}:none`,
];

// Built from the enums: a model stores this list in its manifest and refuses
// to load against a different one.
export const ACTION_KEYS: readonly string[] = [
  ...CARDS.map((c) => `PLAY:${c}`),
  ...LOCATIONS.map((l) => `LOC:${l}`),
  ...CARDS.flatMap((c) => [`VISIT:${c}:own`, `VISIT:${c}:opp`]),
  ...EVENTS.map((e) => `EVENT:${e}`),
  "PREPARE",
  "END",
  ...range(MAX_RELATIVE_SEAT).map((i) => `PLAYER:${i + 1}`),
  "PLAYER:none",
  ...LOCATIONS.map((l) => `SLOC:${l}`),
  ...range(MAX_GENERIC_OPTIONS).map((i) => `OPT:${i}`),
  ...workerPlacementKeys("WP"),
  ...range(MAX_PAYMENT_VARIANTS).map((i) => `PAYVARIANT:${i}`),
  // Pearlbrook
  ...Object.values(AdornmentName).map((a) => `ADORN:${a}`),
  "ADORN:none",
  ...Object.values(RiverDestinationSpotName).map((s) => `AMB:${s}`),
  "AMB:ferry",
  ...Object.values(RiverDestinationName).map((r) => `RIVER:${r}`),
  // Newleaf
  ...workerPlacementKeys("TICKET"),
  ...CARDS.map((c) => `RESERVE:${c}`),
  ...Object.values(VisitorName).map((v) => `VISITOR:${v}`),
  ...range(NUM_STATION_TILES).map((i) => `TILE:${i}`),
];

export const NUM_ACTION_KEYS = ACTION_KEYS.length;

export const ACTION_KEY_INDEX: ReadonlyMap<string, number> = new Map(
  ACTION_KEYS.map((key, idx) => [key, idx])
);

function workerPlacementKey(
  prefix: string,
  info: WorkerPlacementInfo | null
): string {
  if (!info) {
    return `${prefix}:none`;
  }
  if (info.location) {
    return `${prefix}:${info.location}`;
  }
  if (info.playedCard) {
    return `${prefix}CARD:${info.playedCard.cardName}`;
  }
  return `${prefix}EVENT:${info.event}`;
}

/**
 * The vocabulary key of a legal move of `gameState`'s active player, or null
 * for set-valued decisions (card subsets, resource splits). Deterministic.
 */
export function actionKey(
  gameState: GameState,
  move: GameInput
): string | null {
  switch (move.inputType) {
    case GameInputType.PLAY_CARD:
      return `PLAY:${move.clientOptions.card}`;
    case GameInputType.PLACE_WORKER:
      return `LOC:${move.clientOptions.location}`;
    case GameInputType.VISIT_DESTINATION_CARD: {
      const playedCard = move.clientOptions.playedCard;
      if (!playedCard) {
        return null;
      }
      const owner =
        playedCard.cardOwnerId === gameState.activePlayerId ? "own" : "opp";
      return `VISIT:${playedCard.cardName}:${owner}`;
    }
    case GameInputType.CLAIM_EVENT:
      return `EVENT:${move.clientOptions.event}`;
    case GameInputType.PREPARE_FOR_SEASON:
      return "PREPARE";
    case GameInputType.GAME_END:
      return "END";
    case GameInputType.SELECT_PLAYER: {
      const selected = move.clientOptions.selectedPlayer;
      if (selected === null) {
        return "PLAYER:none";
      }
      const players = gameState.players;
      const me = players.findIndex(
        (p) => p.playerId === gameState.activePlayerId
      );
      const them = players.findIndex((p) => p.playerId === selected);
      const relative = (them - me + players.length) % players.length;
      return them === -1 || relative === 0 ? null : `PLAYER:${relative}`;
    }
    case GameInputType.SELECT_LOCATION:
      return `SLOC:${move.clientOptions.selectedLocation}`;
    case GameInputType.SELECT_OPTION_GENERIC: {
      const idx = move.options.indexOf(move.clientOptions.selectedOption!);
      return idx >= 0 && idx < MAX_GENERIC_OPTIONS ? `OPT:${idx}` : null;
    }
    case GameInputType.SELECT_WORKER_PLACEMENT:
      return workerPlacementKey("WP", move.clientOptions.selectedOption);
    case GameInputType.SELECT_PAYMENT_FOR_CARD: {
      const paid = JSON.stringify(move.clientOptions.paymentOptions.resources);
      const idx = getPaymentForCardOptions(gameState, move).findIndex(
        (resources) => JSON.stringify(resources) === paid
      );
      return idx >= 0 && idx < MAX_PAYMENT_VARIANTS
        ? `PAYVARIANT:${idx}`
        : null;
    }
    case GameInputType.PLAY_ADORNMENT:
    case GameInputType.SELECT_PLAYED_ADORNMENT:
      return `ADORN:${move.clientOptions.adornment ?? "none"}`;
    case GameInputType.PLACE_AMBASSADOR: {
      const loc = move.clientOptions.loc;
      if (!loc) {
        return null;
      }
      return loc.type === "spot" ? `AMB:${loc.spot}` : "AMB:ferry";
    }
    case GameInputType.SELECT_RIVER_DESTINATION:
      return `RIVER:${move.clientOptions.riverDestination}`;
    case GameInputType.PLAY_TRAIN_TICKET:
      return workerPlacementKey("TICKET", move.clientOptions.selectedOption);
    case GameInputType.RESERVE_CARD:
      return move.clientOptions.selectedOption
        ? `RESERVE:${move.clientOptions.selectedOption.card}`
        : null;
    case GameInputType.SELECT_VISITOR:
      return `VISITOR:${move.clientOptions.selectedVisitor}`;
    case GameInputType.SELECT_TRAIN_CAR_TILE: {
      const idx = move.clientOptions.trainCarTileIdx;
      return idx >= 0 && idx < NUM_STATION_TILES ? `TILE:${idx}` : null;
    }
    case GameInputType.SELECT_CARDS:
    case GameInputType.SELECT_CARDS_WITH_SOURCE:
    case GameInputType.SELECT_PLAYED_CARDS:
    case GameInputType.DISCARD_CARDS:
    case GameInputType.SELECT_RESOURCES:
    case GameInputType.UNDO:
      return null;
    default:
      return null;
  }
}

// actionKey() restricted to the vocabulary (anything else counts as unkeyed).
export function vocabularyKey(
  gameState: GameState,
  move: GameInput
): string | null {
  const key = actionKey(gameState, move);
  return key !== null && ACTION_KEY_INDEX.has(key) ? key : null;
}
