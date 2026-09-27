import * as React from "react";
import { Form } from "formik";
import isEqual from "lodash/isEqual";
import omit from "lodash/omit";

import styles from "../styles/GameInputBox.module.css";
import anim from "../styles/animations.module.css";
import { GameState } from "../model/gameState";
import { GameInputType, GameInput } from "../model/types";
import { Player } from "../model/player";

import { GameBlock } from "./common";

import { GameInputBoxContainer, renderGameInputLabel } from "./gameInputCommon";
import GameInputSelectPlayer from "./GameInputSelectPlayer";
import GameInputSelectResources from "./GameInputSelectResources";
import GameInputPlayedCardsSelector from "./GameInputPlayedCardsSelector";
import GameInputCardsSelector from "./GameInputCardsSelector";
import GameInputPlaceWorkerSelector from "./GameInputPlaceWorkerSelector";
import GameInputClaimEventSelector from "./GameInputClaimEventSelector";
import GameInputSelectRiverDestinationSelector from "./GameInputSelectRiverDestinationSelector";
import GameInputPlaceAmbassadorSelector from "./GameInputPlaceAmbassadorSelector";
import GameInputPlayAdornmentSelector from "./GameInputPlayAdornmentSelector";
import GameInputSelectPaymentForCard from "./GameInputSelectPaymentForCard";
import GameInputSelectWorkerPlacement from "./GameInputSelectWorkerPlacement";
import GameInputSelectOptionGeneric from "./GameInputSelectOptionGeneric";
import GameInputSelectCardWithSourceSelector from "./GameInputSelectCardWithSourceSelector";
import GameInputSelectTrainCarTileSelector from "./GameInputSelectTrainCarTileSelector";
import GameInputVisitorSelector from "./GameInputVisitorSelector";
import GameInputPlayCard from "./GameInputPlayCard";
import { BoardSelectionBridge } from "./BoardSelection";
import PixelSprite, { Sprite } from "./pixel/PixelSprite";
import * as Sprites from "./pixel/sprites";
import { SEASON_SPRITES } from "./pixel/icons";
import { useGameUI } from "./gameUI";

import { assertUnreachable } from "../utils";

const GameInputBoxText: React.FC<{
  title?: string;
  text: string;
  waiting?: boolean;
}> = ({ title = "Game Input", text, waiting = false }) => {
  return (
    <GameBlock
      title={title}
      className={[styles.panel, styles.panel_idle].join(" ")}
    >
      <div className={styles.idle}>
        {waiting && (
          <PixelSprite
            sprite={Sprites.HOURGLASS}
            height="26px"
            className={anim.hourglass}
          />
        )}
        <p id={"js-game-input-box-text"}>{text}</p>
      </div>
    </GameBlock>
  );
};

const INPUT_ICONS: Partial<Record<GameInputType, Sprite>> = {
  [GameInputType.PLACE_WORKER]: Sprites.MEEPLE,
  [GameInputType.PLAY_CARD]: Sprites.CARD,
  [GameInputType.CLAIM_EVENT]: Sprites.FLAG,
  [GameInputType.VISIT_DESTINATION_CARD]: Sprites.BADGE_DESTINATION,
  [GameInputType.GAME_END]: Sprites.CROWN,
  [GameInputType.PLAY_ADORNMENT]: Sprites.PEARL,
  [GameInputType.PLACE_AMBASSADOR]: Sprites.FROG_MEEPLE,
  [GameInputType.RESERVE_CARD]: Sprites.RESERVATION_TOKEN,
  [GameInputType.PLAY_TRAIN_TICKET]: Sprites.TICKET,
};

const BOARD_TIPS: Partial<Record<GameInputType, string>> = {
  [GameInputType.PLACE_WORKER]:
    "Tip: click a glowing location on the board, then Submit.",
  [GameInputType.SELECT_LOCATION]:
    "Tip: click a glowing location on the board, then Submit.",
  [GameInputType.PLAY_CARD]:
    "Tip: click a glowing card in the Meadow or your hand, then Submit.",
  [GameInputType.CLAIM_EVENT]:
    "Tip: click a glowing event on the board, then Submit.",
};

