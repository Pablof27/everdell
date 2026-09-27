import * as React from "react";

import styles from "../styles/RiverDestination.module.css";
import anim from "../styles/animations.module.css";

import {
  RiverDestination as RiverDestinationModel,
  RiverDestinationSpot as RiverDestinationSpotModel,
} from "../model/riverDestination";
import {
  ResourceType,
  RiverDestinationName,
  RiverDestinationSpotName,
} from "../model/types";

import { Description, ItemWrapper } from "./common";
import { Meeple } from "./pixel/icons";
import { useGameUI } from "./gameUI";

const RiverDestinationInner = ({ name }: { name: RiverDestinationName }) => {
  const riverDestination = RiverDestinationModel.fromName(name);
  return (
    <div className={styles.item}>
      <div className={styles.header}>
        {riverDestination.name}
        {riverDestination.name !== RiverDestinationName.SHOAL && (
          <div className={styles.location_type}>{riverDestination.type}</div>
        )}
      </div>
      <div className={styles.description}>
        <Description textParts={riverDestination.description} />
      </div>
    </div>
  );
};

const RiverDestinationHidden = () => {
  return (
    <div data-cy={`river-destination-hidden`} className={styles.hidden_item}>
      <div></div>
      <Description
        textParts={[
          { type: "text", text: "Visit to gain 1 " },
          { type: "resource", resourceType: ResourceType.PEARL },
          { type: "text", text: " and reveal hidden " },
          { type: "em", text: "River Destination" },
          { type: "text", text: "." },
        ]}
      />
      <div></div>
    </div>
  );
};

const RiverDestination = ({ name }: { name: RiverDestinationName }) => {
  return (
    <ItemWrapper>
      <RiverDestinationInner name={name} />
    </ItemWrapper>
  );
};

export const RiverDestinationSpot = ({
  name,
  destination = null,
  ambassadors = null,
  ambassadorIds = null,
}: {
  name: RiverDestinationSpotName;
  destination?: RiverDestinationName | null;
  ambassadors?: string[] | null;
  ambassadorIds?: string[] | null;
}) => {
  const { getPlayerTheme } = useGameUI();
  const isShoal = name == RiverDestinationSpotName.SHOAL;
  destination = isShoal ? RiverDestinationName.SHOAL : destination;
  const isUnavailable = !!(ambassadors && !isShoal && ambassadors.length !== 0);
  return (
    <div data-cy={`river-destination-spot:${name}`}>
      <ItemWrapper
        isHighlighted={isUnavailable}
        footerChildren={
          <div className={styles.spot_name}>
            <Description
              textParts={RiverDestinationSpotModel.fromName(name).shortName}
            />
            {ambassadors && ambassadors.length !== 0 && (
              <div className={styles.ambassadors}>
                <span className="sr-only">Ambassadors: </span>
                <span className={styles.ambassador}>
                  {ambassadorIds && (
                    <span className={styles.ambassador_meeples}>
                      {ambassadorIds.map((playerId, idx) => (
                        <Meeple
                          key={idx}
                          frog
                          theme={getPlayerTheme(playerId)}
                          height="22px"
                          className={anim.popIn}
                        />
                      ))}
                    </span>
                  )}
                  <span className={ambassadorIds ? "sr-only" : undefined}>
                    {ambassadors.join(", ")}
                  </span>
                </span>
              </div>
            )}
          </div>
        }
      >
        <div className={styles.spot}>
          {destination ? (
            <RiverDestinationInner name={destination} />
          ) : (
            <RiverDestinationHidden />
          )}
        </div>
      </ItemWrapper>
    </div>
  );
};

export default RiverDestination;
