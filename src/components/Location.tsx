import * as React from "react";
import styles from "../styles/location.module.css";
import anim from "../styles/animations.module.css";

import { Player } from "../model/player";
import { GameState } from "../model/gameState";
import { Location as LocationModel } from "../model/location";
import {
  Season,
  LocationName,
  LocationType,
  LocationOccupancy,
} from "../model/types";
import { Description, ItemWrapper, Points, WorkerSpotIcon } from "./common";
import PixelSprite, { Sprite } from "./pixel/PixelSprite";
import * as Sprites from "./pixel/sprites";
import { Meeple } from "./pixel/icons";
import { useGameUI } from "./gameUI";
import { useBoardSelection } from "./BoardSelection";

const colorClassMap = {
  BASIC: styles.color_basic,
  FOREST: styles.color_forest,
  HAVEN: styles.color_haven,
  JOURNEY: styles.color_journey,
  KNOLL: styles.color_knoll,
  STATION: styles.color_station,
};

const ICONS: Record<LocationType, Sprite> = {
  BASIC: Sprites.SIGNPOST,
  FOREST: Sprites.TREE_ICON,
  HAVEN: Sprites.HUT,
  JOURNEY: Sprites.MOUNTAIN,
  KNOLL: Sprites.HILL,
  STATION: Sprites.TRAIN,
};

export const LocationInner: React.FC<{ name: LocationName }> = ({ name }) => {
  const location = LocationModel.fromName(name as any);
  const colorClass = colorClassMap[location.type];
  return (
    <div className={[styles.location, colorClass].join(" ")}>
      <div className={styles.location_top}>
        <PixelSprite
          sprite={ICONS[location.type]}
          height="1.5em"
          className={styles.location_icon}
        />
        <span className={styles.location_type}>{location.type}</span>
        <span className={styles.location_occupancy}>
          {location.occupancy === LocationOccupancy.UNLIMITED
            ? "1+"
            : location.occupancy === LocationOccupancy.UNLIMITED_MAX_ONE
            ? "1 / PLAYER"
            : ""}
        </span>
      </div>
      <div className={styles.location_center}>
        <Description textParts={location.description || location.shortName} />
      </div>
    </div>
  );
};

const Location: React.FC<{
  name: LocationName;
  // Player ids of the workers placed on this location.
  workers?: string[];
  viewingPlayer?: Player | null;
  gameState?: GameState | null;
  // "row" renders a compact single-line location (eg. the Journey track).
  variant?: "tile" | "row";
}> = ({
  name,
  workers = [],
  viewingPlayer = null,
  gameState = null,
  variant = "tile",
}) => {
  const location = LocationModel.fromName(name);
  const { getPlayerTheme, getPlayerName } = useGameUI();
  const selection = useBoardSelection();
  let acceptingWorkers = true;
  let numSlots = 1;

  if (location.occupancy === LocationOccupancy.EXCLUSIVE) {
    acceptingWorkers = workers.length === 0;
  }
  if (viewingPlayer) {
    if (location.type === LocationType.JOURNEY) {
      if (viewingPlayer.currentSeason === Season.AUTUMN) {
        acceptingWorkers =
          location.occupancy === LocationOccupancy.EXCLUSIVE
            ? workers.length === 0
            : true;
      } else {
        acceptingWorkers = false;
      }
    }
  }
  if (gameState) {
    if (location.occupancy === LocationOccupancy.EXCLUSIVE_FOUR) {
      numSlots = gameState.players.length < 4 ? 1 : 2;
      acceptingWorkers = workers.length < numSlots;
    }
  }
  const isUnlimited =
    location.occupancy === LocationOccupancy.UNLIMITED ||
    location.occupancy === LocationOccupancy.UNLIMITED_MAX_ONE;

  const isSelectable = selection.locationOptions.indexOf(name) !== -1;
  const isSelected = selection.selectedLocation === name;

  const slots: React.ReactNode[] = workers.map((playerId, idx) => (
    <span key={`w-${playerId}-${idx}`} className={styles.slot}>
      <Meeple
        theme={getPlayerTheme(playerId)}
        height="100%"
        className={anim.popIn}
      />
    </span>
  ));
  const numOpenSlots = isUnlimited
    ? acceptingWorkers
      ? 1
      : 0
    : Math.max(0, numSlots - workers.length);
  for (let i = 0; i < numOpenSlots; i++) {
    slots.push(
      <span
        key={`open-${i}`}
        className={[styles.slot, styles.slot_open].join(" ")}
      >
        <WorkerSpotIcon />
      </span>
    );
  }

  const workersText = workers.length !== 0 && (
    <span className="sr-only">
      Workers: {workers.map((id) => getPlayerName(id)).join(", ")}
    </span>
  );
  const interactionProps = isSelectable
    ? {
        onClick: () => selection.selectLocation(name),
        role: "button",
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            selection.selectLocation(name);
          }
        },
        title: "Click to place a worker here",
      }
    : {};
  const wrapperClassName = [
    styles.board_location,
    isSelectable && styles.selectable,
    isSelected && styles.selected,
  ]
    .filter(Boolean)
    .join(" ");

  if (variant === "row") {
    const vp = location.getPoints(viewingPlayer as Player, gameState as GameState);
    return (
      <div
        data-location={name}
        className={wrapperClassName}
        {...interactionProps}
      >
        <ItemWrapper
          isHighlighted={!acceptingWorkers && !isSelectable}
          isSelected={isSelected}
        >
          <div
            className={[
              styles.location,
              styles.location_row,
              colorClassMap[location.type],
            ].join(" ")}
          >
            {vp ? (
              <Points numPoints={vp} />
            ) : (
              <PixelSprite sprite={ICONS[location.type]} height="1.5em" />
            )}
            <span className={styles.row_description}>
              <Description
                textParts={location.description || location.shortName}
              />
            </span>
            <span className={styles.slots}>{slots}</span>
          </div>
        </ItemWrapper>
        {workersText}
      </div>
    );
  }

  return (
    <div
      data-location={name}
      className={wrapperClassName}
      {...interactionProps}
    >
      <ItemWrapper
        isHighlighted={!acceptingWorkers && !isSelectable}
        isSelected={isSelected}
        footerChildren={
          <div className={styles.location_workers}>
            {workersText}
            <span className={styles.slots}>{slots}</span>
          </div>
        }
      >
        <LocationInner name={name} />
      </ItemWrapper>
    </div>
  );
};

export default Location;
