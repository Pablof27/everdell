import * as React from "react";
import styles from "../styles/gameBoard.module.css";
import anim from "../styles/animations.module.css";
import {
  CardName,
  CardWithSource,
  EventName,
  LocationName,
  LocationType,
  EventType,
} from "../model/types";
import { Player } from "../model/player";
import { GameState } from "../model/gameState";
import { Event as EventModel, oldEventEnums } from "../model/event";
import { Location as LocationModel } from "../model/location";
import { Visitor as VisitorModel } from "../model/visitor";

import Card, { PlayedCard, EmptyCard } from "./Card";
import Location from "./Location";
import TrainCarTile from "./TrainCarTile";
import { RiverDestinationSpot } from "./RiverDestination";
import Adornment from "./Adornment";
import Event, { EventInner } from "./Event";
import { VisitorInner as Visitor } from "./Visitor";
import { GameBlock, ItemWrapper } from "./common";
import { Zoomable } from "./CardZoom";
import { useBoardSelection, isSameCardWithSource } from "./BoardSelection";
import { BoardScenery } from "./Ambience";
import PixelSprite from "./pixel/PixelSprite";
import * as Sprites from "./pixel/sprites";

// Keys cards by name + occurrence so a card keeps its element when others
// leave the row, and only newly dealt cards animate in.
export function keyByOccurrence(names: (string | null)[]): string[] {
  const seen: Record<string, number> = {};
  return names.map((name) => {
    const key = name || "empty";
    seen[key] = (seen[key] || 0) + 1;
    return `${key}#${seen[key]}`;
  });
}

// A card on the board (meadow / station / hand) that can be clicked to play.
export const BoardCard: React.FC<{
  cardName: CardName;
  cardWithSource: CardWithSource;
  interactive?: boolean;
  zoomable?: boolean;
  delay?: number;
  className?: string;
  badgeOnTop?: boolean;
}> = ({
  cardName,
  cardWithSource,
  interactive = true,
  zoomable = true,
  delay = 0,
  className,
  badgeOnTop = false,
}) => {
  const selection = useBoardSelection();
  const isPlayable =
    interactive &&
    selection.cardOptions.some((x) => isSameCardWithSource(x, cardWithSource));
  const isSelected =
    interactive && isSameCardWithSource(selection.selectedCard, cardWithSource);
  const select = () => selection.selectCard(cardWithSource);
  return (
    <div
      className={[
        styles.board_card,
        anim.dealIn,
        isPlayable && styles.playable,
        isSelected && styles.selected_card,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
      onClick={isPlayable ? select : undefined}
      role={isPlayable ? "button" : undefined}
      tabIndex={isPlayable ? 0 : undefined}
      onKeyDown={
        isPlayable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                select();
              }
            }
          : undefined
      }
      title={isPlayable ? `Click to play ${cardName}` : undefined}
    >
      <Zoomable
        disabled={!zoomable}
        render={() => <Card name={cardName} />}
        className={styles.board_card_inner}
      >
        <Card name={cardName} />
      </Zoomable>
      {isPlayable && (
        <span
          className={[styles.play_badge, badgeOnTop && styles.play_badge_top]
            .filter(Boolean)
            .join(" ")}
          aria-hidden={true}
        >
          {isSelected ? "Selected" : "Play"}
        </span>
      )}
    </div>
  );
};

export const Meadow: React.FC<{
  meadowCards: CardName[];
  interactive?: boolean;
}> = ({ meadowCards, interactive = false }) => {
  const keys = keyByOccurrence(meadowCards);
  return (
    <GameBlock
      title={"Meadow"}
      className={styles.meadow_block}
      icon={<PixelSprite sprite={Sprites.BLOSSOM} height="16px" />}
    >
      <div id={"js-meadow-cards"} className={styles.meadow_grid}>
        {meadowCards.map((cardName, idx) => (
          <BoardCard
            key={keys[idx]}
            cardName={cardName}
            cardWithSource={{ card: cardName, source: "MEADOW", sourceIdx: idx }}
            interactive={interactive}
            delay={idx * 60}
          />
        ))}
      </div>
    </GameBlock>
  );
};

