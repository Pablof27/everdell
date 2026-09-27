import * as React from "react";
import { useFormikContext } from "formik";

import {
  CardWithSource,
  EventName,
  GameInput,
  GameInputType,
  LocationName,
} from "../model/types";
import { GameState } from "../model/gameState";
import { Player } from "../model/player";
import { getPlayCardClientOptions } from "./GameInputPlayCard";

// Lets the board (locations, meadow, hand, events) act as an input surface for
// the action panel form: board elements highlight what can be picked and a
// click selects it in the form, which the player then confirms with Submit.

export type BoardSelectionValue = {
  locationOptions: LocationName[];
  selectedLocation: LocationName | null;
  cardOptions: CardWithSource[];
  selectedCard: CardWithSource | null;
  eventOptions: EventName[];
  selectedEvent: EventName | null;
  selectLocation: (location: LocationName) => void;
  selectCard: (card: CardWithSource) => void;
  selectEvent: (event: EventName) => void;
};

const noop = () => {
  return;
};

const EMPTY_SELECTION: BoardSelectionValue = {
  locationOptions: [],
  selectedLocation: null,
  cardOptions: [],
  selectedCard: null,
  eventOptions: [],
  selectedEvent: null,
  selectLocation: noop,
  selectCard: noop,
  selectEvent: noop,
};

const BoardSelectionContext = React.createContext<BoardSelectionValue>(
  EMPTY_SELECTION
);
const PublishContext = React.createContext<
  (value: BoardSelectionValue | null) => void
>(noop);

export const BoardSelectionProvider: React.FC = ({ children }) => {
  const [value, setValue] = React.useState<BoardSelectionValue | null>(null);
  return (
    <PublishContext.Provider value={setValue}>
      <BoardSelectionContext.Provider value={value || EMPTY_SELECTION}>
        {children}
      </BoardSelectionContext.Provider>
    </PublishContext.Provider>
  );
};

export const useBoardSelection = (): BoardSelectionValue =>
  React.useContext(BoardSelectionContext);

export const isSameCardWithSource = (
  a: CardWithSource | null,
  b: CardWithSource | null
): boolean =>
  !!a &&
  !!b &&
  a.card === b.card &&
  a.source === b.source &&
  (typeof a.sourceIdx === "number" ? a.sourceIdx : null) ===
    (typeof b.sourceIdx === "number" ? b.sourceIdx : null);

export const BoardSelectionBridge: React.FC<{
  gameInputs: GameInput[];
  gameState: GameState;
  viewingPlayer: Player;
}> = ({ gameInputs, gameState, viewingPlayer }) => {
  const publish = React.useContext(PublishContext);
  const { values, setFieldValue } = useFormikContext<{
    gameInput: GameInput | null;
  }>();

  const options = React.useMemo(() => {
    const hasInput = (inputType: GameInputType) =>
      gameInputs.some((x) => x.inputType === inputType);
    let locations: LocationName[] = [];
    gameInputs.forEach((x) => {
      if (x.inputType === GameInputType.SELECT_LOCATION) {
        locations = x.locationOptions;
      }
    });
    if (hasInput(GameInputType.PLACE_WORKER)) {
      locations = gameState.getPlayableLocations();
    }
    return {
      locations,
      cards: hasInput(GameInputType.PLAY_CARD)
        ? gameState.getPlayableCards()
        : [],
      events: hasInput(GameInputType.CLAIM_EVENT)
        ? gameState.getClaimableEvents()
        : [],
    };
  }, [gameState, gameInputs]);

  const latest = React.useRef({ gameInputs, options, viewingPlayer });
  latest.current = { gameInputs, options, viewingPlayer };
  const setFieldValueRef = React.useRef(setFieldValue);
  setFieldValueRef.current = setFieldValue;

  const handlers = React.useMemo(
    () => ({
      selectLocation: (location: LocationName) => {
        const input = latest.current.gameInputs.find(
          (x) =>
            x.inputType === GameInputType.SELECT_LOCATION ||
            x.inputType === GameInputType.PLACE_WORKER
        );
        if (input?.inputType === GameInputType.SELECT_LOCATION) {
          setFieldValueRef.current("gameInput", {
            ...input,
            clientOptions: { ...input.clientOptions, selectedLocation: location },
          });
        } else if (input?.inputType === GameInputType.PLACE_WORKER) {
          setFieldValueRef.current("gameInput", {
            ...input,
            clientOptions: { location },
          });
        }
      },
      selectCard: (cardWithSource: CardWithSource) => {
        const { gameInputs, options, viewingPlayer } = latest.current;
        const input = gameInputs.find(
          (x) => x.inputType === GameInputType.PLAY_CARD
        );
        const idx = options.cards.findIndex((x) =>
          isSameCardWithSource(x, cardWithSource)
        );
        if (input?.inputType !== GameInputType.PLAY_CARD || idx === -1) {
          return;
        }
        const option = options.cards[idx];
        setFieldValueRef.current("gameInput", {
          ...input,
          clientOptions: getPlayCardClientOptions(
            option.card,
            "DEFAULT",
            { source: option.source, sourceIdx: option.sourceIdx, _idx: idx },
            viewingPlayer,
            input.clientOptions
          ),
        });
      },
      selectEvent: (event: EventName) => {
        const input = latest.current.gameInputs.find(
          (x) => x.inputType === GameInputType.CLAIM_EVENT
        );
        if (input?.inputType === GameInputType.CLAIM_EVENT) {
          setFieldValueRef.current("gameInput", {
            ...input,
            clientOptions: { event },
          });
        }
      },
    }),
    []
  );

  const selected = values.gameInput;
  const selectedLocation =
    selected?.inputType === GameInputType.PLACE_WORKER
      ? selected.clientOptions.location
      : selected?.inputType === GameInputType.SELECT_LOCATION
      ? selected.clientOptions.selectedLocation
      : null;
  const selectedCardName =
    selected?.inputType === GameInputType.PLAY_CARD
      ? selected.clientOptions.card
      : null;
  const selectedCardSource =
    selected?.inputType === GameInputType.PLAY_CARD
      ? selected.clientOptions.source || "HAND"
      : null;
  const selectedCardSourceIdx =
    selected?.inputType === GameInputType.PLAY_CARD
      ? selected.clientOptions.sourceIdx
      : undefined;
  const selectedEvent =
    selected?.inputType === GameInputType.CLAIM_EVENT
      ? selected.clientOptions.event
      : null;

  React.useEffect(() => {
    publish({
      locationOptions: options.locations,
      selectedLocation,
      cardOptions: options.cards,
      selectedCard:
        selectedCardName && selectedCardSource
          ? {
              card: selectedCardName,
              source: selectedCardSource,
              sourceIdx: selectedCardSourceIdx,
            }
          : null,
      eventOptions: options.events,
      selectedEvent,
      ...handlers,
    });
  }, [
    publish,
    options,
    handlers,
    selectedLocation,
    selectedCardName,
    selectedCardSource,
    selectedCardSourceIdx,
    selectedEvent,
  ]);

  React.useEffect(() => () => publish(null), [publish]);

  return null;
};
