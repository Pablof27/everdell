import * as React from "react";
import { Player } from "../model/player";
import { GameState } from "../model/gameState";
import { ResourceType } from "../model/types";
import styles from "../styles/ViewerUI.module.css";

import { BoardCard, keyByOccurrence } from "./gameBoard";
import Adornment from "./Adornment";
import AnimatedNumber from "./AnimatedNumber";
import { WorkerMeeples } from "./Players";
import PixelSprite from "./pixel/PixelSprite";
import * as Sprites from "./pixel/sprites";
import { RESOURCE_SPRITES, SEASON_SPRITES } from "./pixel/icons";
import { useGameUI, playerThemeStyle } from "./gameUI";

const TRAY_RESOURCES = [
  ResourceType.TWIG,
  ResourceType.RESIN,
  ResourceType.PEBBLE,
  ResourceType.BERRY,
];

// The viewer's dock, pinned to the bottom of the screen: hand + resources.
const ViewerUI: React.FC<{
  player: Player;
  gameState: GameState;
  onShowCity?: (playerId: string) => void;
}> = ({ player, gameState, onShowCity }) => {
  const { getPlayerTheme } = useGameUI();
  const theme = getPlayerTheme(player.playerId);
  const reservedCard = player.getReservedCardOrNull();
  const cardsInHand = player.getCardsInHand();
  const handKeys = keyByOccurrence(cardsInHand);
  const isActive = gameState.activePlayerId === player.playerId;
  const mid = (cardsInHand.length - 1) / 2;
  return (
    <div className={styles.dock} style={playerThemeStyle(theme)}>
      <div className={styles.hand_area}>
        <div className={styles.dock_label}>
          Your hand{" "}
          <b>
            {player.numCardsInHand}/{player.maxHandSize}
          </b>
        </div>
        <div id={"js-player-hand"} className={styles.hand}>
          {cardsInHand.length === 0 &&
            player.getAdornmentsInHand().length === 0 && (
              <div className={styles.empty_hand}>No cards in hand</div>
            )}
          {cardsInHand.map((cardName, idx) => (
            <div
              key={handKeys[idx]}
              className={styles.hand_slot}
              style={{
                ["--fan-rot" as any]: `${((idx - mid) * 1.6).toFixed(1)}deg`,
                ["--fan-y" as any]: `${Math.round(Math.abs(idx - mid) * 4)}px`,
                zIndex: idx + 1,
              }}
            >
              <BoardCard
                cardName={cardName}
                cardWithSource={{ card: cardName, source: "HAND" }}
                interactive={isActive}
                zoomable={false}
                badgeOnTop={true}
                delay={idx * 40}
              />
            </div>
          ))}
          {player.getAdornmentsInHand().map((name, idx) => (
            <div key={`adornment-${idx}`} className={styles.hand_adornment}>
              <Adornment name={name} />
            </div>
          ))}
        </div>
      </div>
      {reservedCard && (
        <div className={styles.reserved_area}>
          <div className={styles.dock_label}>Reserved</div>
          <div className={styles.hand_slot}>
            <BoardCard
              cardName={reservedCard}
              cardWithSource={{ card: reservedCard, source: "RESERVED" }}
              interactive={isActive}
              zoomable={false}
              badgeOnTop={true}
            />
          </div>
        </div>
      )}
      <div className={styles.tray}>
        <div className={styles.tray_resources}>
          {TRAY_RESOURCES.map((resourceType) => (
            <span
              key={resourceType}
              className={styles.tray_resource}
              title={resourceType.toLowerCase()}
            >
              <PixelSprite
                sprite={RESOURCE_SPRITES[resourceType]}
                height="30px"
              />
              <span className={styles.tray_value}>
                <AnimatedNumber
                  value={player.getNumResourcesByType(resourceType)}
                />
              </span>
            </span>
          ))}
          {gameState.gameOptions.pearlbrook && (
            <span className={styles.tray_resource} title="pearl">
              <PixelSprite sprite={Sprites.PEARL} height="30px" />
              <span className={styles.tray_value}>
                <AnimatedNumber
                  value={player.getNumResourcesByType(ResourceType.PEARL)}
                />
              </span>
            </span>
          )}
        </div>
        <div className={styles.tray_row}>
          <span className={styles.tray_chip} title="VP tokens">
            <PixelSprite sprite={Sprites.VP} height="20px" />
            <AnimatedNumber value={player.getNumResourcesByType(ResourceType.VP)} />
          </span>
          <span className={styles.tray_chip} title="Workers">
            <WorkerMeeples player={player} height="22px" />
          </span>
          <span
            className={styles.tray_chip}
            title={`Season: ${player.currentSeason}`}
          >
            <PixelSprite
              sprite={SEASON_SPRITES[player.currentSeason]}
              height="18px"
            />
            {player.currentSeason}
          </span>
          {onShowCity && (
            <button
              type="button"
              className={styles.city_button}
              onClick={() => onShowCity(player.playerId)}
            >
              <PixelSprite sprite={Sprites.HUT} height="18px" />
              City{" "}
              <b>
                {player.getNumOccupiedSpacesInCity()}/{player.maxCitySize}
              </b>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewerUI;
