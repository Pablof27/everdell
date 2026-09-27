import { Sprite } from "./PixelSprite";

// Hand-authored pixel art. Each row is one line of pixels, "." is transparent.
// Keys in `palette` map to colours; components may override keys (eg. to tint
// a worker with the player's colour).

const INK = "#2a1a0e";

// ---------------------------------------------------------------------------
// Resources & symbols (12x12)
// ---------------------------------------------------------------------------

export const TWIG: Sprite = {
  palette: {
    o: "#3b2210",
    L: "#c98d52",
    b: "#8f5a2c",
    d: "#5e3a1b",
    g: "#8fd05a",
    G: "#4d9a35",
  },
  rows: [
    ".......oooo.",
    "......oLbbdo",
    ".oo..oLbbdo.",
    "ogGooLbbdo..",
    "oggGLbbdo...",
    ".ooLbbdo....",
    ".oLbbdo.....",
    "oLbbdo......",
    "obbdo.......",
    "oddo........",
    ".oo.........",
    "............",
  ],
};

export const RESIN: Sprite = {
  palette: {
    o: "#6b2e08",
    Y: "#ffd98a",
    A: "#f39a2b",
    D: "#c2601a",
    W: "#fff6e0",
  },
  rows: [
    ".....oo.....",
    "....oYAo....",
    "....oYAo....",
    "...oYWAAo...",
    "..oYWAAAAo..",
    ".oYWAAAAAAo.",
    ".oYAAAAAAAo.",
    "oYAAAAAAAADo",
    "oAAAAAAAADDo",
    ".oAAAAAADDo.",
    "..ooDDDDoo..",
    "....oooo....",
  ],
};

export const PEBBLE: Sprite = {
  palette: {
    o: "#2c3338",
    L: "#d3dadd",
    W: "#f5f8f9",
    G: "#9ea9af",
    D: "#6c777d",
  },
  rows: [
    "............",
    "............",
    "....oooo....",
    "..ooLLLLoo..",
    ".oLWWLLGGGo.",
    ".oLWLLGGGGo.",
    "oLLLGGGGGGDo",
    "oLGGGGGGGDDo",
    "oGGGGGGGDDDo",
    ".oGGGGDDDDo.",
    "..ooDDDDoo..",
    "....oooo....",
  ],
};

export const BERRY: Sprite = {
  palette: {
    o: "#2d0f38",
    P: "#a043c0",
    W: "#efc2fa",
    M: "#63207a",
    G: "#3f8a2e",
    g: "#7cc04b",
  },
  rows: [
    ".....oo.....",
    "....oGgo....",
    "..ooogGooo..",
    ".oPPPooPPPo.",
    "oPWWPPPPPPMo",
    "oPWPPPPPPPMo",
    "oPPPPPPPPPMo",
    "oPPPPPPPPMMo",
    "oMPPPPPPPMMo",
    ".oMMPPPPMMo.",
    "..ooMMMMoo..",
    "....oooo....",
  ],
};

export const PEARL: Sprite = {
  palette: {
    o: "#4b5563",
    W: "#ffffff",
    L: "#e6ecf4",
    B: "#aebfd8",
    P: "#f4c6dc",
  },
  rows: [
    "............",
    "....oooo....",
    "..ooWWLLoo..",
    ".oWWWLLLLLo.",
    ".oWWLLLLLLo.",
    "oLWLLLLLLLBo",
    "oLLLLLLLLLBo",
    "oLLLLLLLLBBo",
    ".oLLLLLLBBo.",
    ".oPLLLLBBBo.",
    "..ooPPBBoo..",
    "....oooo....",
  ],
};

export const VP: Sprite = {
  palette: {
    o: "#5c3b06",
    Y: "#f7c948",
    W: "#fff3b8",
    D: "#c48a1c",
    S: "#c98b16",
  },
  rows: [
    "....oooo....",
    "..ooYYYYoo..",
    ".oYWWYYYYYo.",
    ".oYWYSSYYDo.",
    "oYYYYSSYYYDo",
    "oYYSSSSSSYDo",
    "oYYYSSSSYYDo",
    "oYYYSSSSYYDo",
    ".oYYSYYSYDo.",
    ".oYYYYYYDDo.",
    "..ooDDDDoo..",
    "....oooo....",
  ],
};

export const CARD: Sprite = {
  palette: {
    o: "#3b2210",
    L: "#f1d9a6",
    B: "#b0773f",
    g: "#8fd05a",
    G: "#4d9a35",
  },
  rows: [
    "..oooooooo..",
    "..oLLLLLLo..",
    "..oLBBBBLo..",
    "..oLBBgBLo..",
    "..oLBggGLo..",
    "..oLgggGLo..",
    "..oLBgGBLo..",
    "..oLBBGBLo..",
    "..oLBBBBLo..",
    "..oLLLLLLo..",
    "..oooooooo..",
    "............",
  ],
};

