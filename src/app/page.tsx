"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ALL_CUES, ALL_TABLES, CueItem, TableItem } from "@/config/shopData";

export default function BilliardsStandalonePage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#020b14] text-amber-400 font-bold">جاري تحميل كيو ماستر (Cue Master)...</div>}>
      <CueMasterApp />
    </Suspense>
  );
}

interface Ball {
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
}

interface Pocket {
  id: number;
  name: string;
  x: number;
  y: number;
}

// ====================================================================
// REALISTIC BILLIARDS AUDIO SYNTHESIZER (ZERO-LAG SINGLETON CONTEXT)
// ====================================================================
let sharedAudioCtx: AudioContext | null = null;
let lastClackSoundTime = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function playBallClack(relativeSpeed: number) {
  const now = performance.now();
  if (now - lastClackSoundTime < 35) return;
  lastClackSoundTime = now;

  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;

  const vol = Math.min(1.0, Math.max(0.12, relativeSpeed / 16));

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = "sine";
  osc.frequency.setValueAtTime(1420 + Math.random() * 260, t);
  osc.frequency.exponentialRampToValueAtTime(320, t + 0.045);

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1800, t);
  filter.Q.setValueAtTime(3.8, t);

  gain.gain.setValueAtTime(vol * 0.95, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.06);

  try {
    const bufferSize = Math.floor(ctx.sampleRate * 0.025);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005));
    }
    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.45, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    whiteNoise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    whiteNoise.start(t);
  } catch {}
}

function playPocketDrop() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(55, t + 0.16);
  gain.gain.setValueAtTime(0.85, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.22);
}

function playCueStrike(power: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  const vol = Math.min(1.0, Math.max(0.2, power / 100));

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(460, t);
  osc.frequency.exponentialRampToValueAtTime(110, t + 0.07);
  gain.gain.setValueAtTime(vol * 0.9, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.08);
}

function playFoulBuzzer() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(130, t);
  osc.frequency.setValueAtTime(110, t + 0.12);
  gain.gain.setValueAtTime(0.4, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.28);
}

function playSuccessChime() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t + i * 0.08);
    gain.gain.setValueAtTime(0.25, t + i * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t + i * 0.08);
    osc.stop(t + i * 0.08 + 0.25);
  });
}

// Cinematic Slow-Motion Pocket Cam Sound
function playCinematicWhoosh() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = "sine";
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.9);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(420, t);
  filter.frequency.exponentialRampToValueAtTime(75, t + 0.9);

  gain.gain.setValueAtTime(0.001, t);
  gain.gain.linearRampToValueAtTime(0.45, t + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.9);
}