const StationCard: React.FC<{
  position: 0 | 1 | 2;
  gameState: GameState;
  interactive: boolean;
}> = ({ position, gameState, interactive }) => {
  if (!gameState.trainCarTileStack) {
    return null;
  }
  const cardName = gameState.stationCards[position];
  return (
    <div className={styles.station_card}>
      {cardName ? (
        <BoardCard
          key={cardName}
          cardName={cardName}
          cardWithSource={{
            card: cardName,
            source: "STATION",
            sourceIdx: position,
          }}
          interactive={interactive}
        />
      ) : (
        <EmptyCard label="Empty" />
      )}
      <TrainCarTile
        name={gameState.trainCarTileStack.peekAt(position)}
        label={`Station ${position + 1}`}
      />
    </div>
  );
};

export const Station: React.FC<{
  gameState: GameState;
  interactive?: boolean;
}> = ({ gameState, interactive = false }) => {
  if (!gameState.trainCarTileStack) {
    return null;
  }
  return (
    <GameBlock
      title={"Station"}
      icon={<PixelSprite sprite={Sprites.TRAIN} height="16px" />}
    >
      <div id={"js-station"} className={styles.station_cards}>
        <StationCard
          position={0}
          gameState={gameState}
          interactive={interactive}
        />
        <StationCard
          position={1}
          gameState={gameState}
          interactive={interactive}
        />
        <StationCard
          position={2}
          gameState={gameState}
          interactive={interactive}
        />
      </div>
    </GameBlock>
  );
};

const renderLocation = (
  name: LocationName,
  gameState: GameState,
  viewingPlayer: Player | null
) => (
  <Location
    key={name}
    name={name}
    gameState={gameState}
    viewingPlayer={viewingPlayer}
    workers={gameState.locationsMap[name] || []}
  />
);

const getLocationsOfType = (
  gameState: GameState,
  locationType: LocationType
): LocationName[] =>
  (Object.keys(gameState.locationsMap) as LocationName[]).filter(
    (name) => LocationModel.fromName(name).type === locationType
  );

const SectionLabel: React.FC<{ hint?: string }> = ({ hint, children }) => (
  <div className={styles.section_label}>
    <span>{children}</span>
    {hint && <small>{hint}</small>}
  </div>
);

const JourneyTrack: React.FC<{
  gameState: GameState;
  viewingPlayer: Player | null;
  locations: LocationName[];
}> = ({ gameState, viewingPlayer, locations }) => {
  if (locations.length === 0) {
    return null;
  }
  const sorted = [...locations].sort(
    (a, b) =>
      LocationModel.fromName(b).getPoints(viewingPlayer as Player, gameState) -
      LocationModel.fromName(a).getPoints(viewingPlayer as Player, gameState)
  );
  return (
    <div className={styles.journey}>
      <SectionLabel hint="Autumn">Journey</SectionLabel>
      <div className={styles.journey_list}>
        {sorted.map((name) => (
          <Location
            key={name}
            name={name}
            variant="row"
            gameState={gameState}
            viewingPlayer={viewingPlayer}
            workers={gameState.locationsMap[name] || []}
          />
        ))}
      </div>
    </div>
  );
};

