import * as React from "react";

import styles from "../styles/common.module.css";
import { Event } from "../model/event";
import { RiverDestinationSpot } from "../model/riverDestination";
import { Location } from "../model/location";
import { TrainCarTile } from "../model/trainCarTile";
import {
  CardWithSource,
  GameText,
  TextPart,
  ResourceType,
  CardType,
} from "../model/types";
import { assertUnreachable } from "../utils";
import PixelSprite from "./pixel/PixelSprite";
import {
  FillSprite,
  RESOURCE_SPRITES,
  CARD_TYPE_SPRITES,
} from "./pixel/icons";
import * as Sprites from "./pixel/sprites";
import { useGameUI, playerThemeStyle } from "./gameUI";

export const GameBlockTitle: React.FC<{ icon?: React.ReactNode }> = ({
  icon,
  children,
}) => {
  return (
    <div id={"js-game-block-title"} className={styles.title}>
      {icon}
      <span>{children}</span>
    </div>
  );
};

export const GameBlock: React.FC<{
  title: string;
  id?: string;
  icon?: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}> = ({ title, id, icon, className, actions, children }) => {
  return (
    <div id={id} className={[styles.block, className].filter(Boolean).join(" ")}>
      <div className={styles.block_header}>
        <GameBlockTitle icon={icon}>{title}</GameBlockTitle>
        {actions}
      </div>
      {children}
    </div>
  );
};

export const CardTypeSymbol = ({ cardType }: { cardType: CardType }) => {
  const sprite = CARD_TYPE_SPRITES[cardType];
  return (
    <span className={styles.fill}>
      <span className={styles.hidden}>{cardType}</span>
      {sprite ? <FillSprite sprite={sprite} /> : <>{cardType}</>}
    </span>
  );
};

export const CardIcon = () => <FillSprite sprite={Sprites.CARD} />;

export const GoldenLeafIcon = () => <FillSprite sprite={Sprites.GOLDEN_LEAF} />;

export const TicketIcon = () => <FillSprite sprite={Sprites.TICKET} />;

export const ReservationTokenIcon = () => (
  <FillSprite sprite={Sprites.RESERVATION_TOKEN} />
);

const ADORNMENT_CARD_COLORS = { L: "#fbd7e0", B: "#c75b7a", g: "#ffffff", G: "#aebfd8" };

export const AdornmentCardIcon = () => (
  <FillSprite sprite={Sprites.CARD} colors={ADORNMENT_CARD_COLORS} />
);

const LOCKED_PAW_COLORS = { P: "#d9d2c3", o: "#9c8f7a" };

export const WorkerSpotIcon = ({ locked = false }: { locked?: boolean }) => (
  <FillSprite
    sprite={Sprites.PAW}
    colors={locked ? LOCKED_PAW_COLORS : undefined}
  />
);

const EMPTY_AMBASSADOR_COLORS = { C: "#cfe8d6", D: "#9cc5a8", L: "#f3f7ef" };

export const AmbassadorSpotIcon = () => (
  <FillSprite sprite={Sprites.FROG_MEEPLE} colors={EMPTY_AMBASSADOR_COLORS} />
);

export const EmptyCitySpotIcon = () => <FillSprite sprite={Sprites.HUT} />;

export const VPIcon = () => <FillSprite sprite={Sprites.VP} />;

const PLAIN_COIN_COLORS = { S: "#f7c948", W: "#f7c948" };

export const Points = ({ numPoints }: { numPoints: number }) => {
  return (
    <span className={styles.points}>
      <PixelSprite
        sprite={Sprites.VP}
        colors={PLAIN_COIN_COLORS}
        className={styles.points_coin}
      />
      <span className={styles.points_value}>{numPoints}</span>
    </span>
  );
};

export const WildResourceIcon = () => <FillSprite sprite={Sprites.ANY} />;

export const ResourceTypeIcon = ({
  resourceType,
}: {
  resourceType: ResourceType;
}) => {
  const sprite = RESOURCE_SPRITES[resourceType];
  return sprite ? <FillSprite sprite={sprite} /> : <>{resourceType}</>;
};

export const GameIcon = ({
  type,
}: {
  type:
    | CardType
    | ResourceType
    | "CARD"
    | "VP"
    | "ANY"
    | "TRAIN_TICKET"
    | "RESERVATION_TOKEN"
    | "GOLDEN_LEAF";
}) => {
  return (
    <span className={styles.resource}>
      <span className={styles.resource_inner}>
        {type === "CARD" ? (
          <CardIcon />
        ) : type === "VP" ? (
          <VPIcon />
        ) : type === "GOLDEN_LEAF" ? (
          <GoldenLeafIcon />
        ) : type === "RESERVATION_TOKEN" ? (
          <ReservationTokenIcon />
        ) : type === "TRAIN_TICKET" ? (
          <TicketIcon />
        ) : type === "ANY" ? (
          <WildResourceIcon />
        ) : Object.values(ResourceType).includes(type as any) ? (
          <ResourceTypeIcon resourceType={type as ResourceType} />
        ) : Object.values(CardType).includes(type as any) ? (
          <CardTypeSymbol cardType={type as CardType} />
        ) : (
          type
        )}
      </span>
    </span>
  );
};

const PlayerNamePart: React.FC<{ name: string }> = ({ name }) => {
  const { getPlayerThemeByName } = useGameUI();
  return (
    <span
      className={styles.player_part}
      style={playerThemeStyle(getPlayerThemeByName(name))}
    >
      {name}
    </span>
  );
};

