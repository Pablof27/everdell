import * as React from "react";
import { useState, useCallback } from "react";
import { unstable_batchedUpdates } from "react-dom";

import { GameBoard } from "./gameBoard";
import Players from "./Players";
import GamePointsBreakdown from "./GamePointsBreakdown";
import ViewerUI from "./ViewerUI";
import GameInputBox from "./GameInputBox";
import GameUpdater from "./GameUpdater";
import GameLog from "./GameLog";
import GameTopBar from "./GameTopBar";
import CityDrawer from "./CityDrawer";
import { GameUIProvider } from "./gameUI";
import { BoardSelectionProvider } from "./BoardSelection";
import { ZoomProvider } from "./CardZoom";
import { SeasonParticles } from "./Ambience";
import { spriteToDataUri } from "./pixel/PixelSprite";
import * as Sprites from "./pixel/sprites";
import { Player } from "../model/player";
import { GameState } from "../model/gameState";
import { GameInput } from "../model/types";
import { GameJSON, PlayerJSON } from "../model/jsonTypes";

import styles from "../styles/Game.module.css";

const TEXTURES = {
  ["--grass-tile" as any]: spriteToDataUri(Sprites.GRASS_TILE, 3),
  ["--water-tile" as any]: spriteToDataUri(Sprites.WATER_TILE, 3),
};

const Game: React.FC<{
  gameJSON: GameJSON;
  gameInputs: GameInput[];
  viewingPlayerJSON: PlayerJSON | null;
}> = (props) => {
  const [gameJSON, setGameJSON] = useState(props.gameJSON);
  const [gameInputs, setGameInputs] = useState(props.gameInputs);
  const [viewingPlayerJSON, setViewingPlayerJSON] = useState(
    props.viewingPlayerJSON
  );
  const [cityPlayerId, setCityPlayerId] = useState<string | null>(null);
  const closeCity = useCallback(() => setCityPlayerId(null), []);
  const updateGameAndViewingPlayer = useCallback(
    ({ game, viewingPlayer, gameInputs }) => {
      unstable_batchedUpdates(() => {
        setGameJSON(game);
        setViewingPlayerJSON(viewingPlayer);
        setGameInputs(gameInputs);
      });
    },
    [gameJSON, viewingPlayerJSON, gameInputs]
  );

  const { gameId, gameState: gameStateJSON } = gameJSON;
  const { playerId = null, playerSecret = null } = viewingPlayerJSON || {};

  gameStateJSON.players = gameStateJSON.players.map((playerJSON) => {
    if (playerJSON.playerId === viewingPlayerJSON?.playerId) {
      return viewingPlayerJSON;
    } else {
      return playerJSON;
    }
  });

  const gameState = GameState.fromJSON(gameStateJSON);
  const viewingPlayer = viewingPlayerJSON
    ? Player.fromJSON(viewingPlayerJSON)
    : null;
  const season = (viewingPlayer || gameState.getActivePlayer()).currentSeason;

  return (
    <GameUpdater
      gameId={gameId}
      playerId={playerId}
      isGameOver={gameState.isGameOver()}
      activePlayerId={gameState.activePlayerId}
      playerSecret={playerSecret as string}
      gameStateId={gameState.gameStateId}
      onUpdate={updateGameAndViewingPlayer}
    >
      <GameUIProvider
        gameState={gameState}
        viewingPlayerId={viewingPlayer ? viewingPlayer.playerId : null}
      >
        <BoardSelectionProvider>
          <ZoomProvider>
            <div
              className={[styles.container, viewingPlayer && styles.with_dock]
                .filter(Boolean)
                .join(" ")}
              style={TEXTURES}
            >
              <SeasonParticles season={season} />
              <GameTopBar
                gameState={gameState}
                viewingPlayer={viewingPlayer}
                deckCount={gameStateJSON.deck.numCards}
                discardCount={gameStateJSON.discardPile.numCards}
              />
              <div className={styles.layout}>
                <aside className={styles.rail}>
                  <Players
                    viewingPlayer={viewingPlayer}
                    gameState={gameState}
                    onShowCity={setCityPlayerId}
                    showRealtimePoints={
                      gameState.gameOptions.realtimePoints ||
                      // Game options used to be on the game object.
                      // Keeping this for backwards compatibility.
                      !!(gameJSON as any)?.gameOptions?.realtimePoints
                    }
                  />
                </aside>
                <main className={styles.main}>
                  {gameState.isGameOver() && (
                    <GamePointsBreakdown gameState={gameState} />
                  )}
                  <GameBoard
                    gameState={gameState}
                    viewingPlayer={viewingPlayer}
                  />
                </main>
                <aside className={styles.side}>
                  <div className={styles.actions}>
                    <GameInputBox
                      key={gameState.gameStateId}
                      gameId={gameId}
                      gameState={gameState}
                      gameInputs={gameInputs}
                      viewingPlayer={viewingPlayer}
                    />
                  </div>
                  <div className={styles.log}>
                    <GameLog
                      logs={gameState.getGameLog()}
                      gameStateJSON={gameStateJSON}
                    />
                  </div>
                </aside>
              </div>
              {viewingPlayer && (
                <ViewerUI
                  player={viewingPlayer}
                  gameState={gameState}
                  onShowCity={setCityPlayerId}
                />
              )}
              <CityDrawer
                gameState={gameState}
                viewingPlayer={viewingPlayer}
                openPlayerId={cityPlayerId}
                onClose={closeCity}
              />
            </div>
          </ZoomProvider>
        </BoardSelectionProvider>
      </GameUIProvider>
    </GameUpdater>
  );
};

export default Game;