const InputTypeIcon: React.FC<{
  gameInput: GameInput;
  viewingPlayer: Player;
}> = ({ gameInput, viewingPlayer }) => {
  const { getPlayerTheme } = useGameUI();
  const theme = getPlayerTheme(viewingPlayer.playerId);
  if (gameInput.inputType === GameInputType.UNDO) {
    return <span className={styles.tab_glyph}>{"\u21B6"}</span>;
  }
  const sprite =
    gameInput.inputType === GameInputType.PREPARE_FOR_SEASON
      ? SEASON_SPRITES[viewingPlayer.currentSeason]
      : INPUT_ICONS[gameInput.inputType];
  if (!sprite) {
    return <span className={styles.tab_glyph}>{"\u2726"}</span>;
  }
  return (
    <PixelSprite
      sprite={sprite}
      height="20px"
      colors={
        sprite === Sprites.MEEPLE || sprite === Sprites.FROG_MEEPLE
          ? { C: theme.color, D: theme.dark, L: theme.light }
          : undefined
      }
    />
  );
};

const defaultOrder = 10;
const gameInputSortOrder: Partial<Record<GameInputType, number>> = {
  [GameInputType.CLAIM_EVENT]: 1,
  [GameInputType.PLAY_CARD]: 2,
  [GameInputType.PLAY_ADORNMENT]: 2.5,
  [GameInputType.PLACE_WORKER]: 3,
  [GameInputType.PLACE_AMBASSADOR]: 3.5,
  [GameInputType.VISIT_DESTINATION_CARD]: 4,
  [GameInputType.PREPARE_FOR_SEASON]: defaultOrder + 1,
  [GameInputType.GAME_END]: defaultOrder + 2,
  [GameInputType.UNDO]: defaultOrder + 3,
};