export const Events: React.FC<{
  gameState: GameState;
  interactive?: boolean;
}> = ({ gameState, interactive = false }) => {
  const getClaimerId = (name: EventName): string | null => {
    // See comment above oldEventEnums
    const oldEventName = Object.keys(gameState.eventsMap).find(
      (oldEventName) => {
        if (oldEventEnums[oldEventName]) {
          const oldName = oldEventEnums[oldEventName];
          return EventName[oldName as keyof typeof EventName] === name;
        }
      }
    );
    return (
      gameState.eventsMap[name] ||
      (oldEventName && gameState.eventsMap[oldEventName as EventName]) ||
      null
    );
  };
  const typeOrder: Record<EventType, number> = {
    [EventType.BASIC]: 0,
    [EventType.SPECIAL]: 1,
    [EventType.WONDER]: 2,
  };
  const allEventObj = (Object.keys(gameState.eventsMap) as EventName[]).map(
    (eventName) => EventModel.fromName(eventName)
  );
  allEventObj.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

  return (
    <GameBlock
      title={gameState.gameOptions.pearlbrook ? "Events & Wonders" : "Events"}
      icon={<PixelSprite sprite={Sprites.FLAG} height="16px" />}
      className={styles.events_block}
    >
      <div id={"js-game-events"} className={styles.event_items}>
        {allEventObj.map((event) => {
          const playerId = getClaimerId(event.name);
          return (
            <Zoomable
              key={event.name}
              className={styles.event_item}
              render={() => <EventInner name={event.name} />}
            >
              <Event
                name={event.name}
                claimedBy={playerId ? gameState.getPlayer(playerId).name : null}
                claimedById={playerId}
                compact={true}
                interactive={interactive}
              />
            </Zoomable>
          );
        })}
      </div>
    </GameBlock>
  );
};

export const PlayerCity: React.FC<{
  player: Player;
  gameState: GameState;
  viewerId: string | null;
}> = ({ player, viewerId, gameState }) => {
  const playedCards = player.getPlayedCards();
  const playedAdornments = player.getPlayedAdornments();
  const playedCardIdx: { [cardName: string]: number } = {};
  const claimedVisitors = player.claimedVisitors;

  const labelToCount: [string, number][] = [
    ["Critters", player.getNumPlayedCritters()],
    ["Constructions", player.getNumPlayedConstructions()],
    ["Common Critters", player.getNumPlayedCommonCritters()],
    ["Common Constructions", player.getNumPlayedCommonConstructions()],
    ["Unique Critters", player.getNumPlayedUniqueCritters()],
    ["Unique Constructions", player.getNumPlayedUniqueConstructions()],
  ];

  return playedCards.length !== 0 ||
    playedAdornments.length !== 0 ||
    claimedVisitors.length !== 0 ? (
    <div data-cy={`player-city:${player.name}`} className={styles.city}>
      <div className={styles.city_stats}>
        {labelToCount
          .filter(([_, count]) => count)
          .map(([label, count]) => {
            return (
              <div key={label} className={styles.city_stat}>
                <span>{label}: </span>
                <b>{count}</b>
              </div>
            );
          })}
      </div>
      <div className={styles.items}>
        {playedCards.map((playedCard, idx) => {
          const cardName = playedCard.cardName;
          playedCardIdx[cardName] = (playedCardIdx[cardName] || 0) + 1;
          return (
            <ItemWrapper key={`card-${idx}`}>
              <PlayedCard
                playedCard={playedCard}
                gameState={gameState}
                viewerId={viewerId}
                cardOwner={player}
                cardIdx={playedCardIdx[cardName]}
              />
            </ItemWrapper>
          );
        })}
        {playedAdornments.map((playedAdornment, idx) => (
          <Adornment key={`adornment-${idx}`} name={playedAdornment} />
        ))}
        {claimedVisitors.map((claimedVisitor, idx) => (
          <ItemWrapper key={`visitor-${idx}`}>
            <Visitor name={claimedVisitor} />
            <div className={styles.visitor_meta_data}>
              Points:{" "}
              {VisitorModel.fromName(claimedVisitor).getPoints(
                player,
                gameState
              )}
            </div>
          </ItemWrapper>
        ))}
      </div>
    </div>
  ) : (
    <div data-cy={`player-city:${player.name}`} className={styles.empty_city}>
      City is empty.
    </div>
  );
};

