"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ALL_CUES, ALL_TABLES, CueItem, TableItem } from "@/config/shopData";
import {
  ActiveModalType,
  Ball,
  BallGroup,
  CORNER_POCKET_IDS,
  CinematicCamState,
  GameMode,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  getBreakLineX,
  getMatchDifficulty,
  getModeBallRadius,
  getSnookerTargetInfo,
} from "@/types/billiards";
import {
  playBallClack,
  playCinematicWhoosh,
  playCueStrike,
  playFoulBuzzer,
  playSuccessChime,
  unlockAudio,
} from "@/utils/audio";
import {
  clampBallInHandPos,
  computeBotShot,
  findFreeCueBallPos,
  getCueForceMultiplier,
  initBallsRack,
  moveBreakCueBall,
  placeCueBallSafely,
  stepPhysics,
} from "@/engine/physics";
import { resolveShotOutcome } from "@/engine/rules";
import { createBallGlossCanvas, renderTableScene } from "@/engine/renderer";
import { IntroVideo } from "@/components/IntroVideo";
import { ModeSelectTriangles } from "@/components/ModeSelectTriangles";
import { Lobby } from "@/components/Lobby";
import { MatchedOpponentInfo, MatchmakingOverlay } from "@/components/MatchmakingOverlay";
import { ShopModal } from "@/components/ShopModal";
import { GameModals } from "@/components/GameModals";
import { TableHUD } from "@/components/TableHUD";
import { PowerMeter } from "@/components/PowerMeter";
import { TableEntranceOverlay } from "@/components/TableEntranceOverlay";

const HAND_OPEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M10.5 13V6.5a1.5 1.5 0 0 1 3 0V12m0-6.5a1.5 1.5 0 0 1 3 0V12m0-5a1.5 1.5 0 0 1 3 0v6.5m0-4.5a1.5 1.5 0 0 1 3 0v7.2c0 4.3-3.1 7.8-7.5 7.8-3.4 0-5.7-1.9-7.4-4.8l-2.3-3.8a1.4 1.4 0 0 1 2.2-1.7L9 14.8V13Z" fill="#ffffff" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const HAND_GRAB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M8.5 14.5v-3a1.5 1.5 0 0 1 3 0v1m0-2a1.5 1.5 0 0 1 3 0v2m0-1.5a1.5 1.5 0 0 1 3 0v2m0-.5a1.5 1.5 0 0 1 3 0v4.8c0 4-3 7.2-7 7.2-3.2 0-5.5-1.8-6.8-4.5l-1.5-3.2a1.4 1.4 0 0 1 2.3-1.5l1.5 1.7Z" fill="#fde047" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CURSOR_HAND_OPEN = `url("data:image/svg+xml,${encodeURIComponent(HAND_OPEN_SVG)}") 14 14, grab`;
const CURSOR_HAND_GRAB = `url("data:image/svg+xml,${encodeURIComponent(HAND_GRAB_SVG)}") 14 14, grabbing`;

export default function BilliardsStandalonePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-[#020b14] text-amber-400 font-bold">
          جاري تحميل كيو ماستر (Cue Master)...
        </div>
      }
    >
      <CueMasterApp />
    </Suspense>
  );
}