const GameInputBoxInner = ({
  gameInput,
  gameState,
  viewingPlayer,
}: {
  gameInput: GameInput;
  gameState: GameState;
  viewingPlayer: Player;
}) => {
  return (
    <div>
      {gameInput.inputType === GameInputType.PLACE_WORKER ? (
        <GameInputPlaceWorkerSelector
          name={"gameInput.clientOptions.location"}
          viewingPlayer={viewingPlayer}
          locations={gameState.getPlayableLocations()}
        />
      ) : gameInput.inputType === GameInputType.PLAY_CARD ? (
        <GameInputPlayCard
          viewingPlayer={viewingPlayer}
          options={gameState.getPlayableCards()}
        />
      ) : gameInput.inputType === GameInputType.CLAIM_EVENT ? (
        <GameInputClaimEventSelector
          name={"gameInput.clientOptions.event"}
          events={gameState.getClaimableEvents()}
        />
      ) : gameInput.inputType === GameInputType.PREPARE_FOR_SEASON ? (
        <></>
      ) : gameInput.inputType === GameInputType.GAME_END ? (
        <></>
      ) : gameInput.inputType === GameInputType.UNDO ? (
        <></>
      ) : gameInput.inputType === GameInputType.DISCARD_CARDS ? (
        <GameInputCardsSelector
          name={"gameInput.clientOptions.cardsToDiscard"}
          options={viewingPlayer.getCardsInHand()}
        />
      ) : gameInput.inputType === GameInputType.SELECT_RESOURCES ? (
        <GameInputSelectResources
          name={"gameInput.clientOptions.resources"}
          gameInput={gameInput}
          viewingPlayer={viewingPlayer}
        />
      ) : gameInput.inputType === GameInputType.SELECT_PLAYER ? (
        <GameInputSelectPlayer
          name={"gameInput.clientOptions.selectedPlayer"}
          gameInput={gameInput}
          gameState={gameState}
          viewingPlayer={viewingPlayer}
        />
      ) : gameInput.inputType === GameInputType.SELECT_PLAYED_CARDS ? (
        <GameInputPlayedCardsSelector
          name={"gameInput.clientOptions.selectedCards"}
          gameState={gameState}
          viewingPlayer={viewingPlayer}
          chooseOne={false}
          options={gameInput.cardOptions}
        />
      ) : gameInput.inputType === GameInputType.SELECT_CARDS ? (
        <GameInputCardsSelector
          name={"gameInput.clientOptions.selectedCards"}
          options={gameInput.cardOptions}
        />
      ) : gameInput.inputType === GameInputType.SELECT_PAYMENT_FOR_CARD ? (
        <GameInputSelectPaymentForCard
          name={"gameInput.clientOptions.paymentOptions.resources"}
          gameInput={gameInput}
          viewingPlayer={viewingPlayer}
        />
      ) : gameInput.inputType === GameInputType.SELECT_WORKER_PLACEMENT ? (
        <GameInputSelectWorkerPlacement
          name={"gameInput.clientOptions.selectedOption"}
          options={gameInput.options}
          gameState={gameState}
          viewingPlayer={viewingPlayer}
        />
      ) : gameInput.inputType === GameInputType.SELECT_OPTION_GENERIC ? (
        <GameInputSelectOptionGeneric
          name={"gameInput.clientOptions.selectedOption"}
          gameInput={gameInput}
          viewingPlayer={viewingPlayer}
        />
      ) : gameInput.inputType === GameInputType.VISIT_DESTINATION_CARD ? (
        <GameInputPlayedCardsSelector
          name={"gameInput.clientOptions.playedCard"}
          gameState={gameState}
          viewingPlayer={viewingPlayer}
          chooseOne={true}
          options={gameState.getVisitableDestinationCards()}
        />
      ) : gameInput.inputType === GameInputType.SELECT_LOCATION ? (
        <GameInputPlaceWorkerSelector
          name={"gameInput.clientOptions.selectedLocation"}
          viewingPlayer={viewingPlayer}
          locations={gameInput.locationOptions}
        />
      ) : gameInput.inputType === GameInputType.PLACE_AMBASSADOR ? (
        <GameInputPlaceAmbassadorSelector
          name={"gameInput.clientOptions.loc"}
          gameState={gameState}
          viewingPlayer={viewingPlayer}
          options={gameState.getPlayableAmbassadorLocations()}
        />
      ) : gameInput.inputType === GameInputType.PLAY_ADORNMENT ? (
        <GameInputPlayAdornmentSelector
          name={"gameInput.clientOptions.adornment"}
          adornments={gameState.getPlayableAdornments()}
        />
      ) : gameInput.inputType === GameInputType.SELECT_PLAYED_ADORNMENT ? (
        <GameInputPlayAdornmentSelector
          name={"gameInput.clientOptions.adornment"}
          adornments={gameInput.adornmentOptions}
        />
      ) : gameInput.inputType === GameInputType.SELECT_RIVER_DESTINATION ? (
        <GameInputSelectRiverDestinationSelector
          name={"gameInput.clientOptions.riverDestination"}
          options={gameInput.options}
        />
      ) : gameInput.inputType === GameInputType.PLAY_TRAIN_TICKET ? (
        <>
          <p className={styles.description}>
            Select a deployed worker to reactivate
          </p>
          <GameInputSelectWorkerPlacement
            name={"gameInput.clientOptions.selectedOption"}
            options={viewingPlayer.getRecallableWorkers()}
            gameState={gameState}
            viewingPlayer={viewingPlayer}
          />
        </>
      ) : gameInput.inputType === GameInputType.SELECT_CARDS_WITH_SOURCE ? (
        <GameInputSelectCardWithSourceSelector
          name={"gameInput.clientOptions.selectedCards"}
          chooseOne={
            gameInput.minToSelect === gameInput.maxToSelect &&
            gameInput.maxToSelect === 1
          }
          valueOnSelect={(item) => [item]}
          options={gameInput.cardOptions}
        />
      ) : gameInput.inputType === GameInputType.RESERVE_CARD ? (
        <GameInputSelectCardWithSourceSelector
          name={"gameInput.clientOptions.selectedOption"}
          chooseOne={true}
          options={gameState.getCardsWithSource(false, false)}
        />
      ) : gameInput.inputType === GameInputType.SELECT_TRAIN_CAR_TILE ? (
        <GameInputSelectTrainCarTileSelector
          name={"gameInput.clientOptions.trainCarTileIdx"}
          options={gameInput.options}
        />
      ) : gameInput.inputType === GameInputType.SELECT_VISITOR ? (
        <GameInputVisitorSelector
          name={"gameInput.clientOptions.selectedVisitor"}
          options={gameInput.visitorOptions}
        />
      ) : (
        <>
          {assertUnreachable(
            gameInput,
            `Unexpected game input: ${JSON.stringify(gameInput, null, 2)}`
          )}
        </>
      )}
    </div>
  );
};

const getInitialSelectedGameInput = (
  gameInput: GameInput,
  gameState: GameState
): GameInput => {
  if (gameInput.inputType === GameInputType.CLAIM_EVENT) {
    const claimableEvents = gameState.getClaimableEvents();
    if (claimableEvents.length === 1) {
      return {
        ...gameInput,
        clientOptions: {
          event: claimableEvents[0],
        },
      };
    }
  }
  return gameInput;
};

