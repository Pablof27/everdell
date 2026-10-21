import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";

import type { ArenaBotOptions } from "../bot/botCatalog";
import type { ArenaExpansions } from "../bot/arena";
import type {
  ArenaGame,
  ArenaWorkerMessage,
  ArenaWorkerRequest,
} from "../bot/arenaWorker";
import { GameState } from "../model/gameState";
import { BOT_TYPES, BotType, GameLogEntry } from "../model/types";
import { MAX_SEED } from "../model/random";
import { GameBlock } from "./common";
import { BOT_TYPE_LABELS } from "./GameBuilder";
import GameLog from "./GameLog";
import GamePointsBreakdown from "./GamePointsBreakdown";
import {
  GameUIProvider,
  getPlayerThemeByIdx,
  playerThemeStyle,
} from "./gameUI";

import styles from "../styles/Arena.module.css";

const CUSTOM_BOT = "custom";
const MAX_BOTS = 4;
const MAX_GAMES = 1000;

const EXPANSIONS: { name: keyof ArenaExpansions; label: string }[] = [
  { name: "pearlbrook", label: "Pearlbrook" },
  { name: "newleaf", label: "Newleaf" },
  { name: "bellfaire", label: "Bellfaire" },
];

type BotValues = {
  // A difficulty name or CUSTOM_BOT.
  bot: string;
  botType: BotType;
  // "" = hand-tuned weights.
  weightsFile: string;
};

type ArenaRun = {
  botNames: string[];
  numGames: number;
  games: ArenaGame[];
  status: "running" | "done" | "stopped" | "error";
  error: string | null;
};

const botLabel = ({ bot, botType, weightsFile }: BotValues): string => {
  if (bot !== CUSTOM_BOT) {
    return bot;
  }
  return botType === "GREEDY" && weightsFile
    ? `Greedy ${weightsFile.replace(/\.json$/, "")}`
    : BOT_TYPE_LABELS[botType];
};

// Bots sharing a label get numbered so they can be told apart.
const getBotNames = (bots: BotValues[]): string[] => {
  const labels = bots.map(botLabel);
  return labels.map((label, idx) =>
    labels.indexOf(label) === labels.lastIndexOf(label)
      ? label
      : `${label} #${idx + 1}`
  );
};

const toBotSpec = (
  values: BotValues,
  name: string,
  { difficulties, weightsFiles }: ArenaBotOptions
): ArenaWorkerRequest["bots"][number] => {
  const difficulty = difficulties.find((d) => d.name === values.bot);
  if (difficulty) {
    return {
      name,
      botType: difficulty.bot.botType,
      weights: difficulty.bot.botWeights,
    };
  }
  const { botType, weightsFile } = values;
  const weights =
    botType === "GREEDY"
      ? weightsFiles.find((w) => w.file === weightsFile)?.weights
      : null;
  return { name, botType, weights };
};

// Tallied like runArena: tied winners split the win.
const summarize = (games: ArenaGame[], numBots: number) => {
  const wins = Array.from({ length: numBots }, () => 0);
  const totalPoints = Array.from({ length: numBots }, () => 0);
  let totalMoves = 0;
  let numRejectedMoves = 0;
  let durationMs = 0;
  games.forEach((game) => {
    game.points.forEach((pts, seat) => {
      totalPoints[game.botBySeat[seat]] += pts;
    });
    game.winnerSeats.forEach((seat) => {
      wins[game.botBySeat[seat]] += 1 / game.winnerSeats.length;
    });
    totalMoves += game.numMoves;
    numRejectedMoves += game.numRejectedMoves;
    durationMs += game.durationMs;
  });
  const numGames = Math.max(games.length, 1);
  return {
    wins,
    meanPoints: totalPoints.map((p) => p / numGames),
    meanMoves: totalMoves / numGames,
    numRejectedMoves,
    durationMs,
  };
};

const formatSeconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

const BotName: React.FC<{ botIdx: number; name: string }> = ({
  botIdx,
  name,
}) => (
  <span
    className={styles.player}
    style={playerThemeStyle(getPlayerThemeByIdx(botIdx))}
  >
    {name}
  </span>
);