function CueMasterApp() {
  const searchParams = useSearchParams();
  const username = searchParams.get("username") || "لاعب 1";
  const avatar =
    searchParams.get("avatar") || "https://api.dicebear.com/7.x/bottts/svg?seed=CueMaster";
  const initialStake = parseInt(searchParams.get("stake") || "100");
  const initialPrize = parseInt(searchParams.get("prize") || "190");
  const initialMode = (searchParams.get("mode") as GameMode) || "8-ball";
  const initialOpponentName = searchParams.get("opponentName") || "أحمد_البرنس";
  const initialOpponentAvatar =
    searchParams.get("opponentAvatar") || "https://api.dicebear.com/7.x/bottts/svg?seed=AhmedEG";
  const initialOpponentFlag = searchParams.get("opponentFlag") || "🇪🇬";

  // Active Matchmaking & Opponent State
  const [matchmakingPending, setMatchmakingPending] = useState<{ mode: GameMode; stake: number } | null>(null);
  const [opponentName, setOpponentName] = useState(initialOpponentName);
  const [opponentAvatar, setOpponentAvatar] = useState(initialOpponentAvatar);
  const [opponentFlag, setOpponentFlag] = useState(initialOpponentFlag);

  // Navigation & Modals
  const [currentView, setCurrentView] = useState<"intro" | "mode_select" | "menu" | "table">("intro");
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);

  // Shop & Inventory
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
  const [slowMoEnabled, setSlowMoEnabled] = useState(true);

  // Match State
  const [mode, setMode] = useState<GameMode>(initialMode);
  const [isPractice, setIsPractice] = useState(false);
  const [stake, setStake] = useState(initialStake);
  const [prize, setPrize] = useState(initialPrize);
  const [ballsVersion, setBallsVersion] = useState(0);
  const [humanGroup, setHumanGroup] = useState<BallGroup>("unassigned");
  const [botGroup, setBotGroup] = useState<BallGroup>("unassigned");
  const [groupAnnouncement, setGroupAnnouncement] = useState<{
    title: string;
    human: string;
    bot: string;
  } | null>(null);

  const [calledPocketId, setCalledPocketId] = useState<number | null>(null);
  const [oneFifteenUncalledCount, setOneFifteenUncalledCount] = useState<0 | 1>(0);
  const [oneFifteenHumanEightPocket, setOneFifteenHumanEightPocket] = useState<number | null>(null);
  const [oneFifteenBotEightPocket, setOneFifteenBotEightPocket] = useState<number | null>(null);
  const [awaitingOneFifteenPocketPick, setAwaitingOneFifteenPocketPick] = useState(false);
  const [pottedBallsHistory, setPottedBallsHistory] = useState<Ball[]>([]);
  const [isBallInHand, setIsBallInHand] = useState(false);
  const [isBreakShot, setIsBreakShot] = useState(true);
  const [humanScore, setHumanScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [snookerOnColorAfterRed, setSnookerOnColorAfterRed] = useState(false);
  const [spinX, setSpinX] = useState(0);
  const [spinY, setSpinY] = useState(0);
  const [showSpinPopover, setShowSpinPopover] = useState(false);
  const [showPocketPopover, setShowPocketPopover] = useState(false);
  const [turn, setTurn] = useState<"human" | "bot">("human");
  const [turnMessage, setTurnMessage] = useState("طاولة مفتوحة: أسقط أي كرة لتحديد صنفك!");
  const [power, setPower] = useState(0);
  const [isShooting, setIsShooting] = useState(false);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [cinematicCam, setCinematicCam] = useState<CinematicCamState | null>(null);
  const [showTableEntrance, setShowTableEntrance] = useState(false);

  // Orientation & Responsive Sizing
  const [isPortrait, setIsPortrait] = useState(false);
  const [isVirtualLandscape, setIsVirtualLandscape] = useState(false);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [canvasDisplaySize, setCanvasDisplaySize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // DOM & Engine Refs
  const tableStageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const powerTrackRef = useRef<HTMLDivElement | null>(null);
  const powerFillRef = useRef<HTMLDivElement | null>(null);
  const powerHandleRef = useRef<HTMLDivElement | null>(null);
  const powerTextRef = useRef<HTMLDivElement | null>(null);

  const ballsRef = useRef<Ball[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const glossCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const proceduralTableCacheRef = useRef<Record<string, HTMLCanvasElement>>({});
  const cueImageCacheRef = useRef<Record<string, HTMLImageElement>>({});
  const tableImageCacheRef = useRef<Record<string, HTMLImageElement>>({});

  // Gesture & Shot Refs
  const isAimDraggingRef = useRef(false);
  const isPullBackShootingRef = useRef(false);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartAimAngleRef = useRef(0);
  const isDraggingBallInHandRef = useRef(false);
  const isDraggingBreakCueRef = useRef(false);
  const isHoveringBreakCueRef = useRef(false);
  const isSpinDraggingRef = useRef(false);
  const isVerticalMeterDraggingRef = useRef(false);
  const aimAngleRef = useRef(0);
  const powerRef = useRef(0);
  const spinXRef = useRef(0);
  const spinYRef = useRef(0);
  const calledPocketIdRef = useRef<number | null>(null);
  const activeShotCalledPocketRef = useRef<number | null>(null);
  const activeShotAimAngleRef = useRef(0);
  const spinAppliedInCurrentShotRef = useRef(false);
  const isShootingRef = useRef(false);
  const botAimVisibleRef = useRef(false);
  const isBallInHandRef = useRef(false);
  const mustShootForwardFromBaulkRef = useRef(false);
  const oneFifteenUncalledCountRef = useRef<0 | 1>(0);
  const oneFifteenHumanEightPocketRef = useRef<number | null>(null);
  const oneFifteenBotEightPocketRef = useRef<number | null>(null);
  const awaitingOneFifteenPocketPickRef = useRef(false);
  const isHoveringBallInHandRef = useRef(false);
  const aimAngleHistoryRef = useRef<{ angle: number; time: number }[]>([]);
  const isBreakShotRef = useRef(true);
  const wasBreakShotRef = useRef(false);
  const ballInHandHoverPosRef = useRef<{ x: number; y: number } | null>(null);
  const turnRef = useRef<"human" | "bot">("human");
  const humanGroupRef = useRef<BallGroup>("unassigned");
  const botGroupRef = useRef<BallGroup>("unassigned");
  const humanScoreRef = useRef(0);
  const botScoreRef = useRef(0);
  const snookerOnColorAfterRedRef = useRef(false);
  const soundEnabledRef = useRef(true);
  const aimAssistLongRef = useRef(true);
  const slowMoEnabledRef = useRef(true);
  const selectedCueRef = useRef("cue_maple_standard");
  const selectedTableRef = useRef("classic");
  const modeRef = useRef<GameMode>(initialMode);
  const isPracticeRef = useRef(false);
  const stakeRef = useRef(initialStake);
  const prizeRef = useRef(initialPrize);
  const coinsRef = useRef(85000);
  const cinematicCamRef = useRef<CinematicCamState | null>(null);
  const cinematicTriggeredThisShotRef = useRef(false);
  const cinematicTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slowMoScaleRef = useRef(1.0);
  const slowMoTargetScaleRef = useRef(1.0);
  const shotsSinceSlowMoRef = useRef(3);
  const shotStartPosRef = useRef({ x: 200, y: 225 });
  const firstBallHitInShotRef = useRef<Ball | null>(null);
  const pottedInCurrentShotRef = useRef<{ ball: Ball; pocketId: number }[]>([]);
  const pottedBallsHistoryRef = useRef<Ball[]>([]);
  const cueScratchedInShotRef = useRef(false);

  // Sync React state -> refs
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { aimAssistLongRef.current = aimAssistLong; }, [aimAssistLong]);
  useEffect(() => { slowMoEnabledRef.current = slowMoEnabled; }, [slowMoEnabled]);
  useEffect(() => { selectedCueRef.current = selectedCue; }, [selectedCue]);
  useEffect(() => { selectedTableRef.current = selectedTable; }, [selectedTable]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { isPracticeRef.current = isPractice; }, [isPractice]);
  useEffect(() => { stakeRef.current = stake; }, [stake]);
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
  useEffect(() => { oneFifteenHumanEightPocketRef.current = oneFifteenHumanEightPocket; }, [oneFifteenHumanEightPocket]);
  useEffect(() => { oneFifteenBotEightPocketRef.current = oneFifteenBotEightPocket; }, [oneFifteenBotEightPocket]);
  useEffect(() => { awaitingOneFifteenPocketPickRef.current = awaitingOneFifteenPocketPick; }, [awaitingOneFifteenPocketPick]);

  const activeCue = ALL_CUES.find((c) => c.id === selectedCue) || ALL_CUES[0];
  const currentTable = ALL_TABLES.find((t) => t.id === selectedTable) || ALL_TABLES[0];
  const turnTotalTime = activeCue?.stats?.time || 30;
  const [turnTimeLeft, setTurnTimeLeft] = useState(turnTotalTime);

  // Storage & Viewport Orientation
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
      const sSlowMo = localStorage.getItem("cuemaster_slowmo_enabled");
      if (sSlowMo !== null) {
        const parsed = sSlowMo !== "false";
        setSlowMoEnabled(parsed);
        slowMoEnabledRef.current = parsed;
      }
    } catch {}

    const updateOrientation = () => {
      const vw = window.visualViewport ? Math.round(window.visualViewport.width) : window.innerWidth;
      const vh = window.visualViewport ? Math.round(window.visualViewport.height) : window.innerHeight;
      setViewportSize({ w: vw, h: vh });
      const portrait = vh > vw && vw < 920;
      setIsPortrait(portrait);
      if (portrait) setIsVirtualLandscape((prev) => prev || currentView === "table");
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

  // Lazy-load ONLY active table & cue images
  useEffect(() => {
    const tbl = ALL_TABLES.find((t) => t.id === selectedTable);
    if (tbl?.image && !tableImageCacheRef.current[tbl.id]) {
      const img = new Image();
      img.src = tbl.image;
      img.onload = () => { tableImageCacheRef.current[tbl.id] = img; };
    }
    const cue = ALL_CUES.find((c) => c.id === selectedCue);
    if (cue?.image && !cueImageCacheRef.current[cue.id]) {
      const img = new Image();
      img.src = cue.image;
      img.onload = () => { cueImageCacheRef.current[cue.id] = img; };
    }
  }, [selectedTable, selectedCue]);

  // Fit exact 2:1 Canvas inside available widescreen space
  useEffect(() => {
    if (currentView !== "table") return;
    const el = tableStageRef.current;
    if (!el) return;

    const computeSize = () => {
      const rect = el.getBoundingClientRect();
      const availW = isVirtualLandscape && isPortrait ? rect.height : rect.width;
      const availH = isVirtualLandscape && isPortrait ? rect.width : rect.height;
      const padW = Math.max(0, availW - 8);
      const padH = Math.max(0, availH - 8);
      if (padW <= 0 || padH <= 0) return;
      const w = Math.floor(Math.min(padW, padH * 2));
      setCanvasDisplaySize({ w, h: Math.floor(w / 2) });
    };

    computeSize();
    const ro = new ResizeObserver(computeSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [currentView, isVirtualLandscape, isPortrait, viewportSize]);

  const saveCoins = (val: number) => {
    coinsRef.current = val;
    setCoins(val);
    try { localStorage.setItem("cuemaster_coins", val.toString()); } catch {}
  };

  const saveGems = (val: number) => {
    setGems(val);
    try { localStorage.setItem("cuemaster_gems", val.toString()); } catch {}
  };

  const getActiveGeom = () =>
    (ALL_TABLES.find((t) => t.id === selectedTableRef.current) || ALL_TABLES[0]).geometry;

  const handleTurnTimeout = () => {
    if (soundEnabledRef.current) playFoulBuzzer();
    const activeGeom = getActiveGeom();
    const baulkMaxX =
      modeRef.current === "snooker" || modeRef.current === "one-fifteen"
        ? getBreakLineX(modeRef.current, activeGeom)
        : undefined;
    isBreakShotRef.current = false;
    isDraggingBreakCueRef.current = false;
    setIsBreakShot(false);
    if (modeRef.current === "snooker") {
      snookerOnColorAfterRedRef.current = false;
      setSnookerOnColorAfterRed(false);
    }

    if (!isPracticeRef.current) {
      const nextTurn = turnRef.current === "human" ? "bot" : "human";
      oneFifteenUncalledCountRef.current = 0;
      setOneFifteenUncalledCount(0);
      if (nextTurn === "human") {
        ballInHandHoverPosRef.current = findFreeCueBallPos(ballsRef.current, activeGeom, baulkMaxX);
        isBallInHandRef.current = true;
        mustShootForwardFromBaulkRef.current = modeRef.current === "one-fifteen";
        setIsBallInHand(true);
        turnRef.current = "human";
        setTurn("human");
        setTurnMessage(
          baulkMaxX !== undefined
            ? "⏱️ انتهى وقت الخصم! ضع الكرة البيضاء خلف الخط والعب للأمام"
            : "⏱️ انتهى وقت الخصم! الفاول لصالحك، اسحب الكرة البيضاء في أي مكان!"
        );
      } else {
        placeCueBallSafely(ballsRef.current, activeGeom, baulkMaxX);
        isBallInHandRef.current = false;
        mustShootForwardFromBaulkRef.current = modeRef.current === "one-fifteen";
        setIsBallInHand(false);
        turnRef.current = "bot";
        setTurn("bot");
        setTurnMessage("⚠️ انتهى وقتك! الكرة في يد الخصم.");
      }
    } else {
      oneFifteenUncalledCountRef.current = 0;
      setOneFifteenUncalledCount(0);
      ballInHandHoverPosRef.current = findFreeCueBallPos(ballsRef.current, activeGeom, baulkMaxX);
      isBallInHandRef.current = true;
      mustShootForwardFromBaulkRef.current = modeRef.current === "one-fifteen";
      setIsBallInHand(true);
      setTurnMessage("⏱️ انتهى وقت التصويب في التدريب!");
    }
  };

  useEffect(() => {
    if (currentView !== "table" || isShooting || gameOver || isPractice || showTableEntrance) return;
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
  }, [currentView, turn, isShooting, gameOver, isPractice, turnTotalTime, showTableEntrance]);

  const initBalls = (currentMode: GameMode) => {
    ballsRef.current = initBallsRack(currentMode, getActiveGeom());
    humanGroupRef.current = "unassigned";
    botGroupRef.current = "unassigned";
    humanScoreRef.current = 0;
    botScoreRef.current = 0;
    snookerOnColorAfterRedRef.current = false;
    turnRef.current = "human";
    isBallInHandRef.current = false;
    mustShootForwardFromBaulkRef.current = false;
    oneFifteenUncalledCountRef.current = 0;
    setOneFifteenUncalledCount(0);
    oneFifteenHumanEightPocketRef.current = null;
    oneFifteenBotEightPocketRef.current = null;
    setOneFifteenHumanEightPocket(null);
    setOneFifteenBotEightPocket(null);
    awaitingOneFifteenPocketPickRef.current = false;
    setAwaitingOneFifteenPocketPick(false);
    pottedBallsHistoryRef.current = [];
    setPottedBallsHistory([]);
    aimAngleHistoryRef.current = [];
    isBreakShotRef.current = true;
    isDraggingBreakCueRef.current = false;
    isShootingRef.current = false;
    botAimVisibleRef.current = false;
    ballInHandHoverPosRef.current = null;
    calledPocketIdRef.current = null;
    aimAngleRef.current = 0;
    powerRef.current = 0;
    setHumanGroup("unassigned");
    setBotGroup("unassigned");
    setHumanScore(0);
    setBotScore(0);
    setSnookerOnColorAfterRed(false);
    setGroupAnnouncement(null);
    setTurn("human");
    setTurnMessage(
      currentMode === "snooker"
        ? "🔴 ضربة البداية: حرّك الكرة البيضاء باليد خلف الخط وصوّب على المثلث!"
        : currentMode === "one-fifteen"
        ? "🟡 1 و 15: حرّك الكرة البيضاء باليد خلف الخط واضرب المثلث!"
        : "🎱 ضربة البداية: حرّك الكرة البيضاء باليد خلف الخط وصوّب على المثلث!"
    );
    wasBreakShotRef.current = false;
    setIsBallInHand(false);
    setIsBreakShot(true);
    setIsShooting(false);
    setCalledPocketId(null);
    setPower(0);
    setBallsVersion((v) => v + 1);
    firstBallHitInShotRef.current = null;
    pottedInCurrentShotRef.current = [];
    cueScratchedInShotRef.current = false;
    isHoveringBreakCueRef.current = false;
    shotsSinceSlowMoRef.current = 3;
    slowMoScaleRef.current = 1.0;
    slowMoTargetScaleRef.current = 1.0;
  };

  const triggerGameOver = (winner: "human" | "bot", message: string) => {
    setGameOver(message);
    const curCue = ALL_CUES.find((c) => c.id === selectedCueRef.current) || ALL_CUES[0];
    const curPrize = prizeRef.current;
    if (winner === "human" && curPrize > 0) {
      const perkBonus = curCue.id === "cue_royal_ruby" ? Math.round(curPrize * 1.15) : curPrize;
      saveCoins(coinsRef.current + perkBonus);
      if (soundEnabledRef.current) playSuccessChime();
    } else if (winner === "human" && soundEnabledRef.current) {
      playSuccessChime();
    }
    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: "GAME_OVER", game: "billiards", winner, coins: winner === "human" ? curPrize : 0, isHuman: winner === "human" },
        "*"
      );
    }
  };

  // Shop Actions
  const handleEquipCue = (cueId: string) => {
    selectedCueRef.current = cueId;
    setSelectedCue(cueId);
    try { localStorage.setItem("cuemaster_selected_cue", cueId); } catch {}
    if (soundEnabledRef.current) playSuccessChime();
  };

  const handleBuyCue = (cue: CueItem) => {
    if (unlockedCues.includes(cue.id)) return handleEquipCue(cue.id);
    if (coins < cue.price) return alert("❌ رصيدك من الكوينز غير كافٍ!");
    const next = [...unlockedCues, cue.id];
    saveCoins(coins - cue.price);
    setUnlockedCues(next);
    selectedCueRef.current = cue.id;
    setSelectedCue(cue.id);
    try {
      localStorage.setItem("cuemaster_unlocked_cues", JSON.stringify(next));
      localStorage.setItem("cuemaster_selected_cue", cue.id);
    } catch {}
    if (soundEnabledRef.current) playSuccessChime();
  };

  const handleEquipTable = (tableId: string) => {
    selectedTableRef.current = tableId;
    setSelectedTable(tableId);
    try { localStorage.setItem("cuemaster_selected_table", tableId); } catch {}
    if (soundEnabledRef.current) playSuccessChime();
  };

  const handleBuyTable = (tbl: TableItem) => {
    if (unlockedTables.includes(tbl.id)) return handleEquipTable(tbl.id);
    if (coins < tbl.price) return alert("❌ رصيدك من الكوينز غير كافٍ لشراء هذه الطاولة!");
    const next = [...unlockedTables, tbl.id];
    saveCoins(coins - tbl.price);
    setUnlockedTables(next);
    selectedTableRef.current = tbl.id;
    setSelectedTable(tbl.id);
    try {
      localStorage.setItem("cuemaster_unlocked_tables", JSON.stringify(next));
      localStorage.setItem("cuemaster_selected_table", tbl.id);
    } catch {}
    if (soundEnabledRef.current) playSuccessChime();
  };

  // Main Delta-Time Physics & Canvas Render Loop (Guaranteed continuous rAF!)
  useEffect(() => {
    if (currentView !== "table") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    if (!glossCanvasRef.current) {
      glossCanvasRef.current = createBallGlossCanvas();
    }

    const clearCinematicCam = () => {
      if (cinematicTimerRef.current) {
        clearTimeout(cinematicTimerRef.current);
        cinematicTimerRef.current = null;
      }
      slowMoTargetScaleRef.current = 1.0;
      if (cinematicCamRef.current) {
        cinematicCamRef.current = null;
        setCinematicCam(null);
      }
    };

    let lastFrameTime = performance.now();

    const frameLoop = (now: number) => {
      const rawDt = now - lastFrameTime;
      lastFrameTime = now;
      const dtNorm = Math.min(2.2, Math.max(0.2, rawDt / 16.6667));

      // Smoothly interpolate real-time slow-motion scale (0.20 slow-mo <-> 1.0 normal)
      const targetScale = slowMoEnabledRef.current ? slowMoTargetScaleRef.current : 1.0;
      const lerpRate = targetScale < slowMoScaleRef.current ? 0.22 : 0.085;
      slowMoScaleRef.current += (targetScale - slowMoScaleRef.current) * lerpRate;
      if (Math.abs(slowMoScaleRef.current - targetScale) < 0.005) {
        slowMoScaleRef.current = targetScale;
      }
      const slowMoIntensity = Math.max(0, Math.min(1, (1 - slowMoScaleRef.current) / 0.8));

      // If featured ball slowed down or missed cleanly while in slow-mo, release smoothly
      if (cinematicCamRef.current && slowMoTargetScaleRef.current < 1.0 && cinematicCamRef.current.ballId !== undefined) {
        const feat = ballsRef.current.find((b) => b.id === cinematicCamRef.current?.ballId);
        if (feat && !feat.isPotted && Math.hypot(feat.vx, feat.vy) < 0.4) {
          slowMoTargetScaleRef.current = 1.0;
        }
      }

      const tableCfg = ALL_TABLES.find((t) => t.id === selectedTableRef.current) || ALL_TABLES[0];
      const activeCueObj = ALL_CUES.find((c) => c.id === selectedCueRef.current) || ALL_CUES[0];
      const matchDiff = getMatchDifficulty(stakeRef.current, isPracticeRef.current, modeRef.current);

      renderTableScene({
        ctx,
        balls: ballsRef.current,
        tableCfg,
        activeCueObj,
        mode: modeRef.current,
        turn: turnRef.current,
        isPractice: isPracticeRef.current,
        isShooting: isShootingRef.current,
        isBreakShot: isBreakShotRef.current,
        isBotAiming: botAimVisibleRef.current,
        isBallInHand: isBallInHandRef.current,
        mustShootForwardFromBaulk: mustShootForwardFromBaulkRef.current,
        ballInHandHoverPos: ballInHandHoverPosRef.current,
        isDraggingBall: isDraggingBallInHandRef.current || isDraggingBreakCueRef.current,
        isHoveringBreakCue: isHoveringBreakCueRef.current,
        slowMoCam: cinematicCamRef.current,
        slowMoIntensity,
        calledPocketId: calledPocketIdRef.current,
        oneFifteenHumanEightPocket: oneFifteenHumanEightPocketRef.current,
        oneFifteenBotEightPocket: oneFifteenBotEightPocketRef.current,
        awaitingOneFifteenPocketPick: awaitingOneFifteenPocketPickRef.current,
        humanGroup: humanGroupRef.current,
        snookerTarget: getSnookerTargetInfo(ballsRef.current, snookerOnColorAfterRedRef.current),
        aimAngle: aimAngleRef.current,
        power: powerRef.current,
        spinX: spinXRef.current,
        spinY: spinYRef.current,
        aimAssistLong: aimAssistLongRef.current,
        aimScale: matchDiff.aimScale,
        maxAimDistCap: matchDiff.maxAimDistCap,
        targetLineScale: matchDiff.targetLineScale,
        glossCanvas: glossCanvasRef.current,
        tableImageCache: tableImageCacheRef.current,
        cueImageCache: cueImageCacheRef.current,
        proceduralTableCache: proceduralTableCacheRef.current,
      });

      const isHumanTurn = turnRef.current === "human" || isPracticeRef.current;
      const anyMoving = stepPhysics({
        balls: ballsRef.current,
        dtNorm,
        timeScale: slowMoScaleRef.current,
        tableCfg,
        cueActive: activeCueObj,
        soundEnabled: soundEnabledRef.current,
        activeShotCalledPocketId: activeShotCalledPocketRef.current,
        activeShotAimAngle: activeShotAimAngleRef.current,
        spinX: isHumanTurn ? spinXRef.current : 0,
        spinY: isHumanTurn ? spinYRef.current : 0,
        spinAppliedRef: spinAppliedInCurrentShotRef,
        firstBallHitRef: firstBallHitInShotRef,
        callbacks: {
          onPotentialCinematic: (pocket, ball, reason) => {
            if (!slowMoEnabledRef.current || cinematicTriggeredThisShotRef.current) return;
            if (wasBreakShotRef.current && ball.number !== 8) return;

            const shotDist = Math.hypot(
              shotStartPosRef.current.x - pocket.x,
              shotStartPosRef.current.y - pocket.y
            );
            const isDecisive =
              reason === "eight" ||
              reason === "snooker_final" ||
              (modeRef.current === "one-fifteen" && (ball.number === 1 || ball.number === 15));
            const isSpecialPlay =
              isDecisive ||
              reason === "bank" ||
              (reason === "called" && shotDist > 290) ||
              shotDist > 375;

            if (!isSpecialPlay) return;

            const minShotsCooldown = isDecisive ? 1 : 3;
            if (shotsSinceSlowMoRef.current < minShotsCooldown) return;

            cinematicTriggeredThisShotRef.current = true;
            shotsSinceSlowMoRef.current = 0;

            const reasonLabel =
              reason === "eight"
                ? "🏆 الكرة الحاسمة 8"
                : reason === "bank"
                ? "🎯 ارتداد / بند رائع"
                : reason === "snooker_final"
                ? "👑 كرة الحسم النهائية"
                : reason === "called"
                ? "🎯 الجيب المحدد بدقة"
                : "🔥 تسديدة بعيدة مميزة";

            const camData: CinematicCamState = {
              active: true,
              pocket,
              ballNum: ball.number,
              ballId: ball.id,
              ballColor: ball.color,
              reason: reasonLabel,
            };
            cinematicCamRef.current = camData;
            setCinematicCam(camData);
            slowMoTargetScaleRef.current = 0.2;
            if (soundEnabledRef.current) playCinematicWhoosh();

            if (cinematicTimerRef.current) clearTimeout(cinematicTimerRef.current);
            cinematicTimerRef.current = setTimeout(() => {
              slowMoTargetScaleRef.current = 1.0;
              cinematicCamRef.current = null;
              setCinematicCam(null);
              cinematicTimerRef.current = null;
            }, 1300);
          },
          onPocketed: (ball, pocketId) => {
            if (ball.type === "cue") {
              cueScratchedInShotRef.current = true;
            } else {
              pottedInCurrentShotRef.current.push({ ball, pocketId });
            }
            if (cinematicCamRef.current && cinematicCamRef.current.ballId === ball.id) {
              if (cinematicTimerRef.current) clearTimeout(cinematicTimerRef.current);
              cinematicTimerRef.current = setTimeout(() => {
                slowMoTargetScaleRef.current = 1.0;
                cinematicCamRef.current = null;
                setCinematicCam(null);
                cinematicTimerRef.current = null;
              }, 340);
            }
          },
          onFirstBallHit: () => {},
        },
      });

      if (isShootingRef.current && !anyMoving) {
        isShootingRef.current = false;
        setIsShooting(false);
        shotsSinceSlowMoRef.current += 1;
        powerRef.current = 0;
        setPower(0);
        if (powerFillRef.current) powerFillRef.current.style.height = "0%";
        if (powerHandleRef.current) powerHandleRef.current.style.top = "calc(0% - 10px)";
        if (powerTextRef.current) powerTextRef.current.textContent = "0%";

        clearCinematicCam();
        setBallsVersion((v) => v + 1);

        const pottedList = pottedInCurrentShotRef.current;
        const cueScratched = cueScratchedInShotRef.current;
        const firstHit = firstBallHitInShotRef.current;
        pottedInCurrentShotRef.current = [];
        cueScratchedInShotRef.current = false;
        firstBallHitInShotRef.current = null;

        if (pottedList.length > 0) {
          for (const entry of pottedList) {
            if (
              entry.ball.number !== 0 &&
              !pottedBallsHistoryRef.current.some((b) => b.id === entry.ball.id)
            ) {
              pottedBallsHistoryRef.current.push(entry.ball);
            }
          }
          setPottedBallsHistory([...pottedBallsHistoryRef.current]);
        }

        const shotCalledPocket = activeShotCalledPocketRef.current;
        activeShotCalledPocketRef.current = null;
        calledPocketIdRef.current = null;
        setCalledPocketId(null);

        const shotMustShootForward = mustShootForwardFromBaulkRef.current;
        mustShootForwardFromBaulkRef.current = false;

        resolveShotOutcome({
          mode: modeRef.current,
          isPractice: isPracticeRef.current,
          soundEnabled: soundEnabledRef.current,
          wasBreakShot: wasBreakShotRef.current,
          tableGeom: tableCfg.geometry,
          balls: ballsRef.current,
          pottedList,
          cueScratched,
          firstHit,
          activeShooter: turnRef.current,
          targetPocketForThisShot: shotCalledPocket,
          humanGroup: humanGroupRef.current,
          botGroup: botGroupRef.current,
          snookerOnColorAfterRed: snookerOnColorAfterRedRef.current,
          humanScore: humanScoreRef.current,
          botScore: botScoreRef.current,
          mustShootForwardFromBaulk: shotMustShootForward,
          oneFifteenUncalledCount: oneFifteenUncalledCountRef.current,
          oneFifteenHumanEightPocket: oneFifteenHumanEightPocketRef.current,
          oneFifteenBotEightPocket: oneFifteenBotEightPocketRef.current,
          onOneFifteenEightPocketChange: (target, pId) => {
            if (target === "human") {
              oneFifteenHumanEightPocketRef.current = pId;
              setOneFifteenHumanEightPocket(pId);
              calledPocketIdRef.current = pId;
              setCalledPocketId(pId);
            } else {
              oneFifteenBotEightPocketRef.current = pId;
              setOneFifteenBotEightPocket(pId);
            }
          },
          onPromptOneFifteenTablePocketPick: (target) => {
            if (target === "human") {
              awaitingOneFifteenPocketPickRef.current = true;
              setAwaitingOneFifteenPocketPick(true);
            }
          },
          onOneFifteenUncalledCountChange: (nextCount) => {
            oneFifteenUncalledCountRef.current = nextCount;
            setOneFifteenUncalledCount(nextCount);
          },
          onSnookerUpdate: ({ humanScore: hs, botScore: bs, onColorAfterRed }) => {
            humanScoreRef.current = hs;
            botScoreRef.current = bs;
            snookerOnColorAfterRedRef.current = onColorAfterRed;
            setHumanScore(hs);
            setBotScore(bs);
            setSnookerOnColorAfterRed(onColorAfterRed);
          },
          onGameOver: triggerGameOver,
          onAssignGroups: (hGrp, bGrp, announcement) => {
            humanGroupRef.current = hGrp;
            botGroupRef.current = bGrp;
            setHumanGroup(hGrp);
            setBotGroup(bGrp);
            setGroupAnnouncement(announcement);
            setTimeout(() => setGroupAnnouncement(null), 1000);
          },
          onTurnChange: (nextTurn) => {
            turnRef.current = nextTurn;
            setTurn(nextTurn);
          },
          onBallInHand: (hoverPos) => {
            ballInHandHoverPosRef.current = hoverPos;
            const enabled = hoverPos !== null;
            isBallInHandRef.current = enabled;
            if (enabled && modeRef.current === "one-fifteen") {
              mustShootForwardFromBaulkRef.current = true;
            }
            setIsBallInHand(enabled);
          },
          onMessage: setTurnMessage,
        });

        // Ensure potted balls strip matches all currently pocketed balls in drop order
        pottedBallsHistoryRef.current = pottedBallsHistoryRef.current.filter((b) => b.isPotted);
        setPottedBallsHistory([...pottedBallsHistoryRef.current]);
      }

      // ALWAYS schedule next frame unconditionally so scratches/fouls never freeze the loop
      animFrameRef.current = requestAnimationFrame(frameLoop);
    };

    animFrameRef.current = requestAnimationFrame(frameLoop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      clearCinematicCam();
    };
  }, [currentView]);

  // Screen -> Table Coordinate Mapping
  const getCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    if (isVirtualLandscape && isPortrait) {
      return {
        x: ((clientY - rect.top) / rect.height) * TABLE_WIDTH,
        y: ((rect.right - clientX) / rect.width) * TABLE_HEIGHT,
      };
    }
    return {
      x: ((clientX - rect.left) / rect.width) * TABLE_WIDTH,
      y: ((clientY - rect.top) / rect.height) * TABLE_HEIGHT,
    };
  };

  const getBallInHandMaxX = () =>
    modeRef.current === "snooker" || modeRef.current === "one-fifteen"
      ? getBreakLineX(modeRef.current, getActiveGeom())
      : undefined;

  const tryPlaceBallInHand = (x: number, y: number, finalize = false) => {
    const ballRadius = ballsRef.current[0]?.radius ?? getModeBallRadius(modeRef.current);
    const clamped = clampBallInHandPos(x, y, getActiveGeom(), getBallInHandMaxX(), ballRadius);
    const isOverlapping = ballsRef.current
      .slice(1)
      .some((b) => !b.isPotted && Math.hypot(b.x - clamped.x, b.y - clamped.y) < ballRadius * 2.2);
    if (!isOverlapping) {
      const cueBall = ballsRef.current[0];
      if (cueBall) {
        cueBall.x = clamped.x;
        cueBall.y = clamped.y;
        cueBall.vx = 0;
        cueBall.vy = 0;
        cueBall.isPotted = false;
        ballInHandHoverPosRef.current = { x: clamped.x, y: clamped.y };
        if (finalize) {
          isBallInHandRef.current = false;
          setIsBallInHand(false);
          setTurnMessage(
            modeRef.current === "one-fifteen" && mustShootForwardFromBaulkRef.current
              ? "✅ تم تثبيت الكرة خلف الخط! صوّب للأمام واسحب شريط القوة للضرب."
              : "✅ تم تثبيت الكرة! وجّه واسحب شريط القوة على اليسار للضرب."
          );
        } else {
          setTurnMessage("✋ تم وضع الكرة! يمكنك سحبها مجدداً لأي مكان أو الضغط على (تثبيت الكرة) للبدء.");
        }
        if (soundEnabledRef.current) playBallClack(4);
      }
      return true;
    }
    setTurnMessage("⚠️ لا يمكن وضع الكرة فوق كرة أخرى!");
    return false;
  };

  const confirmBallInHand = () => {
    if (!isBallInHandRef.current) return;
    const cueBall = ballsRef.current[0];
    if (cueBall && !cueBall.isPotted) {
      isBallInHandRef.current = false;
      setIsBallInHand(false);
      setTurnMessage(
        modeRef.current === "one-fifteen" && mustShootForwardFromBaulkRef.current
          ? "✅ تم تثبيت الكرة خلف الخط! صوّب للأمام واسحب شريط القوة للضرب."
          : "✅ تم تثبيت الكرة! وجّه واسحب شريط القوة على اليسار للضرب."
      );
      if (soundEnabledRef.current) playBallClack(3);
    }
  };

  const handleChooseOneFifteenEightPocket = (pocketId: number) => {
    oneFifteenHumanEightPocketRef.current = pocketId;
    setOneFifteenHumanEightPocket(pocketId);
    calledPocketIdRef.current = pocketId;
    setCalledPocketId(pocketId);
    awaitingOneFifteenPocketPickRef.current = false;
    setAwaitingOneFifteenPocketPick(false);
    const pName = getActiveGeom().pockets[pocketId]?.name || `جيب ${pocketId}`;
    const specialNum = humanGroupRef.current === "solids" ? 1 : 15;
    setTurnMessage(`🎯 تم تحديد (${pName}) للكرة 8! صوّب الآن على الكرة (${specialNum}) في الميدل.`);
    if (soundEnabledRef.current) playBallClack(3);
  };

  const syncCanvasCursor = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (isDraggingBallInHandRef.current || isDraggingBreakCueRef.current) {
      canvas.style.cursor = CURSOR_HAND_GRAB;
      return;
    }
    const canInteract = (turnRef.current === "human" || isPracticeRef.current) && !isShootingRef.current;
    if (canInteract && (isHoveringBallInHandRef.current || isHoveringBreakCueRef.current)) {
      canvas.style.cursor = CURSOR_HAND_OPEN;
      return;
    }
    canvas.style.cursor = canInteract ? "crosshair" : "default";
  };

  useEffect(() => {
    syncCanvasCursor();
  }, [currentView, isBallInHand, isBreakShot, isShooting, turn, isPractice]);

  const handleToggleSlowMo = () => {
    setSlowMoEnabled((prev) => {
      const next = !prev;
      slowMoEnabledRef.current = next;
      try { localStorage.setItem("cuemaster_slowmo_enabled", String(next)); } catch {}
      if (!next) {
        if (cinematicTimerRef.current) {
          clearTimeout(cinematicTimerRef.current);
          cinematicTimerRef.current = null;
        }
        slowMoScaleRef.current = 1.0;
        slowMoTargetScaleRef.current = 1.0;
        if (cinematicCamRef.current) {
          cinematicCamRef.current = null;
          setCinematicCam(null);
        }
      }
      return next;
    });
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    if (isDraggingBreakCueRef.current && isBreakShotRef.current) {
      const geom = getActiveGeom();
      moveBreakCueBall(coords.x, coords.y, ballsRef.current, geom, getBreakLineX(modeRef.current, geom));
      syncCanvasCursor();
      return;
    }

    if (isDraggingBallInHandRef.current) {
      const ballRadius = ballsRef.current[0]?.radius ?? getModeBallRadius(modeRef.current);
      const clamped = clampBallInHandPos(coords.x, coords.y, getActiveGeom(), getBallInHandMaxX(), ballRadius);
      ballInHandHoverPosRef.current = clamped;
      const isOverlapping = ballsRef.current
        .slice(1)
        .some((b) => !b.isPotted && Math.hypot(b.x - clamped.x, b.y - clamped.y) < ballRadius * 2.2);
      const cueBall = ballsRef.current[0];
      if (!isOverlapping && cueBall) {
        cueBall.x = clamped.x;
        cueBall.y = clamped.y;
        cueBall.isPotted = false;
      }
      syncCanvasCursor();
      return;
    }

    if ((turnRef.current !== "human" && !isPracticeRef.current) || isShootingRef.current) {
      isHoveringBreakCueRef.current = false;
      isHoveringBallInHandRef.current = false;
      syncCanvasCursor();
      return;
    }

    const cueBall = ballsRef.current[0];
    if (isBreakShotRef.current && cueBall && !cueBall.isPotted) {
      isHoveringBreakCueRef.current =
        Math.hypot(coords.x - cueBall.x, coords.y - cueBall.y) <= Math.max(32, cueBall.radius * 3.4);
    } else {
      isHoveringBreakCueRef.current = false;
    }

    if (isBallInHandRef.current && cueBall && !cueBall.isPotted) {
      isHoveringBallInHandRef.current =
        Math.hypot(coords.x - cueBall.x, coords.y - cueBall.y) <= Math.max(40, cueBall.radius * 3.8);
    } else {
      isHoveringBallInHandRef.current = false;
    }
    syncCanvasCursor();

    if (cueBall && (isAimDraggingRef.current || e.buttons === 1)) {
      const lockedAngle = dragStartAimAngleRef.current;
      const startPos = dragStartPosRef.current || { x: cueBall.x, y: cueBall.y };

      // Direction vector of the shot
      const forwardX = Math.cos(lockedAngle);
      const forwardY = Math.sin(lockedAngle);

      // Drag displacement vector from pointer down position
      const deltaX = coords.x - startPos.x;
      const deltaY = coords.y - startPos.y;

      // Project displacement along the cue stick axis (positive = forward towards target, negative = backwards)
      const forwardDisp = deltaX * forwardX + deltaY * forwardY;
      const perpDisp = Math.abs(deltaX * (-forwardY) + deltaY * forwardX);

      // When dragging backwards opposite to cue direction: charge power & lock aim!
      // "اما نظبطه ونشد لورا على الشاشه عكس اتجاه المضرب يحمل انه يلعب وميحركش الاتجاه المختار"
      if (isPullBackShootingRef.current || (forwardDisp < -10 && perpDisp < Math.abs(forwardDisp) * 0.95)) {
        isPullBackShootingRef.current = true;
        // Keep aim angle completely locked so it does NOT move
        aimAngleRef.current = lockedAngle;

        const pullDist = -forwardDisp;
        if (pullDist > 0) {
          const pct = Math.min(100, Math.max(0, Math.round((pullDist / 140) * 100)));
          powerRef.current = pct;
          setPower(pct);
          applyPowerVisual(pct);
        } else {
          powerRef.current = 0;
          setPower(0);
          applyPowerVisual(0);
        }
        return;
      }

      // Otherwise: Adjust aim angle smoothly with low sensitivity (damping)
      const dx = coords.x - cueBall.x;
      const dy = coords.y - cueBall.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 8) {
        const targetAngle = Math.atan2(dy, dx);
        let diff = (targetAngle - aimAngleRef.current) % (Math.PI * 2);
        if (diff > Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;

        // Smooth damping for fine, steady aiming ("السهم الحساسيه بتاعته عاليه")
        const damping = Math.abs(diff) < 0.1 ? 0.24 : 0.42;
        aimAngleRef.current += diff * damping;

        // Keep anchor in sync so subsequent pull-back engages smoothly
        dragStartAimAngleRef.current = aimAngleRef.current;
        dragStartPosRef.current = { x: coords.x, y: coords.y };

        const now = performance.now();
        aimAngleHistoryRef.current.push({ angle: aimAngleRef.current, time: now });
        if (aimAngleHistoryRef.current.length > 8) {
          aimAngleHistoryRef.current.shift();
        }
      }
    }
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    unlockAudio();
    if (showSpinPopover) setShowSpinPopover(false);
    if (showPocketPopover) setShowPocketPopover(false);

    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    // 1. Awaiting 1 & 15 table pocket pick: player clicks directly on table pocket!
    if (awaitingOneFifteenPocketPickRef.current) {
      const clickedPocket = getActiveGeom().pockets.find(
        (p) => Math.hypot(p.x - coords.x, p.y - coords.y) < 45
      );
      if (clickedPocket) {
        if (oneFifteenBotEightPocketRef.current === clickedPocket.id) {
          setTurnMessage("⚠️ هذا الجيب محجوز للخصم! اختر جيباً آخر للكرة 8.");
          return;
        }
        handleChooseOneFifteenEightPocket(clickedPocket.id);
        return;
      }
    }

    if (modeRef.current === "8-ball" || modeRef.current === "one-fifteen") {
      const clickedPocket = getActiveGeom().pockets.find(
        (p) => Math.hypot(p.x - coords.x, p.y - coords.y) < 38
      );
      if (clickedPocket && !isBallInHandRef.current) {
        const nextPocket = calledPocketIdRef.current === clickedPocket.id ? null : clickedPocket.id;
        calledPocketIdRef.current = nextPocket;
        setCalledPocketId(nextPocket);
        if (soundEnabledRef.current) playBallClack(3);
        return;
      }
    }

    if (isBallInHandRef.current) {
      const cueBall = ballsRef.current[0];
      const distToCue = cueBall && !cueBall.isPotted
        ? Math.hypot(coords.x - cueBall.x, coords.y - cueBall.y)
        : 0;
      const isDirectTouchOnCue =
        !cueBall ||
        cueBall.isPotted ||
        distToCue <= Math.max(40, (cueBall?.radius ?? 10) * 3.8);

      if (isDirectTouchOnCue) {
        isDraggingBallInHandRef.current = true;
        const ballRadius = ballsRef.current[0]?.radius ?? getModeBallRadius(modeRef.current);
        const clamped = clampBallInHandPos(coords.x, coords.y, getActiveGeom(), getBallInHandMaxX(), ballRadius);
        ballInHandHoverPosRef.current = clamped;
        const isOverlapping = ballsRef.current
          .slice(1)
          .some((b) => !b.isPotted && Math.hypot(b.x - clamped.x, b.y - clamped.y) < ballRadius * 2.2);
        if (!isOverlapping && cueBall) {
          cueBall.x = clamped.x;
          cueBall.y = clamped.y;
          cueBall.isPotted = false;
        }
        syncCanvasCursor();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
        return;
      }
      // If user tapped outside the cue ball, allow aiming! Fall through to aiming below.
    }

    if ((turnRef.current === "human" || isPracticeRef.current) && !isShootingRef.current) {
      const cueBall = ballsRef.current[0];
      if (
        isBreakShotRef.current &&
        !isBallInHandRef.current &&
        cueBall &&
        !cueBall.isPotted &&
        Math.hypot(coords.x - cueBall.x, coords.y - cueBall.y) <= Math.max(32, cueBall.radius * 3.4)
      ) {
        isDraggingBreakCueRef.current = true;
        isHoveringBreakCueRef.current = true;
        const geom = getActiveGeom();
        moveBreakCueBall(coords.x, coords.y, ballsRef.current, geom, getBreakLineX(modeRef.current, geom));
        syncCanvasCursor();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
        return;
      }

      isAimDraggingRef.current = true;
      isPullBackShootingRef.current = false;
      dragStartPosRef.current = { x: coords.x, y: coords.y };
      dragStartAimAngleRef.current = aimAngleRef.current;
      powerRef.current = 0;
      if (cueBall) {
        const dx = coords.x - cueBall.x;
        const dy = coords.y - cueBall.y;
        if (Math.hypot(dx, dy) > 8) {
          aimAngleRef.current = Math.atan2(dy, dx);
          dragStartAimAngleRef.current = aimAngleRef.current;
          aimAngleHistoryRef.current = [{ angle: aimAngleRef.current, time: performance.now() }];
        }
      }
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingBreakCueRef.current) {
      isDraggingBreakCueRef.current = false;
      if (soundEnabledRef.current) playBallClack(3);
    }
    if (isBallInHandRef.current && isDraggingBallInHandRef.current) {
      isDraggingBallInHandRef.current = false;
      const coords = getCanvasCoords(e.clientX, e.clientY);
      const ballRadius = ballsRef.current[0]?.radius ?? getModeBallRadius(modeRef.current);
      const target = coords
        ? clampBallInHandPos(coords.x, coords.y, getActiveGeom(), getBallInHandMaxX(), ballRadius)
        : ballInHandHoverPosRef.current;
      if (target) {
        tryPlaceBallInHand(target.x, target.y, false);
      }
      syncCanvasCursor();
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
      return;
    }
    if (isPullBackShootingRef.current) {
      isPullBackShootingRef.current = false;
      isAimDraggingRef.current = false;
      const finalPower = powerRef.current;
      dragStartPosRef.current = null;
      aimAngleHistoryRef.current = [];
      if (finalPower >= 10 && (isPracticeRef.current || turnRef.current === "human") && !isShootingRef.current) {
        if (isBallInHandRef.current) confirmBallInHand();
        handleShoot(finalPower);
      } else {
        powerRef.current = 0;
        setPower(0);
        applyPowerVisual(0);
      }
      syncCanvasCursor();
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
      return;
    }

    if (isAimDraggingRef.current) {
      isAimDraggingRef.current = false;
      // Filter out finger-lift jitter:
      // When lifting finger off screen, use angle held right before release roll
      const history = aimAngleHistoryRef.current;
      if (history.length >= 2) {
        const now = performance.now();
        const stable = history.find((h) => now - h.time >= 40) || history[0];
        if (stable) {
          aimAngleRef.current = stable.angle;
        }
      }
      aimAngleHistoryRef.current = [];
    }
    syncCanvasCursor();
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  const handleCanvasPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isAimDraggingRef.current = false;
    isPullBackShootingRef.current = false;
    dragStartPosRef.current = null;
    isDraggingBallInHandRef.current = false;
    isDraggingBreakCueRef.current = false;
    isHoveringBreakCueRef.current = false;
    powerRef.current = 0;
    setPower(0);
    applyPowerVisual(0);
    syncCanvasCursor();
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  const handleCanvasPointerLeave = () => {
    if (!isDraggingBreakCueRef.current && !isDraggingBallInHandRef.current) {
      isHoveringBreakCueRef.current = false;
      syncCanvasCursor();
    }
  };

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
    if (powerHandleRef.current) powerHandleRef.current.style.top = `calc(${pct}% - 10px)`;
    if (powerTextRef.current) powerTextRef.current.textContent = `${pct}%`;
  };

  const updatePowerFromPointer = (clientX: number, clientY: number, trackEl: HTMLElement) => {
    const rect = trackEl.getBoundingClientRect();
    const progress =
      isVirtualLandscape && isPortrait
        ? (rect.right - clientX) / Math.max(1, rect.width)
        : (clientY - rect.top) / Math.max(1, rect.height);
    applyPowerVisual(Math.min(100, Math.max(0, Math.round(progress * 100))));
  };

  const handlePowerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    unlockAudio();
    if (isShootingRef.current || (!isPracticeRef.current && turnRef.current !== "human")) return;
    if (isBallInHandRef.current) {
      confirmBallInHand();
    }
    isVerticalMeterDraggingRef.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    updatePowerFromPointer(e.clientX, e.clientY, e.currentTarget);
  };

  const handlePowerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isVerticalMeterDraggingRef.current) return;
    updatePowerFromPointer(e.clientX, e.clientY, e.currentTarget);
  };

  const handlePowerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isVerticalMeterDraggingRef.current) return;
    isVerticalMeterDraggingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}

    const finalPower = powerRef.current;
    setPower(finalPower);
    if (finalPower >= 12 && (isPracticeRef.current || turnRef.current === "human") && !isShootingRef.current) {
      if (isBallInHandRef.current) confirmBallInHand();
      handleShoot(finalPower);
    } else {
      applyPowerVisual(0);
      setPower(0);
    }
  };

  const handlePowerPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    isVerticalMeterDraggingRef.current = false;
    applyPowerVisual(0);
    setPower(0);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  const updateSpinFromPointer = (clientX: number, clientY: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    let x = isVirtualLandscape && isPortrait
      ? ((clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2
      : ((clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
    let y = isVirtualLandscape && isPortrait
      ? ((rect.right - clientX) / Math.max(1, rect.width) - 0.5) * 2
      : ((clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
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

  const isHumanOnEightBall = () => {
    if ((modeRef.current !== "8-ball" && modeRef.current !== "one-fifteen") || humanGroupRef.current === "unassigned") {
      return false;
    }
    const expected = humanGroupRef.current === "solids" ? "solid" : "stripe";
    return !ballsRef.current.some((b) => !b.isPotted && b.number !== 8 && b.type === expected);
  };

  const handleShoot = (explicitPower?: number) => {
    unlockAudio();
    if (isShootingRef.current) return;
    if (isBallInHandRef.current) {
      confirmBallInHand();
    }
    if (turnRef.current !== "human" && !isPracticeRef.current) return;

    const matchDiff = getMatchDifficulty(stakeRef.current, isPracticeRef.current, modeRef.current);
    const mustCallPocket =
      isHumanOnEightBall() ||
      (modeRef.current === "8-ball" && !isBreakShotRef.current && matchDiff.requireCalledPocket);

    if (mustCallPocket && calledPocketIdRef.current === null) {
      setTurnMessage(
        isHumanOnEightBall()
          ? "🎯 اختر الجيب الهدف للكرة السوداء 8 أولاً بالضغط عليه!"
          : `🎯 في مستوى (${matchDiff.labelAr}) يجب تحديد الجيب بالضغط عليه أولاً!`
      );
      applyPowerVisual(0);
      setPower(0);
      return;
    }

    if (
      modeRef.current === "one-fifteen" &&
      mustShootForwardFromBaulkRef.current &&
      Math.cos(aimAngleRef.current) <= 0.02
    ) {
      setTurnMessage("⚠️ في لعبة 1 و 15: الكرة خلف الخط — يجب التصويب للأمام!");
      applyPowerVisual(0);
      setPower(0);
      return;
    }

    const cueBall = ballsRef.current[0];
    if (!cueBall || cueBall.isPotted) return;

    const shotPower = explicitPower !== undefined ? explicitPower : powerRef.current >= 12 ? powerRef.current : 65;

    activeShotCalledPocketRef.current = calledPocketIdRef.current;
    activeShotAimAngleRef.current = aimAngleRef.current;
    spinAppliedInCurrentShotRef.current = false;
    shotStartPosRef.current = { x: cueBall.x, y: cueBall.y };
    cinematicTriggeredThisShotRef.current = false;
    isHoveringBreakCueRef.current = false;
    for (let i = 0; i < ballsRef.current.length; i++) ballsRef.current[i].railBounces = 0;

    wasBreakShotRef.current = isBreakShotRef.current;
    isBreakShotRef.current = false;
    isDraggingBreakCueRef.current = false;
    setIsBreakShot(false);
    isShootingRef.current = true;
    setIsShooting(true);
    if (soundEnabledRef.current) playCueStrike(shotPower);

    const curCue = ALL_CUES.find((c) => c.id === selectedCueRef.current) || ALL_CUES[0];
    const cueSpinFactor = 0.75 + (curCue.stats.spin / 10) * 0.55;
    cueBall.spinSide = Math.abs(spinXRef.current) > 0.12 ? spinXRef.current * cueSpinFactor : 0;
    const speed = (shotPower / 100) * 36 * getCueForceMultiplier(curCue);
    cueBall.vx = Math.cos(aimAngleRef.current) * speed;
    cueBall.vy = Math.sin(aimAngleRef.current) * speed;
  };

  // Bot AI Turn Execution (Natural pause -> visible cue aiming -> smooth pull-back -> strike)
  useEffect(() => {
    if (currentView !== "table") return;
    if (turn === "bot" && !isShooting && !gameOver && !isPractice && !isBallInHand) {
      let cancelled = false;
      let aimRaf: number | null = null;
      let strikeTimer: ReturnType<typeof setTimeout> | null = null;

      setTurnMessage("🤖 الخصم يفحص الطاولة...");

      const thinkTimer = setTimeout(() => {
        if (cancelled) return;
        const cueBall = ballsRef.current[0];
        if (!cueBall) return;
        const activeGeom = getActiveGeom();
        const baulkMaxX =
          modeRef.current === "snooker" || modeRef.current === "one-fifteen"
            ? getBreakLineX(modeRef.current, activeGeom)
            : undefined;
        if (cueBall.isPotted) {
          placeCueBallSafely(ballsRef.current, activeGeom, baulkMaxX);
          if (modeRef.current === "one-fifteen") {
            mustShootForwardFromBaulkRef.current = true;
          }
        }

        const snookerTarget = getSnookerTargetInfo(ballsRef.current, snookerOnColorAfterRedRef.current);
        const matchDiff = getMatchDifficulty(stakeRef.current, isPracticeRef.current, modeRef.current);
        const plan = computeBotShot(
          ballsRef.current,
          botGroupRef.current,
          modeRef.current,
          activeGeom,
          snookerTarget,
          matchDiff.botAimError,
          modeRef.current === "one-fifteen" && mustShootForwardFromBaulkRef.current
        );
        if (!plan) return;

        calledPocketIdRef.current = plan.pocketId;
        setCalledPocketId(plan.pocketId);
        activeShotCalledPocketRef.current = plan.pocketId;
        setTurnMessage(
          plan.pocketId === null && modeRef.current === "one-fifteen"
            ? "🤖 الخصم يلعب ضربة أمان بدون تحديد جيب..."
            : "🤖 الخصم يوجّه العصا نحو الهدف..."
        );

        const startAngle = aimAngleRef.current;
        // Shortest wrapped delta angle
        let deltaAngle = ((plan.angle - startAngle + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

        const targetPower = Math.min(95, Math.max(35, Math.round((plan.speed / 36) * 100)));
        botAimVisibleRef.current = true;
        powerRef.current = 0;

        const aimStart = performance.now();
        const AIM_SWEEP_MS = 650;
        const PULL_BACK_MS = 380;

        const animateBotAim = (now: number) => {
          if (cancelled) return;
          const elapsed = now - aimStart;

          if (elapsed < AIM_SWEEP_MS) {
            const t = elapsed / AIM_SWEEP_MS;
            const eased = 1 - Math.pow(1 - t, 3);
            aimAngleRef.current = startAngle + deltaAngle * eased;
            powerRef.current = 0;
            aimRaf = requestAnimationFrame(animateBotAim);
            return;
          }

          aimAngleRef.current = plan.angle;
          const pullElapsed = elapsed - AIM_SWEEP_MS;
          if (pullElapsed < PULL_BACK_MS) {
            const pt = pullElapsed / PULL_BACK_MS;
            const easedPull = 1 - Math.pow(1 - pt, 2);
            powerRef.current = Math.round(targetPower * easedPull);
            aimRaf = requestAnimationFrame(animateBotAim);
            return;
          }

          powerRef.current = targetPower;
          strikeTimer = setTimeout(() => {
            if (cancelled) return;
            botAimVisibleRef.current = false;
            powerRef.current = 0;
            wasBreakShotRef.current = isBreakShotRef.current;
            isBreakShotRef.current = false;
            setIsBreakShot(false);
            activeShotAimAngleRef.current = plan.angle;
            spinAppliedInCurrentShotRef.current = false;
            shotStartPosRef.current = { x: cueBall.x, y: cueBall.y };
            cinematicTriggeredThisShotRef.current = false;
            for (let i = 0; i < ballsRef.current.length; i++) ballsRef.current[i].railBounces = 0;

            isShootingRef.current = true;
            setIsShooting(true);
            if (soundEnabledRef.current) playCueStrike(targetPower);
            cueBall.spinSide = 0;
            cueBall.vx = Math.cos(plan.angle) * plan.speed;
            cueBall.vy = Math.sin(plan.angle) * plan.speed;
          }, 180);
        };

        aimRaf = requestAnimationFrame(animateBotAim);
      }, 480);

      return () => {
        cancelled = true;
        botAimVisibleRef.current = false;
        powerRef.current = 0;
        clearTimeout(thinkTimer);
        if (strikeTimer) clearTimeout(strikeTimer);
        if (aimRaf) cancelAnimationFrame(aimRaf);
      };
    }
  }, [currentView, turn, isShooting, gameOver, isPractice, isBallInHand, botGroup]);

  const beginPlayWithMatchmaking = (targetMode: GameMode, tableStake = 100) => {
    unlockAudio();
    if (tableStake > 0 && coinsRef.current < tableStake) {
      alert(`❌ رصيدك الحالي (${coinsRef.current.toLocaleString()} 🪙) غير كافٍ لدخول طاولة برهان ${tableStake.toLocaleString()} 🪙!`);
      return;
    }
    setMatchmakingPending({ mode: targetMode, stake: tableStake });
  };

  const startMatch = (
    targetMode: GameMode,
    practice = false,
    tableStake = 100,
    explicitOpponent?: { name: string; avatar: string; flag: string }
  ) => {
    unlockAudio();
    if (explicitOpponent) {
      setOpponentName(explicitOpponent.name);
      setOpponentAvatar(explicitOpponent.avatar);
      setOpponentFlag(explicitOpponent.flag);
    }
    if (!practice && tableStake > 0) {
      if (coinsRef.current < tableStake) {
        alert(`❌ رصيدك الحالي (${coinsRef.current.toLocaleString()} 🪙) غير كافٍ لدخول طاولة برهان ${tableStake.toLocaleString()} 🪙!`);
        return;
      }
      saveCoins(coinsRef.current - tableStake);
    }

    const matchPrize = practice ? 0 : Math.round(tableStake * 1.9);
    modeRef.current = targetMode;
    isPracticeRef.current = practice;
    stakeRef.current = tableStake;
    prizeRef.current = matchPrize;
    setMode(targetMode);
    setIsPractice(practice);
    setStake(tableStake);
    setPrize(matchPrize);
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
      if (portrait) setIsVirtualLandscape(true);
    }

    setShowTableEntrance(true);
    if (soundEnabledRef.current) playCinematicWhoosh();
    setCurrentView("table");
  };

  // Remaining Balls for Top Bar Tray
  const humanRemainingBalls = (() => {
    void ballsVersion;
    if (humanGroup === "unassigned") return [];
    const expected = humanGroup === "solids" ? "solid" : "stripe";
    const groupLeft = ballsRef.current.filter((b) => !b.isPotted && b.number !== 8 && b.type === expected);
    if (groupLeft.length > 0) return groupLeft;
    const black8 = ballsRef.current.find((b) => !b.isPotted && b.number === 8);
    return black8 ? [black8] : [];
  })();

  const botRemainingCount = (() => {
    void ballsVersion;
    if (botGroup === "unassigned") return 7;
    const expected = botGroup === "solids" ? "solid" : "stripe";
    return ballsRef.current.filter((b) => !b.isPotted && b.number !== 8 && b.type === expected).length;
  })();

  const snookerTarget = (() => {
    void ballsVersion;
    return getSnookerTargetInfo(ballsRef.current, snookerOnColorAfterRed);
  })();

  const snookerRedsLeft = (() => {
    void ballsVersion;
    return ballsRef.current.filter((b) => !b.isPotted && b.type === "red").length;
  })();

  const rotatedStyle =
    isVirtualLandscape && isPortrait
      ? {
          position: "fixed" as const,
          top: 0,
          left: 0,
          right: "auto",
          bottom: "auto",
          width: viewportSize.h ? `${viewportSize.h}px` : "100dvh",
          height: viewportSize.w ? `${viewportSize.w}px` : "100dvw",
          transform: `translateX(${viewportSize.w ? `${viewportSize.w}px` : "100dvw"}) rotate(90deg)`,
          transformOrigin: "top left",
        }
      : undefined;

  return (
    <div
      className="relative w-screen h-dvh bg-[#020b14] text-slate-100 flex flex-col font-sans select-none overflow-hidden"
      dir="rtl"
    >
      {currentView === "intro" ? (
        <IntroVideo onFinish={() => setCurrentView("mode_select")} />
      ) : currentView === "mode_select" ? (
        <ModeSelectTriangles
          onSelectMode={(pickedMode) => {
            unlockAudio();
            if (soundEnabledRef.current) playBallClack(5);
            modeRef.current = pickedMode;
            setMode(pickedMode);
            setCurrentView("menu");
          }}
        />
      ) : currentView === "menu" ? (
        <Lobby
          username={username}
          avatar={avatar}
          coins={coins}
          gems={gems}
          selectedMode={mode}
          onSelectMode={(pickedMode) => {
            modeRef.current = pickedMode;
            setMode(pickedMode);
          }}
          onChangeMode={() => setCurrentView("mode_select")}
          onAddCoins={(amt) => saveCoins(coins + amt)}
          onAddGems={(amt) => saveGems(gems + amt)}
          onPlayMatchmaking={beginPlayWithMatchmaking}
          onStartMatch={startMatch}
          onOpenModal={(modal, tab) => {
            if (tab) setShopTab(tab);
            setActiveModal(modal);
          }}
        />
      ) : (
        <div
          dir="ltr"
          className="relative w-full h-full flex flex-col bg-[#020b14] overflow-hidden touch-none"
          style={rotatedStyle ? { ...rotatedStyle, zIndex: 50 } : undefined}
        >
          <TableHUD
            mode={mode}
            username={username}
            avatar={avatar}
            opponentName={opponentName}
            opponentAvatar={opponentAvatar}
            opponentFlag={opponentFlag}
            turn={turn}
            turnTimeLeft={turnTimeLeft}
            turnTotalTime={turnTotalTime}
            isPractice={isPractice}
            prize={prize}
            turnMessage={turnMessage}
            humanGroup={humanGroup}
            botGroup={botGroup}
            humanRemainingBalls={humanRemainingBalls}
            botRemainingCount={botRemainingCount}
            humanScore={humanScore}
            botScore={botScore}
            snookerTarget={snookerTarget}
            snookerRedsLeft={snookerRedsLeft}
            spinX={spinX}
            spinY={spinY}
            showSpinPopover={showSpinPopover}
            setShowSpinPopover={setShowSpinPopover}
            showPocketPopover={showPocketPopover}
            setShowPocketPopover={setShowPocketPopover}
            calledPocketId={calledPocketId}
            oneFifteenHumanEightPocket={oneFifteenHumanEightPocket}
            oneFifteenBotEightPocket={oneFifteenBotEightPocket}
            oneFifteenUncalledCount={oneFifteenUncalledCount}
            isPortrait={isPortrait}
            isVirtualLandscape={isVirtualLandscape}
            slowMoEnabled={slowMoEnabled}
            onSpinPointerDown={(e) => {
              isSpinDraggingRef.current = true;
              try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
              updateSpinFromPointer(e.clientX, e.clientY, e.currentTarget);
            }}
            onSpinPointerMove={(e) => {
              if (!isSpinDraggingRef.current) return;
              updateSpinFromPointer(e.clientX, e.clientY, e.currentTarget);
            }}
            onSpinPointerUp={(e) => {
              isSpinDraggingRef.current = false;
              try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
            }}
            onSpinPointerCancel={() => { isSpinDraggingRef.current = false; }}
            onResetSpin={() => {
              spinXRef.current = 0;
              spinYRef.current = 0;
              setSpinX(0);
              setSpinY(0);
            }}
            onFineAim={(delta) => { aimAngleRef.current += delta; }}
            onSelectPocket={(id) => {
              calledPocketIdRef.current = id;
              setCalledPocketId(id);
              setShowPocketPopover(false);
            }}
            onToggleSlowMo={handleToggleSlowMo}
            onOpenShop={() => {
              setShopTab("cues");
              setActiveModal("shop");
            }}
            onToggleVirtualLandscape={() => setIsVirtualLandscape((v) => !v)}
            onExit={() => {
              setShowTableEntrance(false);
              setGameOver(null);
              setIsVirtualLandscape(false);
              setCurrentView("menu");
            }}
          />

          {showTableEntrance && (
            <TableEntranceOverlay
              table={currentTable}
              mode={mode}
              username={username}
              opponentName={opponentName}
              isPractice={isPractice}
              prize={prize}
              onFinish={() => setShowTableEntrance(false)}
            />
          )}

          {groupAnnouncement && (
            <div
              dir="rtl"
              className="absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border-2 border-amber-400 text-slate-100 px-4 py-1.5 rounded-xl shadow-2xl flex flex-col items-center pointer-events-none"
            >
              <div className="text-[11px] font-black text-amber-300">{groupAnnouncement.title}</div>
              <div className="text-[10px] font-bold text-slate-200">
                أنت: <span className="text-amber-400">{groupAnnouncement.human}</span> | الخصم:{" "}
                <span className="text-slate-300">{groupAnnouncement.bot}</span>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 flex flex-row items-stretch overflow-hidden w-full">
            <PowerMeter
              power={power}
              disabled={(!isPractice && turn !== "human") || isShooting}
              trackRef={powerTrackRef}
              fillRef={powerFillRef}
              handleRef={powerHandleRef}
              textRef={powerTextRef}
              onPointerDown={handlePowerPointerDown}
              onPointerMove={handlePowerPointerMove}
              onPointerUp={handlePowerPointerUp}
              onPointerCancel={handlePowerPointerCancel}
              onQuickShoot={() => handleShoot()}
            />

            <main
              ref={tableStageRef}
              className="relative flex-1 min-w-0 min-h-0 flex items-center justify-center p-1 overflow-hidden"
            >
              {awaitingOneFifteenPocketPick && (
                <div
                  dir="rtl"
                  className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-amber-950/95 border-2 border-amber-400 text-amber-200 px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-black shadow-2xl flex items-center gap-2 animate-bounce whitespace-nowrap"
                >
                  <span className="text-sm">🎯</span>
                  <span>الخصم أسقط كرتك! انقر على أي جيب مضيء على الطاولة لتحديد جيب الكرة 8</span>
                </div>
              )}

              {isBallInHand && !awaitingOneFifteenPocketPick && (
                <div
                  dir="rtl"
                  className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 border-2 border-amber-400 text-amber-300 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-black shadow-2xl flex items-center gap-2.5 whitespace-nowrap"
                >
                  <span className="text-sm animate-pulse">✋</span>
                  <span>
                    الكرة بيدك: اسحب الكرة لتغيير مكانها، والمس خارجها للتصويب أو اسحب القوة للضرب
                  </span>
                  <button
                    type="button"
                    onClick={confirmBallInHand}
                    className="px-2.5 py-0.5 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-[10px] sm:text-[11px] cursor-pointer shadow flex items-center gap-1 transition-all"
                  >
                    <span>✓</span>
                    <span>تثبيت</span>
                  </button>
                </div>
              )}

              {!isBallInHand && isBreakShot && !isShooting && (turn === "human" || isPractice) && (
                <div
                  dir="rtl"
                  className="absolute top-1.5 left-1/2 -translate-x-1/2 z-20 bg-cyan-950/90 border border-cyan-400/70 text-cyan-100 px-3 py-0.5 rounded-full text-[10px] font-black shadow-lg pointer-events-none whitespace-nowrap"
                >
                  ✋ ضربة البداية: حرّك الكرة البيضاء باليد خلف الخط وصوّب على المثلث
                </div>
              )}

              {!isBallInHand && !(isBreakShot && !isShooting && (turn === "human" || isPractice)) && (
                <div
                  dir="rtl"
                  className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 z-20 bg-slate-950/85 border border-slate-800 text-amber-200 px-2.5 py-0.5 rounded-full text-[9px] font-bold pointer-events-none max-w-[85%] truncate"
                >
                  {turnMessage}
                </div>
              )}

              {cinematicCam && (
                <>
                  <div
                    dir="rtl"
                    className="absolute top-0 left-0 right-0 z-30 h-7 bg-gradient-to-b from-black/90 to-black/60 border-b border-cyan-400/40 flex items-center justify-between px-4 pointer-events-none"
                  >
                    <span className="text-[10px] font-black text-cyan-300 animate-pulse">
                      {cinematicCam.reason || "🔥 لقطة مميزة"}
                    </span>
                    <span className="text-[10px] font-black text-amber-300 tracking-wider">🎬 SLOW MOTION</span>
                    <span className="text-[10px] font-bold text-slate-300">{cinematicCam.pocket.name}</span>
                  </div>
                  <div
                    dir="rtl"
                    className="absolute bottom-0 left-0 right-0 z-30 h-7 bg-gradient-to-t from-black/90 to-black/60 border-t border-cyan-400/40 flex items-center justify-between px-4 pointer-events-none"
                  >
                    <span className="text-[10px] font-black text-emerald-400">⏱️ حركة بطيئة 0.2x</span>
                    <span className="text-[10px] font-mono text-amber-400 font-extrabold">
                      {cinematicCam.ballNum === 8 ? "🏆 الكرة 8!" : `كرة (${cinematicCam.ballNum})`}
                    </span>
                  </div>
                </>
              )}

              <div
                className="flex items-center justify-center transition-transform duration-500 ease-out will-change-transform"
                style={{
                  transformOrigin: cinematicCam
                    ? `${(cinematicCam.pocket.x / TABLE_WIDTH) * 100}% ${(cinematicCam.pocket.y / TABLE_HEIGHT) * 100}%`
                    : "50% 50%",
                  transform: cinematicCam ? "scale(1.18)" : "scale(1)",
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
                  onPointerLeave={handleCanvasPointerLeave}
                  style={{
                    width: canvasDisplaySize.w > 0 ? `${canvasDisplaySize.w}px` : "100%",
                    height: canvasDisplaySize.h > 0 ? `${canvasDisplaySize.h}px` : "auto",
                    borderColor: currentTable.cushionGlow,
                    boxShadow: `0 0 24px ${currentTable.cushionGlow}33, 0 8px 28px rgba(0,0,0,0.85)`,
                  }}
                  className="rounded-xl sm:rounded-2xl border-2 sm:border-4 touch-none select-none block"
                />
              </div>

              {/* شريط الكرات المسقطة بالترتيب */}
              <div
                dir="rtl"
                className="absolute bottom-1 sm:bottom-2 left-1/2 -translate-x-1/2 z-20 max-w-[96%] flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-amber-500/40 shadow-2xl overflow-x-auto no-scrollbar pointer-events-auto"
              >
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-black text-amber-300 shrink-0 select-none">
                  <span className="text-xs">🎱</span>
                  <span>الكرات المسقطة:</span>
                </div>
                {pottedBallsHistory.length === 0 ? (
                  <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 shrink-0 italic">
                    لم تسقط أي كرة بعد
                  </span>
                ) : (
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    {pottedBallsHistory.map((b, idx) => (
                      <div
                        key={`${b.id}-${idx}`}
                        className="relative flex items-center justify-center group"
                        title={`الكرة #${b.number} — الترتيب: ${idx + 1}`}
                      >
                        <div
                          className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-white/70 flex items-center justify-center text-[7.5px] sm:text-[8.5px] font-black shadow-md transition-transform transform group-hover:scale-125 select-none"
                          style={{
                            background:
                              b.type === "stripe"
                                ? `linear-gradient(to bottom, #ffffff 24%, ${b.color} 24%, ${b.color} 76%, #ffffff 76%)`
                                : b.color,
                            color:
                              b.number === 8 ||
                              b.type === "color" ||
                              b.number === 2 ||
                              b.number === 4 ||
                              b.number === 6 ||
                              b.number === 7 ||
                              b.number === 10 ||
                              b.number === 12 ||
                              b.number === 14 ||
                              b.number === 15
                                ? "#ffffff"
                                : "#0f172a",
                          }}
                        >
                          {b.number}
                        </div>
                        <span className="absolute -top-4 bg-slate-900/95 border border-amber-400 text-amber-300 text-[8px] font-mono font-bold px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                          #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      )}



      {matchmakingPending && (
        <MatchmakingOverlay
          username={username}
          avatar={avatar}
          mode={matchmakingPending.mode}
          stake={matchmakingPending.stake}
          prize={Math.round(matchmakingPending.stake * 1.9)}
          soundEnabled={soundEnabled}
          onCancel={() => setMatchmakingPending(null)}
          onMatched={(bot: MatchedOpponentInfo) => {
            const pending = matchmakingPending;
            setMatchmakingPending(null);
            if (pending) {
              startMatch(pending.mode, false, pending.stake, {
                name: bot.name,
                avatar: bot.avatar,
                flag: bot.flag,
              });
            }
          }}
        />
      )}

      {(activeModal || gameOver) && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[60] overflow-hidden"
          style={currentView === "table" ? rotatedStyle : undefined}
        >
          {activeModal === "shop" && (
            <ShopModal
              coins={coins}
              shopTab={shopTab}
              setShopTab={setShopTab}
              cueCategoryFilter={cueCategoryFilter}
              setCueCategoryFilter={setCueCategoryFilter}
              selectedCue={selectedCue}
              selectedTable={selectedTable}
              unlockedCues={unlockedCues}
              unlockedTables={unlockedTables}
              activeCue={activeCue}
              onEquipCue={handleEquipCue}
              onBuyCue={handleBuyCue}
              onEquipTable={handleEquipTable}
              onBuyTable={handleBuyTable}
              onClose={() => setActiveModal(null)}
            />
          )}

          <GameModals
            activeModal={activeModal}
            gameOver={gameOver}
            username={username}
            coins={coins}
            soundEnabled={soundEnabled}
            aimAssistLong={aimAssistLong}
            slowMoEnabled={slowMoEnabled}
            currentTable={currentTable}
            activeCue={activeCue}
            mode={mode}
            isPractice={isPractice}
            stake={stake}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            onToggleAimAssist={() => setAimAssistLong(!aimAssistLong)}
            onToggleSlowMo={handleToggleSlowMo}
            onOpenShop={() => setActiveModal("shop")}
            onCloseModal={() => setActiveModal(null)}
            onStartMatch={startMatch}
            onRestartMatch={() => {
              setGameOver(null);
              startMatch(mode, isPractice, stake);
            }}
            onExitToMenu={() => {
              setGameOver(null);
              setIsVirtualLandscape(false);
              setCurrentView("menu");
              try {
                if (typeof window !== "undefined" && window.parent && window.parent !== window) {
                  window.parent.postMessage({ type: "CLOSE_GAME" }, "*");
                }
              } catch {}
            }}
          />
        </div>
      )}
    </div>
  );
}