const GameInputBox: React.FC<{
  gameId: string;
  title?: string;
  devDebug?: boolean;
  gameState: GameState;
  gameInputs: GameInput[];
  viewingPlayer: Player | null;
}> = ({
  title = "Actions",
  devDebug = false,
  gameId,
  gameState,
  gameInputs,
  viewingPlayer,
}) => {
  const activePlayer = gameState.getActivePlayer();
  if (gameState.isGameOver()) {
    return <GameInputBoxText title={title} text={`Game Over!`} />;
  }
  if (!viewingPlayer) {
    return (
      <GameInputBoxText
        title={title}
        text={`${activePlayer.name}'s turn`}
        waiting={true}
      />
    );
  }
  if (gameState.activePlayerId !== viewingPlayer.playerId) {
    return (
      <GameInputBoxText
        title={title}
        text={`Waiting for ${activePlayer.name}`}
        waiting={true}
      />
    );
  }

  gameInputs.sort((a, b) =>
    (gameInputSortOrder[a.inputType] || defaultOrder) <
    (gameInputSortOrder[b.inputType] || defaultOrder)
      ? -1
      : 1
  );

  if (gameInputs.length === 0) {
    return <pre>{JSON.stringify(gameState, null, 2)}</pre>;
  }

  return (
    <GameInputBoxContainer
      title={devDebug ? title : "Your turn"}
      gameId={gameId}
      devDebug={devDebug}
      viewingPlayer={viewingPlayer}
      initialValues={{
        gameInput: getInitialSelectedGameInput(gameInputs[0], gameState),
      }}
    >
      {({ values, setFieldValue, isSubmitting, status }) => {
        const selectedGameInput = values.gameInput;

        // For inputs that require selecting multiple things, update the button
        // text to say how many have been selected.
        let submitLabel = "Submit";
        if (selectedGameInput) {
          if (
            selectedGameInput.inputType === GameInputType.SELECT_CARDS ||
            selectedGameInput.inputType === GameInputType.SELECT_PLAYED_CARDS
          ) {
            const numSelected =
              selectedGameInput.clientOptions.selectedCards.length;
            submitLabel = `${numSelected} Selected`;
          } else if (
            selectedGameInput.inputType === GameInputType.DISCARD_CARDS
          ) {
            const numSelected =
              selectedGameInput.clientOptions.cardsToDiscard.length;
            submitLabel = `${numSelected} Selected`;
          }
        }

        const selectedIdx = gameInputs.findIndex((gameInput) =>
          isEqual(
            omit(values.gameInput, ["clientOptions"]),
            omit(gameInput, ["clientOptions"])
          )
        );
        const selectedInput =
          selectedIdx === -1 ? null : gameInputs[selectedIdx];
        const tip = selectedInput && BOARD_TIPS[selectedInput.inputType];
        const error = status && status.error;

        return (
          <Form className={styles.form}>
            {!devDebug && (
              <BoardSelectionBridge
                gameInputs={gameInputs}
                gameState={gameState}
                viewingPlayer={viewingPlayer}
              />
            )}
            <div role="group" className={styles.tabs}>
              {gameInputs.map((gameInput, idx) => {
                const isSelected = idx === selectedIdx;
                return (
                  <label
                    key={idx}
                    className={[
                      styles.input_type_radio,
                      isSelected && styles.tab_selected,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <input
                      id={`js-game-input-type-${gameInput.inputType}`}
                      type="radio"
                      name="selectedInputType"
                      value={idx}
                      checked={isSelected}
                      onChange={() => {
                        setFieldValue(
                          "gameInput",
                          getInitialSelectedGameInput(gameInput, gameState)
                        );
                      }}
                    />
                    <span className={styles.tab_icon}>
                      <InputTypeIcon
                        gameInput={gameInput}
                        viewingPlayer={viewingPlayer}
                      />
                    </span>
                    <span className={styles.input_type_radio_span}>
                      {renderGameInputLabel(gameInput, gameState.gameOptions)}
                    </span>
                  </label>
                );
              })}
            </div>
            {selectedInput && (
              <div
                key={selectedIdx}
                className={[styles.input_type_form_nested, anim.fadeIn].join(
                  " "
                )}
              >
                {tip && !devDebug && <p className={styles.tip}>{tip}</p>}
                <GameInputBoxInner
                  gameInput={selectedInput}
                  gameState={gameState}
                  viewingPlayer={viewingPlayer}
                />
              </div>
            )}
            <div className={styles.submit_bar}>
              {error && (
                <div
                  key={error}
                  className={[styles.error, anim.shake].join(" ")}
                  role="alert"
                >
                  {error}
                </div>
              )}
              <button
                className={["px-btn", styles.button].join(" ")}
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "..." : submitLabel}
              </button>
            </div>
          </Form>
        );
      }}
    </GameInputBoxContainer>
  );
};

export default GameInputBox;
