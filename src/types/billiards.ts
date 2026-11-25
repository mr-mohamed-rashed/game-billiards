export type GameMode = "8-ball" | "snooker";
export type BallGroup = "unassigned" | "solids" | "stripes";
export type ActiveModalType = "settings" | "shop" | "leaderboard" | "tournaments" | "stake_select" | null;

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
  px: number;
  py: number;
  pz: number;
}

export interface Pocket {
  id: number;
  name: string;
  x: number;
  y: number;
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

// 6 Calibrated Table Pockets (Exact mouth of the pockets on all tables)
export const POCKETS: Pocket[] = [
  { id: 0, name: "أعلى يسار", x: 52, y: 46 },
  { id: 1, name: "أعلى وسط", x: 450, y: 35 },
  { id: 2, name: "أعلى يمين", x: 848, y: 46 },
  { id: 3, name: "أسفل يسار", x: 52, y: 404 },
  { id: 4, name: "أسفل وسط", x: 450, y: 415 },
  { id: 5, name: "أسفل يمين", x: 848, y: 404 },
];

// 12 Pocket Jaw Knuckle Bumpers (flush with cushion edges for realistic pocket rebounds)
export const POCKET_JAWS: { x: number; y: number; r: number }[] = [
  // Top rail jaws (cushion line y=64 -> surface y=52, r=6 => center y=46)
  { x: 94, y: 46, r: 6 },
  { x: 422, y: 46, r: 6 },
  { x: 478, y: 46, r: 6 },
  { x: 806, y: 46, r: 6 },
  // Bottom rail jaws (cushion line y=379 -> surface y=391, r=6 => center y=397)
  { x: 94, y: 397, r: 6 },
  { x: 422, y: 397, r: 6 },
  { x: 478, y: 397, r: 6 },
  { x: 806, y: 397, r: 6 },
  // Left rail jaws (cushion line x=82 -> surface x=70, r=6 => center x=64)
  { x: 64, y: 86, r: 6 },
  { x: 64, y: 364, r: 6 },
  // Right rail jaws (cushion line x=823 -> surface x=835, r=6 => center x=841)
  { x: 841, y: 86, r: 6 },
  { x: 841, y: 364, r: 6 },
];

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
