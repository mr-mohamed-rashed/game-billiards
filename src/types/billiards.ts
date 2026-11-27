export type GameMode = "8-ball" | "snooker" | "one-fifteen";
export type BallGroup = "unassigned" | "solids" | "stripes";
export type ActiveModalType = "settings" | "shop" | "leaderboard" | "tournaments" | null;

export const ONE_FIFTEEN_POCKET_1 = 1;  // أعلى وسط (شمال الكسرة)
export const ONE_FIFTEEN_POCKET_15 = 4; // أسفل وسط (يمين الكسرة)

export type SnookerTargetInfo =
  | { phase: "red" }
  | { phase: "color" }
  | { phase: "clearance"; expectedValue: number };

export const SNOOKER_COLOR_ORDER = [2, 3, 4, 5, 6, 7] as const;

export const SNOOKER_COLOR_META: Record<number, { color: string; nameAr: string }> = {
  2: { color: "#facc15", nameAr: "الأصفر" },
  3: { color: "#16a34a", nameAr: "الأخضر" },
  4: { color: "#78350f", nameAr: "البني" },
  5: { color: "#2563eb", nameAr: "الأزرق" },
  6: { color: "#ec4899", nameAr: "الوردي" },
  7: { color: "#09090b", nameAr: "الأسود" },
};

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
  // Active Left/Right side English stored for cushion rebounds (- left, + right)
  spinSide?: number;
  // Transient per-shot cushion/jaw bounce counter for detecting bank/special shots
  railBounces?: number;
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
  ballId?: number;
  ballColor: string;
  reason?: string;
}

export const TABLE_WIDTH = 900;
export const TABLE_HEIGHT = 450;
export const CUSHION = 30;
export const BALL_RADIUS = 12;
export const SNOOKER_BALL_RADIUS = 8.5;
export const SNOOKER_D_RADIUS = 56;

export function getModeBallRadius(mode: GameMode): number {
  return mode === "snooker" ? SNOOKER_BALL_RADIUS : BALL_RADIUS;
}

export function getPlayBounds(geom: TableGeometry, ballRadius: number) {
  return {
    minX: geom.walls.left + ballRadius,
    maxX: geom.walls.right - ballRadius,
    minY: geom.walls.top + ballRadius,
    maxY: geom.walls.bottom - ballRadius,
  };
}

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
  const cornerClear = 15;
  const midClear = 10;
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

  const jawR = 5;
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

export function buildTableGeometryFromWalls(walls: {
  left: number;
  right: number;
  top: number;
  bottom: number;
}): TableGeometry {
  const midX = (walls.left + walls.right) / 2;
  return buildTableGeometry({
    walls,
    pockets: {
      tl: [walls.left - 11, walls.top - 11, 18],
      tm: [midX, walls.top - 18, 18],
      tr: [walls.right + 11, walls.top - 11, 18],
      bl: [walls.left - 11, walls.bottom + 11, 18],
      bm: [midX, walls.bottom + 18, 18],
      br: [walls.right + 11, walls.bottom + 11, 18],
    },
  });
}

export const DEFAULT_TABLE_GEOMETRY: TableGeometry = buildTableGeometryFromWalls({
  left: 75,
  right: 826,
  top: 55,
  bottom: 390,
});

export interface MatchDifficulty {
  id: "rookie" | "pro" | "masters" | "legend";
  labelAr: string;
  aimLabelAr: string;
  badgeColor: string;
  aimScale: number;
  maxAimDistCap: number;
  targetLineScale: number;
  botAimError: number;
  requireCalledPocket: boolean;
}

export function getMatchDifficulty(
  stake: number,
  isPractice: boolean,
  mode: GameMode = "8-ball"
): MatchDifficulty {
  const forceCall = mode === "one-fifteen";
  if (isPractice || stake <= 100) {
    return {
      id: "rookie",
      labelAr: isPractice ? "تدريب حر" : "مبتدئ",
      aimLabelAr: forceCall ? "سهم كامل + تحديد كل جيب" : "سهم كامل (100%)",
      badgeColor: "#22c55e",
      aimScale: 1.0,
      maxAimDistCap: 800,
      targetLineScale: 1.0,
      botAimError: 0.055,
      requireCalledPocket: forceCall,
    };
  }
  if (stake <= 500) {
    return {
      id: "pro",
      labelAr: "محترفين",
      aimLabelAr: forceCall ? "سهم متوسط + تحديد كل جيب" : "سهم متوسط (62%)",
      badgeColor: "#38bdf8",
      aimScale: 0.62,
      maxAimDistCap: 380,
      targetLineScale: 0.65,
      botAimError: 0.032,
      requireCalledPocket: forceCall,
    };
  }
  if (stake <= 2500) {
    return {
      id: "masters",
      labelAr: "أساتذة",
      aimLabelAr: "سهم قصير (38%) + تحديد جيب",
      badgeColor: "#f59e0b",
      aimScale: 0.38,
      maxAimDistCap: 230,
      targetLineScale: 0.38,
      botAimError: 0.018,
      requireCalledPocket: true,
    };
  }
  return {
    id: "legend",
    labelAr: "أساطير 🔥",
    aimLabelAr: "سهم قصير جداً (22%) + تحديد جيب",
    badgeColor: "#f43f5e",
    aimScale: 0.22,
    maxAimDistCap: 135,
    targetLineScale: 0.22,
    botAimError: 0.008,
    requireCalledPocket: true,
  };
}

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

export function getBreakLineX(
  mode: GameMode,
  geom: TableGeometry = DEFAULT_TABLE_GEOMETRY
): number {
  const { walls } = geom;
  const span = walls.right - walls.left;
  return mode === "snooker" ? walls.left + span * 0.21 : walls.left + span * 0.25;
}

export function getSnookerSpots(geom: TableGeometry = DEFAULT_TABLE_GEOMETRY) {
  const { walls } = geom;
  const span = walls.right - walls.left;
  const centerY = (walls.top + walls.bottom) / 2;
  const centerX = (walls.left + walls.right) / 2;
  const baulkX = getBreakLineX("snooker", geom);
  const pinkX = walls.left + span * 0.74;
  const apexX = pinkX + SNOOKER_BALL_RADIUS * 2.15;
  const blackX = walls.right - 68;

  return {
    baulkX,
    apexX,
    centerY,
    dRadius: SNOOKER_D_RADIUS,
    spots: [
      { val: 2, color: "#facc15", x: baulkX, y: centerY + SNOOKER_D_RADIUS },
      { val: 3, color: "#16a34a", x: baulkX, y: centerY - SNOOKER_D_RADIUS },
      { val: 4, color: "#78350f", x: baulkX, y: centerY },
      { val: 5, color: "#2563eb", x: centerX, y: centerY },
      { val: 6, color: "#ec4899", x: pinkX, y: centerY },
      { val: 7, color: "#09090b", x: blackX, y: centerY },
    ],
  };
}

export function getSnookerTargetInfo(
  balls: Ball[],
  onColorAfterRed: boolean
): SnookerTargetInfo {
  if (onColorAfterRed) return { phase: "color" };
  const hasReds = balls.some((b) => !b.isPotted && b.type === "red");
  if (hasReds) return { phase: "red" };
  const remainingColors = balls.filter((b) => !b.isPotted && b.type === "color");
  if (remainingColors.length === 0) return { phase: "clearance", expectedValue: 7 };
  const expectedValue = Math.min(...remainingColors.map((b) => b.value || 7));
  return { phase: "clearance", expectedValue };
}
