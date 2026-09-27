import * as React from "react";
import { useState } from "react";

import styles from "../styles/Players.module.css";
import {
  PlayerStatus as TPlayerStatus,
  Season,
  ResourceType,
  CardType,
  TrainTicketStatus,
} from "../model/types";
import { Player } from "../model/player";
import { GameState } from "../model/gameState";
import { Card as CardModel } from "../model/card";
import { CardTypeSymbol } from "./common";
import { PlayedCard } from "./Card";
import AnimatedNumber from "./AnimatedNumber";
import { Zoomable } from "./CardZoom";
import PixelSprite, { Sprite } from "./pixel/PixelSprite";
import * as Sprites from "./pixel/sprites";
import {
  CritterAvatar,
  Meeple,
  RESOURCE_SPRITES,
  SEASON_SPRITES,
} from "./pixel/icons";
import { useGameUI, playerThemeStyle } from "./gameUI";

const RESOURCES = [
  ResourceType.TWIG,
  ResourceType.RESIN,
  ResourceType.PEBBLE,
  ResourceType.BERRY,
];

const CARD_TYPES = [
  CardType.TRAVELER,
  CardType.PRODUCTION,
  CardType.DESTINATION,
  CardType.GOVERNANCE,
  CardType.PROSPERITY,
];

const seasonClass: Record<Season, string> = {
  [Season.WINTER]: styles.pill_WINTER,
  [Season.SPRING]: styles.pill_SPRING,
  [Season.SUMMER]: styles.pill_SUMMER,
  [Season.AUTUMN]: styles.pill_AUTUMN,
};