export const ANY: Sprite = {
  palette: {
    o: INK,
    T: "#a86a35",
    R: "#f39a2b",
    P: "#a043c0",
    G: "#9ea9af",
    W: "#fff8e7",
  },
  rows: [
    "....oooo....",
    "..ooTTRRoo..",
    ".oTTTTRRRRo.",
    ".oTTTTRRRRo.",
    "oTTTTTRRRRRo",
    "oTTTTWWRRRRo",
    "oPPPPWWGGGGo",
    "oPPPPPGGGGGo",
    ".oPPPPGGGGo.",
    ".oPPPPGGGGo.",
    "..ooPPGGoo..",
    "....oooo....",
  ],
};

export const GOLDEN_LEAF: Sprite = {
  palette: {
    o: "#6b4a06",
    Y: "#f5c542",
    W: "#fff1a8",
    D: "#c08a1a",
  },
  rows: [
    ".......oooo.",
    ".....ooYYYo.",
    "....oYYWYYo.",
    "...oYYWYYYo.",
    "..oYYWYYYDo.",
    "..oYWYYYDDo.",
    ".oYWYYYDDo..",
    ".oYYYYDDo...",
    ".oYYDDDo....",
    "..ooooo.....",
    ".oo.........",
    "oo..........",
  ],
};

export const AUTUMN_LEAF: Sprite = {
  palette: {
    o: "#6b2e08",
    Y: "#f39a2b",
    W: "#ffd98a",
    D: "#c2601a",
  },
  rows: GOLDEN_LEAF.rows,
};

export const TICKET: Sprite = {
  palette: {
    o: "#7a4f12",
    Y: "#f6e27a",
    R: "#d9573b",
    W: "#c9a93a",
  },
  rows: [
    "............",
    "............",
    "oooooooooooo",
    "oYYYYYoYYYYo",
    "oYYRYYoYWWYo",
    ".oRRRYoYYYo.",
    ".oYRYYoYWWo.",
    "oYYYYYoYYYYo",
    "oooooooooooo",
    "............",
    "............",
    "............",
  ],
};

export const RESERVATION_TOKEN: Sprite = {
  palette: {
    o: "#3b2210",
    T: "#e3c48a",
    R: "#c0392b",
  },
  rows: [
    "....oooo....",
    "..ooTTTToo..",
    ".oTTRRRRTTo.",
    ".oTTRRRRTTo.",
    "oTTTRRRRTTTo",
    "oTTTRRRRTTTo",
    "oTTTRRRRTTTo",
    "oTTTRTTRTTTo",
    ".oTTTTTTTTo.",
    ".oTTTTTTTTo.",
    "..ooTTTToo..",
    "....oooo....",
  ],
};

// ---------------------------------------------------------------------------
// Card type badges (12x12). C = type colour, D = darker shade, w = glyph.
// ---------------------------------------------------------------------------

const badgePalette = (C: string, D: string) => ({
  o: INK,
  C,
  D,
  w: "#fff8e7",
});

export const TYPE_COLORS = {
  TRAVELER: { C: "#c4a574", D: "#8a6d3b" },
  PRODUCTION: { C: "#6aa84f", D: "#3f7a2e" },
  DESTINATION: { C: "#c8483d", D: "#8a2a22" },
  GOVERNANCE: { C: "#4a86c5", D: "#285a8f" },
  PROSPERITY: { C: "#7e57c2", D: "#4f3285" },
};

export const BADGE_TRAVELER: Sprite = {
  palette: badgePalette(TYPE_COLORS.TRAVELER.C, TYPE_COLORS.TRAVELER.D),
  rows: [
    "....oooo....",
    "..ooCCCCoo..",
    ".oCCCwwwCCo.",
    ".oCCCwwwCCo.",
    "oCCCCwwwCCCo",
    "oCCCCwwwCCCo",
    "oCCCCwwwwwCo",
    "oCCCwwwwwwCo",
    ".oCCwwwwwwo.",
    ".oCCCCCCCDo.",
    "..ooCDDDoo..",
    "....oooo....",
  ],
};

export const BADGE_PRODUCTION: Sprite = {
  palette: badgePalette(TYPE_COLORS.PRODUCTION.C, TYPE_COLORS.PRODUCTION.D),
  rows: [
    "....oooo....",
    "..ooCCCCoo..",
    ".oCCCCCCCCo.",
    ".oCwwCCwwwo.",
    "oCwwwwCwwwCo",
    "oCCwwwwwwCCo",
    "oCCCCwwCCCCo",
    "oCCCCwwCCCCo",
    ".oCCCwwCCCo.",
    ".oCCwwwwCDo.",
    "..ooCDDDoo..",
    "....oooo....",
  ],
};