const ArenaSetup: React.FC<{
  botOptions: ArenaBotOptions;
  running: boolean;
  onRun: (request: ArenaWorkerRequest) => void;
  onStop: () => void;
}> = ({ botOptions, running, onRun, onStop }) => {
  const { difficulties, weightsFiles } = botOptions;
  // The hardest difficulty, then the next ones.
  const defaultBot = (rank = 0): BotValues => ({
    bot: difficulties[difficulties.length - 1 - rank]?.name ?? CUSTOM_BOT,
    botType: "GREEDY",
    weightsFile: weightsFiles[weightsFiles.length - 1]?.file ?? "",
  });

  const [bots, setBots] = useState<BotValues[]>(() => [
    defaultBot(0),
    defaultBot(1),
  ]);
  const [expansions, setExpansions] = useState<ArenaExpansions>({});
  const [numGames, setNumGames] = useState("20");
  const [seed, setSeed] = useState("1");
  const [formError, setFormError] = useState<string | null>(null);

  const updateBot = (idx: number, values: Partial<BotValues>) =>
    setBots(bots.map((bot, i) => (i === idx ? { ...bot, ...values } : bot)));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const gamesToPlay = Number(numGames);
    if (
      !(
        Number.isInteger(gamesToPlay) &&
        gamesToPlay >= 1 &&
        gamesToPlay <= MAX_GAMES
      )
    ) {
      setFormError(`Games must be a whole number from 1 to ${MAX_GAMES}`);
      return;
    }
    if (!(/^\d+$/.test(seed.trim()) && Number(seed) <= MAX_SEED)) {
      setFormError(`Seed must be a whole number from 0 to ${MAX_SEED}`);
      return;
    }
    setFormError(null);
    const botNames = getBotNames(bots);
    onRun({
      bots: bots.map((bot, idx) => toBotSpec(bot, botNames[idx], botOptions)),
      numGames: gamesToPlay,
      seed: Number(seed),
      expansions,
    });
  };

  return (
    <form id="js-arena-form" onSubmit={submit}>
      <GameBlock title="Setup" className={styles.panel}>
        <fieldset className={styles.fieldset} disabled={running}>
          <div className={styles.section_label}>Bots</div>
          {bots.map((bot, idx) => (
            <div key={idx} className={styles.bot}>
              <div className={styles.bot_row}>
                <span
                  className={styles.bot_number}
                  style={playerThemeStyle(getPlayerThemeByIdx(idx))}
                >
                  {idx + 1}
                </span>
                <select
                  className={styles.select}
                  value={bot.bot}
                  aria-label={`Bot ${idx + 1}`}
                  onChange={(e) => updateBot(idx, { bot: e.target.value })}
                >
                  {difficulties.map(({ name }) => (
                    <option key={name} value={name}>
                      {`${name} bot`}
                    </option>
                  ))}
                  <option value={CUSTOM_BOT}>Custom bot</option>
                </select>
                {bots.length > 2 && (
                  <button
                    type="button"
                    className={styles.icon_button}
                    title="Remove bot"
                    onClick={() => setBots(bots.filter((_, i) => i !== idx))}
                  >
                    -
                  </button>
                )}
                {bots.length < MAX_BOTS && (
                  <button
                    type="button"
                    className={styles.icon_button}
                    title="Add bot"
                    onClick={() =>
                      setBots([
                        ...bots.slice(0, idx + 1),
                        defaultBot(),
                        ...bots.slice(idx + 1),
                      ])
                    }
                  >
                    +
                  </button>
                )}
              </div>
              {bot.bot === CUSTOM_BOT && (
                <div className={styles.custom_bot}>
                  <select
                    className={styles.select}
                    value={bot.botType}
                    title="Strategy"
                    onChange={(e) =>
                      updateBot(idx, {
                        botType: e.target.value as BotType,
                      })
                    }
                  >
                    {BOT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {BOT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                  {bot.botType === "GREEDY" && (
                    <select
                      className={styles.select}
                      value={bot.weightsFile}
                      title="Weights file (under weights/)"
                      onChange={(e) =>
                        updateBot(idx, { weightsFile: e.target.value })
                      }
                    >
                      {weightsFiles.map(({ file }) => (
                        <option key={file} value={file}>
                          {file}
                        </option>
                      ))}
                      <option value="">Hand-tuned weights</option>
                    </select>
                  )}
                </div>
              )}
            </div>
          ))}
          <div className={styles.section_label}>Expansions</div>
          <div className={styles.options}>
            {EXPANSIONS.map(({ name, label }) => (
              <label key={name} className={styles.option}>
                <input
                  type="checkbox"
                  checked={!!expansions[name]}
                  onChange={(e) =>
                    setExpansions({
                      ...expansions,
                      [name]: e.target.checked,
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <div className={styles.options}>
            <label className={styles.option}>
              Games
              <input
                className={styles.input}
                type="number"
                min={1}
                max={MAX_GAMES}
                value={numGames}
                onChange={(e) => setNumGames(e.target.value)}
              />
            </label>
            <label
              className={styles.option}
              title="Game i is dealt with seed + i. The CLI arena with the same bots and seed plays the same games."
            >
              Seed
              <input
                className={styles.input}
                inputMode="numeric"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
              />
            </label>
          </div>
        </fieldset>
        <div className={styles.actions}>
          {/* Keyed: reusing the clicked Stop button as submit restarts the run. */}
          {running ? (
            <button
              key="stop"
              type="button"
              id="js-arena-stop"
              className="px-btn px-btn-wood"
              onClick={onStop}
            >
              Stop
            </button>
          ) : (
            <button
              key="run"
              type="submit"
              id="js-arena-run"
              className="px-btn"
            >
              Run Arena
            </button>
          )}
          {formError && <span className={styles.error}>{formError}</span>}
        </div>
      </GameBlock>
    </form>
  );
};

const Arena: React.FC<{ botOptions: ArenaBotOptions }> = ({ botOptions }) => {
  const [run, setRun] = useState<ArenaRun | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const stopWorker = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
  };

  const startArena = (request: ArenaWorkerRequest) => {
    stopWorker();
    const worker = new Worker(
      // @ts-expect-error import.meta needs module esnext (webpack bundles it)
      new URL("../bot/arenaWorker.ts", import.meta.url)
    );
    workerRef.current = worker;
    const finish = (status: ArenaRun["status"], error: string | null) => {
      stopWorker();
      setRun((prev) => prev && { ...prev, status, error });
    };
    worker.onmessage = ({ data }: MessageEvent<ArenaWorkerMessage>) => {
      if (workerRef.current !== worker) {
        return;
      }
      if (data.type === "game") {
        const { game } = data;
        setRun((prev) => prev && { ...prev, games: [...prev.games, game] });
      } else if (data.type === "done") {
        finish("done", null);
      } else {
        finish("error", data.message);
      }
    };
    worker.onerror = (event) => {
      if (workerRef.current === worker) {
        finish("error", event.message || "The arena worker crashed");
      }
    };
    worker.postMessage(request);
    setRun({
      botNames: request.bots.map((bot) => bot.name),
      numGames: request.numGames,
      games: [],
      status: "running",
      error: null,
    });
    setSelectedIdx(null);
  };

  const stopArena = () => {
    stopWorker();
    setRun((prev) => prev && { ...prev, status: "stopped" });
  };

  const selectedGame =
    run && selectedIdx !== null ? run.games[selectedIdx] : null;

  return (
    <div className={styles.container}>
      <Head>
        <title>Bot Arena - Everdell</title>
      </Head>
      <header className={styles.header}>
        <h1 className={styles.title}>Bot Arena</h1>
        <Link href="/" className={styles.home_link}>
          Back to Everdell
        </Link>
      </header>
      <div className={styles.top}>
        <ArenaSetup
          botOptions={botOptions}
          running={run?.status === "running"}
          onRun={startArena}
          onStop={stopArena}
        />
        {run && <ArenaSummary run={run} />}
      </div>
      {run && run.games.length > 0 && (
        <div
          className={[styles.results, selectedGame && styles.results_detail]
            .filter(Boolean)
            .join(" ")}
        >
          <GamesTable
            run={run}
            selectedIdx={selectedIdx}
            onSelect={setSelectedIdx}
          />
          {selectedGame && (
            <ArenaGameDetail
              key={selectedGame.gameIdx}
              game={selectedGame}
              onPrev={
                selectedGame.gameIdx > 0
                  ? () => setSelectedIdx(selectedGame.gameIdx - 1)
                  : null
              }
              onNext={
                selectedGame.gameIdx < run.games.length - 1
                  ? () => setSelectedIdx(selectedGame.gameIdx + 1)
                  : null
              }
              onClose={() => setSelectedIdx(null)}
            />
          )}
        </div>
      )}
    </div>
  );
};

const ArenaSummary: React.FC<{ run: ArenaRun }> = ({ run }) => {
  const { botNames, games, status, error } = run;
  const summary = summarize(games, botNames.length);
  const statusText =
    status === "running"
      ? `Playing game ${games.length + 1} of ${run.numGames}...`
      : status === "done"
      ? `Played ${games.length} games.`
      : status === "stopped"
      ? `Stopped after ${games.length} of ${run.numGames} games.`
      : `Failed after ${games.length} of ${run.numGames} games: ${error}`;
  return (
    <GameBlock title="Results" className={styles.panel}>
      <div
        id="js-arena-status"
        className={[styles.status, status === "error" && styles.error]
          .filter(Boolean)
          .join(" ")}
      >
        {statusText}
      </div>
      <div className={styles.progress}>
        <div
          className={styles.progress_bar}
          style={{ width: `${(100 * games.length) / run.numGames}%` }}
        />
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Bot</th>
            <th className={styles.num}>Wins</th>
            <th className={styles.num}>Win %</th>
            <th className={styles.num}>Mean VP</th>
          </tr>
        </thead>
        <tbody>
          {botNames.map((name, idx) => (
            <tr key={idx}>
              <td>
                <BotName botIdx={idx} name={name} />
              </td>
              <td className={styles.num}>{summary.wins[idx].toFixed(1)}</td>
              <td className={styles.num}>
                {games.length
                  ? `${((100 * summary.wins[idx]) / games.length).toFixed(1)}%`
                  : "-"}
              </td>
              <td className={styles.num}>
                {games.length ? summary.meanPoints[idx].toFixed(2) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {games.length > 0 && (
        <div className={styles.footnote}>
          {`${summary.meanMoves.toFixed(1)} moves/game · ` +
            `${summary.numRejectedMoves} rejected moves · ` +
            `${formatSeconds(summary.durationMs)} ` +
            `(${formatSeconds(summary.durationMs / games.length)}/game)`}
        </div>
      )}
    </GameBlock>
  );
};

const GamesTable: React.FC<{
  run: ArenaRun;
  selectedIdx: number | null;
  onSelect: (gameIdx: number) => void;
}> = ({ run, selectedIdx, onSelect }) => (
  <GameBlock title="Games" className={[styles.panel, styles.games].join(" ")}>
    <table id="js-arena-games" className={styles.table}>
      <thead>
        <tr>
          <th className={styles.num}>#</th>
          <th>Winner</th>
          <th>Result (seat order)</th>
          <th className={styles.num}>Moves</th>
          <th className={styles.num}>Time</th>
          <th className={styles.num}>Seed</th>
        </tr>
      </thead>
      <tbody>
        {run.games.map((game) => (
          <GameRow
            key={game.gameIdx}
            game={game}
            isSelected={game.gameIdx === selectedIdx}
            onSelect={onSelect}
          />
        ))}
      </tbody>
    </table>
  </GameBlock>
);

const GameRow = React.memo(function GameRow({
  game,
  isSelected,
  onSelect,
}: {
  game: ArenaGame;
  isSelected: boolean;
  onSelect: (gameIdx: number) => void;
}) {
  const { gameIdx, botBySeat, playerNames, points, winnerSeats } = game;
  return (
    <tr
      className={[styles.game_row, isSelected && styles.game_row_selected]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onSelect(gameIdx)}
    >
      <td className={styles.num}>
        <button
          type="button"
          className={styles.link_button}
          title="Show the game log"
        >
          {gameIdx + 1}
        </button>
      </td>
      <td>
        {winnerSeats.length > 1 && "Tie: "}
        {winnerSeats.map((seat) => (
          <BotName
            key={seat}
            botIdx={botBySeat[seat]}
            name={playerNames[seat]}
          />
        ))}
      </td>
      <td>
        <span className={styles.result}>
          {playerNames.map((name, seat) => (
            <span
              key={seat}
              className={[
                styles.result_seat,
                winnerSeats.includes(seat) && styles.result_winner,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <BotName botIdx={botBySeat[seat]} name={name} />
              {points[seat]}
            </span>
          ))}
        </span>
      </td>
      <td className={styles.num}>
        {game.numMoves}
        {game.numRejectedMoves > 0 && (
          <span
            className={styles.error}
            title="Moves the engine rejected"
          >{` (${game.numRejectedMoves} rejected)`}</span>
        )}
      </td>
      <td className={styles.num}>{formatSeconds(game.durationMs)}</td>
      <td className={styles.num}>{game.seed}</td>
    </tr>
  );
});

const ArenaGameDetail: React.FC<{
  game: ArenaGame;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
}> = ({ game, onPrev, onNext, onClose }) => {
  const gameState = useMemo(
    () => GameState.fromJSON(JSON.parse(game.finalStateJSON)),
    [game]
  );
  const logs = useMemo<GameLogEntry[]>(() => JSON.parse(game.logJSON), [game]);
  return (
    <div id="js-arena-game" className={styles.detail}>
      <GameUIProvider
        gameState={gameState}
        viewingPlayerId={null}
        playerThemeIdxs={game.botBySeat}
      >
        <GameBlock
          title={`Game ${game.gameIdx + 1}`}
          className={styles.panel}
          actions={
            <div className={styles.detail_actions}>
              <button
                type="button"
                className="px-btn px-btn-wood"
                disabled={!onPrev}
                onClick={onPrev || undefined}
              >
                Prev
              </button>
              <button
                type="button"
                className="px-btn px-btn-wood"
                disabled={!onNext}
                onClick={onNext || undefined}
              >
                Next
              </button>
              <button
                type="button"
                className="px-btn px-btn-wood"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          }
        >
          <div className={styles.footnote}>
            {`Seed ${game.seed} · ${game.numMoves} moves · ` +
              `${game.numRejectedMoves} rejected · ` +
              `${formatSeconds(game.durationMs)}`}
          </div>
          <GamePointsBreakdown gameState={gameState} />
        </GameBlock>
        <GameLog logs={logs} fixedHeight={false} />
      </GameUIProvider>
    </div>
  );
};

export default Arena;
