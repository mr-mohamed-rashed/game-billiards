export type GameMode = "8-ball" | "snooker";
export type BallGroup = "unassigned" | "solids" | "stripes";
export type ActiveModalType = "settings" | "shop" | "leaderboard" | "tournaments" | null;

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  number: number;
  type: "cue" | "solid" | "stripe" | "black" | "red" | "color";
  isPotted: boolean;
  value?: number;
  // Number pole unit vector
  px: number;
  py: number;
  pz: number;
  // Orthogonal stripe / polar-cap unit vector (s · p = 0)
  sx: number;
  sy: number;
  sz: number;
}

export interface Pocket {
  id: number;
  name: string;
  x: number;
  y: number;
  r: number;
}

export interface TableGeometry {
  walls: { left: number; right: number; top: number; bottom: number };
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  railSpans: {
    topLeftEndX: number;
    topMidStartX: number;
    topMidEndX: number;
    topRightStartX: number;
    botLeftEndX: number;
    botMidStartX: number;
    botMidEndX: number;
    botRightStartX: number;
    leftTopEndY: number;
    leftBotStartY: number;
    rightTopEndY: number;
    rightBotStartY: number;
  };
  pockets: Pocket[];
  jaws: { x: number; y: number; r: number }[];
}

export interface CinematicCamState {
  active: boolean;
  pocket: Pocket;
  ballNum: number;
  ballColor: string;
}

export const TABLE_WIDTH = 900;
export const TABLE_HEIGHT = 450;
export const CUSHION = 30;
export const BALL_RADIUS = 12;

export function buildTableGeometry(spec: {
  walls: { left: number; right: number; top: number; bottom: number };
  pockets: {
    tl: [number, number, number];
    tm: [number, number, number];
    tr: [number, number, number];
    bl: [number, number, number];
    bm: [number, number, number];
    br: [number, number, number];
  };
}): TableGeometry {
  const { walls, pockets: pk } = spec;
  const bounds = {
    minX: walls.left + BALL_RADIUS,
    maxX: walls.right - BALL_RADIUS,
    minY: walls.top + BALL_RADIUS,
    maxY: walls.bottom - BALL_RADIUS,
  };

  const pockets: Pocket[] = [
    { id: 0, name: "أعلى يسار", x: pk.tl[0], y: pk.tl[1], r: pk.tl[2] },
    { id: 1, name: "أعلى وسط", x: pk.tm[0], y: pk.tm[1], r: pk.tm[2] },
    { id: 2, name: "أعلى يمين", x: pk.tr[0], y: pk.tr[1], r: pk.tr[2] },
    { id: 3, name: "أسفل يسار", x: pk.bl[0], y: pk.bl[1], r: pk.bl[2] },
    { id: 4, name: "أسفل وسط", x: pk.bm[0], y: pk.bm[1], r: pk.bm[2] },
    { id: 5, name: "أسفل يمين", x: pk.br[0], y: pk.br[1], r: pk.br[2] },
  ];

  // Derive straight cushion mouth spans directly from walls & pocket holes
  const cornerClear = 9;
  const midClear = 8;
  const railSpans = {
    topLeftEndX: Math.max(bounds.minX + 4, pk.tl[0] + pk.tl[2] + cornerClear),
    topMidStartX: pk.tm[0] - pk.tm[2] - midClear,
    topMidEndX: pk.tm[0] + pk.tm[2] + midClear,
    topRightStartX: Math.min(bounds.maxX - 4, pk.tr[0] - pk.tr[2] - cornerClear),
    botLeftEndX: Math.max(bounds.minX + 4, pk.bl[0] + pk.bl[2] + cornerClear),
    botMidStartX: pk.bm[0] - pk.bm[2] - midClear,
    botMidEndX: pk.bm[0] + pk.bm[2] + midClear,
    botRightStartX: Math.min(bounds.maxX - 4, pk.br[0] - pk.br[2] - cornerClear),
    leftTopEndY: Math.max(bounds.minY + 4, pk.tl[1] + pk.tl[2] + cornerClear),
    leftBotStartY: Math.min(bounds.maxY - 4, pk.bl[1] - pk.bl[2] - cornerClear),
    rightTopEndY: Math.max(bounds.minY + 4, pk.tr[1] + pk.tr[2] + cornerClear),
    rightBotStartY: Math.min(bounds.maxY - 4, pk.br[1] - pk.br[2] - cornerClear),
  };

  const jawR = 6;
  const jaws: { x: number; y: number; r: number }[] = [
    // Top rail jaws (surface sits flush at walls.top)
    { x: railSpans.topLeftEndX, y: walls.top - jawR, r: jawR },
    { x: railSpans.topMidStartX, y: walls.top - jawR, r: jawR },
    { x: railSpans.topMidEndX, y: walls.top - jawR, r: jawR },
    { x: railSpans.topRightStartX, y: walls.top - jawR, r: jawR },
    // Bottom rail jaws (surface sits flush at walls.bottom)
    { x: railSpans.botLeftEndX, y: walls.bottom + jawR, r: jawR },
    { x: railSpans.botMidStartX, y: walls.bottom + jawR, r: jawR },
    { x: railSpans.botMidEndX, y: walls.bottom + jawR, r: jawR },
    { x: railSpans.botRightStartX, y: walls.bottom + jawR, r: jawR },
    // Left rail jaws (surface sits flush at walls.left)
    { x: walls.left - jawR, y: railSpans.leftTopEndY, r: jawR },
    { x: walls.left - jawR, y: railSpans.leftBotStartY, r: jawR },
    // Right rail jaws (surface sits flush at walls.right)
    { x: walls.right + jawR, y: railSpans.rightTopEndY, r: jawR },
    { x: walls.right + jawR, y: railSpans.rightBotStartY, r: jawR },
  ];

  return { walls, bounds, railSpans, pockets, jaws };
}