// Official 8-Ball Ball Mapping
const BALL_CONFIG_MAP: Record<number, { color: string; type: "solid" | "stripe" | "black"; nameAr: string }> = {
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

function CueMasterApp() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "guest";
  const username = searchParams.get("username") || "لاعب 1";
  const avatar = searchParams.get("avatar") || "https://api.dicebear.com/7.x/bottts/svg?seed=CueMaster";
  const initialStake = parseInt(searchParams.get("stake") || "100");
  const initialPrize = parseInt(searchParams.get("prize") || "190");
  const initialMode = (searchParams.get("mode") as "8-ball" | "snooker") || "8-ball";
  const opponentName = searchParams.get("opponentName") || "أحمد_البرنس";
  const opponentAvatar = searchParams.get("opponentAvatar") || "https://api.dicebear.com/7.x/bottts/svg?seed=AhmedEG";
  const opponentFlag = searchParams.get("opponentFlag") || "🇪🇬";

  // Navigation & Modals
  const [currentView, setCurrentView] = useState<"menu" | "table">("menu");
  const [activeModal, setActiveModal] = useState<"settings" | "shop" | "leaderboard" | "tournaments" | "stake_select" | null>(null);

  // Shop & Inventory State
  const [shopTab, setShopTab] = useState<"cues" | "tables">("cues");
  const [cueCategoryFilter, setCueCategoryFilter] = useState<"all" | "classic" | "legendary">("all");
  const [selectedCue, setSelectedCue] = useState<string>("cue_maple_standard");
  const [selectedTable, setSelectedTable] = useState<string>("classic");
  const [unlockedCues, setUnlockedCues] = useState<string[]>(["cue_maple_standard"]);
  const [unlockedTables, setUnlockedTables] = useState<string[]>(["classic"]);
  const [coins, setCoins] = useState(85000);
  const [gems, setGems] = useState(250);

  // Settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [aimAssistLong, setAimAssistLong] = useState(true);

  // Match State
  const [mode, setMode] = useState<"8-ball" | "snooker">(initialMode);
  const [isPractice, setIsPractice] = useState(false);
  const [stake, setStake] = useState(initialStake);
  const [prize, setPrize] = useState(initialPrize);

  // Official 8-Ball Game State: Groups Assignment (سادة 1-7 أم ألوان 9-15)
  const [humanGroup, setHumanGroup] = useState<"unassigned" | "solids" | "stripes">("unassigned");
  const [botGroup, setBotGroup] = useState<"unassigned" | "solids" | "stripes">("unassigned");
  const [groupAnnouncement, setGroupAnnouncement] = useState<{ title: string; human: string; bot: string } | null>(null);

  // Call Pocket
  const [calledPocketId, setCalledPocketId] = useState<number | null>(0);
  const activeShotCalledPocketRef = useRef<number | null>(0);
  const activeShotAimAngleRef = useRef<number>(0);
  const spinAppliedInCurrentShotRef = useRef<boolean>(false);

  const [isBallInHand, setIsBallInHand] = useState(false);
  const [ballInHandHoverPos, setBallInHandHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Cue Stick Spin / English Control (اسكروه، باك سبن، توب سبن)
  const [spinX, setSpinX] = useState(0);
  const [spinY, setSpinY] = useState(0);

  // Cue Stick Drag Pull-Back State
  const [isDraggingCueStick, setIsDraggingCueStick] = useState(false);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Table Engine State
  const [turn, setTurn] = useState<"human" | "bot">("human");
  const [turnMessage, setTurnMessage] = useState("طاولة مفتوحة: أول كرة تسقطها تحدد صنفك (سادة أم ألوان)!");
  const [humanScore, setHumanScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [power, setPower] = useState(65);
  const [aimAngle, setAimAngle] = useState(0);
  const [isShooting, setIsShooting] = useState(false);
  const [gameOver, setGameOver] = useState<string | null>(null);

  // Cinematic Pocket Cam (لقطة سينمائية بطيئة وأفقية مقربة عند إسقاط الكرات عبر مسافة طويلة)
  const [cinematicCam, setCinematicCam] = useState<{
    active: boolean;
    pocket: Pocket;
    ballNum: number;
    ballColor: string;
  } | null>(null);
  const cinematicCamRef = useRef<{
    active: boolean;
    pocket: Pocket;
    ballNum: number;
    ballColor: string;
  } | null>(null);
  const cinematicTriggeredThisShotRef = useRef<boolean>(false);
  const shotStartPosRef = useRef<{ x: number; y: number }>({ x: 200, y: 225 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballsRef = useRef<Ball[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const tableImageCacheRef = useRef<Record<string, HTMLImageElement>>({});

  // Shot Resolution Tracking
  const firstBallHitInShotRef = useRef<Ball | null>(null);
  const pottedInCurrentShotRef = useRef<{ ball: Ball; pocketId: number }[]>([]);
  const cueScratchedInShotRef = useRef<boolean>(false);

  // Active Cue and Table Objects
  const activeCue = ALL_CUES.find((c) => c.id === selectedCue) || ALL_CUES[0];
  const currentTable = ALL_TABLES.find((t) => t.id === selectedTable) || ALL_TABLES[0];

  // Turn Timer with Circular Progress (Enhanced by Cue Time Stat)
  const turnTotalTime = activeCue?.stats?.time || 30;
  const [turnTimeLeft, setTurnTimeLeft] = useState(turnTotalTime);

  // Table Dimensions
  const TABLE_WIDTH = 900;
  const TABLE_HEIGHT = 450;
  const CUSHION = 30;
  const BALL_RADIUS = 12;

  // 6 Calibrated Table Pockets (Exact mouth of the black holes on all tables)
  const pockets: Pocket[] = [
    { id: 0, name: "أعلى يسار", x: 52, y: 46 },
    { id: 1, name: "أعلى وسط", x: 450, y: 35 },
    { id: 2, name: "أعلى يمين", x: 848, y: 46 },
    { id: 3, name: "أسفل يسار", x: 52, y: 404 },
    { id: 4, name: "أسفل وسط", x: 450, y: 415 },
    { id: 5, name: "أسفل يمين", x: 848, y: 404 },
  ];

  // Preload Storage & Assets
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sCoins = localStorage.getItem("cuemaster_coins");
      if (sCoins) setCoins(parseInt(sCoins));
      const sGems = localStorage.getItem("cuemaster_gems");
      if (sGems) setGems(parseInt(sGems));
      const sCue = localStorage.getItem("cuemaster_selected_cue");
      if (sCue) setSelectedCue(sCue);
      const sTable = localStorage.getItem("cuemaster_selected_table");
      if (sTable) setSelectedTable(sTable);
      const sUnlCues = localStorage.getItem("cuemaster_unlocked_cues");
      if (sUnlCues) setUnlockedCues(JSON.parse(sUnlCues));
      const sUnlTables = localStorage.getItem("cuemaster_unlocked_tables");
      if (sUnlTables) setUnlockedTables(JSON.parse(sUnlTables));
    } catch {}

    // Preload table textures
    ALL_TABLES.forEach((table) => {
      if (table.image && !tableImageCacheRef.current[table.id]) {
        const img = new Image();
        img.src = table.image;
        img.onload = () => {
          tableImageCacheRef.current[table.id] = img;
        };
      }
    });
  }, []);

  // Sync to Storage
  const saveCoins = (val: number) => {
    setCoins(val);
    try { localStorage.setItem("cuemaster_coins", val.toString()); } catch {}
  };
  const saveGems = (val: number) => {
    setGems(val);
    try { localStorage.setItem("cuemaster_gems", val.toString()); } catch {}
  };

  // Turn Timeout Foul Handler
  const handleTurnTimeout = () => {
    if (soundEnabled) playFoulBuzzer();
    if (!isPractice) {
      const nextTurn = turn === "human" ? "bot" : "human";
      setTurn(nextTurn);
      if (nextTurn === "human") {
        setIsBallInHand(true);
        setTurnMessage("⏱️ انتهى وقت الخصم! الفاول لصالحك، الكرة في يدك الآن 🧤");
      } else {
        setTurnMessage("⚠️ انتهى وقت التصويب! فاول لانتهاء الوقت، الكرة في يد الخصم الآن.");
        setTimeout(() => {
          const cb = ballsRef.current[0];
          if (cb) {
            cb.x = 82 + 180 + Math.random() * 80;
            cb.y = TABLE_HEIGHT / 2 + (Math.random() - 0.5) * 80;
            cb.vx = 0;
            cb.vy = 0;
            cb.isPotted = false;
          }
        }, 1000);
      }
    } else {
      setIsBallInHand(true);
      setTurnMessage("⏱️ انتهى وقت التصويب في التدريب!");
    }
  };

  // Turn Timer Countdown Loop
  useEffect(() => {
    if (currentView !== "table" || isShooting || gameOver || isPractice) return;

    setTurnTimeLeft(turnTotalTime);

    const timer = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTurnTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentView, turn, isShooting, gameOver, isPractice, turnTotalTime]);

  // Initialize Rack with Official Standard 8-Ball Positions
  const initBalls = (currentMode: "8-ball" | "snooker") => {
    const balls: Ball[] = [];
    const tableLeft = 82;
    const tableRight = 823;
    const centerY = 221.5;

    // 1. White Cue Ball
    balls.push({
      id: 0,
      x: tableLeft + (tableRight - tableLeft) * 0.25,
      y: centerY,
      vx: 0,
      vy: 0,
      radius: BALL_RADIUS,
      color: "#f8fafc",
      number: 0,
      type: "cue",
      isPotted: false,
    });

    if (currentMode === "8-ball") {
      const RACK_NUMBERS = [1, 9, 2, 3, 8, 10, 11, 4, 12, 5, 13, 6, 14, 7, 15];
      const apexX = tableLeft + (tableRight - tableLeft) * 0.72;
      const spacing = BALL_RADIUS * 2.04;
      const rowSpacing = spacing * Math.cos(Math.PI / 6);

      let ballIdx = 0;
      for (let r = 0; r < 5; r++) {
        const rowX = apexX + r * rowSpacing;
        const startY = centerY - (r * spacing) / 2;
        for (let c = 0; c <= r; c++) {
          const ballNum = RACK_NUMBERS[ballIdx++];
          const cfg = BALL_CONFIG_MAP[ballNum];
          balls.push({
            id: ballNum,
            x: rowX,
            y: startY + c * spacing,
            vx: 0,
            vy: 0,
            radius: BALL_RADIUS,
            color: cfg.color,
            number: ballNum,
            type: cfg.type,
            isPotted: false,
          });
        }
      }
    } else {
      // Snooker Rack Setup
      let sId = 1;
      const apexX = tableLeft + (tableRight - tableLeft) * 0.75;
      const spacing = BALL_RADIUS * 2.05;
      const rowSpacing = spacing * Math.cos(Math.PI / 6);

      for (let r = 0; r < 5; r++) {
        const rowX = apexX + r * rowSpacing;
        const startY = centerY - (r * spacing) / 2;
        for (let c = 0; c <= r; c++) {
          balls.push({
            id: sId++,
            x: rowX,
            y: startY + c * spacing,
            vx: 0,
            vy: 0,
            radius: BALL_RADIUS,
            color: "#dc2626",
            number: 1,
            type: "red",
            value: 1,
            isPotted: false,
          });
        }
      }

      const colors = [
        { name: "Yellow", color: "#facc15", val: 2, x: 82 + 150, y: centerY + 60 },
        { name: "Green", color: "#16a34a", val: 3, x: 82 + 150, y: centerY - 60 },
        { name: "Brown", color: "#78350f", val: 4, x: 82 + 150, y: centerY },
        { name: "Blue", color: "#2563eb", val: 5, x: TABLE_WIDTH / 2, y: centerY },
        { name: "Pink", color: "#ec4899", val: 6, x: apexX - 25, y: centerY },
        { name: "Black", color: "#09090b", val: 7, x: tableRight - 55, y: centerY },
      ];
      colors.forEach((c) => {
        balls.push({
          id: sId++,
          x: c.x,
          y: c.y,
          vx: 0,
          vy: 0,
          radius: BALL_RADIUS,
          color: c.color,
          number: c.val,
          type: "color",
          value: c.val,
          isPotted: false,
        });
      });
    }

    ballsRef.current = balls;
    setHumanGroup("unassigned");
    setBotGroup("unassigned");
    setGroupAnnouncement(null);
    setTurn("human");
    setTurnMessage("طاولة مفتوحة: أول ضربة ناجحة في جيب محدد تعيّن صنفك!");
    setIsBallInHand(false);
    firstBallHitInShotRef.current = null;
    pottedInCurrentShotRef.current = [];
    cueScratchedInShotRef.current = false;
  };

  // Handle Game Over
  const triggerGameOver = (winner: "human" | "bot", message: string) => {
    setGameOver(message);
    if (winner === "human") {
      const perkBonus = activeCue.id === "cue_royal_ruby" ? Math.round(prize * 1.15) : prize;
      saveCoins(coins + perkBonus);
      if (soundEnabled) playSuccessChime();
    }
    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: "GAME_OVER",
        game: "billiards",
        winner,
        coins: winner === "human" ? prize : 0,
        isHuman: winner === "human",
      }, "*");
    }
  };

  const handleCloseToParent = () => {
    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "CLOSE_GAME" }, "*");
    }
  };

  // Re-spot illegally potted ball onto foot spot
  const respotBall = (ball: Ball) => {
    const tableLeft = 82;
    const tableRight = 823;
    const footSpotX = tableLeft + (tableRight - tableLeft) * 0.72;
    const footSpotY = TABLE_HEIGHT / 2;

    let targetX = footSpotX;
    let targetY = footSpotY;

    while (ballsRef.current.some((b) => !b.isPotted && Math.hypot(b.x - targetX, b.y - targetY) < BALL_RADIUS * 2.1)) {
      targetX += BALL_RADIUS * 2.2;
      if (targetX > tableRight - BALL_RADIUS - 5) {
        targetX = footSpotX;
        targetY += BALL_RADIUS * 2.2;
      }
    }

    ball.isPotted = false;
    ball.x = targetX;
    ball.y = targetY;
    ball.vx = 0;
    ball.vy = 0;
  };

  // Shop Purchasing & Equipping Logic
  const handleEquipCue = (cueId: string) => {
    setSelectedCue(cueId);
    try { localStorage.setItem("cuemaster_selected_cue", cueId); } catch {}
    if (soundEnabled) playSuccessChime();
  };

  const handleBuyCue = (cue: CueItem) => {
    if (unlockedCues.includes(cue.id)) {
      handleEquipCue(cue.id);
      return;
    }
    if (coins < cue.price) {
      alert("❌ رصيدك من الكوينز غير كافٍ! العب مباريات أو اضغط (+) لزيادة الكوينز.");
      return;
    }
    const newCoins = coins - cue.price;
    const newUnlocked = [...unlockedCues, cue.id];
    saveCoins(newCoins);
    setUnlockedCues(newUnlocked);
    setSelectedCue(cue.id);
    try {
      localStorage.setItem("cuemaster_unlocked_cues", JSON.stringify(newUnlocked));
      localStorage.setItem("cuemaster_selected_cue", cue.id);
    } catch {}
    if (soundEnabled) playSuccessChime();
  };

  const handleEquipTable = (tableId: string) => {
    setSelectedTable(tableId);
    try { localStorage.setItem("cuemaster_selected_table", tableId); } catch {}
    if (soundEnabled) playSuccessChime();
  };

  const handleBuyTable = (tbl: TableItem) => {
    if (unlockedTables.includes(tbl.id)) {
      handleEquipTable(tbl.id);
      return;
    }
    if (coins < tbl.price) {
      alert("❌ رصيدك من الكوينز غير كافٍ لشراء هذه الطاولة!");
      return;
    }
    const newCoins = coins - tbl.price;
    const newUnlocked = [...unlockedTables, tbl.id];
    saveCoins(newCoins);
    setUnlockedTables(newUnlocked);
    setSelectedTable(tbl.id);
    try {
      localStorage.setItem("cuemaster_unlocked_tables", JSON.stringify(newUnlocked));
      localStorage.setItem("cuemaster_selected_table", tbl.id);
    } catch {}
    if (soundEnabled) playSuccessChime();
  };

  // High-Precision Physics Engine (8 Sub-steps per frame, Segmented Cushions, Realistic Pocket Mouth)
  useEffect(() => {
    if (currentView !== "table") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tableCfg = ALL_TABLES.find((t) => t.id === selectedTable) || ALL_TABLES[0];
    const SUB_STEPS = 8;
    const FRICTION = tableCfg.friction;
    const subFriction = Math.pow(FRICTION, 1 / SUB_STEPS);
    const CUSHION_BOUNCE = tableCfg.bounceRestitution;
    const MAX_SPEED = 28;

    const updatePhysics = () => {
      const balls = ballsRef.current;
      let anyMoving = false;

      const cueActive = ALL_CUES.find((c) => c.id === selectedCue) || ALL_CUES[0];
      const cueSpinBonus = 0.75 + (cueActive.stats.spin / 10) * 0.55;
      const timeScale = cinematicCamRef.current ? 0.35 : 1.0;

      for (let step = 0; step < SUB_STEPS; step++) {
        // 1. Move Balls & Resolve Cushions / Pocket Drops per Sub-step
        balls.forEach((ball) => {
          if (ball.isPotted) return;

          ball.x += (ball.vx * timeScale) / SUB_STEPS;
          ball.y += (ball.vy * timeScale) / SUB_STEPS;
          ball.vx *= Math.pow(subFriction, timeScale);
          ball.vy *= Math.pow(subFriction, timeScale);

          const speed = Math.hypot(ball.vx, ball.vy);
          if (speed > 0.08) anyMoving = true;

          // High-Elasticity Rubber Cushion Rails (Balls bounce strictly off the dark cushion shadow line)
          // Top Cushions (two segments: left of middle pocket, right of middle pocket)
          if (ball.y < 64 && ((ball.x > 94 && ball.x < 422) || (ball.x > 478 && ball.x < 806))) {
            ball.y = 64;
            ball.vy = Math.abs(ball.vy) * CUSHION_BOUNCE;
            if (soundEnabled && speed > 1.0) playBallClack(speed);
          }
          // Bottom Cushions
          if (ball.y > 379 && ((ball.x > 94 && ball.x < 422) || (ball.x > 478 && ball.x < 806))) {
            ball.y = 379;
            ball.vy = -Math.abs(ball.vy) * CUSHION_BOUNCE;
            if (soundEnabled && speed > 1.0) playBallClack(speed);
          }
          // Left Cushion
          if (ball.x < 82 && (ball.y > 86 && ball.y < 364)) {
            ball.x = 82;
            ball.vx = Math.abs(ball.vx) * CUSHION_BOUNCE;
            if (soundEnabled && speed > 1.0) playBallClack(speed);
          }
          // Right Cushion
          if (ball.x > 823 && (ball.y > 86 && ball.y < 364)) {
            ball.x = 823;
            ball.vx = -Math.abs(ball.vx) * CUSHION_BOUNCE;
            if (soundEnabled && speed > 1.0) playBallClack(speed);
          }

          // Exact Pocket Drop Detection & Funnel Suction into Black Holes
          pockets.forEach((p) => {
            const dx = p.x - ball.x;
            const dy = p.y - ball.y;
            const dist = Math.hypot(dx, dy);

            // Inward funnel suction towards pocket mouth
            if (dist < 30 && dist > 0.5) {
              const pull = 0.45 * (1 - dist / 30) * timeScale;
              ball.vx += (dx / dist) * pull;
              ball.vy += (dy / dist) * pull;
            }

            // TRIGGER CINEMATIC POCKET DROP CAM:
            // When a legal ball is heading into the called target pocket across a long distance or is 8-ball!
            const isCalledTargetPocket = activeShotCalledPocketRef.current !== null && p.id === activeShotCalledPocketRef.current;
            if (
              !cinematicTriggeredThisShotRef.current &&
              dist < 38 &&
              dist > 14 &&
              (isCalledTargetPocket || ball.number === 8) &&
              ball.type !== "cue"
            ) {
              const shotDist = Math.hypot(shotStartPosRef.current.x - p.x, shotStartPosRef.current.y - p.y);
              if (shotDist > 270 || ball.number === 8) {
                cinematicTriggeredThisShotRef.current = true;
                const camData = {
                  active: true,
                  pocket: p,
                  ballNum: ball.number,
                  ballColor: ball.color,
                };
                cinematicCamRef.current = camData;
                setCinematicCam(camData);
                if (soundEnabled) playCinematicWhoosh();
              }
            }

            if (dist < 22) {
              ball.isPotted = true;
              ball.vx = 0;
              ball.vy = 0;
              if (soundEnabled) playPocketDrop();

              if (ball.type === "cue") {
                cueScratchedInShotRef.current = true;
              } else {
                pottedInCurrentShotRef.current.push({ ball, pocketId: p.id });
              }
            }
          });

          // Outer table safety catch (if a ball rolls behind a pocket cavity)
          if (ball.x < 42 || ball.x > TABLE_WIDTH - 42 || ball.y < 32 || ball.y > TABLE_HEIGHT - 32) {
            const nearestP = pockets.reduce((prev, curr) => Math.hypot(curr.x - ball.x, curr.y - ball.y) < Math.hypot(prev.x - ball.x, prev.y - ball.y) ? curr : prev);
            ball.isPotted = true;
            ball.vx = 0;
            ball.vy = 0;
            if (soundEnabled) playPocketDrop();
            if (ball.type === "cue") cueScratchedInShotRef.current = true;
            else pottedInCurrentShotRef.current.push({ ball, pocketId: nearestP.id });
          }
        });

        // 2. Ball-to-Ball Elastic Collisions (High-precision sub-stepping eliminates penetration & sideways deflection)
        for (let i = 0; i < balls.length; i++) {
          for (let j = i + 1; j < balls.length; j++) {
            const b1 = balls[i];
            const b2 = balls[j];
            if (b1.isPotted || b2.isPotted) continue;

            const dx = b2.x - b1.x;
            const dy = b2.y - b1.y;
            const dist = Math.hypot(dx, dy);
            const minDist = b1.radius + b2.radius;

            if (dist < minDist && dist > 0.001) {
              const nx = dx / dist;
              const ny = dy / dist;

              // Infinitesimal separation (prevents any violent sideways displacement)
              const overlap = minDist - dist;
              b1.x -= nx * overlap * 0.5;
              b1.y -= ny * overlap * 0.5;
              b2.x += nx * overlap * 0.5;
              b2.y += ny * overlap * 0.5;

              // Enforce cushion boundaries during ball-to-ball separation so balls never enter cushion face
              [b1, b2].forEach((b) => {
                if (b.y < 64 && ((b.x > 94 && b.x < 422) || (b.x > 478 && b.x < 806))) b.y = 64;
                if (b.y > 379 && ((b.x > 94 && b.x < 422) || (b.x > 478 && b.x < 806))) b.y = 379;
                if (b.x < 82 && (b.y > 86 && b.y < 364)) b.x = 82;
                if (b.x > 823 && (b.y > 86 && b.y < 364)) b.x = 823;
              });

              // Relative velocity along collision normal
              const relVelNormal = (b1.vx - b2.vx) * nx + (b1.vy - b2.vy) * ny;

              if (relVelNormal > 0) {
                const restitution = 0.94;
                const impulse = ((1 + restitution) * relVelNormal) / 2;

                b1.vx -= impulse * nx;
                b1.vy -= impulse * ny;
                b2.vx += impulse * nx;
                b2.vy += impulse * ny;

                anyMoving = true;

                if (soundEnabled && relVelNormal > 0.8) {
                  playBallClack(relVelNormal);
                }
              }

              // Track First Ball Hit by Cue Ball
              if (b1.type === "cue" || b2.type === "cue") {
                const targetB = b1.type === "cue" ? b2 : b1;
                const cueB = b1.type === "cue" ? b1 : b2;

                if (!firstBallHitInShotRef.current) {
                  firstBallHitInShotRef.current = targetB;
                }

                // Apply Spin Impulse ONCE per shot along aim axis
                if (!spinAppliedInCurrentShotRef.current) {
                  spinAppliedInCurrentShotRef.current = true;
                  const cosAim = Math.cos(activeShotAimAngleRef.current);
                  const sinAim = Math.sin(activeShotAimAngleRef.current);

                  if (spinY < -0.15) {
                    const screwMag = Math.abs(spinY) * 4.8 * cueSpinBonus;
                    cueB.vx -= cosAim * screwMag;
                    cueB.vy -= sinAim * screwMag;
                  } else if (spinY > 0.15) {
                    const followMag = spinY * 3.6 * cueSpinBonus;
                    cueB.vx += cosAim * followMag;
                    cueB.vy += sinAim * followMag;
                  }
                  if (Math.abs(spinX) > 0.15) {
                    const sideMag = spinX * 2.2 * cueSpinBonus;
                    cueB.vx += -sinAim * sideMag;
                    cueB.vy += cosAim * sideMag;
                  }
                }
              }
            }
          }
        }
      }

      // Clean Stop Threshold & Speed Clamping
      balls.forEach((ball) => {
        if (ball.isPotted) return;
        const curSpeed = Math.hypot(ball.vx, ball.vy);
        if (curSpeed > MAX_SPEED) {
          ball.vx = (ball.vx / curSpeed) * MAX_SPEED;
          ball.vy = (ball.vy / curSpeed) * MAX_SPEED;
        }
        if (curSpeed < 0.08) {
          ball.vx = 0;
          ball.vy = 0;
        } else {
          anyMoving = true;
        }
      });

      // 3. Handle Shot Completion & Official 8-Ball Rules Judgment
      if (isShooting && !anyMoving) {
        setIsShooting(false);
        if (cinematicCamRef.current) {
          setTimeout(() => {
            cinematicCamRef.current = null;
            setCinematicCam(null);
          }, 1100);
        } else {
          setCinematicCam(null);
        }

        const pottedList = pottedInCurrentShotRef.current;
        const cueScratched = cueScratchedInShotRef.current;
        const firstHit = firstBallHitInShotRef.current;
        const activeShooter = turn;
        const targetPocketForThisShot = activeShotCalledPocketRef.current;

        pottedInCurrentShotRef.current = [];
        cueScratchedInShotRef.current = false;
        firstBallHitInShotRef.current = null;

        if (mode === "8-ball") {
          const shooterGroup = activeShooter === "human" ? humanGroup : botGroup;
          const remainingTargetBalls = ballsRef.current.filter((b) =>
            !b.isPotted && b.number !== 8 && (shooterGroup === "solids" ? b.type === "solid" : b.type === "stripe")
          );

          // CHECK RULE: 8-Ball Potting
          const black8Entry = pottedList.find((item) => item.ball.number === 8);
          if (black8Entry) {
            if (cueScratched) {
              if (activeShooter === "human") triggerGameOver("bot", "❌ خسرت المباراة! أسقطت الكرة البيضاء مع الكرة السوداء رقم 8.");
              else triggerGameOver("human", "🎉 مبروك الفوز! الخصم أسقط الكرة البيضاء مع الكرة السوداء رقم 8.");
              return;
            }

            if (remainingTargetBalls.length > 0 || shooterGroup === "unassigned") {
              if (activeShooter === "human") triggerGameOver("bot", "❌ خسرت المباراة! أسقطت الكرة السوداء رقم 8 قبل تصفية جميع كراتك.");
              else triggerGameOver("human", "🎉 مبروك الفوز! الخصم أسقط الكرة السوداء رقم 8 قبل تصفية كراته.");
              return;
            }

            if (targetPocketForThisShot !== null && black8Entry.pocketId !== targetPocketForThisShot) {
              if (activeShooter === "human") triggerGameOver("bot", "❌ خسرت المباراة! الكرة السوداء 8 سقطت في جيب غير الجيب المحدد.");
              else triggerGameOver("human", "🎉 مبروك الفوز! الخصم أسقط الكرة السوداء 8 في جيب غير الجيب المحدد.");
              return;
            }

            if (activeShooter === "human") triggerGameOver("human", "🏆 مبروك الفوز الساحق! أحرزت الكرة السوداء رقم 8 في الجيب المحدد بعد تصفية كراتك!");
            else triggerGameOver("bot", "خسرت المباراة! الخصم أحرز الكرة السوداء رقم 8 وفاز بالجولة.");
            return;
          }

          // CHECK FOUL RULES:
          let foulOccurred = false;
          let foulReason = "";

          if (cueScratched) {
            foulOccurred = true;
            foulReason = "سقوط الكرة البيضاء في الجيب (Scratch).";
          } else if (!firstHit) {
            foulOccurred = true;
            foulReason = "الكرة البيضاء لم تلمس أي كرة على الإطلاق!";
          } else if (shooterGroup === "unassigned" && firstHit.number === 8) {
            foulOccurred = true;
            foulReason = "الطاولة مفتوحة: لا يجوز لمس الكرة السوداء رقم 8 أولاً!";
          } else if (shooterGroup !== "unassigned") {
            const expectedType = shooterGroup === "solids" ? "solid" : "stripe";
            // Check if shooter had balls of their own group at the start of this shot
            const shooterBallsPottedThisShot = pottedList.filter((item) => item.ball.type === expectedType).length;
            const hadGroupBallsBeforeShot = (remainingTargetBalls.length + shooterBallsPottedThisShot) > 0;

            if (hadGroupBallsBeforeShot) {
              if (firstHit.type !== expectedType) {
                foulOccurred = true;
                foulReason = firstHit.number === 8
                  ? "لمست الكرة السوداء رقم 8 أولاً قبل تصفية كراتك!"
                  : (shooterGroup === "solids" ? "لمست كرة (ألوان/مخطط) وصنفك هو سادة!" : "لمست كرة (سادة) وصنفك هو ألوان/مخطط!");
              }
            } else {
              if (firstHit.number !== 8) {
                foulOccurred = true;
                foulReason = "أنهيت كراتك، يجب لمس الكرة السوداء رقم 8 أولاً!";
              }
            }
          }

          if (foulOccurred) {
            if (soundEnabled) playFoulBuzzer();
            if (!isPractice) {
              const nextTurn = activeShooter === "human" ? "bot" : "human";
              setTurn(nextTurn);
              if (nextTurn === "human") {
                setIsBallInHand(true);
                setTurnMessage(`✋ خطأ على الخصم: (${foulReason}) الكرة في يدك الآن!`);
              } else {
                setTurnMessage(`⚠️ فاول عليك: (${foulReason}) الكرة في يد الخصم الآن.`);
                setTimeout(() => {
                  const cb = ballsRef.current[0];
                  if (cb) {
                    cb.x = 82 + 180 + Math.random() * 80;
                    cb.y = TABLE_HEIGHT / 2 + (Math.random() - 0.5) * 80;
                    cb.vx = 0;
                    cb.vy = 0;
                    cb.isPotted = false;
                  }
                }, 1000);
              }
            } else {
              setIsBallInHand(true);
              setTurnMessage(`✋ فاول: (${foulReason}) الكرة في اليد!`);
            }
            return;
          }

          // CHECK CALL POCKET RULE
          const legallyCalledPots: Ball[] = [];
          const wrongPocketPots: Ball[] = [];

          pottedList.forEach(({ ball, pocketId }) => {
            if (targetPocketForThisShot !== null && pocketId === targetPocketForThisShot) {
              legallyCalledPots.push(ball);
            } else {
              wrongPocketPots.push(ball);
              respotBall(ball);
            }
          });

          if (wrongPocketPots.length > 0) {
            setTurnMessage(`⚠️ كرة سقطت في جيب غير محدد (${wrongPocketPots.map((b) => b.number).join(",")})! تم إرجاعها للطاولة.`);
          }

          // ASSIGN GROUPS: First legal pot determines Solids (سادة) vs Stripes (ألوان)
          // Displays floating message for exactly 1.2 seconds!
          if (humanGroup === "unassigned" && legallyCalledPots.length > 0) {
            const firstLegal = legallyCalledPots.find((b) => b.type === "solid" || b.type === "stripe");
            if (firstLegal) {
              const isSolid = firstLegal.type === "solid";
              if (activeShooter === "human") {
                setHumanGroup(isSolid ? "solids" : "stripes");
                setBotGroup(isSolid ? "stripes" : "solids");
                setGroupAnnouncement({
                  title: "🎉 أحرزت أول كرة وتم تعيين الصنف!",
                  human: isSolid ? "سادة 🟡 (1-7)" : "ألوان 🔵 (9-15)",
                  bot: isSolid ? "ألوان 🔵 (9-15)" : "سادة 🟡 (1-7)",
                });
                setTurnMessage(`🎱 صنفك المعتمد: [${isSolid ? "سادة 🟡 (1-7)" : "ألوان 🔵 (9-15)"}]!`);
              } else {
                setBotGroup(isSolid ? "solids" : "stripes");
                setHumanGroup(isSolid ? "stripes" : "solids");
                setGroupAnnouncement({
                  title: "🤖 الخصم أحرز أول كرة وتم تعيين الأصناف!",
                  human: isSolid ? "ألوان 🔵 (9-15)" : "سادة 🟡 (1-7)",
                  bot: isSolid ? "سادة 🟡 (1-7)" : "ألوان 🔵 (9-15)",
                });
                setTurnMessage(`🎱 صنفك المعتمد: [${isSolid ? "ألوان 🔵 (9-15)" : "سادة 🟡 (1-7)"}]!`);
              }
              // Quick 1.2 second announcement disappearance
              setTimeout(() => setGroupAnnouncement(null), 1200);
            }
          }

          // Check if Shooter keeps their turn!
          const currentShooterGroup = activeShooter === "human" ? humanGroup : botGroup;
          const pottedLegalBallInCalledPocket = legallyCalledPots.some((b) =>
            currentShooterGroup === "unassigned"
              ? (b.type === "solid" || b.type === "stripe")
              : (currentShooterGroup === "solids" ? b.type === "solid" : b.type === "stripe")
          );

          if (pottedLegalBallInCalledPocket) {
            if (activeShooter === "human") setHumanScore((s) => s + legallyCalledPots.length);
            else setBotScore((s) => s + legallyCalledPots.length);

            // Did the shooter just finish their last ball?!
            const remainingForShooter = ballsRef.current.filter((b) =>
              !b.isPotted && b.number !== 8 && (currentShooterGroup === "solids" ? b.type === "solid" : b.type === "stripe")
            );

            if (remainingForShooter.length === 0 && currentShooterGroup !== "unassigned") {
              if (activeShooter === "human") {
                setTurn("human");
                setTurnMessage("🏆 مبروك! أنهيت جميع كرات صنفك بنجاح! دورك مستمر الآن لإسقاط الكرة السوداء 8 في الجيب المحدد وإنهاء الجيم!");
              } else {
                setTurn("bot");
                setTurnMessage("⚠️ الخصم أنهى جميع كراته ودوره مستمر على الكرة السوداء رقم 8!");
              }
            } else {
              setTurnMessage("🔥 ضربة صحيحة في الجيب المحدد! دورك مستمر للضربة التالية!");
            }
          } else {
            if (!isPractice) {
              setTurn(activeShooter === "human" ? "bot" : "human");
              setTurnMessage(activeShooter === "human" ? "دور الخصم الآن..." : "دورك الآن! تأكد من لمس صنفك أولاً.");
            }
          }

        } else {
          // Snooker Logic
          if (cueScratched) {
            if (!isPractice) setTurn(activeShooter === "human" ? "bot" : "human");
            const cb = ballsRef.current[0];
            if (cb) {
              cb.x = 82 + 150;
              cb.y = TABLE_HEIGHT / 2;
              cb.isPotted = false;
            }
          } else {
            const totalPoints = pottedList.reduce((acc, item) => acc + (item.ball.value || 1), 0);
            if (totalPoints > 0) {
              if (activeShooter === "human") setHumanScore((s) => s + totalPoints);
              else setBotScore((s) => s + totalPoints);
            } else {
              if (!isPractice) setTurn(activeShooter === "human" ? "bot" : "human");
            }
          }
        }
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

      // 1. Table Background & Cushion Rendering
      const tableImg = tableCfg.image ? tableImageCacheRef.current[tableCfg.id] : null;

      if (tableImg && tableImg.complete && tableImg.naturalWidth > 0) {
        ctx.drawImage(tableImg, 0, 0, TABLE_WIDTH, TABLE_HEIGHT);
      } else {
        // Procedural Table Frame & Felt
        ctx.fillStyle = "#1c100b";
        ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
        ctx.strokeStyle = tableCfg.cushionGlow;
        ctx.lineWidth = 4;
        ctx.strokeRect(8, 8, TABLE_WIDTH - 16, TABLE_HEIGHT - 16);

        const feltGradient = ctx.createRadialGradient(
          TABLE_WIDTH / 2, TABLE_HEIGHT / 2, 80,
          TABLE_WIDTH / 2, TABLE_HEIGHT / 2, 450
        );
        feltGradient.addColorStop(0, tableCfg.feltColor);
        feltGradient.addColorStop(1, "#021c10");

        ctx.fillStyle = feltGradient;
        ctx.fillRect(CUSHION, CUSHION, TABLE_WIDTH - 2 * CUSHION, TABLE_HEIGHT - 2 * CUSHION);
      }

      // Snooker Baulk Line & "D" Zone
      if (mode === "snooker") {
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 2;
        const baulkX = 82 + 150;
        ctx.beginPath();
        ctx.moveTo(baulkX, 64);
        ctx.lineTo(baulkX, 379);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(baulkX, TABLE_HEIGHT / 2, 60, -Math.PI / 2, Math.PI / 2, true);
        ctx.stroke();
      }

      // 2. Pocket Target Call Highlight (Positioned exactly at the mouth of the black hole)
      pockets.forEach((p) => {
        const isTarget = calledPocketId === p.id;

        if (isTarget) {
          // Glowing Target Indicator over the called pocket opening
          ctx.strokeStyle = "#eab308";
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Soft golden aura inside the pocket mouth
          ctx.fillStyle = "rgba(234, 179, 8, 0.22)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#eab308";
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("🎯 الهدف", p.x, p.y + (p.y < TABLE_HEIGHT / 2 ? 28 : -22));
        }
      });

      // 3. Balls (Accurate Solids & Stripes Rendering)
      const balls = ballsRef.current;
      balls.forEach((ball) => {
        if (ball.isPotted) return;

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.beginPath();
        ctx.arc(ball.x + 2, ball.y + 3, ball.radius, 0, Math.PI * 2);
        ctx.fill();

        // Base Sphere
        ctx.fillStyle = ball.color;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();

        // Stripes (White Band)
        if (ball.type === "stripe") {
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius - 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = ball.color;
          ctx.beginPath();
          ctx.ellipse(ball.x, ball.y, ball.radius - 3, (ball.radius - 3) * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // White Center Circle & Number for Solids & Stripes
        if (ball.type === "solid" || ball.type === "stripe" || ball.type === "black") {
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius * 0.42, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#0f172a";
          ctx.font = `bold ${ball.number >= 10 ? "8px" : "9px"} sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(ball.number.toString(), ball.x, ball.y);
        }

        // White Cue Ball Spin Impact Dot Indicator
        if (ball.type === "cue" && (Math.abs(spinX) > 0.05 || Math.abs(spinY) > 0.05)) {
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          ctx.arc(ball.x + spinX * 7, ball.y + spinY * 7, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Sphere Gloss / Specular Highlight
        const glossGrad = ctx.createRadialGradient(
          ball.x - ball.radius * 0.35, ball.y - ball.radius * 0.35, 1,
          ball.x, ball.y, ball.radius
        );
        glossGrad.addColorStop(0, "rgba(255,255,255,0.7)");
        glossGrad.addColorStop(0.4, "rgba(255,255,255,0.1)");
        glossGrad.addColorStop(1, "rgba(0,0,0,0.35)");
        ctx.fillStyle = glossGrad;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // 4. Ball in Hand Placement Guide & Hand Glove Icon
      if (isBallInHand && ballInHandHoverPos) {
        ctx.fillStyle = "rgba(59, 130, 246, 0.35)";
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(ballInHandHoverPos.x, ballInHandHoverPos.y, BALL_RADIUS + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🧤", ballInHandHoverPos.x + 14, ballInHandHoverPos.y - 12);
      }

      // 5. AIM LINE RAYCASTING & LEGAL TARGET VALIDATION (Scaled with Cue Aim Stat)
      const cueBall = balls[0];
      if ((turn === "human" || isPractice) && !isShooting && !isBallInHand && cueBall && !cueBall.isPotted) {
        const cosA = Math.cos(aimAngle);
        const sinA = Math.sin(aimAngle);
        const collisionRadius = BALL_RADIUS * 2;

        const baseDist = aimAssistLong ? 420 : 260;
        const cueBonusDist = (activeCue.stats.aim / 10) * 280;
        let closestHitDist = baseDist + cueBonusDist;

        let hitBall: Ball | null = null;
        let ghostBallPos = { x: 0, y: 0 };
        let targetDeflectDir = { dx: 0, dy: 0 };

        for (let i = 1; i < balls.length; i++) {
          const b = balls[i];
          if (b.isPotted) continue;

          const toBx = b.x - cueBall.x;
          const toBy = b.y - cueBall.y;
          const projDist = toBx * cosA + toBy * sinA;

          if (projDist > 0 && projDist < closestHitDist) {
            const perpDistSq = (toBx * toBx + toBy * toBy) - (projDist * projDist);
            if (perpDistSq < collisionRadius * collisionRadius && perpDistSq >= 0) {
              const d = Math.sqrt(collisionRadius * collisionRadius - perpDistSq);
              const actualHitDist = projDist - d;
              if (actualHitDist < closestHitDist && actualHitDist > 0) {
                closestHitDist = actualHitDist;
                hitBall = b;
                ghostBallPos = {
                  x: cueBall.x + cosA * actualHitDist,
                  y: cueBall.y + sinA * actualHitDist,
                };
                const normDx = b.x - ghostBallPos.x;
                const normDy = b.y - ghostBallPos.y;
                const normLen = Math.hypot(normDx, normDy) || 1;
                targetDeflectDir = { dx: normDx / normLen, dy: normDy / normLen };
              }
            }
          }
        }

        let isAimedTargetLegal = true;
        let warningText = "";

        if (hitBall && mode === "8-ball") {
          if (humanGroup === "unassigned") {
            if (hitBall.number === 8) {
              isAimedTargetLegal = false;
              warningText = "⚠️ طاولة مفتوحة: لا يجوز ضرب 8!";
            }
          } else {
            const remainingHumanBalls = balls.filter((b) =>
              !b.isPotted && b.number !== 8 && (humanGroup === "solids" ? b.type === "solid" : b.type === "stripe")
            );
            if (remainingHumanBalls.length > 0) {
              const expectedType = humanGroup === "solids" ? "solid" : "stripe";
              if (hitBall.type !== expectedType) {
                isAimedTargetLegal = false;
                warningText = hitBall.number === 8 ? "⚠️ فاول: لا تلمس 8 الآن!" : "⚠️ فاول: صنف الخصم!";
              }
            } else {
              if (hitBall.number !== 8) {
                isAimedTargetLegal = false;
                warningText = "⚠️ فاول: هدفك الكرة 8!";
              }
            }
          }
        }

        const endAimX = cueBall.x + cosA * closestHitDist;
        const endAimY = cueBall.y + sinA * closestHitDist;

        // Custom Aim Line Style (Aura glow for Legendary Cues!)
        const aimLineColor = !isAimedTargetLegal
          ? "rgba(239, 68, 68, 0.95)"
          : activeCue.category === "legendary"
          ? activeCue.glowColor
          : "rgba(255, 255, 255, 0.85)";

        ctx.strokeStyle = aimLineColor;
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = activeCue.category === "legendary" ? 2.5 : 1.5;
        if (activeCue.category === "legendary" && isAimedTargetLegal) {
          ctx.shadowColor = activeCue.glowColor;
          ctx.shadowBlur = 8;
        }
        ctx.beginPath();
        ctx.moveTo(cueBall.x, cueBall.y);
        ctx.lineTo(endAimX, endAimY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        if (hitBall) {
          // Ghost Ball Outline
          ctx.strokeStyle = isAimedTargetLegal ? "rgba(255, 255, 255, 0.7)" : "rgba(239, 68, 68, 0.8)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(ghostBallPos.x, ghostBallPos.y, BALL_RADIUS, 0, Math.PI * 2);
          ctx.stroke();

          // Target Ball Deflection Guide Line
          ctx.strokeStyle = isAimedTargetLegal ? (activeCue.category === "legendary" ? activeCue.glowColor : "#facc15") : "#ef4444";
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(hitBall.x, hitBall.y);
          ctx.lineTo(
            hitBall.x + targetDeflectDir.dx * (120 + (activeCue.stats.aim / 10) * 80),
            hitBall.y + targetDeflectDir.dy * (120 + (activeCue.stats.aim / 10) * 80)
          );
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = isAimedTargetLegal ? "rgba(250, 204, 21, 0.35)" : "rgba(239, 68, 68, 0.4)";
          ctx.beginPath();
          ctx.arc(hitBall.x, hitBall.y, BALL_RADIUS + 3, 0, Math.PI * 2);
          ctx.fill();

          if (!isAimedTargetLegal && warningText) {
            ctx.fillStyle = "#ef4444";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(warningText, hitBall.x, hitBall.y - 18);
          }
        }

        // 6. Realistic Cue Stick with Dynamic Pull-Back & Elemental Aura Glow
        const cueLength = 270;
        const cueOffset = 22 + (power / 100) * 75;
        const cueTipX = cueBall.x - cosA * cueOffset;
        const cueTipY = cueBall.y - sinA * cueOffset;
        const cueEndX = cueBall.x - cosA * (cueOffset + cueLength);
        const cueEndY = cueBall.y - sinA * (cueOffset + cueLength);

        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        // Gradient Shaft for Selected Cue
        const grad = ctx.createLinearGradient(cueTipX, cueTipY, cueEndX, cueEndY);
        grad.addColorStop(0, activeCue.tipColor);
        grad.addColorStop(0.35, activeCue.glowColor);
        grad.addColorStop(0.7, "#1e293b");
        grad.addColorStop(1, "#090d16");

        ctx.strokeStyle = grad;
        ctx.lineWidth = 5.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cueTipX, cueTipY);
        ctx.lineTo(cueEndX, cueEndY);
        ctx.stroke();

        // White Tip Ferrule
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(cueTipX, cueTipY);
        ctx.lineTo(cueTipX - cosA * 8, cueTipY - sinA * 8);
        ctx.stroke();

        // Elemental Aura / Glow effect for Legendary Cues
        if (activeCue.category === "legendary") {
          ctx.strokeStyle = activeCue.glowColor;
          ctx.lineWidth = 9;
          ctx.globalAlpha = 0.35 + Math.sin(Date.now() / 180) * 0.15;
          ctx.shadowColor = activeCue.glowColor;
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.moveTo(cueTipX, cueTipY);
          ctx.lineTo(cueEndX, cueEndY);
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }

        ctx.restore();
      }

      updatePhysics();
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    currentView,
    mode,
    turn,
    aimAngle,
    power,
    isShooting,
    soundEnabled,
    aimAssistLong,
    selectedCue,
    selectedTable,
    isPractice,
    isBallInHand,
    ballInHandHoverPos,
    calledPocketId,
    humanGroup,
    botGroup,
    spinX,
    spinY,
  ]);

  // Handle Mouse Events: Aim, Ball-in-Hand, Drag-to-Pull Stick
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = TABLE_WIDTH / rect.width;
    const scaleY = TABLE_HEIGHT / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    if (isBallInHand) {
      const minX = 84;
      const maxX = 821;
      const minY = 66;
      const maxY = 377;
      const clampedX = Math.min(maxX, Math.max(minX, mouseX));
      const clampedY = Math.min(maxY, Math.max(minY, mouseY));
      setBallInHandHoverPos({ x: clampedX, y: clampedY });
      return;
    }

    if ((turn !== "human" && !isPractice) || isShooting) return;

    const cueBall = ballsRef.current[0];
    if (cueBall) {
      if (isDraggingCueStick && dragStartPosRef.current) {
        const cosA = Math.cos(aimAngle);
        const sinA = Math.sin(aimAngle);
        const dragDist = (cueBall.x - mouseX) * cosA + (cueBall.y - mouseY) * sinA;
        const calculatedPower = Math.min(100, Math.max(10, Math.round((dragDist / 180) * 100)));
        setPower(calculatedPower);
      } else {
        const angle = Math.atan2(mouseY - cueBall.y, mouseX - cueBall.x);
        setAimAngle(angle);
      }
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = TABLE_WIDTH / rect.width;
    const scaleY = TABLE_HEIGHT / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Check if player clicked a pocket to CALL IT
    const clickedPocket = pockets.find((p) => Math.hypot(p.x - mouseX, p.y - mouseY) < 32);
    if (clickedPocket) {
      setCalledPocketId(clickedPocket.id);
      if (soundEnabled) playBallClack(3);
      return;
    }

    // Ball in Hand placement
    if (isBallInHand) {
      const minX = 84;
      const maxX = 821;
      const minY = 66;
      const maxY = 377;

      const clampedX = Math.min(maxX, Math.max(minX, mouseX));
      const clampedY = Math.min(maxY, Math.max(minY, mouseY));

      const isOverlapping = ballsRef.current.slice(1).some((b) => !b.isPotted && Math.hypot(b.x - clampedX, b.y - clampedY) < BALL_RADIUS * 2.2);

      if (!isOverlapping) {
        const cueBall = ballsRef.current[0];
        if (cueBall) {
          cueBall.x = clampedX;
          cueBall.y = clampedY;
          cueBall.vx = 0;
          cueBall.vy = 0;
          cueBall.isPotted = false;
          setIsBallInHand(false);
          setBallInHandHoverPos(null);
          setTurnMessage("✅ تم وضع الكرة بنجاح! حدد الهدف والبوكت واضرب.");
          if (soundEnabled) playBallClack(4);
        }
      } else {
        alert("لا يمكن وضع الكرة البيضاء فوق كرة أخرى!");
      }
      return;
    }

    // Start Dragging Cue Stick
    if ((turn === "human" || isPractice) && !isShooting) {
      setIsDraggingCueStick(true);
      dragStartPosRef.current = { x: mouseX, y: mouseY };
    }
  };

  const handleCanvasMouseUp = () => {
    if (isDraggingCueStick) {
      setIsDraggingCueStick(false);
      dragStartPosRef.current = null;
      handleShoot();
    }
  };

  // Human Player Strike Action (with Cue Stats Modifiers)
  const handleShoot = () => {
    if (isShooting || isBallInHand) return;
    if (turn !== "human" && !isPractice) return;

    const cueBall = ballsRef.current[0];
    if (!cueBall || cueBall.isPotted) return;

    // Snapshot pocket & aim angle for this active shot
    activeShotCalledPocketRef.current = calledPocketId;
    activeShotAimAngleRef.current = aimAngle;
    spinAppliedInCurrentShotRef.current = false;
    shotStartPosRef.current = { x: cueBall.x, y: cueBall.y };
    cinematicTriggeredThisShotRef.current = false;

    setIsShooting(true);
    if (soundEnabled) playCueStrike(power);

    // Apply Cue Force Stat Modifier
    const forceBonus = 0.85 + (activeCue.stats.force / 10) * 0.35;
    const speed = (power / 100) * 24 * forceBonus;
    cueBall.vx = Math.cos(aimAngle) * speed;
    cueBall.vy = Math.sin(aimAngle) * speed;
  };

  // Bot AI Turn Execution
  useEffect(() => {
    if (turn === "bot" && !isShooting && !gameOver && !isPractice && !isBallInHand) {
      const botTimer = setTimeout(() => {
        const cueBall = ballsRef.current[0];
        if (!cueBall || cueBall.isPotted) return;

        const candidateBalls = ballsRef.current.filter((b) => {
          if (b.isPotted || b.type === "cue") return false;
          if (botGroup !== "unassigned") {
            const botType = botGroup === "solids" ? "solid" : "stripe";
            const botBallsLeft = ballsRef.current.filter((x) => !x.isPotted && (botGroup === "solids" ? x.type === "solid" : x.type === "stripe"));
            if (botBallsLeft.length > 0) return b.type === botType;
            return b.number === 8;
          }
          return b.number !== 8;
        });

        const targets = candidateBalls.length > 0 ? candidateBalls : ballsRef.current.filter((b) => !b.isPotted && b.type !== "cue");

        if (targets.length > 0) {
          const closest = targets.reduce((prev, curr) => {
            const d1 = Math.hypot(prev.x - cueBall.x, prev.y - cueBall.y);
            const d2 = Math.hypot(curr.x - cueBall.x, curr.y - cueBall.y);
            return d1 < d2 ? prev : curr;
          });

          // Bot Calls Pocket
          const bestPocket = pockets.reduce((prev, curr) => {
            const d1 = Math.hypot(prev.x - closest.x, prev.y - closest.y);
            const d2 = Math.hypot(curr.x - closest.x, curr.y - closest.y);
            return d1 < d2 ? prev : curr;
          });
          setCalledPocketId(bestPocket.id);
          activeShotCalledPocketRef.current = bestPocket.id;

          const variance = (Math.random() - 0.5) * 0.11;
          const targetAngle = Math.atan2(closest.y - cueBall.y, closest.x - cueBall.x) + variance;
          setAimAngle(targetAngle);
          activeShotAimAngleRef.current = targetAngle;
          spinAppliedInCurrentShotRef.current = false;
          shotStartPosRef.current = { x: cueBall.x, y: cueBall.y };
          cinematicTriggeredThisShotRef.current = false;

          setIsShooting(true);
          if (soundEnabled) playCueStrike(65);
          const botSpeed = 15 + Math.random() * 8;
          cueBall.vx = Math.cos(targetAngle) * botSpeed;
          cueBall.vy = Math.sin(targetAngle) * botSpeed;
        }
      }, 1500);

      return () => clearTimeout(botTimer);
    }
  }, [currentView, turn, isShooting, gameOver, isPractice, isBallInHand, botGroup, soundEnabled]);

  // Launch Table Match
  const startMatch = (targetMode: "8-ball" | "snooker", practice = false, tableStake = 100) => {
    setMode(targetMode);
    setIsPractice(practice);
    setStake(tableStake);
    setPrize(Math.round(tableStake * 1.9));
    setHumanScore(0);
    setBotScore(0);
    setGameOver(null);
    initBalls(targetMode);
    setCurrentView("table");
  };

  const humanRemainingBalls = ballsRef.current.filter(
    (b) => !b.isPotted && b.number !== 8 && (humanGroup === "solids" ? b.type === "solid" : b.type === "stripe")
  );

  return (
    <div className="relative w-full min-h-screen bg-[#020b14] text-slate-100 flex flex-col font-sans select-none overflow-hidden" dir="rtl">
      {/* ========================================================= */}
      {/* VIEW 1: CUE MASTER MAIN LOBBY                             */}
      {/* ========================================================= */}
      {currentView === "menu" ? (
        <div className="relative w-full h-screen flex flex-col justify-between bg-cover bg-center overflow-hidden" style={{ backgroundImage: "url('/cue_master_bg.jpg')" }}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/45 to-black/90 pointer-events-none" />

          {/* Top Bar: Profile & Currencies */}
          <header className="relative z-10 flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-amber-500/30">
              <img src={avatar} alt="Avatar" className="w-10 h-10 rounded-xl bg-amber-400/20 p-1 border border-amber-400 object-cover" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-amber-300 text-sm">{username}</span>
                  <span className="text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded-full font-bold">Level 1</span>
                </div>
                <div className="w-24 bg-slate-800 h-1.5 rounded-full mt-1 overflow-hidden">
                  <div className="bg-emerald-400 h-full w-2/5 rounded-full" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Active Cue Quick Pill */}
              <button
                onClick={() => { setShopTab("cues"); setActiveModal("shop"); }}
                className="hidden sm:flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 hover:border-amber-400 cursor-pointer transition-all"
              >
                <span className="text-[11px] text-slate-400">العصا:</span>
                <span className="text-xs font-bold text-amber-300">{activeCue.nameAr}</span>
              </button>

              {/* Coins Counter */}
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-amber-500/40">
                <span className="text-base">🪙</span>
                <span className="font-black text-amber-400 text-sm tracking-wide">{coins.toLocaleString()}</span>
                <button
                  onClick={() => saveCoins(coins + 5000)}
                  className="w-5 h-5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center cursor-pointer shadow"
                >
                  +
                </button>
              </div>

              {/* Gems Counter */}
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-fuchsia-500/40">
                <span className="text-base">💎</span>
                <span className="font-black text-fuchsia-400 text-sm tracking-wide">{gems.toLocaleString()}</span>
                <button
                  onClick={() => saveGems(gems + 50)}
                  className="w-5 h-5 rounded-md bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-black text-xs flex items-center justify-center cursor-pointer shadow"
                >
                  +
                </button>
              </div>
            </div>
          </header>

          {/* Center Brand: CUE MASTER Logo */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 -mt-6">
            <div className="relative inline-block mb-3">
              <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]">
                CUE MASTER
              </h1>
              <p className="text-cyan-400 tracking-[0.25em] text-xs md:text-sm font-extrabold uppercase drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]">
                بلياردو الملوك والسنوكر العالمي
              </p>
            </div>

            {/* 4 Glossy Action Buttons */}
            <div className="grid grid-cols-2 gap-4 w-full max-w-md mt-4">
              <button
                onClick={() => setActiveModal("stake_select")}
                className="group relative flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-black text-base shadow-[0_8px_20px_rgba(34,197,94,0.4)] border border-emerald-300/40 bg-gradient-to-b from-emerald-400 via-emerald-600 to-emerald-800 hover:from-emerald-300 hover:to-emerald-700 active:scale-95 transition-all cursor-pointer"
              >
                <span className="text-2xl drop-shadow">▶️</span>
                <span className="tracking-wide text-white drop-shadow">العب الآن</span>
              </button>

              <button
                onClick={() => setActiveModal("stake_select")}
                className="group relative flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-black text-base shadow-[0_8px_20px_rgba(37,99,235,0.4)] border border-blue-300/40 bg-gradient-to-b from-blue-400 via-blue-600 to-blue-800 hover:from-blue-300 hover:to-blue-700 active:scale-95 transition-all cursor-pointer"
              >
                <span className="text-2xl drop-shadow">👥</span>
                <span className="tracking-wide text-white drop-shadow">أونلاين</span>
              </button>

              <button
                onClick={() => setActiveModal("tournaments")}
                className="group relative flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-black text-base shadow-[0_8px_20px_rgba(217,119,6,0.4)] border border-amber-300/40 bg-gradient-to-b from-amber-400 via-amber-600 to-amber-800 hover:from-amber-300 hover:to-amber-700 active:scale-95 transition-all cursor-pointer"
              >
                <span className="text-2xl drop-shadow">🏆</span>
                <span className="tracking-wide text-white drop-shadow">البطولات</span>
              </button>

              <button
                onClick={() => startMatch("8-ball", true, 0)}
                className="group relative flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-black text-base shadow-[0_8px_20px_rgba(100,116,139,0.4)] border border-slate-400/40 bg-gradient-to-b from-slate-400 via-slate-600 to-slate-800 hover:from-slate-300 hover:to-slate-700 active:scale-95 transition-all cursor-pointer"
              >
                <span className="text-2xl drop-shadow">🎯</span>
                <span className="tracking-wide text-white drop-shadow">تدريب فردي</span>
              </button>
            </div>
          </div>

          {/* Bottom Bar: Settings, Shop, Leaderboard */}
          <footer className="relative z-10 flex items-center justify-between px-6 py-4">
            <button
              onClick={() => setActiveModal("settings")}
              className="flex items-center gap-2 bg-black/60 hover:bg-slate-900/80 px-4 py-2.5 rounded-2xl border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer shadow-lg active:scale-95"
            >
              <span>⚙️</span>
              <span className="text-xs font-black">الإعدادات</span>
            </button>

            {/* Glowing SHOP Button */}
            <button
              onClick={() => setActiveModal("shop")}
              className="group relative flex items-center gap-3 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 px-6 py-3 rounded-2xl border-2 border-amber-200 text-slate-950 font-black shadow-[0_0_25px_rgba(251,191,36,0.6)] active:scale-95 transition-all cursor-pointer"
            >
              <span className="text-xl">🛒</span>
              <span className="text-sm tracking-wider uppercase">المتجر ({ALL_CUES.length} عصا & {ALL_TABLES.length} طاولات)</span>
            </button>

            <button
              onClick={() => setActiveModal("leaderboard")}
              className="flex items-center gap-2 bg-black/60 hover:bg-slate-900/80 px-4 py-2.5 rounded-2xl border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer shadow-lg active:scale-95"
            >
              <span>🏆</span>
              <span className="text-xs font-black">المتصدرين</span>
            </button>
          </footer>
        </div>
      ) : (
        /* ========================================================= */
        /* VIEW 2: ACTIVE MATCH TABLE SCREEN                         */
        /* ========================================================= */
        <div className="flex-1 flex flex-col justify-between p-2 md:p-4 bg-[#020b14] max-w-6xl mx-auto w-full">
          {/* Top In-Game HUD Bar with Circular Turn Timers */}
          <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-xl backdrop-blur-md">
            {/* Player Info & Circular Timer */}
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                {/* Circular Turn Timer SVG Ring */}
                <svg className="w-14 h-14 -rotate-90 pointer-events-none">
                  <circle
                    cx="28"
                    cy="28"
                    r="23"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="3.5"
                    fill="transparent"
                  />
                  {turn === "human" && (
                    <circle
                      cx="28"
                      cy="28"
                      r="23"
                      stroke={turnTimeLeft <= 5 ? "#ef4444" : turnTimeLeft <= 10 ? "#facc15" : "#22c55e"}
                      strokeWidth="3.5"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 23}
                      strokeDashoffset={2 * Math.PI * 23 * (1 - turnTimeLeft / turnTotalTime)}
                      strokeLinecap="round"
                      className="transition-all duration-300"
                    />
                  )}
                </svg>
                <img
                  src={avatar}
                  alt="You"
                  className="absolute w-10 h-10 rounded-xl bg-slate-800 border border-amber-400 shadow-md object-cover"
                />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-amber-300">{username}</span>
                  <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">أنت</span>
                  {turn === "human" && (
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded-full font-mono ${
                        turnTimeLeft <= 5
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      }`}
                    >
                      ⏱️ {turnTimeLeft}s
                    </span>
                  )}
                </div>
                {/* Balls Assigned & Remaining Status */}
                <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1 mt-0.5">
                  {mode === "8-ball" ? (
                    humanGroup === "unassigned" ? (
                      <span className="text-amber-400 font-bold">طاولة مفتوحة</span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <span className="text-amber-300 font-black">{humanGroup === "solids" ? "سادة 🟡 (1-7)" : "ألوان 🔵 (9-15)"}</span>
                        <span className="text-[10px] bg-slate-800 px-1 rounded text-slate-300">متبقي: {humanRemainingBalls.length}</span>
                        {humanRemainingBalls.length === 0 && <span className="text-xs text-amber-400 font-black animate-pulse">🎯 هدفك الكرة 8!</span>}
                      </span>
                    )
                  ) : (
                    <span>النقاط: {humanScore}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Center Match Stats & Turn Message */}
            <div className="flex flex-col items-center max-w-xs text-center">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                  {mode === "8-ball" ? "8-Ball Pool" : "Snooker"}
                </span>
                <span className="text-xs font-bold text-amber-400">الجائزة: {prize.toLocaleString()} 🪙</span>
              </div>
              <div className="text-[11px] font-black text-amber-200 mt-1 line-clamp-1">{turnMessage}</div>
            </div>

            {/* Opponent Info with Circular Timer */}
            <div className="flex items-center gap-3">
              <div className="text-left">
                <div className="flex items-center gap-1.5 justify-end">
                  {turn === "bot" && (
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded-full font-mono ${
                        turnTimeLeft <= 5
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      }`}
                    >
                      ⏱️ {turnTimeLeft}s
                    </span>
                  )}
                  <span className="text-xs font-black text-slate-200">{opponentName}</span>
                  <span>{opponentFlag}</span>
                </div>
                <div className="text-[11px] font-bold text-slate-400">
                  {isPractice
                    ? "وضع التدريب"
                    : botGroup === "unassigned"
                    ? "طاولة مفتوحة"
                    : botGroup === "solids"
                    ? "سادة 🟡 (1-7)"
                    : "ألوان 🔵 (9-15)"}
                </div>
              </div>

              <div className="relative flex items-center justify-center">
                <svg className="w-14 h-14 -rotate-90 pointer-events-none">
                  <circle
                    cx="28"
                    cy="28"
                    r="23"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="3.5"
                    fill="transparent"
                  />
                  {turn === "bot" && (
                    <circle
                      cx="28"
                      cy="28"
                      r="23"
                      stroke={turnTimeLeft <= 5 ? "#ef4444" : turnTimeLeft <= 10 ? "#facc15" : "#22c55e"}
                      strokeWidth="3.5"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 23}
                      strokeDashoffset={2 * Math.PI * 23 * (1 - turnTimeLeft / turnTotalTime)}
                      strokeLinecap="round"
                      className="transition-all duration-300"
                    />
                  )}
                </svg>
                <img
                  src={opponentAvatar}
                  alt="Opponent"
                  className="absolute w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 shadow-md object-cover"
                />
              </div>

              {/* Shop & Exit Buttons */}
              <button
                onClick={() => setActiveModal("shop")}
                className="w-9 h-9 rounded-xl bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/50 flex items-center justify-center text-amber-300 font-black text-sm cursor-pointer ml-1"
                title="تغيير العصا أو الطاولة"
              >
                🛒
              </button>
              <button
                onClick={() => {
                  setGameOver(null);
                  setCurrentView("menu");
                  try {
                    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
                      window.parent.postMessage({ type: "CLOSE_GAME" }, "*");
                    }
                  } catch {}
                }}
                className="w-9 h-9 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/50 flex items-center justify-center text-rose-300 font-black text-xs cursor-pointer"
                title="خروج للقائمة الرئيسية"
              >
                🚪
              </button>
            </div>
          </div>

          {/* Group Assignment Floating Toast (Shows for exactly 1.2s and fades away) */}
          {groupAnnouncement && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border-2 border-amber-400 text-slate-100 px-6 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col items-center animate-in fade-in zoom-in duration-150">
              <div className="text-xs font-black text-amber-300">{groupAnnouncement.title}</div>
              <div className="text-[11px] font-bold text-slate-200 mt-0.5">
                أنت: <span className="text-amber-400 font-extrabold">{groupAnnouncement.human}</span> | الخصم: <span className="text-slate-300 font-extrabold">{groupAnnouncement.bot}</span>
              </div>
            </div>
          )}

          {/* Billiards Canvas Viewport with Dynamic 3D Cinematic Perspective */}
          <div className="relative flex-1 flex items-center justify-center my-2 overflow-hidden rounded-2xl w-full">
            {/* Cinematic Letterbox Overlays */}
            {cinematicCam && (
              <>
                {/* Top Film Bar */}
                <div className="absolute top-0 left-0 right-0 z-30 h-11 bg-black/95 border-b border-amber-500/40 flex items-center justify-between px-6 shadow-2xl animate-in slide-in-from-top duration-300">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                    <span className="text-[11px] font-black text-red-500 tracking-wider">🔴 REC | لقطة سينمائية بطيئة</span>
                  </div>
                  <div className="text-xs font-black text-amber-300 tracking-widest uppercase">
                    🎬 CINEMATIC POCKET CAM
                  </div>
                  <div className="text-[11px] font-bold text-slate-300">
                    جيب: {cinematicCam.pocket.name}
                  </div>
                </div>

                {/* Bottom Film Bar */}
                <div className="absolute bottom-0 left-0 right-0 z-30 h-11 bg-black/95 border-t border-amber-500/40 flex items-center justify-between px-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
                  <div className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                    <span>🎯</span>
                    <span>تصويب استثنائي عبر مسافة طويلة | SLOW MOTION 0.35x</span>
                  </div>
                  <div className="text-[10px] font-mono text-amber-400 font-extrabold">
                    {cinematicCam.ballNum === 8 ? "🏆 الكرة السوداء الحاسمة!" : `كرة رقم (${cinematicCam.ballNum})`}
                  </div>
                </div>
              </>
            )}

            <div
              className="w-full flex items-center justify-center transition-all duration-700 ease-out"
              style={{
                perspective: "900px",
                transformOrigin: cinematicCam
                  ? `${(cinematicCam.pocket.x / TABLE_WIDTH) * 100}% ${(cinematicCam.pocket.y / TABLE_HEIGHT) * 100}%`
                  : "50% 50%",
                transform: cinematicCam
                  ? `scale(2.25) rotateX(${cinematicCam.pocket.y < TABLE_HEIGHT / 2 ? "-42deg" : "42deg"})`
                  : "scale(1) rotateX(0deg)",
              }}
            >
              <canvas
                ref={canvasRef}
                width={TABLE_WIDTH}
                height={TABLE_HEIGHT}
                onMouseMove={handleCanvasMouseMove}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                style={{
                  borderColor: currentTable.cushionGlow,
                  boxShadow: `0 0 35px ${currentTable.cushionGlow}33, 0 10px 40px rgba(0,0,0,0.8)`
                }}
                className={`w-full max-h-[68vh] object-contain rounded-2xl border-4 ${
                  isBallInHand ? "cursor-grab" : isDraggingCueStick ? "cursor-grabbing" : "cursor-crosshair"
                }`}
              />
            </div>
          </div>

          {/* Bottom Table Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-xl backdrop-blur-md">
            {/* Interactive English / Spin Widget */}
            <div className="flex items-center gap-3">
              <div
                className="relative w-12 h-12 rounded-full bg-slate-100 border-2 border-slate-400 cursor-pointer shadow-inner flex items-center justify-center"
                title="اضغط لتحديد نقطة ضرب المضرب (اسكروه، توب سبن، دوران جانبي)"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
                  const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
                  const dist = Math.hypot(x, y);
                  if (dist <= 0.85) {
                    setSpinX(Math.round(x * 10) / 10);
                    setSpinY(Math.round(y * 10) / 10);
                  } else {
                    setSpinX(0);
                    setSpinY(0);
                  }
                }}
              >
                <div className="absolute w-full h-[1px] bg-slate-300" />
                <div className="absolute h-full w-[1px] bg-slate-300" />
                <div
                  className="w-3.5 h-3.5 bg-rose-600 rounded-full border border-white shadow-md transition-all pointer-events-none"
                  style={{ transform: `translate(${spinX * 18}px, ${spinY * 18}px)` }}
                />
              </div>

              <div className="text-[11px] font-bold text-slate-300">
                <div className="text-amber-400 font-black">الدوران (Spin):</div>
                <div>{spinY < -0.2 ? "اسكروه (Backspin) 🔻" : spinY > 0.2 ? "توب سبن (Topspin) 🔺" : "ضربة في المركز"}</div>
              </div>
            </div>

            {/* Target Called Pocket Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-slate-400">الجيب الهدف:</span>
              <div className="flex items-center gap-1">
                {pockets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setCalledPocketId(p.id)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                      calledPocketId === p.id
                        ? "bg-amber-400 text-slate-950 shadow-md scale-105"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Power Slider & Shoot Button */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 font-bold">القوة:</span>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={power}
                  onChange={(e) => setPower(parseInt(e.target.value))}
                  disabled={(!isPractice && turn !== "human") || isShooting || isBallInHand}
                  className="w-24 accent-amber-500 cursor-pointer"
                />
                <span className="text-[11px] font-black text-amber-400 w-7 text-center">{power}%</span>
              </div>

              <button
                onClick={handleShoot}
                disabled={(!isPractice && turn !== "human") || isShooting || isBallInHand}
                className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-lg cursor-pointer ${
                  (isPractice || turn === "human") && !isShooting && !isBallInHand
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white active:scale-95 shadow-emerald-500/30"
                    : "bg-slate-800 text-slate-600 cursor-not-allowed"
                }`}
              >
                {isShooting ? "الكرات تتحرك... 🎱" : isBallInHand ? "ضع الكرة باليد أولاً ✋" : (isPractice || turn === "human") ? "اضرب الكرة! 🚀" : "دور الخصم..."}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SHOP & INVENTORY MODAL (20 CUES + 9 TABLES WITH STATS)   */}
      {/* ========================================================= */}
      {activeModal === "shop" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 overflow-hidden">
          <div className="bg-[#0b121e] border-2 border-amber-500/50 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🛒</span>
                <div>
                  <h3 className="text-lg font-black text-amber-300">متجر كيو ماستر (Shop & Inventory)</h3>
                  <p className="text-[11px] text-slate-400">اختر وجهز أفضل العصي والطاولات الحصرية بأعلى الإحصائيات</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1 rounded-xl border border-amber-500/40 text-amber-400 font-black text-sm">
                  <span>🪙</span>
                  <span>{coins.toLocaleString()}</span>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-black cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Shop Section Tabs */}
            <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-slate-800/80 bg-slate-900/50">
              <button
                onClick={() => setShopTab("cues")}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  shopTab === "cues"
                    ? "bg-amber-400 text-slate-950 shadow-md"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                <span>🎱</span>
                <span>عصيان البلياردو (20 عصا)</span>
              </button>
              <button
                onClick={() => setShopTab("tables")}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  shopTab === "tables"
                    ? "bg-amber-400 text-slate-950 shadow-md"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                <span>🟩</span>
                <span>طاولات اللعب ({ALL_TABLES.length} طاولات)</span>
              </button>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {shopTab === "cues" ? (
                <>
                  {/* Category Filter Chips */}
                  <div className="flex items-center gap-2 pb-2">
                    <button
                      onClick={() => setCueCategoryFilter("all")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        cueCategoryFilter === "all" ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      الكل (20)
                    </button>
                    <button
                      onClick={() => setCueCategoryFilter("classic")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        cueCategoryFilter === "classic" ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      🌟 الفئة الاحترافية والكلاسيكية (10)
                    </button>
                    <button
                      onClick={() => setCueCategoryFilter("legendary")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        cueCategoryFilter === "legendary" ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      ⚡ الفئة الأسطورية وخوارق الطبيعة (10)
                    </button>
                  </div>

                  {/* Cues Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ALL_CUES.filter((c) => cueCategoryFilter === "all" || c.category === cueCategoryFilter).map((cue) => {
                      const isEquipped = selectedCue === cue.id;
                      const isUnlocked = unlockedCues.includes(cue.id);

                      return (
                        <div
                          key={cue.id}
                          className={`relative flex flex-col justify-between p-4 rounded-2xl border transition-all ${
                            isEquipped
                              ? "bg-amber-500/10 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.25)]"
                              : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          {/* Cue Image Showcase */}
                          <div className="w-full h-12 bg-slate-900/90 rounded-xl overflow-hidden flex items-center justify-center p-1 border border-slate-800/80 mb-3">
                            <img src={cue.image} alt={cue.nameAr} className="max-h-full object-contain filter drop-shadow-md" />
                          </div>

                          {/* Cue Title & Category Badge */}
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="text-sm font-black text-white">{cue.nameAr}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{cue.nameEn}</div>
                            </div>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                cue.category === "legendary"
                                  ? "bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-500/50"
                                  : "bg-amber-950 text-amber-300 border border-amber-500/50"
                              }`}
                            >
                              {cue.category === "legendary" ? "⚡ أسطورية" : "🌟 احترافية"}
                            </span>
                          </div>

                          {/* 4 Stats Bars */}
                          <div className="grid grid-cols-2 gap-2 my-2 text-[10px]">
                            {/* Force */}
                            <div>
                              <div className="flex justify-between text-slate-400 mb-0.5">
                                <span>💥 القوة:</span>
                                <span className="font-bold text-amber-400">{cue.stats.force}/10</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full" style={{ width: `${(cue.stats.force / 10) * 100}%` }} />
                              </div>
                            </div>

                            {/* Aim */}
                            <div>
                              <div className="flex justify-between text-slate-400 mb-0.5">
                                <span>🎯 التوجيه:</span>
                                <span className="font-bold text-cyan-400">{cue.stats.aim}/10</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: `${(cue.stats.aim / 10) * 100}%` }} />
                              </div>
                            </div>

                            {/* Spin */}
                            <div>
                              <div className="flex justify-between text-slate-400 mb-0.5">
                                <span>🌀 الدوران:</span>
                                <span className="font-bold text-purple-400">{cue.stats.spin}/10</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-400 rounded-full" style={{ width: `${(cue.stats.spin / 10) * 100}%` }} />
                              </div>
                            </div>

                            {/* Time */}
                            <div>
                              <div className="flex justify-between text-slate-400 mb-0.5">
                                <span>⏱️ الوقت:</span>
                                <span className="font-bold text-emerald-400">{cue.stats.time}ث</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full" style={{ width: `${(cue.stats.time / 50) * 100}%` }} />
                              </div>
                            </div>
                          </div>

                          {/* Special Perk */}
                          <div className="text-[10px] text-amber-200/90 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 mb-3">
                            {cue.specialPerkAr}
                          </div>

                          {/* Action Button */}
                          <div className="flex items-center justify-between pt-1">
                            <div className="text-xs font-black text-amber-400">
                              {cue.price === 0 ? "مجانية" : `${cue.price.toLocaleString()} 🪙`}
                            </div>
                            <button
                              onClick={() => (isUnlocked ? handleEquipCue(cue.id) : handleBuyCue(cue))}
                              className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow ${
                                isEquipped
                                  ? "bg-emerald-500 text-slate-950 font-bold"
                                  : isUnlocked
                                  ? "bg-amber-400 hover:bg-amber-300 text-slate-950"
                                  : coins >= cue.price
                                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white"
                                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
                              }`}
                            >
                              {isEquipped ? "✅ مجهزة حالياً" : isUnlocked ? "تجهيز العصا" : `شراء 🪙`}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* TABLES TAB (ALL 9 TABLES) */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ALL_TABLES.map((table) => {
                      const isEquipped = selectedTable === table.id;
                      const isUnlocked = unlockedTables.includes(table.id);

                      return (
                        <div
                          key={table.id}
                          className={`relative flex flex-col justify-between p-4 rounded-2xl border transition-all ${
                            isEquipped
                              ? "bg-amber-500/10 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.25)]"
                              : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          {/* Table Image Preview */}
                          <div className="w-full h-32 rounded-xl overflow-hidden border border-slate-800 relative bg-slate-900 mb-3">
                            {table.image ? (
                              <img src={table.image} alt={table.nameAr} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-[#15803d]">
                                <span className="text-white font-black text-sm drop-shadow">طاولة البطولة الخضراء</span>
                              </div>
                            )}
                            <div
                              className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-black border"
                              style={{ backgroundColor: "rgba(0,0,0,0.75)", color: table.cushionGlow, borderColor: table.cushionGlow }}
                            >
                              {table.cushionGlow}
                            </div>
                          </div>

                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-black text-white">{table.nameAr}</h4>
                            <span className="text-xs font-black text-amber-400">
                              {table.price === 0 ? "مجانية" : `${table.price.toLocaleString()} 🪙`}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 mb-2">{table.descriptionAr}</p>

                          <div className="flex items-center justify-between text-[10px] text-slate-300 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800 mb-3">
                            <span>انزلاق السطح: {table.friction > 0.985 ? "سريع ناعم ❄️" : "قياسي متزن 🟢"}</span>
                            <span>ارتداد الباند: {table.bounceRestitution > 0.86 ? "انفجاري قوي 🔥" : "قياسي دولي 🎱"}</span>
                          </div>

                          <button
                            onClick={() => (isUnlocked ? handleEquipTable(table.id) : handleBuyTable(table))}
                            className={`w-full py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow ${
                              isEquipped
                                ? "bg-emerald-500 text-slate-950 font-bold"
                                : isUnlocked
                                ? "bg-amber-400 hover:bg-amber-300 text-slate-950"
                                : coins >= table.price
                                ? "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white"
                                : "bg-slate-800 text-slate-500 cursor-not-allowed"
                            }`}
                          >
                            {isEquipped ? "✅ الطاولة المجهزة حالياً" : isUnlocked ? "تجهيز هذه الطاولة" : `شراء الطاولة 🪙 ${table.price.toLocaleString()}`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SETTINGS MODAL                                            */}
      {/* ========================================================= */}
      {activeModal === "settings" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0b121e] border border-slate-700 rounded-3xl p-6 w-full max-w-sm relative shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">⚙️ الإعدادات (Settings)</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="space-y-4 text-xs font-bold">
              <div className="flex items-center justify-between">
                <span>المؤثرات الصوتية:</span>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer ${soundEnabled ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"}`}
                >
                  {soundEnabled ? "مفعل 🔊" : "مكتوم 🔇"}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span>خط التوجيه المساعد:</span>
                <button
                  onClick={() => setAimAssistLong(!aimAssistLong)}
                  className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer ${aimAssistLong ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"}`}
                >
                  {aimAssistLong ? "متقدم (طويل)" : "قياسي"}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span>الطاولة الحالية:</span>
                <span className="text-amber-400 font-bold">{currentTable.nameAr}</span>
              </div>

              <div className="flex items-center justify-between">
                <span>العصا الحالية:</span>
                <span className="text-cyan-400 font-bold">{activeCue.nameAr}</span>
              </div>
            </div>

            <button
              onClick={() => { setActiveModal("shop"); }}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer shadow"
            >
              فتح المتجر لتعديل العصا والطاولة 🛒
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TOURNAMENTS MODAL                                         */}
      {/* ========================================================= */}
      {activeModal === "tournaments" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0b121e] border border-amber-500/40 rounded-3xl p-6 w-full max-w-md relative shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-amber-300 flex items-center gap-2">
                <span>🏆</span> بطولات كيو ماستر الكبرى
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              {[
                { name: "بطولة القاهرة المفتوحة", entry: 500, prize: 3500, players: "8 لاعبين", icon: "🇪🇬" },
                { name: "كأس دبي للمحترفين", entry: 2500, prize: 18000, players: "16 لاعب", icon: "🇦🇪" },
                { name: "ماسترز لندن العالمية", entry: 10000, prize: 75000, players: "32 لاعب", icon: "🇬🇧" },
              ].map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{t.icon}</span>
                    <div>
                      <div className="text-xs font-black text-white">{t.name}</div>
                      <div className="text-[10px] text-slate-400">الجائزة: {t.prize.toLocaleString()} 🪙 | {t.players}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setActiveModal(null);
                      startMatch("8-ball", false, t.entry);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer shadow"
                  >
                    دخول {t.entry} 🪙
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STAKE SELECT MODAL                                        */}
      {/* ========================================================= */}
      {activeModal === "stake_select" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0b121e] border border-amber-500/40 rounded-3xl p-6 w-full max-w-sm relative shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-amber-300">اختر طاولة اللعب والرهان</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="space-y-2.5">
              {[
                { name: "طاولة المبتدئين (الصالون)", stake: 100, prize: 190 },
                { name: "طاولة الهواة (النادي)", stake: 500, prize: 950 },
                { name: "طاولة المحترفين (VIP)", stake: 2500, prize: 4750 },
                { name: "طاولة الملوك (High Roller)", stake: 10000, prize: 19000 },
              ].map((st, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setActiveModal(null);
                    startMatch("8-ball", false, st.stake);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-amber-400/50 transition-all cursor-pointer"
                >
                  <div className="text-right">
                    <div className="text-xs font-black text-white">{st.name}</div>
                    <div className="text-[10px] text-amber-400">الجائزة: {st.prize.toLocaleString()} 🪙</div>
                  </div>
                  <span className="text-xs font-black text-emerald-400">{st.stake.toLocaleString()} 🪙</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* LEADERBOARD MODAL                                         */}
      {/* ========================================================= */}
      {activeModal === "leaderboard" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0b121e] border border-slate-700 rounded-3xl p-6 w-full max-w-sm relative shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>🏆</span> قائمة المتصدرين (Leaderboard)
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="space-y-2">
              {[
                { rank: "🥇 1", name: "الكابتن_ماجد", coins: "2,450,000", flag: "🇪🇬" },
                { rank: "🥈 2", name: "البرنس_السعودي", coins: "1,890,000", flag: "🇸🇦" },
                { rank: "🥉 3", name: "صقر_الخليج", coins: "1,220,000", flag: "🇦🇪" },
                { rank: "4", name: username, coins: coins.toLocaleString(), flag: "⭐" },
              ].map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-400">{p.rank}</span>
                    <span className="font-black text-white">{p.name}</span>
                    <span>{p.flag}</span>
                  </div>
                  <span className="font-mono text-amber-300 font-bold">{p.coins} 🪙</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* GAME OVER MODAL                                           */}
      {/* ========================================================= */}
      {gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 w-full max-w-md text-center shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="text-4xl">{gameOver.includes("مبروك") || gameOver.includes("فزت") ? "🏆" : "❌"}</div>
            <h3 className="text-xl font-black text-amber-300">نهاية المباراة!</h3>
            <p className="text-sm font-bold text-slate-200 leading-relaxed">{gameOver}</p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  setGameOver(null);
                  startMatch(mode, isPractice, stake);
                }}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs cursor-pointer shadow-lg active:scale-95"
              >
                مباراة جديدة 🔄
              </button>
              <button
                onClick={() => {
                  setGameOver(null);
                  setCurrentView("menu");
                  try {
                    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
                      window.parent.postMessage({ type: "CLOSE_GAME" }, "*");
                    }
                  } catch {}
                }}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-xs cursor-pointer active:scale-95"
              >
                القائمة الرئيسية 🏠
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