export const BADGE_DESTINATION: Sprite = {
  palette: badgePalette(TYPE_COLORS.DESTINATION.C, TYPE_COLORS.DESTINATION.D),
  rows: [
    "....oooo....",
    "..ooCCCCoo..",
    ".oCCCwwCCCo.",
    ".oCCwwwwCCo.",
    "oCCwwwwwwCCo",
    "oCwwwwwwwwCo",
    "oCCwwCCwwCCo",
    "oCCwwCCwwCCo",
    ".oCwwCCwwCo.",
    ".oCCCCCCCDo.",
    "..ooCDDDoo..",
    "....oooo....",
  ],
};

export const BADGE_GOVERNANCE: Sprite = {
  palette: badgePalette(TYPE_COLORS.GOVERNANCE.C, TYPE_COLORS.GOVERNANCE.D),
  rows: [
    "....oooo....",
    "..ooCCCCoo..",
    ".oCCCCCCCCo.",
    ".oCwwwwwwCo.",
    "oCCwCCCCwCCo",
    "oCCwwwwwwCCo",
    "oCCwCCCCwCCo",
    "oCCwwwwwwCCo",
    ".oCwCCCCwCo.",
    ".oCwwwwwwDo.",
    "..ooCDDDoo..",
    "....oooo....",
  ],
};

export const BADGE_PROSPERITY: Sprite = {
  palette: badgePalette(TYPE_COLORS.PROSPERITY.C, TYPE_COLORS.PROSPERITY.D),
  rows: [
    "....oooo....",
    "..ooCCCCoo..",
    ".oCCCwwCCCo.",
    ".oCCCwwCCCo.",
    "oCwwCwwCwwCo",
    "oCCwwwwwwCCo",
    "oCCwwwwwwCCo",
    "oCwwCwwCwwCo",
    ".oCCCwwCCCo.",
    ".oCCCwwCCDo.",
    "..ooCDDDoo..",
    "....oooo....",
  ],
};

// ---------------------------------------------------------------------------
// Workers & ambassadors (10x12). C = player colour, D = darker, L = lighter.
// ---------------------------------------------------------------------------

export const MEEPLE: Sprite = {
  palette: {
    o: "#1a0f08",
    k: "#1a0f08",
    C: "#d9573b",
    D: "#8f2f1c",
    L: "#f7b39e",
  },
  rows: [
    "..o....o..",
    ".oCo..oCo.",
    ".oCCooCCo.",
    ".oLCCCCCo.",
    ".oCkCCkCo.",
    ".oCCCCCDo.",
    "..oCCCDo..",
    ".oLCCCCDo.",
    "oLCCCCCCDo",
    "oCCCCCCDDo",
    ".oCCooCDo.",
    ".ooo..ooo.",
  ],
};

export const FROG_MEEPLE: Sprite = {
  palette: {
    o: "#1a0f08",
    k: "#1a0f08",
    W: "#ffffff",
    C: "#3aa66a",
    D: "#1f6a40",
    L: "#f3e7c3",
  },
  rows: [
    ".oo....oo.",
    "oWko..oWko",
    "oCCooooCCo",
    "oCCCCCCCCo",
    "oCCkkkkCDo",
    ".oCCCCCDo.",
    "..oCCCDo..",
    ".oCCCCCDo.",
    "oCCLLLLCDo",
    "oCLLLLLLDo",
    ".oCCooCDo.",
    ".ooo..ooo.",
  ],
};

// ---------------------------------------------------------------------------
// Critter portraits (16x16), used for player avatars and critter card art.
// F = fur, D = dark fur, C = cream, E = inner ear, k = eye, W = eye shine.
// ---------------------------------------------------------------------------

export const SQUIRREL: Sprite = {
  palette: {
    o: "#2a1206",
    F: "#d9713a",
    D: "#a14a1f",
    E: "#f2a37e",
    C: "#f7e2c0",
    n: "#4a2412",
    k: "#1a0f08",
    W: "#ffffff",
  },
  rows: [
    "................",
    "..oo........oo..",
    ".oFFo......oFFo.",
    ".oFEFo....oFEFo.",
    "..oFFFooooFFFo..",
    "..oFFFFFFFFFFo..",
    ".oFFFFFFFFFFFFo.",
    ".oFFkkFFFFkkFFo.",
    ".oFFkWFFFFkWFFo.",
    ".oFFFFCCCCFFFFo.",
    ".oDFFCCnnCCFFDo.",
    "..oDFCCCCCCFDo..",
    "..oDDFCCCCFDDo..",
    "...ooDDDDDDoo...",
    ".....oooooo.....",
    "................",
  ],
};

export const HEDGEHOG: Sprite = {
  palette: {
    o: "#2a1206",
    S: "#6b4a2e",
    s: "#8c6a48",
    F: "#f0d6b0",
    R: "#f2a3a3",
    n: "#2a1206",
    k: "#1a0f08",
    W: "#ffffff",
  },
  rows: [
    "................",
    "...o..o..o..o...",
    "..oSooSooSooSo..",
    ".oSsSSsSSsSSsSo.",
    "oSSSsSSsSSsSSSSo",
    "oSsSFFFFFFFFSsSo",
    "oSSFFFFFFFFFFSSo",
    "oSFFkkFFFFkkFFSo",
    "oSFFkWFFFFkWFFSo",
    ".oFFFFFFFFFFFFo.",
    ".oFRFFFFFFFFRFo.",
    "..oFFFFnnFFFFo..",
    "...oFFFnnFFFo...",
    "....ooFFFFoo....",
    "......oooo......",
    "................",
  ],
};

