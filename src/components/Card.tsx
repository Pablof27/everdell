import * as React from "react";
import { Card as CardModel } from "../model/card";
import { GameState } from "../model/gameState";
import styles from "../styles/card.module.css";
import {
  ResourceType,
  CardName,
  PlayedCardInfo,
  CardType,
} from "../model/types";
import { Player } from "../model/player";
import { resourceMapToGameText, toGameText } from "../model/gameText";
import {
  AmbassadorSpotIcon,
  WorkerSpotIcon,
  Description,
  CardTypeSymbol,
  ResourceTypeIcon,
  Points,
} from "./common";
import { sumResources } from "../model/gameStatePlayHelpers";
import { assertUnreachable } from "../utils";
import PixelSprite, { Sprite } from "./pixel/PixelSprite";
import { Meeple } from "./pixel/icons";
import * as Sprites from "./pixel/sprites";
import { useGameUI, playerThemeStyle } from "./gameUI";

const typeClassMap: Record<CardType, string> = {
  GOVERNANCE: styles.type_governance,
  PROSPERITY: styles.type_prosperity,
  PRODUCTION: styles.type_production,
  DESTINATION: styles.type_destination,
  TRAVELER: styles.type_traveler,
};

function hashString(str: string): number {
  let hash = 7;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const CRITTER_KINDS = Object.keys(Sprites.CRITTERS) as Sprites.CritterKind[];

const CRITTER_FOR_CARD: Partial<Record<CardName, Sprites.CritterKind>> = {
  [CardName.BARGE_TOAD]: "frog",
  [CardName.MINER_MOLE]: "mouse",
  [CardName.CHIP_SWEEP]: "squirrel",
  [CardName.FERRY_FERRET]: "mouse",
  [CardName.HISTORIAN]: "turtle",
};

const FUR_VARIANTS: Record<
  Sprites.CritterKind,
  Record<string, string>[]
> = {
  squirrel: [{}, { F: "#9aa3ad", D: "#6b737c" }, { F: "#b0773f", D: "#6b4526" }],
  mouse: [{}, { F: "#b08a64", D: "#7d5f41" }, { F: "#e8e1d3", D: "#b8ae9b" }],
  hedgehog: [{}, { S: "#4a3a2e", s: "#6b5646" }],
  turtle: [{}, { F: "#5fb3a1", D: "#3b7f72" }],
  frog: [{}, { F: "#5fb3a1", D: "#3b7f72" }, { F: "#b5cf49", D: "#7e9a2a" }],
};

const BUILDING_FOR_TYPE: Record<CardType, Sprite> = {
  PRODUCTION: Sprites.BARN,
  DESTINATION: Sprites.COTTAGE,
  GOVERNANCE: Sprites.TOWER,
  PROSPERITY: Sprites.CASTLE,
  TRAVELER: Sprites.COTTAGE,
};

// Pixel illustration: a critter portrait or a building tinted by card type.
const CardArt = ({ card }: { card: CardModel }) => {
  if (card.name === CardName.EVERTREE) {
    return <PixelSprite sprite={Sprites.EVERTREE} height="100%" />;
  }
  const hash = hashString(card.name);
  if (card.isCritter) {
    const kind =
      CRITTER_FOR_CARD[card.name] || CRITTER_KINDS[hash % CRITTER_KINDS.length];
    const variants = FUR_VARIANTS[kind];
    return (
      <PixelSprite
        sprite={Sprites.CRITTERS[kind]}
        colors={variants[(hash >> 3) % variants.length]}
        height="100%"
      />
    );
  }
  const typeColors = Sprites.TYPE_COLORS[card.cardType];
  return (
    <PixelSprite
      sprite={BUILDING_FOR_TYPE[card.cardType]}
      colors={{ R: typeColors.C, D: typeColors.D }}
      height="100%"
    />
  );
};

function romanize(num: number): string {
  if (isNaN(num)) return "";
  const digits = String(+num).split(""),
    key = [
      "",
      "C",
      "CC",
      "CCC",
      "CD",
      "D",
      "DC",
      "DCC",
      "DCCC",
      "CM",
      "",
      "X",
      "XX",
      "XXX",
      "XL",
      "L",
      "LX",
      "LXX",
      "LXXX",
      "XC",
      "",
      "I",
      "II",
      "III",
      "IV",
      "V",
      "VI",
      "VII",
      "VIII",
      "IX",
    ];
  let roman = "",
    i = 3;
  while (i--) roman = (key[+(digits.pop() as any) + i * 10] || "") + roman;
  return Array(+digits.join("") + 1).join("M") + roman;
}

// determine rarity label, which is unique vs. common and
// critter vs. construction
const getRarityLabel = (card: CardModel) => {
  const rarity = card.isUnique ? "Unique" : "Common";
  const category = card.isCritter ? "Critter" : "Construction";
  return rarity + " " + category;
};

// handle the farm and evertree
const getAssociatedCard = (card: CardModel) => {
  const associatedCard = card.associatedCard;
  if (associatedCard.type === "CARD") {
    return associatedCard.cardName;
  } else if (associatedCard.type === "HUSBAND_WIFE") {
    return "Husband / Wife";
  } else if (associatedCard.type === "ANY") {
    return "Any";
  } else if (associatedCard.type === "GOLDEN_LEAF") {
    const textParts = toGameText([
      "Any ",
      associatedCard.cardType === "UNIQUE"
        ? { type: "em", text: "Unique" }
        : associatedCard.cardType === "COMMON"
        ? { type: "em", text: "Common" }
        : { type: "cardType", cardType: associatedCard.cardType },
      "GOLDEN_LEAF",
    ]);
    return <Description textParts={textParts} />;
  } else {
    assertUnreachable(
      associatedCard,
      `Unexpected associatedCard: ${JSON.stringify(associatedCard)}`
    );
  }
};

const resourceTypeList = [
  ResourceType.BERRY,
  ResourceType.TWIG,
  ResourceType.PEBBLE,
  ResourceType.RESIN,
  "CARD" as const,
];

const CardDescription = ({ card }: { card: CardModel }) => {
  if (card.cardDescription) {
    return <Description textParts={card.cardDescription} />;
  }
  if (card.resourcesToGain) {
    const totalResources = sumResources(card.resourcesToGain);
    for (let i = 0; i < resourceTypeList.length; i++) {
      if (card.resourcesToGain[resourceTypeList[i]] === totalResources) {
        const resourceType = resourceTypeList[i];
        return (
          <Description
            textParts={[
              {
                type: "text",
                text: `Gain ${totalResources} `,
              },
              resourceType === "CARD"
                ? { type: "symbol", symbol: "CARD" }
                : { type: "resource", resourceType: resourceType },
              {
                type: "text",
                text: ".",
              },
            ]}
          />
        );
      }
    }
  }
  return <></>;
};

const AssociatedCard = ({
  card,
  usedForCritter = false,
}: {
  card: CardModel;
  usedForCritter?: boolean;
}) => {
  const associatedCard = getAssociatedCard(card);
  return (
    <div
      className={[
        styles.associated_card,
        card.isCritter
          ? styles.associated_card_critter
          : styles.associated_card_construction,
        usedForCritter && styles.associated_card_used,
        card.associatedCard.type === "GOLDEN_LEAF" &&
          styles.associated_card_golden_leaf,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{associatedCard}</span>
    </div>
  );
};

const WorkerSpots = ({
  card,
  workers,
  ambassador,
}: {
  card: CardModel;
  workers?: string[];
  ambassador?: string | null;
}) => {
  const { getPlayerTheme } = useGameUI();
  if (card.name === CardName.FERRY) {
    return (
      <div className={styles.spots}>
        <span className={styles.spot}>
          {ambassador ? (
            <Meeple frog theme={getPlayerTheme(ambassador)} height="100%" />
          ) : (
            <AmbassadorSpotIcon />
          )}
        </span>
      </div>
    );
  }
  if (card.maxWorkerSpots === 0) {
    return null;
  }
  const spots = [];
  for (let i = 0; i < card.maxWorkerSpots; i++) {
    const workerId = workers && workers[i];
    spots.push(
      <span key={i} className={styles.spot}>
        {workerId ? (
          <Meeple theme={getPlayerTheme(workerId)} height="100%" />
        ) : (
          <WorkerSpotIcon locked={i > 0} />
        )}
      </span>
    );
  }
  return <div className={styles.spots}>{spots}</div>;
};

const Card: React.FC<{
  name: CardName;
  usedForCritter?: boolean;
  // Player ids of workers / ambassador currently on this (played) card.
  workers?: string[];
  ambassador?: string | null;
}> = ({ name, usedForCritter = false, workers, ambassador = null }) => {
  const card = CardModel.fromName(name as any);
  const rarityLabel = getRarityLabel(card);
  return (
    <div
      className={[
        styles.card,
        typeClassMap[card.cardType],
        card.isCritter ? styles.is_critter : styles.is_construction,
      ].join(" ")}
    >
      <div className={styles.header}>
        <span className={styles.type_badge}>
          <CardTypeSymbol cardType={card.cardType} />
        </span>
        <span className={styles.name}>{name}</span>
        <span className={styles.vp}>
          <Points numPoints={card.baseVP} />
        </span>
      </div>
      <div className={styles.art}>
        <div className={styles.cost}>
          {Object.entries(card.baseCost).map(([resourceType, count], idx) => {
            return (
              <span className={styles.cost_item} key={idx}>
                <span className={styles.cost_icon}>
                  <ResourceTypeIcon resourceType={resourceType as ResourceType} />
                </span>
                <span className={styles.cost_value}>{count}</span>
              </span>
            );
          })}
        </div>
        <div className={styles.art_sprite}>
          <CardArt card={card} />
        </div>
        <WorkerSpots card={card} workers={workers} ambassador={ambassador} />
        {card.expansion && (
          <span className={styles.expansion}>{card.expansion}</span>
        )}
      </div>
      <div className={styles.description}>
        <CardDescription card={card} />
      </div>
      <div className={styles.footer}>
        <div className={styles.rarity_label}>
          {rarityLabel}
          &nbsp;&middot;&nbsp;{romanize(card.numInDeck)}
        </div>
        <AssociatedCard card={card} usedForCritter={usedForCritter} />
      </div>
    </div>
  );
};

export const EmptyCard: React.FC<{ label?: string }> = ({ label }) => {
  return (
    <div className={[styles.card, styles.empty].join(" ")}>
      {label && <span className={styles.empty_label}>{label}</span>}
    </div>
  );
};

export default Card;

const getCardPoints = (
  cardName: CardName,
  cardIdx: number,
  cardOwner: Player,
  gameState: GameState
): number => {
  const card = CardModel.fromName(cardName);

  // Bonus for the WIFE needs to be computed separately because it
  // relies on the whole city.
  let extraPoints = 0;
  if (
    cardName === CardName.WIFE &&
    cardOwner.getNumHusbandWifePairs() >= cardIdx
  ) {
    extraPoints += 3;
  }
  return card.getPoints(cardOwner, gameState) + extraPoints;
};

export const PlayedCard: React.FC<{
  playedCard: PlayedCardInfo;
  cardOwner: Player;
  gameState: GameState;
  viewerId: string | null;
  cardIdx?: number;
}> = ({ playedCard, cardOwner, gameState, viewerId, cardIdx }) => {
  const { getPlayerTheme } = useGameUI();
  const {
    cardOwnerId,
    cardName,
    usedForCritter,
    resources = {},
    workers = [],
    pairedCards = [],
    ambassador = null,
    shareSpaceWith = null,
  } = playedCard;
  const card = CardModel.fromName(cardName);
  const isViewerCard = viewerId === cardOwnerId;
  return (
    <div className={styles.played_card_wrapper}>
      <div className={styles.played_card_card}>
        <Card
          name={cardName}
          usedForCritter={card.isConstruction && usedForCritter}
          workers={workers}
          ambassador={ambassador}
        />
      </div>
      <div className={styles.played_card_meta}>
        <span className="sr-only">
          Card Owner: {isViewerCard ? "You" : cardOwner.name}
        </span>
        {!isViewerCard && (
          <span
            className={styles.owner_chip}
            style={playerThemeStyle(getPlayerTheme(cardOwnerId))}
          >
            {cardOwner.name}
          </span>
        )}
        {cardIdx && card.cardType === CardType.PROSPERITY ? (
          <span className={styles.meta_chip}>
            Points:{" "}
            <b>{getCardPoints(cardName, cardIdx, cardOwner, gameState)}</b>
          </span>
        ) : null}
        {"workers" in playedCard && (
          <span className="sr-only">Workers on card: {workers.length}</span>
        )}
        {"ambassador" in playedCard && (
          <span className="sr-only">
            Ambassadors on card: {ambassador ? "1" : "0"}
          </span>
        )}
        {"shareSpaceWith" in playedCard && shareSpaceWith && (
          <span className={styles.meta_chip}>Share space: {shareSpaceWith}</span>
        )}
        {"pairedCards" in playedCard && (
          <span className={styles.meta_chip}>
            Beneath:{" "}
            <Description textParts={toGameText(`${pairedCards.length} CARD`)} />
          </span>
        )}
        {"resources" in playedCard && sumResources(resources) > 0 && (
          <span className={styles.meta_chip}>
            On card:{" "}
            <Description textParts={resourceMapToGameText(resources)} />
          </span>
        )}
      </div>
    </div>
  );
};
