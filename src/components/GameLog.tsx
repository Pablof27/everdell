import * as React from "react";
import { useEffect, useState, useRef } from "react";
import isEqual from "lodash/isEqual";

import styles from "../styles/GameLog.module.css";

import EntityList from "./EntityList";
import { GameLogEntry } from "../model/types";
import { GameStateJSON } from "../model/jsonTypes";
import { Description, GameBlock } from "./common";
import PixelSprite from "./pixel/PixelSprite";
import * as Sprites from "./pixel/sprites";

const GameLog: React.FC<{
  logs: GameLogEntry[];
  gameStateJSON?: GameStateJSON | null;
  fixedHeight?: boolean;
}> = ({ logs, fixedHeight = true }) => {
  const [selectedEntry, setSelectedEntry] = useState<
    GameLogEntry["entry"] | null
  >(null);
  const logsElRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logsElRef.current) {
      logsElRef.current.scrollTop = logsElRef.current.scrollHeight;
    }
  }, [logs.length]);

  return (
    <GameBlock
      title={"Game Log"}
      className={styles.panel}
      icon={<PixelSprite sprite={Sprites.CARD} height="14px" />}
    >
      <div
        className={[styles.logs, fixedHeight && styles.logs_height]
          .filter(Boolean)
          .join(" ")}
        ref={logsElRef}
      >
        <div className={styles.logs_inner}>
          {logs.map(({ entry }, idx) => {
            const isSelected = selectedEntry && isEqual(selectedEntry, entry);
            const isLast = idx == logs.length - 1;
            return (
              <div
                key={isLast ? `last:${JSON.stringify(entry)}` : idx}
                className={[
                  styles.log,
                  isSelected && styles.log_selected,
                  isLast && styles.log_latest,
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  setSelectedEntry(isSelected ? null : entry);
                }}
              >
                <span className={styles.log_prefix} aria-hidden={true}>
                  {"\u25B8"}
                </span>
                <span>
                  <Description textParts={entry} />
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {selectedEntry && (
        <div className={styles.log_entities}>
          <EntityList textParts={selectedEntry} />
        </div>
      )}
    </GameBlock>
  );
};

export default GameLog;