export const MOUSE: Sprite = {
  palette: {
    o: "#2a1a1e",
    F: "#9aa3ad",
    D: "#6b737c",
    E: "#f2b8c6",
    C: "#e9ecef",
    n: "#d46a8a",
    k: "#1a0f08",
    W: "#ffffff",
  },
  rows: [
    "................",
    ".ooo........ooo.",
    "oFFFo......oFFFo",
    "oFEEFo....oFEEFo",
    "oFEEFFooooFFEEFo",
    ".oFFFFFFFFFFFFo.",
    "..oFFFFFFFFFFo..",
    ".oFFkkFFFFkkFFo.",
    ".oFFkWFFFFkWFFo.",
    ".oFFFFFFFFFFFFo.",
    ".oDFCCCCCCCCFDo.",
    "..oDCCCnnCCCDo..",
    "...oDCCCCCCDo...",
    "....ooDDDDoo....",
    "......oooo......",
    "................",
  ],
};

export const TURTLE: Sprite = {
  palette: {
    o: "#16301a",
    F: "#7cbf6a",
    D: "#4f8f45",
    m: "#2e5a24",
    S: "#8a5a2b",
    s: "#c48a4f",
    k: "#1a0f08",
    W: "#ffffff",
  },
  rows: [
    "................",
    ".....oooooo.....",
    "...ooFFFFFFoo...",
    "..oFFFFFFFFFFo..",
    ".oFFFFFFFFFFFFo.",
    ".oFFkkFFFFkkFFo.",
    ".oFFkWFFFFkWFFo.",
    ".oFFFFFFFFFFFFo.",
    ".oDFFFmmmmFFFDo.",
    "..oDFFFFFFFFDo..",
    "..ooSSSSSSSSoo..",
    ".oSSsSSsSSsSSSo.",
    "oSSsSSsSSsSSsSSo",
    "oSSSSSSSSSSSSSSo",
    ".oooooooooooooo.",
    "................",
  ],
};

export const FROG: Sprite = {
  palette: {
    o: "#16301a",
    F: "#6fbf4a",
    D: "#3f8a2e",
    C: "#e9f2c4",
    m: "#2e5a24",
    R: "#f2a3a3",
    k: "#1a0f08",
    W: "#ffffff",
  },
  rows: [
    "................",
    "..oooo....oooo..",
    ".oFFFFo..oFFFFo.",
    ".oFWkFooooFWkFo.",
    ".oFkkFFFFFFkkFo.",
    "oFFFFFFFFFFFFFFo",
    "oFFFFFFFFFFFFFFo",
    "oFRFFFFFFFFFFRFo",
    "oDFmmmmmmmmmmFDo",
    ".oDFFFFFFFFFFDo.",
    "..oDCCCCCCCCDo..",
    "...ooCCCCCCoo...",
    ".....oooooo.....",
    "................",
    "................",
    "................",
  ],
};

export const CRITTERS = {
  squirrel: SQUIRREL,
  hedgehog: HEDGEHOG,
  mouse: MOUSE,
  turtle: TURTLE,
  frog: FROG,
};

export type CritterKind = keyof typeof CRITTERS;

// ---------------------------------------------------------------------------
// Location & UI icons (12x12)
// ---------------------------------------------------------------------------

export const TREE_ICON: Sprite = {
  palette: {
    o: "#1f3a14",
    L: "#8fd05a",
    G: "#5aa53a",
    D: "#3b7a2a",
    T: "#8f5a2c",
    t: "#5e3a1b",
    k: "#3b2210",
  },
  rows: [
    "....oooo....",
    "..ooLLGGoo..",
    ".oLLLGGGGGo.",
    ".oLLGGGGGGo.",
    "oLLGGGGGGGDo",
    "oLGGGGGGGDDo",
    "oGGGGGGGDDDo",
    ".oGGGGGDDDo.",
    "..oooTtooo..",
    ".....Tt.....",
    "....kTtk....",
    "....kkkk....",
  ],
};

export const SIGNPOST: Sprite = {
  palette: {
    o: "#3b2210",
    L: "#e7c48a",
    B: "#b0773f",
    g: "#8fd05a",
    G: "#4d9a35",
  },
  rows: [
    "............",
    ".ooooooooo..",
    ".oLLLLLLLLo.",
    ".oLBBBBBBLLo",
    ".oLLLLLLLLo.",
    ".oooooBooo..",
    ".....oBo....",
    ".....oBo....",
    ".....oBo....",
    "....ooBoo...",
    "...gGGGGGg..",
    "............",
  ],
};

