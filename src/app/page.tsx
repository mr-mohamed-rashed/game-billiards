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
let sharedNoiseBuffer: AudioBuffer | null = null;
let lastClackSoundTime = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => { });
  }
  return sharedAudioCtx;
}

function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => { });
  }
}

function playBallClack(relativeSpeed: number) {
  const now = performance.now();
  if (now - lastClackSoundTime < 45) return;
  lastClackSoundTime = now;

  const ctx = getAudioContext();
  if (!ctx || ctx.state === "suspended") return;
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
    if (!sharedNoiseBuffer || sharedNoiseBuffer.sampleRate !== ctx.sampleRate) {
      const bufferSize = Math.floor(ctx.sampleRate * 0.025);
      sharedNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = sharedNoiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005));
      }
    }
    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = sharedNoiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.45, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    whiteNoise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    whiteNoise.start(t);
  } catch { }
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
  const [showSpinPopover, setShowSpinPopover] = useState(false);
  const [showPocketPopover, setShowPocketPopover] = useState(false);

  // Orientation, Viewport & Mobile Widescreen State
  const [isPortrait, setIsPortrait] = useState(false);
  const [isVirtualLandscape, setIsVirtualLandscape] = useState(false);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [canvasDisplaySize, setCanvasDisplaySize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const tableStageRef = useRef<HTMLDivElement | null>(null);
  const isAimDraggingRef = useRef<boolean>(false);
  const isDraggingBallInHandRef = useRef<boolean>(false);
  const isSpinDraggingRef = useRef<boolean>(false);

  // Vertical Left Power Meter Drag State & Refs (direct DOM update for 0-lag mobile drag)
  const powerTrackRef = useRef<HTMLDivElement | null>(null);
  const powerFillRef = useRef<HTMLDivElement | null>(null);
  const powerHandleRef = useRef<HTMLDivElement | null>(null);
  const powerTextRef = useRef<HTMLDivElement | null>(null);
  const isVerticalMeterDraggingRef = useRef<boolean>(false);
  const cueImageCacheRef = useRef<Record<string, HTMLImageElement>>({});

  // Table Engine State
  const [turn, setTurn] = useState<"human" | "bot">("human");
  const [turnMessage, setTurnMessage] = useState("طاولة مفتوحة: أول كرة تسقطها تحدد صنفك (سادة أم ألوان)!");
  const [humanScore, setHumanScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [power, setPower] = useState(0);
  const [aimAngle, setAimAngle] = useState(0);
  const [isShooting, setIsShooting] = useState(false);
  const [gameOver, setGameOver] = useState<string | null>(null);

  // Live Refs synced for 60fps Canvas Loop (prevents restarting rAF on every touch move)
  const aimAngleRef = useRef<number>(0);
  const powerRef = useRef<number>(0);
  const spinXRef = useRef<number>(0);
  const spinYRef = useRef<number>(0);
  const calledPocketIdRef = useRef<number | null>(0);
  const isShootingRef = useRef<boolean>(false);
  const isBallInHandRef = useRef<boolean>(false);
  const ballInHandHoverPosRef = useRef<{ x: number; y: number } | null>(null);
  const turnRef = useRef<"human" | "bot">("human");
  const humanGroupRef = useRef<"unassigned" | "solids" | "stripes">("unassigned");
  const botGroupRef = useRef<"unassigned" | "solids" | "stripes">("unassigned");
  const soundEnabledRef = useRef<boolean>(true);
  const aimAssistLongRef = useRef<boolean>(true);
  const selectedCueRef = useRef<string>("cue_maple_standard");
  const selectedTableRef = useRef<string>("classic");
  const modeRef = useRef<"8-ball" | "snooker">(initialMode);
  const isPracticeRef = useRef<boolean>(false);
  const prizeRef = useRef<number>(initialPrize);
  const coinsRef = useRef<number>(85000);
  const glossCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const proceduralTableCacheRef = useRef<Record<string, HTMLCanvasElement>>({});

  // Keep refs synced with state
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { aimAssistLongRef.current = aimAssistLong; }, [aimAssistLong]);
  useEffect(() => { selectedCueRef.current = selectedCue; }, [selectedCue]);
  useEffect(() => { selectedTableRef.current = selectedTable; }, [selectedTable]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { isPracticeRef.current = isPractice; }, [isPractice]);
  useEffect(() => { prizeRef.current = prize; }, [prize]);
  useEffect(() => { coinsRef.current = coins; }, [coins]);
  useEffect(() => { calledPocketIdRef.current = calledPocketId; }, [calledPocketId]);
  useEffect(() => { spinXRef.current = spinX; }, [spinX]);
  useEffect(() => { spinYRef.current = spinY; }, [spinY]);
  useEffect(() => { turnRef.current = turn; }, [turn]);
  useEffect(() => { humanGroupRef.current = humanGroup; }, [humanGroup]);
  useEffect(() => { botGroupRef.current = botGroup; }, [botGroup]);
  useEffect(() => { isShootingRef.current = isShooting; }, [isShooting]);
  useEffect(() => { isBallInHandRef.current = isBallInHand; }, [isBallInHand]);

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

  // Preload Storage & Viewport Orientation (Lightweight: no bulk preloading of 29 images)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sCoins = localStorage.getItem("cuemaster_coins");
      if (sCoins) setCoins(parseInt(sCoins));
      const sGems = localStorage.getItem("cuemaster_gems");
      if (sGems) setGems(parseInt(sGems));
      const sCue = localStorage.getItem("cuemaster_selected_cue");
      if (sCue) {
        setSelectedCue(sCue);
        selectedCueRef.current = sCue;
      }
      const sTable = localStorage.getItem("cuemaster_selected_table");
      if (sTable) {
        setSelectedTable(sTable);
        selectedTableRef.current = sTable;
      }
      const sUnlCues = localStorage.getItem("cuemaster_unlocked_cues");
      if (sUnlCues) setUnlockedCues(JSON.parse(sUnlCues));
      const sUnlTables = localStorage.getItem("cuemaster_unlocked_tables");
      if (sUnlTables) setUnlockedTables(JSON.parse(sUnlTables));
    } catch { }

    const updateOrientation = () => {
      if (typeof window === "undefined") return;
      const vw = window.visualViewport ? Math.round(window.visualViewport.width) : window.innerWidth;
      const vh = window.visualViewport ? Math.round(window.visualViewport.height) : window.innerHeight;
      setViewportSize({ w: vw, h: vh });
      const portrait = vh > vw && vw < 920;
      setIsPortrait(portrait);
      if (portrait) {
        setIsVirtualLandscape((prev) => prev || currentView === "table");
      }
    };
    updateOrientation();
    window.addEventListener("resize", updateOrientation);
    window.addEventListener("orientationchange", updateOrientation);
    window.visualViewport?.addEventListener("resize", updateOrientation);
    return () => {
      window.removeEventListener("resize", updateOrientation);
      window.removeEventListener("orientationchange", updateOrientation);
      window.visualViewport?.removeEventListener("resize", updateOrientation);
    };
  }, [currentView]);

  // Lazy-load ONLY the currently selected table and cue images on demand
  useEffect(() => {
    const tbl = ALL_TABLES.find((t) => t.id === selectedTable);
    if (tbl?.image && !tableImageCacheRef.current[tbl.id]) {
      const img = new Image();
      img.src = tbl.image;
      img.onload = () => {
        tableImageCacheRef.current[tbl.id] = img;
      };
    }
    const cue = ALL_CUES.find((c) => c.id === selectedCue);
    if (cue?.image && !cueImageCacheRef.current[cue.id]) {
      const img = new Image();
      img.src = cue.image;
      img.onload = () => {
        cueImageCacheRef.current[cue.id] = img;
      };
    }
  }, [selectedTable, selectedCue]);

  // Measure available Table Stage space to fit the maximum exact 2:1 Canvas without scrolling
  useEffect(() => {
    if (currentView !== "table") return;
    const el = tableStageRef.current;
    if (!el) return;

    const computeSize = () => {
      const rect = el.getBoundingClientRect();
      // In virtual landscape (rotate-90), bounding rect width is visual height and height is visual width
      const availW = isVirtualLandscape && isPortrait ? rect.height : rect.width;
      const availH = isVirtualLandscape && isPortrait ? rect.width : rect.height;
      const padW = Math.max(0, availW - 8);
      const padH = Math.max(0, availH - 8);
      if (padW <= 0 || padH <= 0) return;
      const w = Math.floor(Math.min(padW, padH * 2));
      const h = Math.floor(w / 2);
      setCanvasDisplaySize({ w, h });
    };

    computeSize();
    const ro = new ResizeObserver(computeSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [currentView, isVirtualLandscape, isPortrait, viewportSize]);

  // Sync to Storage
  const saveCoins = (val: number) => {
    setCoins(val);
    try { localStorage.setItem("cuemaster_coins", val.toString()); } catch { }
  };
  const saveGems = (val: number) => {
    setGems(val);
    try { localStorage.setItem("cuemaster_gems", val.toString()); } catch { }
  };

  // Turn Timeout Foul Handler
  const handleTurnTimeout = () => {
    if (soundEnabledRef.current) playFoulBuzzer();
    if (!isPracticeRef.current) {
      const nextTurn = turnRef.current === "human" ? "bot" : "human";
      turnRef.current = nextTurn;
      setTurn(nextTurn);
      if (nextTurn === "human") {
        isBallInHandRef.current = true;
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
      isBallInHandRef.current = true;
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
    humanGroupRef.current = "unassigned";
    botGroupRef.current = "unassigned";
    turnRef.current = "human";
    isBallInHandRef.current = false;
    isShootingRef.current = false;
    ballInHandHoverPosRef.current = null;
    powerRef.current = 0;
    setHumanGroup("unassigned");
    setBotGroup("unassigned");
    setGroupAnnouncement(null);
    setTurn("human");
    setTurnMessage("طاولة مفتوحة: أول ضربة ناجحة في جيب محدد تعيّن صنفك!");
    setIsBallInHand(false);
    setBallInHandHoverPos(null);
    setIsShooting(false);
    setPower(0);
    firstBallHitInShotRef.current = null;
    pottedInCurrentShotRef.current = [];
    cueScratchedInShotRef.current = false;
  };

  // Handle Game Over
  const triggerGameOver = (winner: "human" | "bot", message: string) => {
    setGameOver(message);
    const curCue = ALL_CUES.find((c) => c.id === selectedCueRef.current) || ALL_CUES[0];
    const curPrize = prizeRef.current;
    if (winner === "human") {
      const perkBonus = curCue.id === "cue_royal_ruby" ? Math.round(curPrize * 1.15) : curPrize;
      saveCoins(coinsRef.current + perkBonus);
      if (soundEnabledRef.current) playSuccessChime();
    }
    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: "GAME_OVER",
        game: "billiards",
        winner,
        coins: winner === "human" ? curPrize : 0,
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
    selectedCueRef.current = cueId;
    setSelectedCue(cueId);
    try { localStorage.setItem("cuemaster_selected_cue", cueId); } catch { }
    if (soundEnabledRef.current) playSuccessChime();
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
    selectedCueRef.current = cue.id;
    setSelectedCue(cue.id);
    try {
      localStorage.setItem("cuemaster_unlocked_cues", JSON.stringify(newUnlocked));
      localStorage.setItem("cuemaster_selected_cue", cue.id);
    } catch { }
    if (soundEnabledRef.current) playSuccessChime();
  };

  const handleEquipTable = (tableId: string) => {
    selectedTableRef.current = tableId;
    setSelectedTable(tableId);
    try { localStorage.setItem("cuemaster_selected_table", tableId); } catch { }
    if (soundEnabledRef.current) playSuccessChime();
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
    selectedTableRef.current = tbl.id;
    setSelectedTable(tbl.id);
    try {
      localStorage.setItem("cuemaster_unlocked_tables", JSON.stringify(newUnlocked));
      localStorage.setItem("cuemaster_selected_table", tbl.id);
    } catch { }
    if (soundEnabledRef.current) playSuccessChime();
  };

  // High-Precision Physics Engine (8 Sub-steps per frame, Segmented Cushions, Realistic Pocket Mouth)
  // Depends ONLY on [currentView] so touch aiming & power dragging run at 60fps with zero rAF restarts.
  useEffect(() => {
    if (currentView !== "table") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // Pre-render ball gloss highlight once on an offscreen canvas (avoids 16+ radial gradients per frame)
    if (!glossCanvasRef.current) {
      const gc = document.createElement("canvas");
      const size = BALL_RADIUS * 2 + 2;
      gc.width = size;
      gc.height = size;
      const gctx = gc.getContext("2d");
      if (gctx) {
        const cx = size / 2;
        const cy = size / 2;
        const glossGrad = gctx.createRadialGradient(
          cx - BALL_RADIUS * 0.35, cy - BALL_RADIUS * 0.35, 1,
          cx, cy, BALL_RADIUS
        );
        glossGrad.addColorStop(0, "rgba(255,255,255,0.72)");
        glossGrad.addColorStop(0.4, "rgba(255,255,255,0.08)");
        glossGrad.addColorStop(1, "rgba(0,0,0,0.35)");
        gctx.fillStyle = glossGrad;
        gctx.beginPath();
        gctx.arc(cx, cy, BALL_RADIUS, 0, Math.PI * 2);
        gctx.fill();
      }
      glossCanvasRef.current = gc;
    }

    const SUB_STEPS = 8;
    const MAX_SPEED = 28;

    const updatePhysics = () => {
      const balls = ballsRef.current;
      const ballCount = balls.length;
      if (ballCount === 0) return;

      const tableCfg = ALL_TABLES.find((t) => t.id === selectedTableRef.current) || ALL_TABLES[0];
      const FRICTION = tableCfg.friction;
      const subFriction = Math.pow(FRICTION, 1 / SUB_STEPS);
      const CUSHION_BOUNCE = tableCfg.bounceRestitution;
      const sfxEnabled = soundEnabledRef.current;

      const cueActive = ALL_CUES.find((c) => c.id === selectedCueRef.current) || ALL_CUES[0];
      const cueSpinBonus = 0.75 + (cueActive.stats.spin / 10) * 0.55;
      const timeScale = cinematicCamRef.current ? 0.35 : 1.0;
      const stepFriction = Math.pow(subFriction, timeScale);
      const invSub = timeScale / SUB_STEPS;

      let anyMoving = false;

      for (let step = 0; step < SUB_STEPS; step++) {
        // 1. Move Balls & Resolve Cushions / Pocket Drops per Sub-step
        for (let bi = 0; bi < ballCount; bi++) {
          const ball = balls[bi];
          if (ball.isPotted) continue;

          ball.x += ball.vx * invSub;
          ball.y += ball.vy * invSub;
          ball.vx *= stepFriction;
          ball.vy *= stepFriction;

          const speed = Math.hypot(ball.vx, ball.vy);
          if (speed > 0.08) anyMoving = true;

          // High-Elasticity Rubber Cushion Rails
          if (ball.y < 64 && ((ball.x > 94 && ball.x < 422) || (ball.x > 478 && ball.x < 806))) {
            ball.y = 64;
            ball.vy = Math.abs(ball.vy) * CUSHION_BOUNCE;
            if (sfxEnabled && speed > 1.0) playBallClack(speed);
          }
          if (ball.y > 379 && ((ball.x > 94 && ball.x < 422) || (ball.x > 478 && ball.x < 806))) {
            ball.y = 379;
            ball.vy = -Math.abs(ball.vy) * CUSHION_BOUNCE;
            if (sfxEnabled && speed > 1.0) playBallClack(speed);
          }
          if (ball.x < 82 && ball.y > 86 && ball.y < 364) {
            ball.x = 82;
            ball.vx = Math.abs(ball.vx) * CUSHION_BOUNCE;
            if (sfxEnabled && speed > 1.0) playBallClack(speed);
          }
          if (ball.x > 823 && ball.y > 86 && ball.y < 364) {
            ball.x = 823;
            ball.vx = -Math.abs(ball.vx) * CUSHION_BOUNCE;
            if (sfxEnabled && speed > 1.0) playBallClack(speed);
          }

          // Exact Pocket Drop Detection & Funnel Suction
          for (let pi = 0; pi < pockets.length; pi++) {
            const p = pockets[pi];
            const dx = p.x - ball.x;
            const dy = p.y - ball.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 30 && dist > 0.5) {
              const pull = 0.45 * (1 - dist / 30) * timeScale;
              ball.vx += (dx / dist) * pull;
              ball.vy += (dy / dist) * pull;
            }

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
                if (sfxEnabled) playCinematicWhoosh();
              }
            }

            if (dist < 22) {
              ball.isPotted = true;
              ball.vx = 0;
              ball.vy = 0;
              if (sfxEnabled) playPocketDrop();

              if (ball.type === "cue") {
                cueScratchedInShotRef.current = true;
              } else {
                pottedInCurrentShotRef.current.push({ ball, pocketId: p.id });
              }
              break;
            }
          }

          // Outer table safety catch
          if (!ball.isPotted && (ball.x < 42 || ball.x > TABLE_WIDTH - 42 || ball.y < 32 || ball.y > TABLE_HEIGHT - 32)) {
            let nearestP = pockets[0];
            let bestDist = Infinity;
            for (let pi = 0; pi < pockets.length; pi++) {
              const d = Math.hypot(pockets[pi].x - ball.x, pockets[pi].y - ball.y);
              if (d < bestDist) {
                bestDist = d;
                nearestP = pockets[pi];
              }
            }
            ball.isPotted = true;
            ball.vx = 0;
            ball.vy = 0;
            if (sfxEnabled) playPocketDrop();
            if (ball.type === "cue") cueScratchedInShotRef.current = true;
            else pottedInCurrentShotRef.current.push({ ball, pocketId: nearestP.id });
          }
        }

        // 2. Ball-to-Ball Elastic Collisions
        for (let i = 0; i < ballCount; i++) {
          const b1 = balls[i];
          if (b1.isPotted) continue;
          for (let j = i + 1; j < ballCount; j++) {
            const b2 = balls[j];
            if (b2.isPotted) continue;

            const dx = b2.x - b1.x;
            const dy = b2.y - b1.y;
            const minDist = b1.radius + b2.radius;
            if (Math.abs(dx) >= minDist || Math.abs(dy) >= minDist) continue;

            const dist = Math.hypot(dx, dy);
            if (dist < minDist && dist > 0.001) {
              const nx = dx / dist;
              const ny = dy / dist;

              const overlap = (minDist - dist) * 0.5;
              b1.x -= nx * overlap;
              b1.y -= ny * overlap;
              b2.x += nx * overlap;
              b2.y += ny * overlap;

              // Enforce cushion boundaries during separation
              if (b1.y < 64 && ((b1.x > 94 && b1.x < 422) || (b1.x > 478 && b1.x < 806))) b1.y = 64;
              if (b1.y > 379 && ((b1.x > 94 && b1.x < 422) || (b1.x > 478 && b1.x < 806))) b1.y = 379;
              if (b1.x < 82 && b1.y > 86 && b1.y < 364) b1.x = 82;
              if (b1.x > 823 && b1.y > 86 && b1.y < 364) b1.x = 823;

              if (b2.y < 64 && ((b2.x > 94 && b2.x < 422) || (b2.x > 478 && b2.x < 806))) b2.y = 64;
              if (b2.y > 379 && ((b2.x > 94 && b2.x < 422) || (b2.x > 478 && b2.x < 806))) b2.y = 379;
              if (b2.x < 82 && b2.y > 86 && b2.y < 364) b2.x = 82;
              if (b2.x > 823 && b2.y > 86 && b2.y < 364) b2.x = 823;

              const relVelNormal = (b1.vx - b2.vx) * nx + (b1.vy - b2.vy) * ny;
              if (relVelNormal > 0) {
                const restitution = 0.94;
                const impulse = ((1 + restitution) * relVelNormal) / 2;

                b1.vx -= impulse * nx;
                b1.vy -= impulse * ny;
                b2.vx += impulse * nx;
                b2.vy += impulse * ny;

                anyMoving = true;
                if (sfxEnabled && relVelNormal > 0.8) {
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

                if (!spinAppliedInCurrentShotRef.current) {
                  spinAppliedInCurrentShotRef.current = true;
                  const cosAim = Math.cos(activeShotAimAngleRef.current);
                  const sinAim = Math.sin(activeShotAimAngleRef.current);
                  const curSpinX = spinXRef.current;
                  const curSpinY = spinYRef.current;

                  if (curSpinY < -0.15) {
                    const screwMag = Math.abs(curSpinY) * 4.8 * cueSpinBonus;
                    cueB.vx -= cosAim * screwMag;
                    cueB.vy -= sinAim * screwMag;
                  } else if (curSpinY > 0.15) {
                    const followMag = curSpinY * 3.6 * cueSpinBonus;
                    cueB.vx += cosAim * followMag;
                    cueB.vy += sinAim * followMag;
                  }
                  if (Math.abs(curSpinX) > 0.15) {
                    const sideMag = curSpinX * 2.2 * cueSpinBonus;
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
      for (let i = 0; i < ballCount; i++) {
        const ball = balls[i];
        if (ball.isPotted) continue;
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
      }

      // 3. Handle Shot Completion & Official 8-Ball Rules Judgment
      if (isShootingRef.current && !anyMoving) {
        isShootingRef.current = false;
        setIsShooting(false);
        powerRef.current = 0;
        setPower(0);
        if (powerFillRef.current) powerFillRef.current.style.height = "0%";
        if (powerHandleRef.current) powerHandleRef.current.style.top = "calc(0% - 10px)";
        if (powerTextRef.current) powerTextRef.current.textContent = "0%";

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
        const activeShooter = turnRef.current;
        const targetPocketForThisShot = activeShotCalledPocketRef.current;

        pottedInCurrentShotRef.current = [];
        cueScratchedInShotRef.current = false;
        firstBallHitInShotRef.current = null;

        if (modeRef.current === "8-ball") {
          const shooterGroup = activeShooter === "human" ? humanGroupRef.current : botGroupRef.current;
          const remainingTargetBalls = balls.filter((b) =>
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
            if (sfxEnabled) playFoulBuzzer();
            if (!isPracticeRef.current) {
              const nextTurn = activeShooter === "human" ? "bot" : "human";
              turnRef.current = nextTurn;
              setTurn(nextTurn);
              if (nextTurn === "human") {
                isBallInHandRef.current = true;
                setIsBallInHand(true);
                setTurnMessage(`✋ خطأ على الخصم: (${foulReason}) اسحب الكرة البيضاء وضعها في المكان المناسب!`);
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
              isBallInHandRef.current = true;
              setIsBallInHand(true);
              setTurnMessage(`✋ فاول: (${foulReason}) ضع الكرة البيضاء!`);
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

          // ASSIGN GROUPS: First legal pot determines Solids vs Stripes
          if (humanGroupRef.current === "unassigned" && legallyCalledPots.length > 0) {
            const firstLegal = legallyCalledPots.find((b) => b.type === "solid" || b.type === "stripe");
            if (firstLegal) {
              const isSolid = firstLegal.type === "solid";
              if (activeShooter === "human") {
                const hGrp = isSolid ? "solids" : "stripes";
                const bGrp = isSolid ? "stripes" : "solids";
                humanGroupRef.current = hGrp;
                botGroupRef.current = bGrp;
                setHumanGroup(hGrp);
                setBotGroup(bGrp);
                setGroupAnnouncement({
                  title: "🎉 أحرزت أول كرة وتم تعيين الصنف!",
                  human: isSolid ? "سادة 🟡 (1-7)" : "ألوان 🔵 (9-15)",
                  bot: isSolid ? "ألوان 🔵 (9-15)" : "سادة 🟡 (1-7)",
                });
                setTurnMessage(`🎱 صنفك المعتمد: [${isSolid ? "سادة 🟡 (1-7)" : "ألوان 🔵 (9-15)"}]!`);
              } else {
                const bGrp = isSolid ? "solids" : "stripes";
                const hGrp = isSolid ? "stripes" : "solids";
                botGroupRef.current = bGrp;
                humanGroupRef.current = hGrp;
                setBotGroup(bGrp);
                setHumanGroup(hGrp);
                setGroupAnnouncement({
                  title: "🤖 الخصم أحرز أول كرة وتم تعيين الأصناف!",
                  human: isSolid ? "ألوان 🔵 (9-15)" : "سادة 🟡 (1-7)",
                  bot: isSolid ? "سادة 🟡 (1-7)" : "ألوان 🔵 (9-15)",
                });
                setTurnMessage(`🎱 صنفك المعتمد: [${isSolid ? "ألوان 🔵 (9-15)" : "سادة 🟡 (1-7)"}]!`);
              }
              setTimeout(() => setGroupAnnouncement(null), 1200);
            }
          }

          const currentShooterGroup = activeShooter === "human" ? humanGroupRef.current : botGroupRef.current;
          const pottedLegalBallInCalledPocket = legallyCalledPots.some((b) =>
            currentShooterGroup === "unassigned"
              ? (b.type === "solid" || b.type === "stripe")
              : (currentShooterGroup === "solids" ? b.type === "solid" : b.type === "stripe")
          );

          if (pottedLegalBallInCalledPocket) {
            if (activeShooter === "human") setHumanScore((s) => s + legallyCalledPots.length);
            else setBotScore((s) => s + legallyCalledPots.length);

            const remainingForShooter = balls.filter((b) =>
              !b.isPotted && b.number !== 8 && (currentShooterGroup === "solids" ? b.type === "solid" : b.type === "stripe")
            );

            if (remainingForShooter.length === 0 && currentShooterGroup !== "unassigned") {
              turnRef.current = activeShooter;
              setTurn(activeShooter);
              if (activeShooter === "human") {
                setTurnMessage("🏆 أنهيت كراتك! أسقط الكرة السوداء 8 في الجيب المحدد للفوز!");
              } else {
                setTurnMessage("⚠️ الخصم أنهى كراته ودوره مستمر على الكرة 8!");
              }
            } else {
              setTurnMessage("🔥 ضربة صحيحة! دورك مستمر.");
            }
          } else {
            if (!isPracticeRef.current) {
              const nextT = activeShooter === "human" ? "bot" : "human";
              turnRef.current = nextT;
              setTurn(nextT);
              setTurnMessage(activeShooter === "human" ? "دور الخصم الآن..." : "دورك الآن! تأكد من لمس صنفك أولاً.");
            }
          }
        } else {
          // Snooker Logic
          if (cueScratched) {
            if (!isPracticeRef.current) {
              const nextT = activeShooter === "human" ? "bot" : "human";
              turnRef.current = nextT;
              setTurn(nextT);
            }
            const cb = balls[0];
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
              if (!isPracticeRef.current) {
                const nextT = activeShooter === "human" ? "bot" : "human";
                turnRef.current = nextT;
                setTurn(nextT);
              }
            }
          }
        }
      }
    };

    const render = () => {
      const tableCfg = ALL_TABLES.find((t) => t.id === selectedTableRef.current) || ALL_TABLES[0];
      const activeCueObj = ALL_CUES.find((c) => c.id === selectedCueRef.current) || ALL_CUES[0];

      // 1. Table Background & Cushion Rendering
      const tableImg = tableCfg.image ? tableImageCacheRef.current[tableCfg.id] : null;
      if (tableImg && tableImg.complete && tableImg.naturalWidth > 0) {
        ctx.drawImage(tableImg, 0, 0, TABLE_WIDTH, TABLE_HEIGHT);
      } else {
        let cachedBg = proceduralTableCacheRef.current[tableCfg.id];
        if (!cachedBg) {
          cachedBg = document.createElement("canvas");
          cachedBg.width = TABLE_WIDTH;
          cachedBg.height = TABLE_HEIGHT;
          const bctx = cachedBg.getContext("2d");
          if (bctx) {
            bctx.fillStyle = "#1c100b";
            bctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
            bctx.strokeStyle = tableCfg.cushionGlow;
            bctx.lineWidth = 4;
            bctx.strokeRect(8, 8, TABLE_WIDTH - 16, TABLE_HEIGHT - 16);

            const feltGradient = bctx.createRadialGradient(
              TABLE_WIDTH / 2, TABLE_HEIGHT / 2, 80,
              TABLE_WIDTH / 2, TABLE_HEIGHT / 2, 450
            );
            feltGradient.addColorStop(0, tableCfg.feltColor);
            feltGradient.addColorStop(1, "#021c10");
            bctx.fillStyle = feltGradient;
            bctx.fillRect(CUSHION, CUSHION, TABLE_WIDTH - 2 * CUSHION, TABLE_HEIGHT - 2 * CUSHION);
          }
          proceduralTableCacheRef.current[tableCfg.id] = cachedBg;
        }
        ctx.drawImage(cachedBg, 0, 0);
      }

      // Snooker Baulk Line & "D" Zone
      if (modeRef.current === "snooker") {
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

      // 2. Pocket Target Call Highlight
      const targetPocketId = calledPocketIdRef.current;
      if (targetPocketId !== null) {
        const p = pockets[targetPocketId];
        if (p) {
          ctx.strokeStyle = "#eab308";
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = "rgba(234, 179, 8, 0.22)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#eab308";
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("🎯 الهدف", p.x, p.y + (p.y < TABLE_HEIGHT / 2 ? 28 : -22));
        }
      }

      // 3. Balls Rendering (Lightweight: cached offscreen gloss overlay, no per-frame gradients)
      const balls = ballsRef.current;
      const glossCanvas = glossCanvasRef.current;
      const curSpinX = spinXRef.current;
      const curSpinY = spinYRef.current;

      for (let i = 0; i < balls.length; i++) {
        const ball = balls[i];
        if (ball.isPotted) continue;

        ctx.fillStyle = "rgba(0,0,0,0.42)";
        ctx.beginPath();
        ctx.arc(ball.x + 2, ball.y + 3, ball.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = ball.color;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();

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

        if (ball.type === "cue" && (Math.abs(curSpinX) > 0.05 || Math.abs(curSpinY) > 0.05)) {
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          ctx.arc(ball.x + curSpinX * 7, ball.y + curSpinY * 7, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        if (glossCanvas) {
          ctx.drawImage(glossCanvas, ball.x - ball.radius - 1, ball.y - ball.radius - 1);
        }
      }

      // 4. Ball in Hand Placement Guide
      const hoverPos = ballInHandHoverPosRef.current;
      if (isBallInHandRef.current && hoverPos) {
        ctx.fillStyle = "rgba(59, 130, 246, 0.35)";
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(hoverPos.x, hoverPos.y, BALL_RADIUS + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = "22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🧤", hoverPos.x + 14, hoverPos.y - 12);
      }

      // 5. AIM LINE RAYCASTING & CUE STICK (Zero shadowBlur for smooth mobile FPS)
      const cueBall = balls[0];
      if ((turnRef.current === "human" || isPracticeRef.current) && !isShootingRef.current && !isBallInHandRef.current && cueBall && !cueBall.isPotted) {
        const curAimAngle = aimAngleRef.current;
        const cosA = Math.cos(curAimAngle);
        const sinA = Math.sin(curAimAngle);
        const collisionRadius = BALL_RADIUS * 2;

        const baseDist = aimAssistLongRef.current ? 420 : 260;
        const cueBonusDist = (activeCueObj.stats.aim / 10) * 280;
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
        const hGrp = humanGroupRef.current;

        if (hitBall && modeRef.current === "8-ball") {
          if (hGrp === "unassigned") {
            if (hitBall.number === 8) {
              isAimedTargetLegal = false;
              warningText = "⚠️ طاولة مفتوحة: لا يجوز ضرب 8!";
            }
          } else {
            const remainingHumanBalls = balls.filter((b) =>
              !b.isPotted && b.number !== 8 && (hGrp === "solids" ? b.type === "solid" : b.type === "stripe")
            );
            if (remainingHumanBalls.length > 0) {
              const expectedType = hGrp === "solids" ? "solid" : "stripe";
              if (hitBall.type !== expectedType) {
                isAimedTargetLegal = false;
                warningText = hitBall.number === 8 ? "⚠️ فاول: لا تلمس 8 الآن!" : "⚠️ فاول: صنف الخصم!";
              }
            } else if (hitBall.number !== 8) {
              isAimedTargetLegal = false;
              warningText = "⚠️ فاول: هدفك الكرة 8!";
            }
          }
        }

        const endAimX = cueBall.x + cosA * closestHitDist;
        const endAimY = cueBall.y + sinA * closestHitDist;

        const aimLineColor = !isAimedTargetLegal
          ? "rgba(239, 68, 68, 0.95)"
          : activeCueObj.category === "legendary"
            ? activeCueObj.glowColor
            : "rgba(255, 255, 255, 0.85)";

        ctx.strokeStyle = aimLineColor;
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = activeCueObj.category === "legendary" ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.moveTo(cueBall.x, cueBall.y);
        ctx.lineTo(endAimX, endAimY);
        ctx.stroke();
        ctx.setLineDash([]);

        if (hitBall) {
          ctx.strokeStyle = isAimedTargetLegal ? "rgba(255, 255, 255, 0.7)" : "rgba(239, 68, 68, 0.8)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(ghostBallPos.x, ghostBallPos.y, BALL_RADIUS, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = isAimedTargetLegal ? (activeCueObj.category === "legendary" ? activeCueObj.glowColor : "#facc15") : "#ef4444";
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(hitBall.x, hitBall.y);
          ctx.lineTo(
            hitBall.x + targetDeflectDir.dx * (120 + (activeCueObj.stats.aim / 10) * 80),
            hitBall.y + targetDeflectDir.dy * (120 + (activeCueObj.stats.aim / 10) * 80)
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

        // 6. Cue Stick with Dynamic Pull-Back (lightweight shadow without GPU shadowBlur)
        const cueOffset = BALL_RADIUS + 8 + (powerRef.current / 100) * 85;
        const cueDrawLength = 360;
        const cueDrawThickness = 18;
        const cueImg = activeCueObj.image ? cueImageCacheRef.current[activeCueObj.id] : null;

        ctx.save();
        ctx.translate(cueBall.x, cueBall.y);
        ctx.rotate(curAimAngle);

        // Lightweight offset drop shadow
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(-cueOffset - cueDrawLength + 3, 3, cueDrawLength, 6);

        if (cueImg && cueImg.complete && cueImg.naturalWidth > 0) {
          ctx.drawImage(
            cueImg,
            -cueOffset - cueDrawLength,
            -cueDrawThickness / 2,
            cueDrawLength,
            cueDrawThickness
          );
        } else {
          const grad = ctx.createLinearGradient(-cueOffset - cueDrawLength, 0, -cueOffset, 0);
          grad.addColorStop(0, "#090d16");
          grad.addColorStop(0.35, "#1e293b");
          grad.addColorStop(0.7, activeCueObj.glowColor);
          grad.addColorStop(1, activeCueObj.tipColor);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(-cueOffset, -3.5);
          ctx.lineTo(-cueOffset - cueDrawLength, -8);
          ctx.lineTo(-cueOffset - cueDrawLength, 8);
          ctx.lineTo(-cueOffset, 3.5);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(-cueOffset, -3.5, 4, 7);
          ctx.fillStyle = "#0284c7";
          ctx.fillRect(-cueOffset + 4, -3, 2, 6);
        }

        if (activeCueObj.category === "legendary") {
          ctx.strokeStyle = activeCueObj.glowColor;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.55;
          ctx.strokeRect(-cueOffset - cueDrawLength, -cueDrawThickness / 2, cueDrawLength, cueDrawThickness);
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
  }, [currentView]);

  // Helper to map screen coordinates to Table coordinates (handles Virtual Landscape & scaling)
  const getCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    let x = 0;
    let y = 0;
    if (isVirtualLandscape && isPortrait) {
      // In 90deg clockwise virtual landscape:
      x = ((clientY - rect.top) / rect.height) * TABLE_WIDTH;
      y = ((rect.right - clientX) / rect.width) * TABLE_HEIGHT;
    } else {
      x = ((clientX - rect.left) / rect.width) * TABLE_WIDTH;
      y = ((clientY - rect.top) / rect.height) * TABLE_HEIGHT;
    }
    return { x, y };
  };

  // Clamp coordinates within playable table cushion bounds
  const clampBallInHandPos = (x: number, y: number) => ({
    x: Math.min(821, Math.max(84, x)),
    y: Math.min(377, Math.max(66, y)),
  });

  // Pointer Handlers for Table Canvas: Aiming, Mobile Ball-In-Hand Drag & Pocket Calling
  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    if (isBallInHandRef.current) {
      if (isDraggingBallInHandRef.current || e.pointerType === "mouse") {
        ballInHandHoverPosRef.current = clampBallInHandPos(coords.x, coords.y);
      }
      return;
    }

    if ((turnRef.current !== "human" && !isPracticeRef.current) || isShootingRef.current) return;

    const cueBall = ballsRef.current[0];
    if (cueBall && (isAimDraggingRef.current || e.buttons === 1)) {
      const angle = Math.atan2(coords.y - cueBall.y, coords.x - cueBall.x);
      aimAngleRef.current = angle;
    }
  };

  const tryPlaceBallInHand = (x: number, y: number) => {
    const clamped = clampBallInHandPos(x, y);
    const isOverlapping = ballsRef.current.slice(1).some(
      (b) => !b.isPotted && Math.hypot(b.x - clamped.x, b.y - clamped.y) < BALL_RADIUS * 2.2
    );
    if (!isOverlapping) {
      const cueBall = ballsRef.current[0];
      if (cueBall) {
        cueBall.x = clamped.x;
        cueBall.y = clamped.y;
        cueBall.vx = 0;
        cueBall.vy = 0;
        cueBall.isPotted = false;
        isBallInHandRef.current = false;
        ballInHandHoverPosRef.current = null;
        setIsBallInHand(false);
        setBallInHandHoverPos(null);
        setTurnMessage("✅ تم وضع الكرة! وجّه واسحب شريط القوة على اليسار للضرب.");
        if (soundEnabledRef.current) playBallClack(4);
      }
      return true;
    }
    setTurnMessage("⚠️ لا يمكن وضع الكرة فوق كرة أخرى، حرّكها لمكان فارغ!");
    return false;
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    unlockAudio();
    if (showSpinPopover) setShowSpinPopover(false);
    if (showPocketPopover) setShowPocketPopover(false);

    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    // Check if player tapped a pocket to CALL IT
    const clickedPocket = pockets.find((p) => Math.hypot(p.x - coords.x, p.y - coords.y) < 38);
    if (clickedPocket && !isBallInHandRef.current) {
      calledPocketIdRef.current = clickedPocket.id;
      setCalledPocketId(clickedPocket.id);
      if (soundEnabledRef.current) playBallClack(3);
      return;
    }

    // Ball in Hand: support both click (desktop) & drag-then-release (mobile touch)
    if (isBallInHandRef.current) {
      isDraggingBallInHandRef.current = true;
      ballInHandHoverPosRef.current = clampBallInHandPos(coords.x, coords.y);
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { }
      return;
    }

    // Start Aim dragging
    if ((turnRef.current === "human" || isPracticeRef.current) && !isShootingRef.current) {
      isAimDraggingRef.current = true;
      const cueBall = ballsRef.current[0];
      if (cueBall) {
        const angle = Math.atan2(coords.y - cueBall.y, coords.x - cueBall.x);
        aimAngleRef.current = angle;
      }
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { }
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isBallInHandRef.current && isDraggingBallInHandRef.current) {
      isDraggingBallInHandRef.current = false;
      const coords = getCanvasCoords(e.clientX, e.clientY);
      const target = coords ? clampBallInHandPos(coords.x, coords.y) : ballInHandHoverPosRef.current;
      if (target) tryPlaceBallInHand(target.x, target.y);
    }
    if (isAimDraggingRef.current) {
      isAimDraggingRef.current = false;
      setAimAngle(aimAngleRef.current);
    }
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { }
  };

  const handleCanvasPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isAimDraggingRef.current = false;
    isDraggingBallInHandRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { }
  };

  // Update Power Slider DOM directly during drag (zero React re-renders per frame)
  const applyPowerVisual = (pct: number) => {
    powerRef.current = pct;
    if (powerFillRef.current) {
      powerFillRef.current.style.height = `${pct}%`;
      powerFillRef.current.style.background =
        pct > 75
          ? "linear-gradient(to bottom, #f97316, #ef4444, #b91c1c)"
          : pct > 45
            ? "linear-gradient(to bottom, #fde047, #f59e0b, #b45309)"
            : "linear-gradient(to bottom, #6ee7b7, #10b981, #047857)";
    }
    if (powerHandleRef.current) {
      powerHandleRef.current.style.top = `calc(${pct}% - 10px)`;
    }
    if (powerTextRef.current) {
      powerTextRef.current.textContent = `${pct}%`;
    }
    if (powerTrackRef.current) {
      powerTrackRef.current.style.borderColor = pct > 75 ? "#ef4444" : pct > 45 ? "#f59e0b" : "#10b981";
    }
  };

  // 8-Ball Pool Left Vertical Power Slider Drag Handlers (supports virtual landscape rotation)
  const updatePowerFromPointer = (clientX: number, clientY: number, trackEl: HTMLElement) => {
    const rect = trackEl.getBoundingClientRect();
    let relativeProgress = 0;
    if (isVirtualLandscape && isPortrait) {
      // Top-to-bottom of vertical track corresponds to right-to-left on screen when rotated 90deg clockwise
      relativeProgress = (rect.right - clientX) / Math.max(1, rect.width);
    } else {
      relativeProgress = (clientY - rect.top) / Math.max(1, rect.height);
    }
    const pct = Math.round(relativeProgress * 100);
    const clamped = Math.min(100, Math.max(0, pct));
    applyPowerVisual(clamped);
  };

  const handlePowerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    unlockAudio();
    if (isShootingRef.current || isBallInHandRef.current || (!isPracticeRef.current && turnRef.current !== "human")) return;
    isVerticalMeterDraggingRef.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { }
    updatePowerFromPointer(e.clientX, e.clientY, e.currentTarget);
  };

  const handlePowerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isVerticalMeterDraggingRef.current) return;
    updatePowerFromPointer(e.clientX, e.clientY, e.currentTarget);
  };

  const handlePowerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isVerticalMeterDraggingRef.current) return;
    isVerticalMeterDraggingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { }

    const finalPower = powerRef.current;
    setPower(finalPower);
    if (finalPower >= 12 && (isPracticeRef.current || turnRef.current === "human") && !isShootingRef.current && !isBallInHandRef.current) {
      handleShoot(finalPower);
    } else {
      // Pulled back up to top (<12%) -> cancel shot cleanly
      applyPowerVisual(0);
      setPower(0);
    }
  };

  const handlePowerPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    isVerticalMeterDraggingRef.current = false;
    applyPowerVisual(0);
    setPower(0);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { }
  };

  // Spin / English Ball Pointer Handler (supports mobile touch drag & 90deg virtual landscape)
  const updateSpinFromPointer = (clientX: number, clientY: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    let x = 0;
    let y = 0;
    if (isVirtualLandscape && isPortrait) {
      x = ((clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
      y = ((rect.right - clientX) / Math.max(1, rect.width) - 0.5) * 2;
    } else {
      x = ((clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
      y = ((clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
    }
    const dist = Math.hypot(x, y);
    if (dist > 0.85) {
      x = (x / dist) * 0.85;
      y = (y / dist) * 0.85;
    }
    const rx = Math.round(x * 10) / 10;
    const ry = Math.round(y * 10) / 10;
    spinXRef.current = rx;
    spinYRef.current = ry;
    setSpinX(rx);
    setSpinY(ry);
  };

  // Human Player Strike Action (with Cue Stats Modifiers)
  const handleShoot = (explicitPower?: number) => {
    unlockAudio();
    if (isShootingRef.current || isBallInHandRef.current) return;
    if (turnRef.current !== "human" && !isPracticeRef.current) return;

    const cueBall = ballsRef.current[0];
    if (!cueBall || cueBall.isPotted) return;

    const shotPower = explicitPower !== undefined
      ? explicitPower
      : powerRef.current >= 12
        ? powerRef.current
        : 65;

    activeShotCalledPocketRef.current = calledPocketIdRef.current;
    activeShotAimAngleRef.current = aimAngleRef.current;
    spinAppliedInCurrentShotRef.current = false;
    shotStartPosRef.current = { x: cueBall.x, y: cueBall.y };
    cinematicTriggeredThisShotRef.current = false;

    isShootingRef.current = true;
    setIsShooting(true);
    if (soundEnabledRef.current) playCueStrike(shotPower);

    const curCue = ALL_CUES.find((c) => c.id === selectedCueRef.current) || ALL_CUES[0];
    const forceBonus = 0.85 + (curCue.stats.force / 10) * 0.35;
    const speed = (shotPower / 100) * 24 * forceBonus;
    cueBall.vx = Math.cos(aimAngleRef.current) * speed;
    cueBall.vy = Math.sin(aimAngleRef.current) * speed;
  };

  // Bot AI Turn Execution
  useEffect(() => {
    if (currentView !== "table") return;
    if (turn === "bot" && !isShooting && !gameOver && !isPractice && !isBallInHand) {
      const botTimer = setTimeout(() => {
        const cueBall = ballsRef.current[0];
        if (!cueBall || cueBall.isPotted) return;

        const curBotGroup = botGroupRef.current;
        const candidateBalls = ballsRef.current.filter((b) => {
          if (b.isPotted || b.type === "cue") return false;
          if (curBotGroup !== "unassigned") {
            const botType = curBotGroup === "solids" ? "solid" : "stripe";
            const botBallsLeft = ballsRef.current.filter((x) => !x.isPotted && (curBotGroup === "solids" ? x.type === "solid" : x.type === "stripe"));
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

          const bestPocket = pockets.reduce((prev, curr) => {
            const d1 = Math.hypot(prev.x - closest.x, prev.y - closest.y);
            const d2 = Math.hypot(curr.x - closest.x, curr.y - closest.y);
            return d1 < d2 ? prev : curr;
          });
          calledPocketIdRef.current = bestPocket.id;
          setCalledPocketId(bestPocket.id);
          activeShotCalledPocketRef.current = bestPocket.id;

          const variance = (Math.random() - 0.5) * 0.11;
          const targetAngle = Math.atan2(closest.y - cueBall.y, closest.x - cueBall.x) + variance;
          aimAngleRef.current = targetAngle;
          setAimAngle(targetAngle);
          activeShotAimAngleRef.current = targetAngle;
          spinAppliedInCurrentShotRef.current = false;
          shotStartPosRef.current = { x: cueBall.x, y: cueBall.y };
          cinematicTriggeredThisShotRef.current = false;

          isShootingRef.current = true;
          setIsShooting(true);
          if (soundEnabledRef.current) playCueStrike(65);
          const botSpeed = 15 + Math.random() * 8;
          cueBall.vx = Math.cos(targetAngle) * botSpeed;
          cueBall.vy = Math.sin(targetAngle) * botSpeed;
        }
      }, 1400);

      return () => clearTimeout(botTimer);
    }
  }, [currentView, turn, isShooting, gameOver, isPractice, isBallInHand, botGroup]);

  // Launch Table Match (automatically opens in Widescreen when Table appears)
  const startMatch = (targetMode: "8-ball" | "snooker", practice = false, tableStake = 100) => {
    unlockAudio();
    modeRef.current = targetMode;
    isPracticeRef.current = practice;
    prizeRef.current = Math.round(tableStake * 1.9);
    setMode(targetMode);
    setIsPractice(practice);
    setStake(tableStake);
    setPrize(Math.round(tableStake * 1.9));
    setHumanScore(0);
    setBotScore(0);
    setGameOver(null);
    setShowSpinPopover(false);
    setShowPocketPopover(false);
    initBalls(targetMode);

    if (typeof window !== "undefined") {
      const vw = window.visualViewport ? Math.round(window.visualViewport.width) : window.innerWidth;
      const vh = window.visualViewport ? Math.round(window.visualViewport.height) : window.innerHeight;
      setViewportSize({ w: vw, h: vh });
      const portrait = vh > vw && vw < 920;
      setIsPortrait(portrait);
      if (portrait) {
        setIsVirtualLandscape(true);
      }
    }

    setCurrentView("table");
  };

  const humanRemainingBalls = ballsRef.current.filter(
    (b) => !b.isPotted && b.number !== 8 && (humanGroup === "solids" ? b.type === "solid" : b.type === "stripe")
  );

  const activePocketObj = pockets.find((p) => p.id === calledPocketId) || pockets[0];

  return (
    <div className="relative w-screen h-dvh bg-[#020b14] text-slate-100 flex flex-col font-sans select-none overflow-hidden" dir="rtl">
      {/* ========================================================= */}
      {/* VIEW 1: CUE MASTER MAIN LOBBY                             */}
      {/* ========================================================= */}
      {currentView === "menu" ? (
        <div className="relative w-full h-full flex flex-col justify-between bg-cover bg-center overflow-y-auto" style={{ backgroundImage: "url('/cue_master_bg.jpg')" }}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/55 to-black/90 pointer-events-none" />

          {/* Top Bar: Profile, Level, Trophies, & Currencies */}
          <header className="relative z-10 flex flex-wrap items-center justify-between px-4 md:px-6 py-3 border-b border-slate-800/60 bg-black/60 gap-3">
            {/* User Profile Card */}
            <div className="flex items-center gap-3 bg-black/60 px-3.5 py-1.5 rounded-2xl border border-amber-500/40 shadow-lg">
              <div className="relative">
                <img src={avatar} alt="Avatar" className="w-10 h-10 rounded-xl bg-amber-400/20 p-0.5 border-2 border-amber-400 object-cover shadow" />
                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 font-black text-[9px] px-1 rounded-full border border-slate-900">
                  Lvl 1
                </div>
              </div>
              <div>
                <span className="font-black text-amber-300 text-xs md:text-sm block leading-none">{username}</span>
                <div className="w-20 bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div className="bg-emerald-400 h-full w-2/5 rounded-full shadow-[0_0_8px_#34d399]" />
                </div>
              </div>
            </div>

            {/* Trophy Progress Bar */}
            <div className="hidden sm:flex items-center gap-2 bg-black/60 px-3.5 py-1.5 rounded-2xl border border-blue-500/30">
              <span className="text-base">🏆</span>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold leading-tight">الكؤوس والجوائز</span>
                <span className="text-xs font-black text-amber-300 leading-tight">4 / 12</span>
              </div>
            </div>

            {/* Coins & Gems Counters */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-2xl border border-amber-500/40">
                <span className="text-base">🪙</span>
                <span className="font-black text-amber-400 text-xs md:text-sm">{coins.toLocaleString()}</span>
                <button
                  onClick={() => saveCoins(coins + 5000)}
                  className="w-5 h-5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center cursor-pointer shadow active:scale-90"
                  title="إضافة 5000 كوينز مجاناً"
                >
                  +
                </button>
              </div>

              <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-2xl border border-fuchsia-500/40">
                <span className="text-base">💎</span>
                <span className="font-black text-fuchsia-400 text-xs md:text-sm">{gems.toLocaleString()}</span>
                <button
                  onClick={() => saveGems(gems + 50)}
                  className="w-5 h-5 rounded-md bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-black text-xs flex items-center justify-center cursor-pointer shadow active:scale-90"
                  title="إضافة 50 جوهرة مجاناً"
                >
                  +
                </button>
              </div>
            </div>
          </header>

          {/* Main Lobby Hub Content */}
          <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-4 max-w-4xl mx-auto w-full space-y-4">
            {/* HERO CARD: DOWNTOWN LONDON PUB */}
            <div className="relative w-full rounded-3xl overflow-hidden border-2 border-amber-400/80 shadow-[0_10px_35px_rgba(0,0,0,0.85)] bg-gradient-to-b from-blue-950 via-[#071c36] to-slate-950 p-5 md:p-6 text-center">
              <div className="absolute top-2 left-3 text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full shadow">
                طاولة لندن الرسمية 🇬🇧
              </div>

              {/* Title & 8-Ball Logo */}
              <div className="flex flex-col items-center justify-center my-1">
                <div className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-300 drop-shadow">DOWNTOWN</div>
                <div className="flex items-center gap-2 text-3xl md:text-5xl font-black italic tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                  <span>LONDON</span>
                  <span className="w-8 h-8 md:w-11 md:h-11 rounded-full bg-slate-950 border-2 border-white flex items-center justify-center text-sm md:text-lg font-black not-italic text-white shadow-lg">
                    8
                  </span>
                  <span>PUB</span>
                </div>
              </div>

              {/* Match Stats Line */}
              <div className="flex items-center justify-center gap-6 my-2 text-xs md:text-sm font-bold text-slate-200">
                <div className="flex items-center gap-1">
                  <span>فوز:</span>
                  <span className="text-amber-400 font-black">4 🏆</span>
                </div>
                <div className="w-24 bg-slate-900 h-2 rounded-full border border-slate-700 overflow-hidden">
                  <div className="bg-amber-400 h-full w-1/3 rounded-full" />
                </div>
                <div className="flex items-center gap-1">
                  <span>خسارة:</span>
                  <span className="text-slate-400 font-black">0 🏆</span>
                </div>
              </div>

              {/* Prize Pot */}
              <div className="text-sm md:text-base font-black text-amber-300 mb-3 flex items-center justify-center gap-2">
                <span>الجائزة الكبرى:</span>
                <span className="text-emerald-400 font-mono text-lg font-black">5,000 🪙</span>
              </div>

              {/* Giant Glossy PLAY Button */}
              <button
                onClick={() => startMatch("8-ball", false, 100)}
                className="w-full max-w-xs mx-auto py-3 md:py-4 px-8 rounded-2xl font-black text-lg md:text-xl text-white shadow-[0_8px_25px_rgba(34,197,94,0.5)] border-2 border-emerald-300 bg-gradient-to-b from-emerald-400 via-emerald-600 to-emerald-800 hover:from-emerald-300 hover:to-emerald-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>PLAY</span>
                <span>▶️</span>
              </button>
            </div>

            {/* 3 Quick Mode Buttons */}
            <div className="grid grid-cols-3 gap-2.5 md:gap-4 w-full">
              <button
                onClick={() => setActiveModal("tournaments")}
                className="relative flex flex-col items-center justify-center py-3.5 px-2 rounded-2xl font-black text-xs md:text-sm text-white shadow-[0_6px_20px_rgba(220,38,38,0.35)] border border-rose-400/50 bg-gradient-to-b from-rose-500 via-rose-600 to-rose-800 hover:from-rose-400 hover:to-rose-700 active:scale-95 transition-all cursor-pointer"
              >
                <span className="text-xl md:text-2xl mb-1">⚡</span>
                <span>دورة سريعة</span>
              </button>

              <button
                onClick={() => startMatch("8-ball", true, 0)}
                className="relative flex flex-col items-center justify-center py-3.5 px-2 rounded-2xl font-black text-xs md:text-sm text-slate-950 shadow-[0_6px_20px_rgba(234,179,8,0.35)] border border-amber-300/60 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 hover:from-amber-200 hover:to-amber-500 active:scale-95 transition-all cursor-pointer"
              >
                <span className="text-xl md:text-2xl mb-1">🎯</span>
                <span>العب Trickshots</span>
              </button>

              <button
                onClick={() => setActiveModal("stake_select")}
                className="relative flex flex-col items-center justify-center py-3.5 px-2 rounded-2xl font-black text-xs md:text-sm text-white shadow-[0_6px_20px_rgba(37,99,235,0.35)] border border-blue-400/50 bg-gradient-to-b from-blue-500 via-blue-600 to-blue-800 hover:from-blue-400 hover:to-blue-700 active:scale-95 transition-all cursor-pointer"
              >
                <span className="text-xl md:text-2xl mb-1">👥</span>
                <span>العب مع الأصدقاء</span>
              </button>
            </div>

            {/* Friends Quick Challenge List */}
            <div className="w-full bg-slate-950/80 rounded-2xl border border-slate-800 p-3.5 shadow-xl">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <span className="text-xs font-black text-slate-200">الأصدقاء الذين يلعبون أيضاً كيو ماستر:</span>
                <span className="text-[10px] text-emerald-400 font-bold">متصلون الآن 🟢</span>
              </div>

              <div className="space-y-2">
                {[
                  { name: "Hamada", avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=HamadaPool", stake: 250 },
                  { name: "Mahamed", avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=MohamedPool", stake: 500 },
                  { name: "أحمد_البرنس", avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=AhmedEG", stake: 1000 },
                ].map((friend, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/90 border border-slate-800/80">
                    <div className="flex items-center gap-2.5">
                      <img src={friend.avatar} alt={friend.name} loading="lazy" className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 object-cover" />
                      <div>
                        <div className="text-xs font-black text-white">{friend.name}</div>
                        <div className="text-[10px] text-slate-400">رهان {friend.stake} 🪙</div>
                      </div>
                    </div>
                    <button
                      onClick={() => startMatch("8-ball", false, friend.stake)}
                      className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-white font-black text-xs cursor-pointer shadow active:scale-95"
                    >
                      العب
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </main>

          {/* Bottom Navigation Bar */}
          <footer className="relative z-10 flex items-center justify-around px-4 py-2 bg-slate-950/95 border-t border-slate-800">
            <button
              onClick={() => setCurrentView("menu")}
              className="flex flex-col items-center gap-0.5 text-cyan-400 font-bold cursor-pointer"
            >
              <span className="text-xl">🎱</span>
              <span className="text-[10px]">الرئيسية</span>
            </button>

            <button
              onClick={() => startMatch("8-ball", true, 0)}
              className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-amber-300 font-bold cursor-pointer"
            >
              <span className="text-xl">🎯</span>
              <span className="text-[10px]">تدريب</span>
            </button>

            <button
              onClick={() => setActiveModal("tournaments")}
              className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-amber-300 font-bold cursor-pointer"
            >
              <span className="text-xl">🏆</span>
              <span className="text-[10px]">البطولات</span>
            </button>

            <button
              onClick={() => { setShopTab("cues"); setActiveModal("shop"); }}
              className="relative flex flex-col items-center gap-0.5 text-amber-400 font-bold cursor-pointer"
            >
              <span className="text-xl">🛒</span>
              <span className="text-[10px]">المتجر</span>
              <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
            </button>
          </footer>
        </div>
      ) : (
        /* ========================================================= */
        /* VIEW 2: FULL WIDESCREEN TABLE (NO SCROLL, LEFT BAR + TOP BAR) */
        /* ========================================================= */
        <div
          dir="ltr"
          className="w-full h-full flex flex-col bg-[#020b14] overflow-hidden touch-none"
          style={
            isVirtualLandscape && isPortrait
              ? {
                position: "fixed",
                top: 0,
                left: 0,
                width: viewportSize.h ? `${viewportSize.h}px` : "100dvh",
                height: viewportSize.w ? `${viewportSize.w}px` : "100dvw",
                transform: `translateX(${viewportSize.w ? `${viewportSize.w}px` : "100dvw"}) rotate(90deg)`,
                transformOrigin: "top left",
                zIndex: 50,
              }
              : undefined
          }
        >
          {/* COMPACT TOP HUD BAR (Player, Spin Cue Ball "الكره", Controls, Opponent) */}
          <header className="h-11 sm:h-12 shrink-0 flex items-center justify-between gap-1.5 px-2 bg-slate-950/95 border-b border-slate-800/90 z-30">
            {/* Left Side: Human Player + Circular Timer */}
            <div className="flex items-center gap-1.5 min-w-0" dir="rtl">
              <div className="relative flex items-center justify-center shrink-0 w-9 h-9">
                <svg className="w-9 h-9 -rotate-90 pointer-events-none" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" fill="transparent" />
                  {turn === "human" && (
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      stroke={turnTimeLeft <= 5 ? "#ef4444" : turnTimeLeft <= 10 ? "#facc15" : "#22c55e"}
                      strokeWidth="2.5"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 15}
                      strokeDashoffset={2 * Math.PI * 15 * (1 - turnTimeLeft / turnTotalTime)}
                      strokeLinecap="round"
                    />
                  )}
                </svg>
                <img src={avatar} alt="You" className="absolute w-6 h-6 rounded-md bg-slate-800 border border-amber-400 object-cover" />
              </div>

              <div className="leading-tight min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-black text-amber-300 truncate max-w-[68px] sm:max-w-[100px]">{username}</span>
                  {turn === "human" && !isPractice && (
                    <span className={`text-[9px] font-black px-1 rounded font-mono ${turnTimeLeft <= 5 ? "bg-rose-500/25 text-rose-400" : "bg-emerald-500/20 text-emerald-300"
                      }`}>
                      {turnTimeLeft}s
                    </span>
                  )}
                </div>
                <div className="text-[9px] font-bold text-slate-300 truncate">
                  {humanGroup === "unassigned"
                    ? "مفتوحة"
                    : `${humanGroup === "solids" ? "سادة 🟡" : "ألوان 🔵"} (${humanRemainingBalls.length})`}
                </div>
              </div>
            </div>

            {/* Center Strip: Spin Cue Ball ("الكره") + Fine Aim + Target Pocket + Prize/Status */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              {/* Interactive Spin Cue Ball ("الكره") */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowPocketPopover(false);
                    setShowSpinPopover((prev) => !prev);
                  }}
                  className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-white via-slate-200 to-slate-400 border-2 shadow-inner flex items-center justify-center cursor-pointer active:scale-95 ${showSpinPopover ? "border-amber-300 ring-2 ring-amber-400/50" : "border-amber-500/80"
                    }`}
                  title="ضبط نقطة ضرب الكرة (اسكروه / توب سبن)"
                >
                  <div className="absolute w-full h-[1px] bg-slate-400/50 pointer-events-none" />
                  <div className="absolute h-full w-[1px] bg-slate-400/50 pointer-events-none" />
                  <div
                    className="w-2.5 h-2.5 bg-rose-600 rounded-full border border-white shadow pointer-events-none"
                    style={{ transform: `translate(${spinX * 10}px, ${spinY * 10}px)` }}
                  />
                </button>

                {/* Larger Touch-Friendly Spin Popover */}
                {showSpinPopover && (
                  <div
                    dir="rtl"
                    className="absolute top-11 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border-2 border-amber-400/80 rounded-2xl p-2.5 shadow-2xl flex flex-col items-center gap-1.5 w-32"
                  >
                    <span className="text-[10px] font-black text-amber-300">نقطة ضرب الكرة</span>
                    <div
                      onPointerDown={(e) => {
                        isSpinDraggingRef.current = true;
                        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { }
                        updateSpinFromPointer(e.clientX, e.clientY, e.currentTarget);
                      }}
                      onPointerMove={(e) => {
                        if (!isSpinDraggingRef.current) return;
                        updateSpinFromPointer(e.clientX, e.clientY, e.currentTarget);
                      }}
                      onPointerUp={(e) => {
                        isSpinDraggingRef.current = false;
                        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { }
                      }}
                      onPointerCancel={() => { isSpinDraggingRef.current = false; }}
                      className="relative w-20 h-20 rounded-full bg-gradient-to-br from-slate-50 via-slate-200 to-slate-400 border-2 border-amber-400 shadow-inner flex items-center justify-center touch-none cursor-pointer"
                    >
                      <div className="absolute w-full h-[1px] bg-slate-400/70 pointer-events-none" />
                      <div className="absolute h-full w-[1px] bg-slate-400/70 pointer-events-none" />
                      <div
                        className="w-4 h-4 bg-rose-600 rounded-full border-2 border-white shadow pointer-events-none"
                        style={{ transform: `translate(${spinX * 30}px, ${spinY * 30}px)` }}
                      />
                    </div>
                    <div className="flex items-center justify-between w-full gap-1">
                      <span className="text-[9px] font-bold text-slate-300">
                        {spinY < -0.2 ? "اسكروه 🔻" : spinY > 0.2 ? "توب 🔺" : "مركز"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          spinXRef.current = 0;
                          spinYRef.current = 0;
                          setSpinX(0);
                          setSpinY(0);
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[9px] font-bold text-amber-300 cursor-pointer"
                      >
                        تصفير
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Fine Aim Micro Controls */}
              <div className="flex items-center gap-0.5 bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const next = aimAngleRef.current - 0.012;
                    aimAngleRef.current = next;
                    setAimAngle(next);
                  }}
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 active:scale-90 text-amber-300 text-[10px] font-black flex items-center justify-center cursor-pointer"
                  title="تصويب دقيق يسار"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = aimAngleRef.current + 0.012;
                    aimAngleRef.current = next;
                    setAimAngle(next);
                  }}
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 active:scale-90 text-amber-300 text-[10px] font-black flex items-center justify-center cursor-pointer"
                  title="تصويب دقيق يمين"
                >
                  ▶
                </button>
              </div>

              {/* Target Pocket Quick Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowSpinPopover(false);
                    setShowPocketPopover((prev) => !prev);
                  }}
                  className="h-7 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-[10px] font-black text-amber-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  title="تحديد الجيب الهدف"
                >
                  <span>🎯</span>
                  <span className="hidden md:inline">{activePocketObj.name}</span>
                </button>

                {showPocketPopover && (
                  <div
                    dir="rtl"
                    className="absolute top-10 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border-2 border-amber-400/70 rounded-xl p-2 shadow-2xl grid grid-cols-3 gap-1 w-52"
                  >
                    {pockets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          calledPocketIdRef.current = p.id;
                          setCalledPocketId(p.id);
                          setShowPocketPopover(false);
                        }}
                        className={`px-1.5 py-1 rounded text-[9px] font-black cursor-pointer ${calledPocketId === p.id ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Concise Status + Prize Pill */}
              <div dir="rtl" className="hidden sm:flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1 max-w-[230px] lg:max-w-xs">
                <span className="text-[10px] font-black text-amber-400 shrink-0">{prize.toLocaleString()} 🪙</span>
                <span className="text-slate-600">|</span>
                <span className="text-[10px] font-bold text-amber-100 truncate">{turnMessage}</span>
              </div>
            </div>

            {/* Right Side: Opponent + Quick Buttons (Shop, Rotate, Exit) */}
            <div className="flex items-center gap-1.5">
              <div className="hidden md:block text-right leading-tight" dir="rtl">
                <div className="flex items-center gap-1 text-[11px] font-black text-slate-200">
                  <span>{opponentFlag}</span>
                  <span className="truncate max-w-[80px]">{opponentName}</span>
                </div>
                <div className="text-[9px] font-bold text-slate-400">
                  {isPractice ? "تدريب" : botGroup === "unassigned" ? "مفتوحة" : botGroup === "solids" ? "سادة 🟡" : "ألوان 🔵"}
                </div>
              </div>

              <div className="relative flex items-center justify-center shrink-0 w-9 h-9">
                <svg className="w-9 h-9 -rotate-90 pointer-events-none" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" fill="transparent" />
                  {turn === "bot" && (
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      stroke={turnTimeLeft <= 5 ? "#ef4444" : turnTimeLeft <= 10 ? "#facc15" : "#22c55e"}
                      strokeWidth="2.5"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 15}
                      strokeDashoffset={2 * Math.PI * 15 * (1 - turnTimeLeft / turnTotalTime)}
                      strokeLinecap="round"
                    />
                  )}
                </svg>
                <img src={opponentAvatar} alt="Opponent" className="absolute w-6 h-6 rounded-md bg-slate-800 border border-slate-700 object-cover" />
              </div>

              <button
                type="button"
                onClick={() => { setShopTab("cues"); setActiveModal("shop"); }}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/50 flex items-center justify-center text-amber-300 text-xs cursor-pointer"
                title="المتجر"
              >
                🛒
              </button>
              {isPortrait && (
                <button
                  type="button"
                  onClick={() => setIsVirtualLandscape(!isVirtualLandscape)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center text-xs cursor-pointer ${isVirtualLandscape ? "bg-cyan-500/20 text-cyan-300 border-cyan-400" : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  title="تبديل وضع الشاشة العريضة"
                >
                  🔄
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setGameOver(null);
                  setIsVirtualLandscape(false);
                  setCurrentView("menu");
                }}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/50 flex items-center justify-center text-rose-300 text-xs cursor-pointer"
                title="خروج للقائمة الرئيسية"
              >
                🚪
              </button>
            </div>
          </header>

          {/* Group Assignment Floating Toast */}
          {groupAnnouncement && (
            <div dir="rtl" className="absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border-2 border-amber-400 text-slate-100 px-4 py-1.5 rounded-xl shadow-2xl flex flex-col items-center pointer-events-none">
              <div className="text-[11px] font-black text-amber-300">{groupAnnouncement.title}</div>
              <div className="text-[10px] font-bold text-slate-200">
                أنت: <span className="text-amber-400">{groupAnnouncement.human}</span> | الخصم: <span className="text-slate-300">{groupAnnouncement.bot}</span>
              </div>
            </div>
          )}

          {/* MAIN WIDESCREEN STAGE: Small Left Power Strip + Full Widescreen Table */}
          <div className="flex-1 min-h-0 flex flex-row items-stretch overflow-hidden w-full">
            {/* 1. SMALL LEFT STRIP: Vertical Power Slider + Shoot Button */}
            <aside className="w-11 sm:w-13 shrink-0 flex flex-col items-center justify-between py-1.5 px-1 bg-slate-950/85 border-r border-slate-800/80 z-20 select-none">
              <div
                ref={powerTrackRef}
                onPointerDown={handlePowerPointerDown}
                onPointerMove={handlePowerPointerMove}
                onPointerUp={handlePowerPointerUp}
                onPointerCancel={handlePowerPointerCancel}
                className="relative flex-1 w-8 sm:w-9 min-h-[100px] bg-slate-900 rounded-xl border-2 border-emerald-500/70 shadow-inner cursor-pointer touch-none flex flex-col justify-start p-0.5 overflow-hidden"
              >
                {/* Segmented Markings (Top 0% -> Pull down to 100%) */}
                <div className="absolute inset-0 flex flex-col justify-between py-2 px-1 pointer-events-none opacity-40">
                  {[25, 50, 75, 100].map((val) => (
                    <div key={val} className="flex items-center justify-between w-full">
                      <div className="w-1.5 h-[1px] bg-white" />
                      <span className="text-[7px] font-mono text-white font-bold">{val}</span>
                      <div className="w-1.5 h-[1px] bg-white" />
                    </div>
                  ))}
                </div>

                {/* Dynamic Fill Bar (grows downward as user pulls down) */}
                <div
                  ref={powerFillRef}
                  className="w-full rounded-lg pointer-events-none"
                  style={{
                    height: `${power}%`,
                    background:
                      power > 75
                        ? "linear-gradient(to bottom, #f97316, #ef4444, #b91c1c)"
                        : power > 45
                          ? "linear-gradient(to bottom, #fde047, #f59e0b, #b45309)"
                          : "linear-gradient(to bottom, #6ee7b7, #10b981, #047857)",
                  }}
                />

                {/* Cue Tip Dragger Handle */}
                <div
                  ref={powerHandleRef}
                  className="absolute left-1/2 -translate-x-1/2 w-6 sm:w-7 h-5 rounded-md bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 border border-white shadow-lg flex items-center justify-center pointer-events-none"
                  style={{
                    top: `calc(${power}% - 10px)`,
                  }}
                >
                  <div className="w-3 h-0.5 bg-slate-900 rounded-full" />
                </div>
              </div>

              {/* Live Power % */}
              <div
                ref={powerTextRef}
                className="text-[9px] font-black font-mono text-amber-300 bg-slate-900 px-1 py-0.5 rounded border border-slate-700 my-1"
              >
                {power}%
              </div>

              {/* Quick Shoot Button */}
              <button
                type="button"
                onClick={() => handleShoot()}
                disabled={(!isPractice && turn !== "human") || isShooting || isBallInHand}
                className={`w-8 sm:w-9 h-8 rounded-lg font-black text-xs flex items-center justify-center shadow transition-transform active:scale-95 cursor-pointer ${(isPractice || turn === "human") && !isShooting && !isBallInHand
                    ? "bg-gradient-to-b from-emerald-400 to-emerald-700 text-white border border-emerald-300"
                    : "bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed opacity-50"
                  }`}
                title="اضرب الكرة"
              >
                🚀
              </button>
            </aside>

            {/* 2. MAIN WIDESCREEN TABLE CANVAS VIEWPORT (Fills 100% remaining space, zero scroll) */}
            <main
              ref={tableStageRef}
              className="relative flex-1 min-w-0 min-h-0 flex items-center justify-center p-1 overflow-hidden"
            >
              {/* Mobile-friendly Ball-In-Hand instruction pill */}
              {isBallInHand && (
                <div dir="rtl" className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-blue-950/95 border border-blue-400 text-blue-100 px-3 py-1 rounded-full text-[10px] font-black shadow-lg pointer-events-none whitespace-nowrap">
                  🧤 الكرة في يدك: اسحبها على الطاولة ثم ارفع إصبعك
                </div>
              )}

              {/* Compact Mobile Turn Message Pill (when sm: hidden in top bar) */}
              {!isBallInHand && (
                <div dir="rtl" className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 z-20 bg-slate-950/85 border border-slate-800 text-amber-200 px-2.5 py-0.5 rounded-full text-[9px] font-bold pointer-events-none max-w-[85%] truncate">
                  {turnMessage}
                </div>
              )}

              {/* Cinematic Letterbox Overlays */}
              {cinematicCam && (
                <>
                  <div dir="rtl" className="absolute top-0 left-0 right-0 z-30 h-8 bg-black/90 border-b border-amber-500/40 flex items-center justify-between px-4 pointer-events-none">
                    <span className="text-[10px] font-black text-red-500">🔴 REC | لقطة سينمائية</span>
                    <span className="text-[10px] font-black text-amber-300">🎬 POCKET CAM</span>
                    <span className="text-[10px] font-bold text-slate-300">جيب: {cinematicCam.pocket.name}</span>
                  </div>
                  <div dir="rtl" className="absolute bottom-0 left-0 right-0 z-30 h-8 bg-black/90 border-t border-amber-500/40 flex items-center justify-between px-4 pointer-events-none">
                    <span className="text-[10px] font-black text-emerald-400">🎯 SLOW MOTION 0.35x</span>
                    <span className="text-[10px] font-mono text-amber-400 font-extrabold">
                      {cinematicCam.ballNum === 8 ? "🏆 الكرة 8 الحاسمة!" : `كرة (${cinematicCam.ballNum})`}
                    </span>
                  </div>
                </>
              )}

              <div
                className="flex items-center justify-center transition-transform duration-700 ease-out"
                style={{
                  perspective: "900px",
                  transformOrigin: cinematicCam
                    ? `${(cinematicCam.pocket.x / TABLE_WIDTH) * 100}% ${(cinematicCam.pocket.y / TABLE_HEIGHT) * 100}%`
                    : "50% 50%",
                  transform: cinematicCam
                    ? `scale(2.15) rotateX(${cinematicCam.pocket.y < TABLE_HEIGHT / 2 ? "-40deg" : "40deg"})`
                    : "scale(1) rotateX(0deg)",
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={TABLE_WIDTH}
                  height={TABLE_HEIGHT}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerCancel={handleCanvasPointerCancel}
                  style={{
                    width: canvasDisplaySize.w > 0 ? `${canvasDisplaySize.w}px` : "100%",
                    height: canvasDisplaySize.h > 0 ? `${canvasDisplaySize.h}px` : "auto",
                    borderColor: currentTable.cushionGlow,
                    boxShadow: `0 0 24px ${currentTable.cushionGlow}33, 0 8px 28px rgba(0,0,0,0.85)`,
                  }}
                  className={`rounded-xl sm:rounded-2xl border-2 sm:border-4 touch-none select-none block ${isBallInHand ? "cursor-grab" : "cursor-crosshair"
                    }`}
                />
              </div>
            </main>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALS & GAME OVER (Matches virtual landscape orientation) */}
      {/* ========================================================= */}
      {(activeModal || gameOver) && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[60] overflow-hidden"
          style={
            currentView === "table" && isVirtualLandscape && isPortrait
              ? {
                top: 0,
                left: 0,
                right: "auto",
                bottom: "auto",
                width: viewportSize.h ? `${viewportSize.h}px` : "100dvh",
                height: viewportSize.w ? `${viewportSize.w}px` : "100dvw",
                transform: `translateX(${viewportSize.w ? `${viewportSize.w}px` : "100dvw"}) rotate(90deg)`,
                transformOrigin: "top left",
              }
              : undefined
          }
        >
          {/* SHOP & INVENTORY MODAL */}
          {activeModal === "shop" && (
            <div className="w-full h-full flex items-center justify-center bg-black/85 p-2 sm:p-5 overflow-hidden">
              <div className="bg-[#0b121e] border-2 border-amber-500/50 rounded-3xl w-full max-w-4xl max-h-full flex flex-col shadow-2xl relative overflow-hidden">
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
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${shopTab === "cues"
                        ? "bg-amber-400 text-slate-950 shadow-md"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                  >
                    <span>🎱</span>
                    <span>عصيان البلياردو (20 عصا)</span>
                  </button>
                  <button
                    onClick={() => setShopTab("tables")}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${shopTab === "tables"
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${cueCategoryFilter === "all" ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"
                            }`}
                        >
                          الكل (20)
                        </button>
                        <button
                          onClick={() => setCueCategoryFilter("classic")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${cueCategoryFilter === "classic" ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"
                            }`}
                        >
                          🌟 الفئة الاحترافية والكلاسيكية (10)
                        </button>
                        <button
                          onClick={() => setCueCategoryFilter("legendary")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${cueCategoryFilter === "legendary" ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"
                            }`}
                        >
                          ⚡ الفئة الأسطورية وخوارق الطبيعة (10)
                        </button>
                      </div>

                      {/* ACTIVE EQUIPPED CUE HERO BANNER */}
                      <div className="w-full bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/40 border-2 border-amber-400/60 rounded-2xl p-4 shadow-xl mb-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full font-black">
                              العصا المجهزة حالياً ⚡
                            </span>
                            <h4 className="text-sm font-black text-amber-300">{activeCue.nameAr}</h4>
                            <span className="text-xs text-slate-400 font-mono">({activeCue.nameEn})</span>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                            {activeCue.specialPerkAr}
                          </span>
                        </div>

                        {/* Full Length High-Def Cue Showcase */}
                        <div className="relative w-full h-14 bg-slate-950/90 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-slate-800 shadow-inner">
                          <img
                            src={activeCue.image}
                            alt={activeCue.nameAr}
                            className="w-full h-full object-contain filter drop-shadow-[0_2px_10px_rgba(251,191,36,0.5)]"
                          />
                        </div>
                      </div>

                      {/* Cues Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {ALL_CUES.filter((c) => cueCategoryFilter === "all" || c.category === cueCategoryFilter).map((cue) => {
                          const isEquipped = selectedCue === cue.id;
                          const isUnlocked = unlockedCues.includes(cue.id);

                          return (
                            <div
                              key={cue.id}
                              className={`relative flex flex-col justify-between p-4 rounded-2xl border transition-all ${isEquipped
                                  ? "bg-amber-500/10 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.25)]"
                                  : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                                }`}
                            >
                              {/* Cue Image Showcase with Full Length & Radiant Sheen */}
                              <div className="relative w-full h-14 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-xl overflow-hidden flex items-center justify-center px-2 py-1 border border-slate-800/90 mb-3 shadow-inner">
                                <img
                                  src={cue.image}
                                  alt={cue.nameAr}
                                  loading="lazy"
                                  className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] hover:scale-105 transition-transform"
                                />
                              </div>

                              {/* Cue Title & Category Badge */}
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <div className="text-sm font-black text-white">{cue.nameAr}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{cue.nameEn}</div>
                                </div>
                                <span
                                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cue.category === "legendary"
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
                                  className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow ${isEquipped
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
                              className={`relative flex flex-col justify-between p-4 rounded-2xl border transition-all ${isEquipped
                                  ? "bg-amber-500/10 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.25)]"
                                  : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                                }`}
                            >
                              {/* Table Image Preview */}
                              <div className="w-full h-32 rounded-xl overflow-hidden border border-slate-800 relative bg-slate-900 mb-3">
                                {table.image ? (
                                  <img src={table.image} alt={table.nameAr} loading="lazy" className="w-full h-full object-cover" />
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
                                className={`w-full py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow ${isEquipped
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

          {/* SETTINGS MODAL */}
          {activeModal === "settings" && (
            <div className="w-full h-full flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
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

          {/* TOURNAMENTS MODAL */}
          {activeModal === "tournaments" && (
            <div className="w-full h-full flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
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

          {/* STAKE SELECT MODAL */}
          {activeModal === "stake_select" && (
            <div className="w-full h-full flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
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

          {/* LEADERBOARD MODAL */}
          {activeModal === "leaderboard" && (
            <div className="w-full h-full flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
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

          {/* GAME OVER MODAL */}
          {gameOver && (
            <div className="w-full h-full flex items-center justify-center bg-black/85 p-4">
              <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 w-full max-w-md text-center shadow-2xl space-y-4">
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
                      setIsVirtualLandscape(false);
                      setCurrentView("menu");
                      try {
                        if (typeof window !== "undefined" && window.parent && window.parent !== window) {
                          window.parent.postMessage({ type: "CLOSE_GAME" }, "*");
                        }
                      } catch { }
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
      )}
    </div>
  );
}
