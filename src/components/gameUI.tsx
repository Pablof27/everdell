import * as React from "react";

import { GameState } from "../model/gameState";
import { CritterKind } from "./pixel/sprites";

export type PlayerTheme = {
  idx: number;
  critter: CritterKind;
  color: string;
  dark: string;
  light: string;
};

const PLAYER_THEMES: Omit<PlayerTheme, "idx">[] = [
  { critter: "squirrel", color: "#e0663a", dark: "#8f2f1c", light: "#fbc3a8" },
  { critter: "hedgehog", color: "#9161cc", dark: "#553080", light: "#dcc6f5" },
  { critter: "mouse", color: "#3f93dc", dark: "#1f5689", light: "#bcdcf8" },
  { critter: "turtle", color: "#3aa66a", dark: "#1f6a40", light: "#b3e6c6" },
  { critter: "frog", color: "#d9a520", dark: "#8a6410", light: "#f7e3a3" },
  { critter: "mouse", color: "#d6508a", dark: "#8a2653", light: "#f6c1d8" },
];

export const NEUTRAL_THEME: PlayerTheme = {
  idx: -1,
  critter: "mouse",
  color: "#9c8468",
  dark: "#5b4636",
  light: "#e8dcc6",
};

export function getPlayerThemeByIdx(idx: number): PlayerTheme {
  if (idx < 0) {
    return NEUTRAL_THEME;
  }
  return { idx, ...PLAYER_THEMES[idx % PLAYER_THEMES.length] };
}

// CSS custom properties consumed by player-coloured elements.
export function playerThemeStyle(theme: PlayerTheme): React.CSSProperties {
  return {
    ["--player-color" as any]: theme.color,
    ["--player-dark" as any]: theme.dark,
    ["--player-light" as any]: theme.light,
  };
}

export type GameUIContextValue = {
  gameState: GameState | null;
  viewingPlayerId: string | null;
  getPlayerTheme: (playerId: string) => PlayerTheme;
  getPlayerThemeByName: (name: string) => PlayerTheme;
  getPlayerName: (playerId: string) => string;
  getNumWorkers: (playerId: string) => number;
};

export const GameUIContext = React.createContext<GameUIContextValue>({
  gameState: null,
  viewingPlayerId: null,
  getPlayerTheme: () => NEUTRAL_THEME,
  getPlayerThemeByName: () => NEUTRAL_THEME,
  getPlayerName: (playerId) => playerId,
  getNumWorkers: () => 0,
});

export const GameUIProvider: React.FC<{
  gameState: GameState;
  viewingPlayerId: string | null;
}> = ({ gameState, viewingPlayerId, children }) => {
  const value = React.useMemo<GameUIContextValue>(() => {
    const idxById: Record<string, number> = {};
    const idxByName: Record<string, number> = {};
    const nameById: Record<string, string> = {};
    const numWorkersById: Record<string, number> = {};
    gameState.players.forEach((player, idx) => {
      idxById[player.playerId] = idx;
      idxByName[player.name] = idx;
      nameById[player.playerId] = player.name;
      numWorkersById[player.playerId] = player.toJSON(false).numWorkers;
    });
    return {
      gameState,
      viewingPlayerId,
      getPlayerTheme: (playerId: string) =>
        getPlayerThemeByIdx(playerId in idxById ? idxById[playerId] : -1),
      getPlayerThemeByName: (name: string) =>
        getPlayerThemeByIdx(name in idxByName ? idxByName[name] : -1),
      getPlayerName: (playerId: string) => nameById[playerId] || playerId,
      getNumWorkers: (playerId: string) => numWorkersById[playerId] || 0,
    };
  }, [gameState, viewingPlayerId]);
  return (
    <GameUIContext.Provider value={value}>{children}</GameUIContext.Provider>
  );
};

export const useGameUI = (): GameUIContextValue =>
  React.useContext(GameUIContext);