export const HUT: Sprite = {
  palette: {
    o: INK,
    R: "#c8483d",
    D: "#8a2a22",
    W: "#f0dcb0",
    Y: "#ffd966",
    B: "#6b3f1f",
  },
  rows: [
    ".....oo.....",
    "....oRRo....",
    "...oRRRRo...",
    "..oRRRRRDo..",
    ".oRRRRRRDDo.",
    "oooooooooooo",
    ".oWWWWWWWWo.",
    ".oWYYWoooWo.",
    ".oWYYWoBoWo.",
    ".oWWWWoBoWo.",
    "oooooooooooo",
    "............",
  ],
};

export const MOUNTAIN: Sprite = {
  palette: {
    o: "#2c3338",
    W: "#f4f7f8",
    G: "#9ea9af",
    D: "#6c777d",
    R: "#d9443a",
  },
  rows: [
    ".....oRR....",
    ".....o......",
    ".....oo.....",
    "....oWWo....",
    "...oWWGGo...",
    "..oWGGGGDo..",
    "..oGGGGGDo..",
    ".oGGGGGGDDo.",
    ".oGGGGGDDDo.",
    "oGGGGGGDDDDo",
    "oooooooooooo",
    "............",
  ],
};

export const HILL: Sprite = {
  palette: {
    o: "#1f3a14",
    L: "#8fd05a",
    G: "#5aa53a",
    D: "#3b7a2a",
    B: "#3b2210",
  },
  rows: [
    "............",
    "............",
    "....oooo....",
    "..ooLLGGoo..",
    ".oLLLGGGGGo.",
    ".oLGGoooGGo.",
    "oLGGoBBBoGGo",
    "oGGGoBBBoGDo",
    "oGGGoBBBoDDo",
    "oooooooooooo",
    "............",
    "............",
  ],
};

export const TRAIN: Sprite = {
  palette: {
    o: INK,
    S: "#6c777d",
    R: "#c8483d",
    W: "#e8d2a6",
    Y: "#ffd966",
    K: "#6c777d",
  },
  rows: [
    "............",
    "..oo........",
    "..oSo..ooooo",
    "..oSo..oWWWo",
    ".oooooooYYWo",
    ".oRRRRRoWWWo",
    ".oRRRRRRRRRo",
    "ooRRRRRRRRRo",
    ".ooooooooooo",
    "..oKo..oKo..",
    "..ooo..ooo..",
    "............",
  ],
};

export const PAW: Sprite = {
  palette: {
    o: "var(--paw-outline, #6b4a2e)",
    P: "var(--paw-fill, #f3e3c3)",
  },
  rows: [
    "...oo..oo...",
    "..oPPooPPo..",
    "..oPPooPPo..",
    ".oooo..oooo.",
    "oPPo....oPPo",
    "oPPo.oo.oPPo",
    ".oo.oPPo.oo.",
    "...oPPPPo...",
    "..oPPPPPPo..",
    "..oPPPPPPo..",
    "...oPPPPo...",
    "....oooo....",
  ],
};

export const FLAG: Sprite = {
  palette: {
    o: "#5e3a1b",
    R: "#d9443a",
    W: "#ffb0a3",
  },
  rows: [
    "o.........",
    "oRRRRRRRo.",
    "oRWRRRRRRo",
    "oRRRRRRRo.",
    "oRRRRRRRRo",
    "oRRRRRRRo.",
    "o.........",
    "o.........",
    "o.........",
    "o.........",
    "o.........",
    "oo........",
  ],
};

export const HOURGLASS: Sprite = {
  palette: {
    F: "#8f5a2c",
    o: "#3b2210",
    W: "#e8f4f8",
    S: "#f2c14e",
  },
  rows: [
    "FFFFFFFFFF",
    ".oWWWWWWo.",
    ".oSSSSSSo.",
    "..oSSSSo..",
    "...oSSo...",
    "....oo....",
    "...oSWo...",
    "..oWSWWo..",
    ".oWWSWWWo.",
    ".oSSSSSSo.",
    ".oSSSSSSo.",
    "FFFFFFFFFF",
  ],
};

export const CROWN: Sprite = {
  palette: {
    o: "#5c3b06",
    Y: "#f7c948",
    D: "#c48a1c",
    R: "#d9443a",
    W: "#ffd0c8",
  },
  rows: [
    "o....oo....o",
    "oo..oYYo..oo",
    "oYo.oYYo.oYo",
    "oYYoYYYYoYYo",
    "oYYYYRRYYYYo",
    "oYYYRWRRYYYo",
    "oYYYYRRYYYYo",
    "oYDYDYDYDYDo",
    "oooooooooooo",
  ],
};