export const GameBoard: React.FC<{
  gameState: GameState;
  viewingPlayer: Player | null;
}> = ({ gameState, viewingPlayer }) => {
  const renderLoc = (name: LocationName) =>
    renderLocation(name, gameState, viewingPlayer);
  const basic = getLocationsOfType(gameState, LocationType.BASIC);
  const forest = getLocationsOfType(gameState, LocationType.FOREST);
  const haven = getLocationsOfType(gameState, LocationType.HAVEN);
  const journey = getLocationsOfType(gameState, LocationType.JOURNEY);
  const knoll = getLocationsOfType(gameState, LocationType.KNOLL);
  const station = getLocationsOfType(gameState, LocationType.STATION);
  const half = Math.ceil(forest.length / 2);
  const interactive =
    !!viewingPlayer && gameState.activePlayerId === viewingPlayer.playerId;
  const showStationCards = !!gameState.gameOptions.newleaf?.station;
  const visitors =
    station.length !== 0 && gameState.visitorStack
      ? gameState.visitorStack.getRevealedVisitors().filter(Boolean)
      : [];

  return (
    <div className={styles.board}>
      <BoardScenery />
      <section className={styles.riverbank}>
        <SectionLabel>Basic Locations</SectionLabel>
        <div className={styles.basic_row}>{basic.map(renderLoc)}</div>
      </section>
      <section className={styles.clearing}>
        <div className={[styles.side_col, styles.side_left].join(" ")}>
          <SectionLabel>Forest</SectionLabel>
          {forest.slice(0, half).map(renderLoc)}
          {haven.map(renderLoc)}
        </div>
        <Meadow meadowCards={gameState.meadowCards} interactive={interactive} />
        <div className={[styles.side_col, styles.side_right].join(" ")}>
          {forest.length > 1 && <SectionLabel>Forest</SectionLabel>}
          {forest.slice(half).map(renderLoc)}
          <JourneyTrack
            gameState={gameState}
            viewingPlayer={viewingPlayer}
            locations={journey}
          />
        </div>
      </section>
      <Events gameState={gameState} interactive={interactive} />
      {gameState.gameOptions.pearlbrook && gameState.riverDestinationMap && (
        <River gameState={gameState} viewingPlayer={viewingPlayer} />
      )}
      {(showStationCards || visitors.length !== 0 || knoll.length !== 0) && (
        <section className={styles.expansion_row}>
          {showStationCards && (
            <Station gameState={gameState} interactive={interactive} />
          )}
          {visitors.length !== 0 && (
            <GameBlock
              title="Visitors"
              icon={<PixelSprite sprite={Sprites.TICKET} height="16px" />}
            >
              <div className={styles.station_visitors}>
                {station.map(renderLoc)}
                {visitors.map((visitor) => (
                  <ItemWrapper key={visitor}>
                    <Visitor name={visitor} />
                  </ItemWrapper>
                ))}
              </div>
            </GameBlock>
          )}
          {knoll.length !== 0 && (
            <GameBlock
              title="Knoll"
              icon={<PixelSprite sprite={Sprites.HILL} height="16px" />}
            >
              <div className={styles.station_visitors}>
                {knoll.map(renderLoc)}
              </div>
            </GameBlock>
          )}
        </section>
      )}
    </div>
  );
};

export const River: React.FC<{
  gameState: GameState;
  viewingPlayer: Player | null;
}> = ({ gameState }) => {
  return (
    <GameBlock
      title={"River"}
      icon={<PixelSprite sprite={Sprites.PEARL} height="16px" />}
      className={styles.river_block}
    >
      <div id={"js-game-river"} className={styles.river_items}>
        {gameState
          .riverDestinationMap!.spotEntries()
          .map(([spotName, spotInfo], idx) => {
            return (
              <RiverDestinationSpot
                key={idx}
                name={spotName}
                destination={spotInfo.name}
                ambassadors={spotInfo.ambassadors.map(
                  (playerId) => gameState.getPlayer(playerId).name
                )}
                ambassadorIds={spotInfo.ambassadors}
              />
            );
          })}
      </div>
    </GameBlock>
  );
};
