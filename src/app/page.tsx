"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ALL_CUES, ALL_TABLES, CueItem, TableItem } from "@/config/shopData";
import {
  ActiveModalType,
  BALL_RADIUS,
  Ball,
  BallGroup,
  CinematicCamState,
  GameMode,
  TABLE_HEIGHT,
  TABLE_WIDTH,
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
  const [isBallInHand, setIsBallInHand] = useState(false);
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
  const isDraggingBallInHandRef = useRef(false);
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
  const ballInHandHoverPosRef = useRef<{ x: number; y: number } | null>(null);
  const turnRef = useRef<"human" | "bot">("human");
  const humanGroupRef = useRef<BallGroup>("unassigned");
  const botGroupRef = useRef<BallGroup>("unassigned");
  const soundEnabledRef = useRef(true);
  const aimAssistLongRef = useRef(true);
  const selectedCueRef = useRef("cue_maple_standard");
  const selectedTableRef = useRef("classic");
  const modeRef = useRef<GameMode>(initialMode);
  const isPracticeRef = useRef(false);
  const prizeRef = useRef(initialPrize);
  const coinsRef = useRef(85000);
  const cinematicCamRef = useRef<CinematicCamState | null>(null);
  const cinematicTriggeredThisShotRef = useRef(false);
  const cinematicTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shotStartPosRef = useRef({ x: 200, y: 225 });
  const firstBallHitInShotRef = useRef<Ball | null>(null);
  const pottedInCurrentShotRef = useRef<{ ball: Ball; pocketId: number }[]>([]);
  const cueScratchedInShotRef = useRef(false);

  // Sync React state -> refs
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
    if (!isPracticeRef.current) {
      const nextTurn = turnRef.current === "human" ? "bot" : "human";
      if (nextTurn === "human") {
        ballInHandHoverPosRef.current = findFreeCueBallPos(ballsRef.current, activeGeom);
        isBallInHandRef.current = true;
        setIsBallInHand(true);
        turnRef.current = "human";
        setTurn("human");
        setTurnMessage("⏱️ انتهى وقت الخصم! الفاول لصالحك، اسحب الكرة البيضاء 🧤");
      } else {
        placeCueBallSafely(ballsRef.current, activeGeom);
        isBallInHandRef.current = false;
        setIsBallInHand(false);
        turnRef.current = "bot";
        setTurn("bot");
        setTurnMessage("⚠️ انتهى وقتك! الكرة في يد الخصم.");
      }
    } else {
      ballInHandHoverPosRef.current = findFreeCueBallPos(ballsRef.current, activeGeom);
      isBallInHandRef.current = true;
      setIsBallInHand(true);
      setTurnMessage("⏱️ انتهى وقت التصويب في التدريب!");
    }
  };

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

  const initBalls = (currentMode: GameMode) => {
    ballsRef.current = initBallsRack(currentMode, getActiveGeom());
    humanGroupRef.current = "unassigned";
    botGroupRef.current = "unassigned";
    turnRef.current = "human";
    isBallInHandRef.current = false;
    isShootingRef.current = false;
    botAimVisibleRef.current = false;
    ballInHandHoverPosRef.current = null;
    calledPocketIdRef.current = null;
    powerRef.current = 0;
    setHumanGroup("unassigned");
    setBotGroup("unassigned");
    setGroupAnnouncement(null);
    setTurn("human");
    setTurnMessage("طاولة مفتوحة: أسقط أي كرة لتحديد صنفك!");
    setIsBallInHand(false);
    setIsShooting(false);
    setCalledPocketId(null);
    setPower(0);
    setBallsVersion((v) => v + 1);
    firstBallHitInShotRef.current = null;
    pottedInCurrentShotRef.current = [];
    cueScratchedInShotRef.current = false;
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

      const tableCfg = ALL_TABLES.find((t) => t.id === selectedTableRef.current) || ALL_TABLES[0];
      const activeCueObj = ALL_CUES.find((c) => c.id === selectedCueRef.current) || ALL_CUES[0];

      renderTableScene({
        ctx,
        balls: ballsRef.current,
        tableCfg,
        activeCueObj,
        mode: modeRef.current,
        turn: turnRef.current,
        isPractice: isPracticeRef.current,
        isShooting: isShootingRef.current,
        isBotAiming: botAimVisibleRef.current,
        isBallInHand: isBallInHandRef.current,
        ballInHandHoverPos: ballInHandHoverPosRef.current,
        calledPocketId: calledPocketIdRef.current,
        humanGroup: humanGroupRef.current,
        aimAngle: aimAngleRef.current,
        power: powerRef.current,
        spinX: spinXRef.current,
        spinY: spinYRef.current,
        aimAssistLong: aimAssistLongRef.current,
        glossCanvas: glossCanvasRef.current,
        tableImageCache: tableImageCacheRef.current,
        cueImageCache: cueImageCacheRef.current,
        proceduralTableCache: proceduralTableCacheRef.current,
      });

      const isHumanTurn = turnRef.current === "human" || isPracticeRef.current;
      const anyMoving = stepPhysics({
        balls: ballsRef.current,
        dtNorm,
        timeScale: cinematicCamRef.current ? 0.58 : 1.0,
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
          onPotentialCinematic: (pocket, ball) => {
            if (cinematicTriggeredThisShotRef.current) return;
            const shotDist = Math.hypot(
              shotStartPosRef.current.x - pocket.x,
              shotStartPosRef.current.y - pocket.y
            );
            if (shotDist > 270 || ball.number === 8) {
              cinematicTriggeredThisShotRef.current = true;
              const camData: CinematicCamState = { active: true, pocket, ballNum: ball.number, ballColor: ball.color };
              cinematicCamRef.current = camData;
              setCinematicCam(camData);
              if (soundEnabledRef.current) playCinematicWhoosh();
              if (cinematicTimerRef.current) clearTimeout(cinematicTimerRef.current);
              cinematicTimerRef.current = setTimeout(() => {
                cinematicCamRef.current = null;
                setCinematicCam(null);
                cinematicTimerRef.current = null;
              }, 520);
            }
          },
          onPocketed: (ball, pocketId) => {
            if (ball.type === "cue") {
              cueScratchedInShotRef.current = true;
            } else {
              pottedInCurrentShotRef.current.push({ ball, pocketId });
            }
            if (cinematicCamRef.current) {
              if (cinematicTimerRef.current) clearTimeout(cinematicTimerRef.current);
              cinematicTimerRef.current = setTimeout(() => {
                cinematicCamRef.current = null;
                setCinematicCam(null);
                cinematicTimerRef.current = null;
              }, 180);
            }
          },
          onFirstBallHit: () => {},
        },
      });

      if (isShootingRef.current && !anyMoving) {
        isShootingRef.current = false;
        setIsShooting(false);
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

        resolveShotOutcome({
          mode: modeRef.current,
          isPractice: isPracticeRef.current,
          soundEnabled: soundEnabledRef.current,
          tableGeom: tableCfg.geometry,
          balls: ballsRef.current,
          pottedList,
          cueScratched,
          firstHit,
          activeShooter: turnRef.current,
          targetPocketForThisShot: activeShotCalledPocketRef.current,
          humanGroup: humanGroupRef.current,
          botGroup: botGroupRef.current,
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
            setIsBallInHand(enabled);
          },
          onMessage: setTurnMessage,
        });
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

  const tryPlaceBallInHand = (x: number, y: number) => {
    const clamped = clampBallInHandPos(x, y, getActiveGeom());
    const isOverlapping = ballsRef.current
      .slice(1)
      .some((b) => !b.isPotted && Math.hypot(b.x - clamped.x, b.y - clamped.y) < BALL_RADIUS * 2.2);
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
        setTurnMessage("✅ تم وضع الكرة! وجّه واسحب شريط القوة على اليسار للضرب.");
        if (soundEnabledRef.current) playBallClack(4);
      }
      return true;
    }
    setTurnMessage("⚠️ لا يمكن وضع الكرة فوق كرة أخرى!");
    return false;
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    if (isBallInHandRef.current) {
      if (isDraggingBallInHandRef.current || e.pointerType === "mouse") {
        ballInHandHoverPosRef.current = clampBallInHandPos(coords.x, coords.y, getActiveGeom());
      }
      return;
    }

    if ((turnRef.current !== "human" && !isPracticeRef.current) || isShootingRef.current) return;

    const cueBall = ballsRef.current[0];
    if (cueBall && (isAimDraggingRef.current || e.buttons === 1)) {
      aimAngleRef.current = Math.atan2(coords.y - cueBall.y, coords.x - cueBall.x);
    }
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    unlockAudio();
    if (showSpinPopover) setShowSpinPopover(false);
    if (showPocketPopover) setShowPocketPopover(false);

    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    const clickedPocket = getActiveGeom().pockets.find(
      (p) => Math.hypot(p.x - coords.x, p.y - coords.y) < 38
    );
    if (clickedPocket && !isBallInHandRef.current) {
      calledPocketIdRef.current = clickedPocket.id;
      setCalledPocketId(clickedPocket.id);
      if (soundEnabledRef.current) playBallClack(3);
      return;
    }

    if (isBallInHandRef.current) {
      isDraggingBallInHandRef.current = true;
      ballInHandHoverPosRef.current = clampBallInHandPos(coords.x, coords.y, getActiveGeom());
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
      return;
    }

    if ((turnRef.current === "human" || isPracticeRef.current) && !isShootingRef.current) {
      isAimDraggingRef.current = true;
      const cueBall = ballsRef.current[0];
      if (cueBall) {
        aimAngleRef.current = Math.atan2(coords.y - cueBall.y, coords.x - cueBall.x);
      }
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isBallInHandRef.current && isDraggingBallInHandRef.current) {
      isDraggingBallInHandRef.current = false;
      const coords = getCanvasCoords(e.clientX, e.clientY);
      const target = coords ? clampBallInHandPos(coords.x, coords.y, getActiveGeom()) : ballInHandHoverPosRef.current;
      if (target) tryPlaceBallInHand(target.x, target.y);
    }
    isAimDraggingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  const handleCanvasPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isAimDraggingRef.current = false;
    isDraggingBallInHandRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
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
    if (isShootingRef.current || isBallInHandRef.current || (!isPracticeRef.current && turnRef.current !== "human")) return;
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
    if (finalPower >= 12 && (isPracticeRef.current || turnRef.current === "human") && !isShootingRef.current && !isBallInHandRef.current) {
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
    if (modeRef.current !== "8-ball" || humanGroupRef.current === "unassigned") return false;
    const expected = humanGroupRef.current === "solids" ? "solid" : "stripe";
    return !ballsRef.current.some((b) => !b.isPotted && b.number !== 8 && b.type === expected);
  };

  const handleShoot = (explicitPower?: number) => {
    unlockAudio();
    if (isShootingRef.current || isBallInHandRef.current) return;
    if (turnRef.current !== "human" && !isPracticeRef.current) return;

    if (isHumanOnEightBall() && calledPocketIdRef.current === null) {
      setTurnMessage("🎯 اختر الجيب الهدف للكرة السوداء 8 أولاً بالضغط عليه!");
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
        if (cueBall.isPotted) placeCueBallSafely(ballsRef.current, activeGeom);

        const plan = computeBotShot(ballsRef.current, botGroupRef.current, modeRef.current, activeGeom);
        if (!plan) return;

        calledPocketIdRef.current = plan.pocketId;
        setCalledPocketId(plan.pocketId);
        activeShotCalledPocketRef.current = plan.pocketId;
        setTurnMessage("🤖 الخصم يوجّه العصا نحو الهدف...");

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
            activeShotAimAngleRef.current = plan.angle;
            spinAppliedInCurrentShotRef.current = false;
            shotStartPosRef.current = { x: cueBall.x, y: cueBall.y };
            cinematicTriggeredThisShotRef.current = false;

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
          className="w-full h-full flex flex-col bg-[#020b14] overflow-hidden touch-none"
          style={rotatedStyle ? { ...rotatedStyle, zIndex: 50 } : undefined}
        >
          <TableHUD
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
            spinX={spinX}
            spinY={spinY}
            showSpinPopover={showSpinPopover}
            setShowSpinPopover={setShowSpinPopover}
            showPocketPopover={showPocketPopover}
            setShowPocketPopover={setShowPocketPopover}
            calledPocketId={calledPocketId}
            isPortrait={isPortrait}
            isVirtualLandscape={isVirtualLandscape}
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
            onOpenShop={() => {
              setShopTab("cues");
              setActiveModal("shop");
            }}
            onToggleVirtualLandscape={() => setIsVirtualLandscape((v) => !v)}
            onExit={() => {
              setGameOver(null);
              setIsVirtualLandscape(false);
              setCurrentView("menu");
            }}
          />

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
              disabled={(!isPractice && turn !== "human") || isShooting || isBallInHand}
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
              {isBallInHand && (
                <div
                  dir="rtl"
                  className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-blue-950/95 border border-blue-400 text-blue-100 px-3 py-1 rounded-full text-[10px] font-black shadow-lg pointer-events-none whitespace-nowrap"
                >
                  🧤 الكرة في يدك: اسحبها على الطاولة ثم ارفع إصبعك
                </div>
              )}

              {!isBallInHand && (
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
                    className="absolute top-0 left-0 right-0 z-30 h-7 bg-black/85 border-b border-amber-500/40 flex items-center justify-between px-4 pointer-events-none"
                  >
                    <span className="text-[10px] font-black text-red-500">🔴 لقطة قريبة</span>
                    <span className="text-[10px] font-black text-amber-300">🎬 POCKET CAM</span>
                    <span className="text-[10px] font-bold text-slate-300">{cinematicCam.pocket.name}</span>
                  </div>
                  <div
                    dir="rtl"
                    className="absolute bottom-0 left-0 right-0 z-30 h-7 bg-black/85 border-t border-amber-500/40 flex items-center justify-between px-4 pointer-events-none"
                  >
                    <span className="text-[10px] font-black text-emerald-400">🎯 SLOW MOTION</span>
                    <span className="text-[10px] font-mono text-amber-400 font-extrabold">
                      {cinematicCam.ballNum === 8 ? "🏆 الكرة 8!" : `كرة (${cinematicCam.ballNum})`}
                    </span>
                  </div>
                </>
              )}

              <div
                className="flex items-center justify-center transition-transform duration-300 ease-out will-change-transform"
                style={{
                  transformOrigin: cinematicCam
                    ? `${(cinematicCam.pocket.x / TABLE_WIDTH) * 100}% ${(cinematicCam.pocket.y / TABLE_HEIGHT) * 100}%`
                    : "50% 50%",
                  transform: cinematicCam ? "scale(1.28)" : "scale(1)",
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
                  className={`rounded-xl sm:rounded-2xl border-2 sm:border-4 touch-none select-none block ${
                    isBallInHand ? "cursor-grab" : "cursor-crosshair"
                  }`}
                />
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
            currentTable={currentTable}
            activeCue={activeCue}
            mode={mode}
            isPractice={isPractice}
            stake={stake}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            onToggleAimAssist={() => setAimAssistLong(!aimAssistLong)}
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