export const ARROW: Sprite = {
  palette: { Y: "var(--arrow-color, #f7c948)", o: "#5c3b06" },
  rows: [
    "oo.....",
    "oYo....",
    "oYYo...",
    "oYYYo..",
    "oYYYYo.",
    "oYYYo..",
    "oYYo...",
    "oYo....",
    "oo.....",
  ],
};

// Seasons
export const SUN: Sprite = {
  palette: { Y: "#f7c948", W: "#fff3b8", D: "#e0a020", o: "#b8621a" },
  rows: [
    "....Y..Y....",
    ".Y........Y.",
    "....oooo....",
    "...oYYYYo...",
    "Y.oYWYYYYo.Y",
    "..oYYYYYYo..",
    "..oYYYYYDo..",
    "Y.oYYYYDDo.Y",
    "...oYYDDo...",
    "....oooo....",
    ".Y........Y.",
    "....Y..Y....",
  ],
};

export const SNOWFLAKE: Sprite = {
  palette: { W: "#4f9fd9" },
  rows: [
    ".....W......",
    "...W.W.W....",
    "....WWW.....",
    ".W...W...W..",
    "..W..W..W...",
    "WWWWWWWWWWW.",
    "..W..W..W...",
    ".W...W...W..",
    "....WWW.....",
    "...W.W.W....",
    ".....W......",
    "............",
  ],
};

export const BLOSSOM: Sprite = {
  palette: { P: "#f28bb3", Y: "#f7c948", G: "#4d9a35", o: "#8a2f55" },
  rows: [
    "............",
    "....oooo....",
    "...oPPPPo...",
    ".oooPPPPooo.",
    "oPPPoYYoPPPo",
    "oPPPYYYYPPPo",
    "oPPPoYYoPPPo",
    ".oooPPPPooo.",
    "...oPPPPo...",
    "....oGGo....",
    "....oGo.....",
    ".....o......",
  ],
};

// ---------------------------------------------------------------------------
// Card illustrations (20x16). R/D = roof colour (overridden by card type).
// ---------------------------------------------------------------------------

export const COTTAGE: Sprite = {
  palette: {
    o: INK,
    R: "#c8483d",
    D: "#8a2a22",
    W: "#f0dcb0",
    Y: "#ffd966",
    B: "#6b3f1f",
    C: "#9c6b3c",
  },
  rows: [
    "............ooo.....",
    ".........oo.oCo.....",
    "........oRRooCo.....",
    ".......oRRRRoCo.....",
    "......oRRRRRRoo.....",
    ".....oRRRRRRRRo.....",
    "....oRRRRRRRRRRo....",
    "...oRRRRRRRRRRRDo...",
    "..oRRRRRRRRRRRRDDo..",
    ".oooooooooooooooooo.",
    "..oWWWWWWWWWWWWWWo..",
    "..oWoooWWBBWWoooWo..",
    "..oWoYoWWBBWWoYoWo..",
    "..oWoooWWBBWWoooWo..",
    "..oWWWWWWBBWWWWWWo..",
    ".oooooooooooooooooo.",
  ],
};

export const BARN: Sprite = {
  palette: {
    o: INK,
    R: "#6aa84f",
    D: "#3f7a2e",
    W: "#c98d52",
    X: "#f0dcb0",
    B: "#8f5a2c",
    Y: "#ffd966",
  },
  rows: [
    "......oooooooo......",
    ".....oRRRRRRRRo.....",
    "....oRRRRRRRRRRo....",
    "...oRRRRRRRRRRRDo...",
    "..oRRRRRRRRRRRRRDo..",
    ".oRRRRRRRRRRRRRRRDo.",
    "oRRRRRRRRRRRRRRRRRDo",
    "oooooooooooooooooooo",
    ".oWWWWWWWWWWWWWWWWo.",
    ".oWYYWWooooooWWYYWo.",
    ".oWYYWWoXBBXoWWYYWo.",
    ".oWWWWWoBXXBoWWWWWo.",
    ".oWWWWWoBXXBoWWWWWo.",
    ".oWWWWWoXBBXoWWWWWo.",
    ".oWWWWWooooooWWWWWo.",
    "oooooooooooooooooooo",
  ],
};

export const TOWER: Sprite = {
  palette: {
    o: INK,
    R: "#4a86c5",
    D: "#285a8f",
    F: "#f7c948",
    W: "#e2dccb",
    Y: "#ffd966",
    B: "#6b3f1f",
  },
  rows: [
    "..........oFFF......",
    "..........oFF.......",
    "..........o.........",
    ".........oRo........",
    "........oRRDo.......",
    ".......oRRRDDo......",
    "......oRRRRDDDo.....",
    ".....oRRRRRDDDDo....",
    ".....ooooooooooo....",
    "......oWWWWWWWo.....",
    "......oWWoYoWWo.....",
    "......oWWoYoWWo.....",
    "......oWWWWWWWo.....",
    "......oWWoooWWo.....",
    "......oWWoBoWWo.....",
    ".....ooooooooooo....",
  ],
};