export const Description = ({ textParts }: { textParts: GameText }) => {
  return textParts ? (
    <span>
      {textParts.map((part: TextPart, idx: number) => {
        switch (part.type) {
          case "text":
            return part.text;
          case "iblock":
            return (
              <span key={idx} className={styles.i_part}>
                <Description textParts={part.text} />
              </span>
            );
          case "i":
            return (
              <span key={idx} className={styles.i_part}>
                {part.text}
              </span>
            );
          case "em":
            return (
              <span key={idx} className={styles.em_part}>
                {part.text}
              </span>
            );
          case "BR":
            return <br key={idx} />;
          case "HR":
            return <hr key={idx} />;
          case "resource":
            return (
              <span key={idx}>
                <span className={styles.hidden}>{part.resourceType}</span>
                <span aria-hidden={true}>
                  <GameIcon type={part.resourceType} />
                </span>
              </span>
            );
          case "cardType":
            return <GameIcon key={idx} type={part.cardType} />;
          case "points":
            return <Points key={idx} numPoints={part.value} />;
          case "symbol":
            return (
              <span key={idx}>
                <span className={styles.hidden}>{part.symbol}</span>
                <span aria-hidden={true}>
                  <GameIcon type={part.symbol} />
                </span>
              </span>
            );
          case "player":
            return <PlayerNamePart key={idx} name={part.name} />;
          case "entity":
            if (part.entityType === "event") {
              return (
                <span key={idx} className={styles.entity_part}>
                  <span className={styles.hidden}>Event:</span>
                  <Description
                    textParts={Event.fromName(part.event).getShortName()}
                  />
                </span>
              );
            }
            if (part.entityType === "trainCarTile") {
              return (
                <span key={idx} className={styles.entity_part}>
                  <span className={styles.hidden}>Train Car Tile:</span>
                  <Description
                    textParts={
                      TrainCarTile.fromName(part.trainCarTile).shortName
                    }
                  />
                </span>
              );
            }
            if (part.entityType === "location") {
              return (
                <span key={idx} className={styles.entity_part}>
                  <span className={styles.hidden}>Location:</span>
                  <Description
                    textParts={Location.fromName(part.location).shortName}
                  />
                </span>
              );
            }
            if (part.entityType === "card") {
              return (
                <span key={idx} className={styles.entity_part}>
                  <Description
                    textParts={[{ type: "text", text: part.card }]}
                  />
                </span>
              );
            }
            if (part.entityType === "adornment") {
              return (
                <span key={idx} className={styles.entity_part}>
                  {part.adornment}
                </span>
              );
            }
            if (part.entityType === "riverDestination") {
              return (
                <span key={idx} className={styles.entity_part}>
                  <Description
                    textParts={[{ type: "text", text: part.riverDestination }]}
                  />
                </span>
              );
            }
            if (part.entityType === "riverDestinationSpot") {
              return (
                <span key={idx} className={styles.entity_part}>
                  <span className={styles.hidden}>River Destination Spot:</span>
                  <Description
                    textParts={
                      RiverDestinationSpot.fromName(part.spot).shortName
                    }
                  />
                </span>
              );
            }
            if (part.entityType === "visitor") {
              return (
                <span key={idx} className={styles.entity_part}>
                  {part.visitor}
                </span>
              );
            }
            assertUnreachable(part, `Unexpected part: ${JSON.stringify(part)}`);
            break;
          default:
            assertUnreachable(part, `Unexpected part: ${JSON.stringify(part)}`);
        }
      })}
    </span>
  ) : null;
};

export const ItemWrapper: React.FC<{
  // Dims the item (eg. occupied location, claimed event).
  isHighlighted?: boolean;
  isSelected?: boolean;
  footerChildren?: any;
  className?: string;
}> = ({
  isHighlighted = false,
  isSelected = false,
  footerChildren = null,
  className,
  children,
}) => {
  return (
    <div
      className={[styles.item_wrapper, className].filter(Boolean).join(" ")}
    >
      <div
        className={
          [
            styles.item_inner,
            isHighlighted && styles.item_highlighted,
            isSelected && styles.item_selected,
          ]
            .filter(Boolean)
            .join(" ") || undefined
        }
      >
        {children}
        {isSelected && (
          <span className={styles.item_check} aria-hidden={true}>
            ✓
          </span>
        )}
      </div>
      {footerChildren ? (
        <div className={styles.item_footer}>{footerChildren}</div>
      ) : null}
    </div>
  );
};

export const CardWithSourceFooter = ({
  cardWithSource,
}: {
  cardWithSource: CardWithSource | "FROM_DECK";
}) => {
  const source =
    cardWithSource === "FROM_DECK" ? "DECK" : cardWithSource.source;
  return (
    <div
      className={[styles.item_footer_text, styles[`source_${source}`]].join(
        " "
      )}
    >
      {cardWithSource === "FROM_DECK"
        ? "From Deck"
        : cardWithSource.source === "MEADOW"
        ? "Meadow"
        : cardWithSource.source === "STATION"
        ? `Station ${cardWithSource.sourceIdx! + 1}`
        : cardWithSource.source === "RESERVED"
        ? "Reserved"
        : cardWithSource.source === "HAND"
        ? "Hand"
        : assertUnreachable(cardWithSource.source, "Unexpected source")}
    </div>
  );
};