export const DEFAULT_TABLE_GEOMETRY: TableGeometry = buildTableGeometry({
  walls: { left: 79, right: 825, top: 57, bottom: 392 },
  pockets: {
    tl: [64, 47, 21],
    tm: [452, 34, 19],
    tr: [840, 47, 21],
    bl: [64, 398, 21],
    bm: [452, 412, 19],
    br: [840, 398, 21],
  },
});

export const POCKETS: Pocket[] = DEFAULT_TABLE_GEOMETRY.pockets;
export const POCKET_JAWS: { x: number; y: number; r: number }[] = DEFAULT_TABLE_GEOMETRY.jaws;

export const BALL_CONFIG_MAP: Record<number, { color: string; type: "solid" | "stripe" | "black"; nameAr: string }> = {
  1: { color: "#facc15", type: "solid", nameAr: "صفراء سادة (1)" },
  2: { color: "#2563eb", type: "solid", nameAr: "زرقاء سادة (2)" },
  3: { color: "#dc2626", type: "solid", nameAr: "حمراء سادة (3)" },
  4: { color: "#9333ea", type: "solid", nameAr: "بنفسجية سادة (4)" },
  5: { color: "#ea580c", type: "solid", nameAr: "برتقالية سادة (5)" },
  6: { color: "#16a34a", type: "solid", nameAr: "خضراء سادة (6)" },
  7: { color: "#831843", type: "solid", nameAr: "عنابية سادة (7)" },
  8: { color: "#09090b", type: "black", nameAr: "السوداء (8)" },
  9: { color: "#facc15", type: "stripe", nameAr: "صفراء ألوان (9)" },
  10: { color: "#2563eb", type: "stripe", nameAr: "زرقاء ألوان (10)" },
  11: { color: "#dc2626", type: "stripe", nameAr: "حمراء ألوان (11)" },
  12: { color: "#9333ea", type: "stripe", nameAr: "بنفسجية ألوان (12)" },
  13: { color: "#ea580c", type: "stripe", nameAr: "برتقالية ألوان (13)" },
  14: { color: "#16a34a", type: "stripe", nameAr: "خضراء ألوان (14)" },
  15: { color: "#831843", type: "stripe", nameAr: "عنابية ألوان (15)" },
};