export const CASTLE: Sprite = {
  palette: {
    o: INK,
    S: "#4a4458",
    L: "#b9b3c9",
    R: "#7e57c2",
    Y: "#ffd966",
    B: "#3b2a1a",
  },
  rows: [
    ".........oRR........",
    ".........o..........",
    ".SS..SS..SS..SS..SS.",
    ".SSSSSSSSSSSSSSSSSS.",
    ".SLLLLLLLLLLLLLLLLS.",
    ".SLLRRLLLLLLLLRRLLS.",
    ".SLLRRLLLSSLLLRRLLS.",
    ".SLLLLLLSYYSLLLLLLS.",
    ".SLLLLLLSYYSLLLLLLS.",
    ".SLLLLLLLLLLLLLLLLS.",
    ".SLLLLLLSSSSLLLLLLS.",
    ".SLLLLLSBBBBSLLLLLS.",
    ".SLLLLLSBBBBSLLLLLS.",
    ".SLLLLLSBBBBSLLLLLS.",
    ".SSSSSSSBBBBSSSSSSS.",
    "....................",
  ],
};

// ---------------------------------------------------------------------------
// Scenery
// ---------------------------------------------------------------------------

export const TREE: Sprite = {
  palette: {
    o: "#1f3a14",
    L: "#8fd05a",
    G: "#5aa53a",
    D: "#3b7a2a",
    W: "#c5ec8e",
    T: "#8f5a2c",
    t: "#5e3a1b",
    k: "#3b2210",
  },
  rows: [
    "......oooooooo......",
    "....ooLLLLGGGGoo....",
    "...oLLLLLLGGGGGGo...",
    "..oLLLWLLLGGGGGGGo..",
    ".oLLLLLLLGGGGGGGGGo.",
    ".oLLLLLGGGGGGGGGGDo.",
    "oLLLLGGGGGGLGGGGGGDo",
    "oLLLGGGGGGLLLGGGGDDo",
    "oLGGGGGGGGGGGGGGGDDo",
    "oGGGGGDGGGGGGGGGDDDo",
    ".oGGGGGDDGGGGGGDDDo.",
    ".oGGGGGGGGGGGGDDDDo.",
    "..oDGGGGGGGGGDDDDo..",
    "...oDDGGGGGDDDDDo...",
    ".....ooDDDDDDDoo....",
    ".......kTTttk.......",
    ".......kTTttk.......",
    ".......kTTttk.......",
    "......kkTTttkk......",
    ".....kTTTTttttk.....",
    "....kkkkkkkkkkkk....",
  ],
};

export const EVERTREE: Sprite = {
  palette: {
    ...TREE.palette,
    L: "#ffe38a",
    G: "#f2b84b",
    D: "#c9832a",
    W: "#fff6cf",
    o: "#6b3f0e",
  },
  rows: TREE.rows,
};

export const PINE: Sprite = {
  palette: {
    o: "#15300e",
    L: "#5aa53a",
    G: "#3b7a2a",
    D: "#285a1d",
    T: "#8f5a2c",
    t: "#5e3a1b",
    k: "#3b2210",
  },
  rows: [
    ".....oo.....",
    "....oLGo....",
    "...oLLGGo...",
    "..oLLGGGDo..",
    "...oLGGDo...",
    "..oLLGGGDo..",
    ".oLLGGGGDDo.",
    "..oLGGGGDo..",
    ".oLLGGGGGDo.",
    "oLLGGGGGGDDo",
    ".oooooooooo.",
    ".....kTtk...",
    "....kkTtkk..",
  ],
};

export const BUSH: Sprite = {
  palette: {
    o: "#1f3a14",
    L: "#8fd05a",
    G: "#5aa53a",
    D: "#3b7a2a",
    R: "#d9443a",
  },
  rows: [
    "....oooo..ooo...",
    "..ooLLGGooLGGo..",
    ".oLLLGGGGLLGGGo.",
    "oLLGGGGGGGGGGGDo",
    "oLGGGRGGGGGRGGDo",
    "oGGGGGGGGGGGGDDo",
    "oGGDGGGGGRGGDDDo",
    ".oDDDDDDDDDDDDo.",
    "..oooooooooooo..",
  ],
};

export const MUSHROOM: Sprite = {
  palette: { o: "#3b1a10", R: "#d9443a", W: "#fff3e6", C: "#f3e3c3" },
  rows: [
    "..oooo..",
    ".oRRWRo.",
    "oRWRRRRo",
    "oRRRRWRo",
    "oooooooo",
    "..oCCo..",
    "..oCCo..",
    "..oooo..",
  ],
};

