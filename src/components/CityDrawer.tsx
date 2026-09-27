import * as React from "react";

import styles from "../styles/CityDrawer.module.css";
import { GameState } from "../model/gameState";
import { Player } from "../model/player";
import { PlayerCity } from "./gameBoard";
import { CritterAvatar } from "./pixel/icons";
import { useGameUI, playerThemeStyle } from "./gameUI";

// Slide-up sheet with a player's full city. The viewer's city stays mounted
// (hidden) so it is always part of the page.
const CityDrawer: React.FC<{
  gameState: GameState;
  viewingPlayer: Player | null;
  openPlayerId: string | null;
  onClose: () => void;
}> = ({ gameState, viewingPlayer, openPlayerId, onClose }) => {
  const { getPlayerTheme } = useGameUI();
  const isOpen = !!openPlayerId;
  const openPlayer = openPlayerId ? gameState.getPlayer(openPlayerId) : null;
  const isViewerCity =
    !!viewingPlayer && openPlayerId === viewingPlayer.playerId;

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && (
        <div className={styles.backdrop} onClick={onClose} aria-hidden={true} />
      )}
      <div
        className={[styles.drawer, isOpen && styles.open]
          .filter(Boolean)
          .join(" ")}
        role="dialog"
        aria-modal={isOpen}
        aria-hidden={!isOpen}
        aria-label={openPlayer ? `${openPlayer.name}'s city` : "City"}
        style={
          openPlayer
            ? playerThemeStyle(getPlayerTheme(openPlayer.playerId))
            : undefined
        }
      >
        <div className={styles.header}>
          {openPlayer && (
            <CritterAvatar
              theme={getPlayerTheme(openPlayer.playerId)}
              height="28px"
            />
          )}
          <div className={styles.title}>
            {isViewerCity
              ? "Your City"
              : openPlayer
              ? `${openPlayer.name}'s City`
              : "City"}
            {openPlayer && (
              <span className={styles.count}>
                {openPlayer.getNumOccupiedSpacesInCity()}/
                {openPlayer.maxCitySize}
              </span>
            )}
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close city"
          >
            {"\u2715"}
          </button>
        </div>
        <div className={styles.body}>
          {viewingPlayer && (
            <div hidden={!isViewerCity}>
              <PlayerCity
                player={viewingPlayer}
                viewerId={viewingPlayer.playerId}
                gameState={gameState}
              />
            </div>
          )}
          {openPlayer && !isViewerCity && (
            <PlayerCity
              player={openPlayer}
              viewerId={viewingPlayer ? viewingPlayer.playerId : null}
              gameState={gameState}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default CityDrawer;
