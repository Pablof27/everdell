import * as React from "react";
import Link from "next/link";

import styles from "../styles/GameTopBar.module.css";
import anim from "../styles/animations.module.css";
import { GameState } from "../model/gameState";
import { Player } from "../model/player";
import { GameInputMultiStep } from "../model/types";
import { renderGameInputLabel } from "./gameInputCommon";
import PixelSprite from "./pixel/PixelSprite";
import * as Sprites from "./pixel/sprites";
import { CritterAvatar, SEASON_SPRITES } from "./pixel/icons";
import { useGameUI, playerThemeStyle } from "./gameUI";

const TurnBanner: React.FC<{
  gameState: GameState;
  viewingPlayer: Player | null;
}> = ({ gameState, viewingPlayer }) => {
  const { getPlayerTheme } = useGameUI();
  const activePlayer = gameState.getActivePlayer();
  const theme = getPlayerTheme(activePlayer.playerId);

  if (gameState.isGameOver()) {
    let best = -Infinity;
    gameState.players.forEach((p) => {
      best = Math.max(best, p.getPoints(gameState));
    });
    const winners = gameState.players.filter(
      (p) => p.getPoints(gameState) === best
    );
    return (
      <div className={[styles.banner, styles.banner_over].join(" ")}>
        <PixelSprite sprite={Sprites.CROWN} height="22px" className={anim.bob} />
        <span className={styles.banner_text}>
          Game over!{" "}
          <b>
            {winners.map((p) => p.name).join(" & ")}{" "}
            {winners.length > 1 ? "tie" : "wins"}
          </b>
        </span>
      </div>
    );
  }

  const isViewerTurn =
    !!viewingPlayer && viewingPlayer.playerId === activePlayer.playerId;
  if (isViewerTurn) {
    const pending = gameState.pendingGameInputs[0] as
      | GameInputMultiStep
      | undefined;
    return (
      <div
        className={[styles.banner, styles.banner_you].join(" ")}
        style={playerThemeStyle(theme)}
      >
        <CritterAvatar theme={theme} height="26px" className={anim.bob} />
        <span className={styles.banner_text}>
          <b>Your turn!</b>
          <span className={styles.banner_hint}>
            {pending
              ? renderGameInputLabel(pending, gameState.gameOptions)
              : "Place a worker, play a card or claim an event"}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className={styles.banner} style={playerThemeStyle(theme)}>
      <CritterAvatar theme={theme} height="26px" />
      <span className={styles.banner_text}>
        {viewingPlayer ? (
          <>Waiting for {activePlayer.name}</>
        ) : (
          <>{activePlayer.name}&apos;s turn</>
        )}
        <span className={styles.dots} aria-hidden={true}>
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </span>
      <PixelSprite
        sprite={Sprites.HOURGLASS}
        height="20px"
        className={anim.hourglass}
      />
    </div>
  );
};

const GameTopBar: React.FC<{
  gameState: GameState;
  viewingPlayer: Player | null;
  deckCount: number;
  discardCount: number;
}> = ({ gameState, viewingPlayer, deckCount, discardCount }) => {
  const isViewerTurn =
    !gameState.isGameOver() &&
    !!viewingPlayer &&
    gameState.activePlayerId === viewingPlayer.playerId;

  // Pop a "Your turn" toast whenever the turn passes to the viewer.
  const [toastKey, setToastKey] = React.useState(0);
  React.useEffect(() => {
    if (isViewerTurn) {
      setToastKey((k) => k + 1);
    }
  }, [isViewerTurn]);

  React.useEffect(() => {
    document.title = isViewerTurn ? "\u2605 Your turn \u00b7 Everdell" : "Everdell";
  }, [isViewerTurn]);

  return (
    <header className={styles.topbar}>
      <Link className={styles.logo} href="/">
        <PixelSprite sprite={Sprites.TREE} height="30px" />
        <span>Everdell</span>
      </Link>
      <TurnBanner gameState={gameState} viewingPlayer={viewingPlayer} />
      <div className={styles.counters}>
        <span className={styles.counter} title="Cards left in the deck">
          <PixelSprite sprite={Sprites.CARD} height="20px" />
          <span className={styles.counter_label}>Deck</span>
          <b>{deckCount}</b>
        </span>
        <span className={styles.counter} title="Cards in the discard pile">
          <PixelSprite
            sprite={Sprites.CARD}
            height="20px"
            colors={{ L: "#d9d2c3", B: "#8f8577", g: "#bdb4a3", G: "#8f8577" }}
          />
          <span className={styles.counter_label}>Discard</span>
          <b>{discardCount}</b>
        </span>
        {viewingPlayer && (
          <span
            className={styles.counter}
            title={`Your season: ${viewingPlayer.currentSeason}`}
          >
            <PixelSprite
              sprite={SEASON_SPRITES[viewingPlayer.currentSeason]}
              height="20px"
            />
            <b>{viewingPlayer.currentSeason}</b>
          </span>
        )}
      </div>
      {isViewerTurn && toastKey > 0 && (
        <div key={toastKey} className={styles.toast} aria-hidden={true}>
          Your turn!
        </div>
      )}
    </header>
  );
};

export default GameTopBar;