export const STUMP: Sprite = {
  palette: {
    o: "#3b2210",
    L: "#e7c48a",
    r: "#b98a52",
    B: "#8f5a2c",
    b: "#5e3a1b",
  },
  rows: [
    "...oooooooooo...",
    ".ooLLLLLLLLLLoo.",
    "oLLrrrrrrrrrrLLo",
    "oLrrLLLLLLLLrrLo",
    "oLLrrrrrrrrrrLLo",
    ".ooLLLLLLLLLLoo.",
    ".oBBbBBBbBBBbBo.",
    ".oBBbBBBbBBBbBo.",
    "oBBBbBBBbBBBbBBo",
    ".oooooooooooooo.",
  ],
};

export const ROCK: Sprite = {
  palette: {
    o: "#2c3338",
    L: "#d3dadd",
    W: "#f5f8f9",
    G: "#9ea9af",
    D: "#6c777d",
  },
  rows: [
    "...oooo...",
    ".ooLLGGoo.",
    "oLLWGGGGDo",
    "oLGGGGGGDo",
    "oGGGGGGDDo",
    ".oGGDDDDo.",
    "..oooooo..",
  ],
};

export const FLOWER: Sprite = {
  palette: { P: "#f28bb3", Y: "#f7c948", g: "#4d9a35" },
  rows: ["..P..", ".PYP.", "..P..", "..g..", ".gg..", "..g.."],
};

export const CLOUD: Sprite = {
  palette: { W: "#ffffff", S: "#dcebf5" },
  rows: [
    ".........WWWWW..........",
    "......WWWWWWWWWW..WWW...",
    "...WWWWWWWWWWWWWWWWWWWW.",
    ".WWWWWWWWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWWWWWWWWWW",
    "SWWWWWWWWWWWWWWWWWWWWWWS",
    ".SSSWWWWWSSSSWWWWWWSSSS.",
    "....SSSSS....SSSSSS.....",
  ],
};

export const PETAL: Sprite = {
  palette: { P: "#f7a8c8", W: "#ffe3ef" },
  rows: [".PP.", "PWPP", "PPPP", ".PP."],
};

export const SNOW: Sprite = {
  palette: { W: "#ffffff" },
  rows: ["W.W.W", ".WWW.", "WWWWW", ".WWW.", "W.W.W"],
};

export const FIREFLY: Sprite = {
  palette: { Y: "#fff59a", G: "#d8f36a" },
  rows: [".G.", "GYG", ".G."],
};

// Tileable water ripples (transparent base, drawn over a water colour).
export const WATER_TILE: Sprite = {
  palette: { w: "rgba(255, 255, 255, 0.55)", d: "rgba(0, 40, 70, 0.18)" },
  rows: [
    "................",
    "..www...........",
    ".....wwww.......",
    "................",
    "..........dddd..",
    "................",
    "...........ww...",
    ".............ww.",
  ],
};

// Tileable grass texture for the page background (transparent base).
export const GRASS_TILE: Sprite = {
  palette: {
    g: "rgba(40, 80, 20, 0.28)",
    l: "rgba(255, 255, 210, 0.22)",
    f: "#fff3b0",
    p: "#f7a8c8",
  },
  rows: [
    "................................",
    "...g............................",
    "..g.g.................l.........",
    ".....................l.l........",
    "...........g....................",
    "..........g.g.................f.",
    "................................",
    "....................g...........",
    "...l...............g.g..........",
    "..l.l...........................",
    "................................",
    "............................g...",
    ".........p.................g.g..",
    "................................",
    "...............g................",
    "..............g.g.......l.......",
    "g......................l.l......",
    ".g..............................",
    "......l.........................",
    ".....l.l...........g............",
    "..................g.g...........",
    "..............................l.",
    "...........f.................l.l",
    "................................",
    "..........................g.....",
    "...g.....................g.g....",
    "..g.g...........................",
    "...............l................",
    "..............l.l...............",
    ".......................p........",
    "................................",
    "................................",
  ],
};

export const ALL_SPRITES: Record<string, Sprite> = {
  TWIG,
  RESIN,
  PEBBLE,
  BERRY,
  PEARL,
  VP,
  CARD,
  ANY,
  GOLDEN_LEAF,
  AUTUMN_LEAF,
  TICKET,
  RESERVATION_TOKEN,
  BADGE_TRAVELER,
  BADGE_PRODUCTION,
  BADGE_DESTINATION,
  BADGE_GOVERNANCE,
  BADGE_PROSPERITY,
  MEEPLE,
  FROG_MEEPLE,
  SQUIRREL,
  HEDGEHOG,
  MOUSE,
  TURTLE,
  FROG,
  TREE_ICON,
  SIGNPOST,
  HUT,
  MOUNTAIN,
  HILL,
  TRAIN,
  PAW,
  FLAG,
  HOURGLASS,
  CROWN,
  ARROW,
  SUN,
  SNOWFLAKE,
  BLOSSOM,
  COTTAGE,
  BARN,
  TOWER,
  CASTLE,
  TREE,
  EVERTREE,
  PINE,
  BUSH,
  MUSHROOM,
  STUMP,
  ROCK,
  FLOWER,
  CLOUD,
  PETAL,
  SNOW,
  FIREFLY,
};
