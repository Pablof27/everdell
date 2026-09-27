import * as React from "react";

import styles from "../styles/event.module.css";
import anim from "../styles/animations.module.css";

import { Event as EventModel } from "../model/event";
import { EventName, EventType } from "../model/types";

import { Description, ItemWrapper, Points } from "./common";
import PixelSprite from "./pixel/PixelSprite";
import * as Sprites from "./pixel/sprites";
import { useGameUI, playerThemeStyle } from "./gameUI";
import { useBoardSelection } from "./BoardSelection";

const typeClassMap: Record<EventType, string> = {
  [EventType.BASIC]: styles.type_basic,
  [EventType.SPECIAL]: styles.type_special,
  [EventType.WONDER]: styles.type_wonder,
};

export const EventInner: React.FC<{
  name: EventName;
  // Hide the long ability text (shown on hover / elsewhere).
  compact?: boolean;
}> = ({ name, compact = false }) => {
  const event = EventModel.fromName(name as any);
  return (
    <div
      className={[
        styles.event,
        typeClassMap[event.type],
        compact && styles.compact,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.event_ribbon}>
        <PixelSprite sprite={Sprites.FLAG} height="1.3em" />
        <span className={styles.event_kind}>
          {event.type === EventType.BASIC
            ? "Event"
            : event.type === EventType.WONDER
            ? "Wonder"
            : "Special"}
        </span>
      </div>
      {event.type === EventType.BASIC ? (
        <div className={styles.event_basic}>
          <Description textParts={event.eventRequirementsDescription || []} />
        </div>
      ) : (
        <>
          <div className={styles.event_name}>{name}</div>
          {event.requiredCards && (
            <div className={styles.event_header}>
              <Description
                textParts={[
                  {
                    type: "text",
                    text: event.requiredCards[0],
                  },
                  { type: "text", text: ", " },
                  {
                    type: "text",
                    text: event.requiredCards[1],
                  },
                ]}
              />
            </div>
          )}
          {!compact && event.eventRequirementsDescription && (
            <div className={styles.event_row}>
              <Description textParts={event.eventRequirementsDescription} />
            </div>
          )}
          {(!compact || !event.requiredCards) && event.eventDescription && (
            <div className={styles.event_row}>
              <Description textParts={event.eventDescription} />
            </div>
          )}
        </>
      )}
      {event.baseVP ? (
        <div className={styles.base_vp}>
          <Points numPoints={event.baseVP} />
        </div>
      ) : null}
    </div>
  );
};

export const Event = ({
  name,
  claimedBy = null,
  claimedById = null,
  compact = false,
  interactive = false,
}: {
  name: EventName;
  claimedBy?: string | null;
  claimedById?: string | null;
  compact?: boolean;
  // Board events can be clicked to select them for the Claim Event action.
  interactive?: boolean;
}) => {
  const { getPlayerTheme } = useGameUI();
  const selection = useBoardSelection();
  const isSelectable =
    interactive && selection.eventOptions.indexOf(name) !== -1;
  const isSelected = interactive && selection.selectedEvent === name;
  return (
    <div
      data-cy={`event:${name}`}
      className={[
        styles.board_event,
        isSelectable && styles.selectable,
        !!claimedBy && styles.claimed,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={isSelectable ? () => selection.selectEvent(name) : undefined}
      role={isSelectable ? "button" : undefined}
      tabIndex={isSelectable ? 0 : undefined}
      onKeyDown={
        isSelectable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selection.selectEvent(name);
              }
            }
          : undefined
      }
      title={isSelectable ? "Click to claim this event" : undefined}
    >
      <ItemWrapper
        isHighlighted={!!claimedBy}
        isSelected={isSelected}
        footerChildren={
          claimedBy && (
            <div
              className={[styles.claimed_by, anim.popIn].join(" ")}
              style={
                claimedById
                  ? playerThemeStyle(getPlayerTheme(claimedById))
                  : undefined
              }
            >
              <span className={styles.claimed_label}>{"Claimed: "}</span>
              <span className={styles.claimed_by_text}>{claimedBy}</span>
            </div>
          )
        }
      >
        <EventInner name={name} compact={compact} />
      </ItemWrapper>
    </div>
  );
};

export default Event;