export const Stat: React.FC<{
  sprite: Sprite;
  value: number | string;
  title: string;
  className?: string;
  iconHeight?: string;
}> = ({ sprite, value, title, className, iconHeight = "18px" }) => (
  <span
    className={[styles.stat, className].filter(Boolean).join(" ")}
    title={title}
  >
    <PixelSprite sprite={sprite} height={iconHeight} />
    <span className={styles.stat_value}>
      {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
    </span>
  </span>
);

// Workers as meeples: solid = available, faded = deployed.
export const WorkerMeeples: React.FC<{
  player: Player;
  height?: string;
}> = ({ player, height = "20px" }) => {
  const { getPlayerTheme, getNumWorkers } = useGameUI();
  const theme = getPlayerTheme(player.playerId);
  const total = Math.max(
    getNumWorkers(player.playerId),
    player.numAvailableWorkers
  );
  return (
    <span
      className={styles.meeples}
      title={`${player.numAvailableWorkers} of ${total} workers available`}
    >
      {Array.from({ length: total }).map((_, idx) => (
        <Meeple
          key={idx}
          theme={theme}
          height={height}
          ghost={idx >= player.numAvailableWorkers}
        />
      ))}
    </span>
  );
};

const MiniCity: React.FC<{ player: Player; gameState: GameState }> = ({
  player,
  gameState,
}) => {
  const { viewingPlayerId, getPlayerTheme } = useGameUI();
  const playedCards = player.getPlayedCards();
  if (playedCards.length === 0) {
    return <div className={styles.mini_city_empty}>No cards in city yet</div>;
  }
  return (
    <div className={styles.mini_city}>
      {playedCards.map((playedCard, idx) => {
        const card = CardModel.fromName(playedCard.cardName);
        const workers = playedCard.workers || [];
        return (
          <Zoomable
            key={idx}
            className={[
              styles.mini_card,
              styles[`mini_${card.cardType}`],
              card.isConstruction && playedCard.usedForCritter
                ? styles.mini_used
                : null,
            ]
              .filter(Boolean)
              .join(" ")}
            render={() => (
              <PlayedCard
                playedCard={playedCard}
                cardOwner={player}
                gameState={gameState}
                viewerId={viewingPlayerId}
              />
            )}
          >
            <span className={styles.mini_name}>{playedCard.cardName}</span>
            {workers.map((workerId, wIdx) => (
              <Meeple
                key={wIdx}
                theme={getPlayerTheme(workerId)}
                height="12px"
              />
            ))}
          </Zoomable>
        );
      })}
    </div>
  );
};

export const Players = ({
  gameState,
  viewingPlayer,
  showRealtimePoints = false,
  onShowCity,
}: {
  gameState: GameState;
  viewingPlayer: Player | null;
  showRealtimePoints?: boolean;
  onShowCity?: (playerId: string) => void;
}) => {
  return (
    <div className={styles.players}>
      <div className={styles.players_title}>Players</div>
      {gameState.players.map((player) => {
        return (
          <PlayerStatus
            key={player.playerId}
            player={player}
            gameState={gameState}
            isViewer={
              !!viewingPlayer && player.playerId === viewingPlayer.playerId
            }
            isActivePlayer={player.playerId === gameState.activePlayerId}
            showRealtimePoints={showRealtimePoints}
            onShowCity={onShowCity}
          />
        );
      })}
    </div>
  );
};

const PlayerStatus: React.FC<{
  player: Player;
  gameState: GameState;
  isViewer: boolean;
  isActivePlayer: boolean;
  showRealtimePoints?: boolean;
  onShowCity?: (playerId: string) => void;
}> = ({
  player,
  gameState,
  isViewer,
  isActivePlayer,
  showRealtimePoints,
  onShowCity,
}) => {
  const { getPlayerTheme } = useGameUI();
  const theme = getPlayerTheme(player.playerId);
  const [showMiniCity, setShowMiniCity] = useState(
    gameState.players.length <= 2
  );
  const hasPassed = player.getStatus() === TPlayerStatus.GAME_ENDED;
  const newleaf = gameState.gameOptions.newleaf;
  const pearlbrook = gameState.gameOptions.pearlbrook;
  return (
    <div
      data-cy={`player-status:${player.name}`}
      className={[
        styles.player,
        isActivePlayer && styles.active,
        isViewer && styles.viewer,
        hasPassed && styles.passed,
      ]
        .filter(Boolean)
        .join(" ")}
      style={playerThemeStyle(theme)}
    >
      {isActivePlayer && (
        <span className={styles.turn_arrow} aria-hidden={true}>
          <PixelSprite sprite={Sprites.ARROW} height="18px" />
        </span>
      )}
      <div className={styles.header}>
        <div className={styles.avatar}>
          <CritterAvatar theme={theme} height="30px" />
        </div>
        <div className={styles.identity}>
          <div className={styles.name}>
            <span className={styles.name_text}>{player.name}</span>
            {isViewer && <span className={styles.you}>you</span>}
          </div>
          <div className={styles.pills}>
            {hasPassed ? (
              <span className={[styles.pill, styles.pill_passed].join(" ")}>
                passed
              </span>
            ) : (
              <>
                <span
                  className={[
                    styles.pill,
                    seasonClass[player.currentSeason],
                  ].join(" ")}
                >
                  <PixelSprite
                    sprite={SEASON_SPRITES[player.currentSeason]}
                    height="11px"
                  />
                  {player.currentSeason.toLowerCase()}
                </span>
                {isActivePlayer && (
                  <span className={[styles.pill, styles.pill_active].join(" ")}>
                    active
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        {showRealtimePoints && (
          <div className={styles.points} title="Points">
            <span className={styles.points_label}>{"POINTS"}</span>
            <span className={styles.points_value}>
              <AnimatedNumber value={player.getPoints(gameState)} />
            </span>
          </div>
        )}
      </div>

      <div className={styles.resources}>
        {RESOURCES.map((resourceType) => (
          <Stat
            key={resourceType}
            sprite={RESOURCE_SPRITES[resourceType]}
            value={player.getNumResourcesByType(resourceType)}
            title={resourceType.toLowerCase()}
          />
        ))}
        {pearlbrook && (
          <Stat
            sprite={Sprites.PEARL}
            value={player.getNumResourcesByType(ResourceType.PEARL)}
            title="pearl"
          />
        )}
      </div>

      <div className={styles.stats}>
        <Stat
          sprite={Sprites.CARD}
          value={player.numCardsInHand}
          title="No. of Cards in hand"
        />
        <Stat
          sprite={Sprites.VP}
          value={player.getNumResourcesByType(ResourceType.VP)}
          title="VP tokens"
        />
        <Stat
          sprite={Sprites.HUT}
          value={`${player.getNumOccupiedSpacesInCity()}/${player.maxCitySize}`}
          title="City spaces used"
        />
        {newleaf?.cards && (
          <Stat
            sprite={Sprites.GOLDEN_LEAF}
            value={player.numGoldenLeaf}
            title="No. of Golden Leafs"
          />
        )}
        {pearlbrook && (
          <Stat
            sprite={Sprites.CARD}
            value={player.numAdornmentsInHand}
            title="No. of Adornment cards in hand"
            className={styles.adornment_stat}
          />
        )}
      </div>

      {(newleaf?.reserving || newleaf?.ticket) && (
        <div className={styles.tokens}>
          {newleaf?.reserving && (
            <span className={styles.token} title="Reservation Token">
              <PixelSprite sprite={Sprites.RESERVATION_TOKEN} height="16px" />
              {player.canReserveCard()
                ? "Unused"
                : player.getReservedCardOrNull() ?? "Used"}
            </span>
          )}
          {newleaf?.ticket && (
            <span
              className={styles.token}
              title="Train Ticket: Use to reactivate a deployed worker"
            >
              <PixelSprite sprite={Sprites.TICKET} height="16px" />
              {player.trainTicketStatus === TrainTicketStatus.VALID_FROM_WINTER
                ? "Valid from Winter"
                : player.trainTicketStatus ===
                  TrainTicketStatus.VALID_FROM_SUMMER
                ? "Valid from Summer"
                : "Discarded"}
            </span>
          )}
        </div>
      )}

      <div className={styles.workers_row}>
        <span className="sr-only">
          {"WORKERS"}
          {player.numAvailableWorkers}
        </span>
        <WorkerMeeples player={player} />
        {pearlbrook && (
          <span className={styles.ambassador} title="Ambassador">
            <span className="sr-only">
              {"AMBASSADORS"}
              {player.hasUnusedAmbassador() ? 1 : 0}
            </span>
            <Meeple
              frog
              theme={theme}
              height="20px"
              ghost={!player.hasUnusedAmbassador()}
            />
          </span>
        )}
      </div>

      <div className={styles.types_row}>
        <span className={styles.types}>
          {CARD_TYPES.map((cardType) => (
            <span
              key={cardType}
              className={styles.type_count}
              title={`${cardType.toLowerCase()} cards in city`}
            >
              <span className={styles.type_icon}>
                <CardTypeSymbol cardType={cardType} />
              </span>
              {player.getNumCardType(cardType)}
            </span>
          ))}
        </span>
        <button
          type="button"
          className={styles.city_toggle}
          onClick={() => setShowMiniCity(!showMiniCity)}
          aria-expanded={showMiniCity}
          title={showMiniCity ? "Hide city" : "Show city"}
        >
          {showMiniCity ? "\u25B4" : "\u25BE"}
        </button>
      </div>

      {showMiniCity && (
        <div className={styles.city_section}>
          <MiniCity player={player} gameState={gameState} />
          {onShowCity && (
            <button
              type="button"
              className={styles.open_city}
              onClick={() => onShowCity(player.playerId)}
            >
              {isViewer ? "Open your city" : `Open ${player.name}'s city`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Players;
