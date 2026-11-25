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
  POCKETS,
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
  getCueForceMultiplier,
  initBallsRack,
  stepPhysics,
} from "@/engine/physics";
import { createBallGlossCanvas, renderTableScene } from "@/engine/renderer";
import { Lobby } from "@/components/Lobby";
import { ShopModal } from "@/components/ShopModal";
import { GameModals } from "@/components/GameModals";

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
  const opponentName = searchParams.get("opponentName") || "أحمد_البرنس";
  const opponentAvatar =
    searchParams.get("opponentAvatar") || "https://api.dicebear.com/7.x/bottts/svg?seed=AhmedEG";
  const opponentFlag = searchParams.get("opponentFlag") || "🇪🇬";

  // Navigation & Modals
  const [currentView, setCurrentView] = useState<"menu" | "table">("menu");
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);

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
  const [mode, setMode] = useState<GameMode>(initialMode);
  const [isPractice, setIsPractice] = useState(false);
  const [stake, setStake] = useState(initialStake);
  const [prize, setPrize] = useState(initialPrize);
  const [ballsVersion, setBallsVersion] = useState(0);

  // Official 8-Ball Groups Assignment
  const [humanGroup, setHumanGroup] = useState<BallGroup>("unassigned");
  const [botGroup, setBotGroup] = useState<BallGroup>("unassigned");
  const [groupAnnouncement, setGroupAnnouncement] = useState<{
    title: string;
    human: string;
    bot: string;
  } | null>(null);

  // Call Pocket (Open pockets for regular balls; required only for 8-ball)
  const [calledPocketId, setCalledPocketId] = useState<number | null>(null);
  const activeShotCalledPocketRef = useRef<number | null>(null);
  const activeShotAimAngleRef = useRef<number>(0);
  const spinAppliedInCurrentShotRef = useRef<boolean>(false);

  const [isBallInHand, setIsBallInHand] = useState(false);
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

  // Vertical Left Power Meter Refs (0-lag direct DOM updates)
  const powerTrackRef = useRef<HTMLDivElement | null>(null);
  const powerFillRef = useRef<HTMLDivElement | null>(null);
  const powerHandleRef = useRef<HTMLDivElement | null>(null);
  const powerTextRef = useRef<HTMLDivElement | null>(null);
  const isVerticalMeterDraggingRef = useRef<boolean>(false);

  // Table Engine State
  const [turn, setTurn] = useState<"human" | "bot">("human");
  const [turnMessage, setTurnMessage] = useState("طاولة مفتوحة: أسقط أي كرة لتحديد صنفك!");
  const [power, setPower] = useState(0);
  const [aimAngle, setAimAngle] = useState(0);
  const [isShooting, setIsShooting] = useState(false);
  const [gameOver, setGameOver] = useState<string | null>(null);

  // Live Refs synced for 60/120fps Canvas Loop
  const aimAngleRef = useRef<number>(0);
  const powerRef = useRef<number>(0);
  const spinXRef = useRef<number>(0);
  const spinYRef = useRef<number>(0);
  const calledPocketIdRef = useRef<number | null>(null);
  const isShootingRef = useRef<boolean>(false);
  const isBallInHandRef = useRef<boolean>(false);
  const ballInHandHoverPosRef = useRef<{ x: number; y: number } | null>(null);
  const turnRef = useRef<"human" | "bot">("human");
  const humanGroupRef = useRef<BallGroup>("unassigned");
  const botGroupRef = useRef<BallGroup>("unassigned");
  const soundEnabledRef = useRef<boolean>(true);
  const aimAssistLongRef = useRef<boolean>(true);
  const selectedCueRef = useRef<string>("cue_maple_standard");
  const selectedTableRef = useRef<string>("classic");
  const modeRef = useRef<GameMode>(initialMode);
  const isPracticeRef = useRef<boolean>(false);
  const prizeRef = useRef<number>(initialPrize);
  const coinsRef = useRef<number>(85000);
  const glossCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const proceduralTableCacheRef = useRef<Record<string, HTMLCanvasElement>>({});
  const cueImageCacheRef = useRef<Record<string, HTMLImageElement>>({});
  const tableImageCacheRef = useRef<Record<string, HTMLImageElement>>({});

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

  // Cinematic Pocket Cam
  const [cinematicCam, setCinematicCam] = useState<CinematicCamState | null>(null);
  const cinematicCamRef = useRef<CinematicCamState | null>(null);
  const cinematicTriggeredThisShotRef = useRef<boolean>(false);
  const cinematicTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shotStartPosRef = useRef<{ x: number; y: number }>({ x: 200, y: 225 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballsRef = useRef<Ball[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Shot Resolution Tracking
  const firstBallHitInShotRef = useRef<Ball | null>(null);
  const pottedInCurrentShotRef = useRef<{ ball: Ball; pocketId: number }[]>([]);
  const cueScratchedInShotRef = useRef<boolean>(false);

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

  // Lazy-load ONLY active table and cue images
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

  // Fit exact 2:1 Canvas inside available widescreen area
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
      const h = Math.floor(w / 2);
      setCanvasDisplaySize({ w, h });
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

  const handleTurnTimeout = () => {
    if (soundEnabledRef.current) playFoulBuzzer();
    if (!isPracticeRef.current) {
      const nextTurn = turnRef.current === "human" ? "bot" : "human";
      turnRef.current = nextTurn;
      setTurn(nextTurn);
      if (nextTurn === "human") {
        isBallInHandRef.current = true;
        setIsBallInHand(true);
        setTurnMessage("⏱️ انتهى وقت الخصم! الفاول لصالحك، الكرة في يدك 🧤");
      } else {
        setTurnMessage("⚠️ انتهى وقتك! الكرة في يد الخصم.");
        setTimeout(() => {
          const cb = ballsRef.current[0];
          if (cb) {
            cb.x = 82 + 180 + Math.random() * 80;
            cb.y = TABLE_HEIGHT / 2 + (Math.random() - 0.5) * 80;
            cb.vx = 0;
            cb.vy = 0;
            cb.isPotted = false;
          }
        }, 400);
      }
    } else {
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
    ballsRef.current = initBallsRack(currentMode);
    humanGroupRef.current = "unassigned";
    botGroupRef.current = "unassigned";
    turnRef.current = "human";
    isBallInHandRef.current = false;
    isShootingRef.current = false;
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
    } else if (winner === "human") {
      if (soundEnabledRef.current) playSuccessChime();
    }
    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "GAME_OVER",
          game: "billiards",
          winner,
          coins: winner === "human" ? curPrize : 0,
          isHuman: winner === "human",
        },
        "*"
      );
    }
  };

  // Shop Handlers
  const handleEquipCue = (cueId: string) => {
    selectedCueRef.current = cueId;
    setSelectedCue(cueId);
    try { localStorage.setItem("cuemaster_selected_cue", cueId); } catch {}
    if (soundEnabledRef.current) playSuccessChime();
  };

  const handleBuyCue = (cue: CueItem) => {
    if (unlockedCues.includes(cue.id)) {
      handleEquipCue(cue.id);
      return;
    }
    if (coins < cue.price) {
      alert("❌ رصيدك من الكوينز غير كافٍ!");
      return;
    }
    const newUnlocked = [...unlockedCues, cue.id];
    saveCoins(coins - cue.price);
    setUnlockedCues(newUnlocked);
    selectedCueRef.current = cue.id;
    setSelectedCue(cue.id);
    try {
      localStorage.setItem("cuemaster_unlocked_cues", JSON.stringify(newUnlocked));
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
    if (unlockedTables.includes(tbl.id)) {
      handleEquipTable(tbl.id);
      return;
    }
    if (coins < tbl.price) {
      alert("❌ رصيدك من الكوينز غير كافٍ لشراء هذه الطاولة!");
      return;
    }
    const newUnlocked = [...unlockedTables, tbl.id];
    saveCoins(coins - tbl.price);
    setUnlockedTables(newUnlocked);
    selectedTableRef.current = tbl.id;
    setSelectedTable(tbl.id);
    try {
      localStorage.setItem("cuemaster_unlocked_tables", JSON.stringify(newUnlocked));
      localStorage.setItem("cuemaster_selected_table", tbl.id);
    } catch {}
    if (soundEnabledRef.current) playSuccessChime();
  };

  // Main Delta-Time Physics & Canvas Render Loop (Depends ONLY on [currentView])
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
      // Normalized to 60fps (1.0 at 60Hz, 0.5 at 120Hz, capped at 2.2)
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

      const anyMoving = stepPhysics({
        balls: ballsRef.current,
        dtNorm,
        timeScale: cinematicCamRef.current ? 0.58 : 1.0,
        tableCfg,
        cueActive: activeCueObj,
        soundEnabled: soundEnabledRef.current,
        activeShotCalledPocketId: activeShotCalledPocketRef.current,
        activeShotAimAngle: activeShotAimAngleRef.current,
        spinX: spinXRef.current,
        spinY: spinYRef.current,
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
              const camData: CinematicCamState = {
                active: true,
                pocket,
                ballNum: ball.number,
                ballColor: ball.color,
              };
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

      // Handle Shot Completion & Official 8-Ball Rules (Open Pockets + Call Pocket on 8-Ball Only)
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
        const activeShooter = turnRef.current;
        const targetPocketForThisShot = activeShotCalledPocketRef.current;

        pottedInCurrentShotRef.current = [];
        cueScratchedInShotRef.current = false;
        firstBallHitInShotRef.current = null;

        const balls = ballsRef.current;

        if (modeRef.current === "8-ball") {
          const shooterGroup = activeShooter === "human" ? humanGroupRef.current : botGroupRef.current;
          const remainingTargetBalls = balls.filter(
            (b) =>
              !b.isPotted &&
              b.number !== 8 &&
              (shooterGroup === "solids" ? b.type === "solid" : b.type === "stripe")
          );

          // 1. Check 8-Ball Potting
          const black8Entry = pottedList.find((item) => item.ball.number === 8);
          if (black8Entry) {
            if (cueScratched) {
              if (activeShooter === "human") triggerGameOver("bot", "❌ خسرت المباراة! أسقطت الكرة البيضاء مع الكرة السوداء رقم 8.");
              else triggerGameOver("human", "🎉 مبروك الفوز! الخصم أسقط الكرة البيضاء مع الكرة السوداء 8.");
              return;
            }
            if (remainingTargetBalls.length > 0 || shooterGroup === "unassigned") {
              if (activeShooter === "human") triggerGameOver("bot", "❌ خسرت المباراة! أسقطت الكرة 8 قبل تصفية كراتك.");
              else triggerGameOver("human", "🎉 مبروك الفوز! الخصم أسقط الكرة 8 قبل تصفية كراته.");
              return;
            }
            if (targetPocketForThisShot !== null && black8Entry.pocketId !== targetPocketForThisShot) {
              if (activeShooter === "human") triggerGameOver("bot", "❌ خسرت المباراة! الكرة السوداء 8 سقطت في جيب غير الجيب المحدد.");
              else triggerGameOver("human", "🎉 مبروك الفوز! الخصم أسقط الكرة 8 في جيب غير المحدد.");
              return;
            }
            if (activeShooter === "human") triggerGameOver("human", "🏆 مبروك الفوز الساحق! أحرزت الكرة السوداء 8 في الجيب المحدد!");
            else triggerGameOver("bot", "خسرت المباراة! الخصم أحرز الكرة السوداء رقم 8.");
            return;
          }

          // 2. Check Foul Rules
          let foulOccurred = false;
          let foulReason = "";

          if (cueScratched) {
            foulOccurred = true;
            foulReason = "سقوط الكرة البيضاء (Scratch)";
          } else if (!firstHit) {
            foulOccurred = true;
            foulReason = "الكرة البيضاء لم تلمس أي كرة";
          } else if (shooterGroup === "unassigned" && firstHit.number === 8) {
            foulOccurred = true;
            foulReason = "لا يجوز لمس الكرة 8 أولاً";
          } else if (shooterGroup !== "unassigned") {
            const expectedType = shooterGroup === "solids" ? "solid" : "stripe";
            const shooterBallsPottedThisShot = pottedList.filter((item) => item.ball.type === expectedType).length;
            const hadGroupBallsBeforeShot = remainingTargetBalls.length + shooterBallsPottedThisShot > 0;

            if (hadGroupBallsBeforeShot) {
              if (firstHit.type !== expectedType) {
                foulOccurred = true;
                foulReason =
                  firstHit.number === 8
                    ? "لمست الكرة 8 قبل تصفية كراتك"
                    : shooterGroup === "solids"
                    ? "لمست كرة ألوان وصنفك سادة"
                    : "لمست كرة سادة وصنفك ألوان";
              }
            } else if (firstHit.number !== 8) {
              foulOccurred = true;
              foulReason = "أنهيت كراتك، يجب لمس الكرة 8 أولاً";
            }
          }

          if (foulOccurred) {
            if (soundEnabledRef.current) playFoulBuzzer();
            if (!isPracticeRef.current) {
              const nextTurn = activeShooter === "human" ? "bot" : "human";
              turnRef.current = nextTurn;
              setTurn(nextTurn);
              if (nextTurn === "human") {
                isBallInHandRef.current = true;
                setIsBallInHand(true);
                setTurnMessage(`✋ فاول على الخصم (${foulReason}): اسحب الكرة البيضاء!`);
              } else {
                setTurnMessage(`⚠️ فاول عليك (${foulReason}): دور الخصم.`);
                setTimeout(() => {
                  const cb = ballsRef.current[0];
                  if (cb) {
                    cb.x = 82 + 180 + Math.random() * 80;
                    cb.y = TABLE_HEIGHT / 2 + (Math.random() - 0.5) * 80;
                    cb.vx = 0;
                    cb.vy = 0;
                    cb.isPotted = false;
                  }
                }, 400);
              }
            } else {
              isBallInHandRef.current = true;
              setIsBallInHand(true);
              setTurnMessage(`✋ فاول (${foulReason}): ضع الكرة البيضاء!`);
            }
            return;
          }

          // 3. Open Pockets for regular balls! (No respot for regular pots)
          const legalPottedBalls = pottedList.map((entry) => entry.ball);

          // Assign Groups on first legal solid/stripe pot
          if (humanGroupRef.current === "unassigned" && legalPottedBalls.length > 0) {
            const firstLegal = legalPottedBalls.find((b) => b.type === "solid" || b.type === "stripe");
            if (firstLegal) {
              const isSolid = firstLegal.type === "solid";
              if (activeShooter === "human") {
                const hGrp: BallGroup = isSolid ? "solids" : "stripes";
                const bGrp: BallGroup = isSolid ? "stripes" : "solids";
                humanGroupRef.current = hGrp;
                botGroupRef.current = bGrp;
                setHumanGroup(hGrp);
                setBotGroup(bGrp);
                setGroupAnnouncement({
                  title: "🎉 تم تعيين الصنف!",
                  human: isSolid ? "سادة 🟡 (1-7)" : "ألوان 🔵 (9-15)",
                  bot: isSolid ? "ألوان 🔵 (9-15)" : "سادة 🟡 (1-7)",
                });
              } else {
                const bGrp: BallGroup = isSolid ? "solids" : "stripes";
                const hGrp: BallGroup = isSolid ? "stripes" : "solids";
                botGroupRef.current = bGrp;
                humanGroupRef.current = hGrp;
                setBotGroup(bGrp);
                setHumanGroup(hGrp);
                setGroupAnnouncement({
                  title: "🤖 الخصم عيّن الأصناف!",
                  human: isSolid ? "ألوان 🔵 (9-15)" : "سادة 🟡 (1-7)",
                  bot: isSolid ? "سادة 🟡 (1-7)" : "ألوان 🔵 (9-15)",
                });
              }
              setTimeout(() => setGroupAnnouncement(null), 1000);
            }
          }

          const currentShooterGroup = activeShooter === "human" ? humanGroupRef.current : botGroupRef.current;
          const pottedOwnBall = legalPottedBalls.some((b) =>
            currentShooterGroup === "unassigned"
              ? b.type === "solid" || b.type === "stripe"
              : currentShooterGroup === "solids"
              ? b.type === "solid"
              : b.type === "stripe"
          );

          const remainingHumanAfter = balls.filter(
            (b) =>
              !b.isPotted &&
              b.number !== 8 &&
              humanGroupRef.current !== "unassigned" &&
              (humanGroupRef.current === "solids" ? b.type === "solid" : b.type === "stripe")
          );

          if (pottedOwnBall) {
            if (activeShooter === "human" && remainingHumanAfter.length === 0 && humanGroupRef.current !== "unassigned") {
              setTurnMessage("🏆 أنهيت كراتك! حدد الجيب بالضغط عليه لإسقاط الكرة 8!");
            } else if (activeShooter === "bot") {
              const remainingBotAfter = balls.filter(
                (b) =>
                  !b.isPotted &&
                  b.number !== 8 &&
                  (botGroupRef.current === "solids" ? b.type === "solid" : b.type === "stripe")
              );
              setTurnMessage(
                remainingBotAfter.length === 0
                  ? "⚠️ الخصم أنهى كراته ويلعب على الكرة 8!"
                  : "🤖 ضربة ناجحة للخصم، دوره مستمر..."
              );
            } else {
              setTurnMessage("🔥 ضربة ناجحة! دورك مستمر.");
            }
          } else {
            if (!isPracticeRef.current) {
              const nextT = activeShooter === "human" ? "bot" : "human";
              turnRef.current = nextT;
              setTurn(nextT);
              if (nextT === "human") {
                setTurnMessage(
                  remainingHumanAfter.length === 0 && humanGroupRef.current !== "unassigned"
                    ? "🏆 دورك على الكرة 8! اضغط على الجيب الهدف أولاً."
                    : "دورك الآن!"
                );
              } else {
                setTurnMessage("دور الخصم الآن...");
              }
            }
          }
        } else {
          // Snooker fallback
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
          } else if (pottedList.length === 0 && !isPracticeRef.current) {
            const nextT = activeShooter === "human" ? "bot" : "human";
            turnRef.current = nextT;
            setTurn(nextT);
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(frameLoop);
    };

    animFrameRef.current = requestAnimationFrame(frameLoop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      clearCinematicCam();
    };
  }, [currentView]);

  // Screen -> Table Coordinate Mapping (handles 90deg Virtual Landscape)
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
      aimAngleRef.current = Math.atan2(coords.y - cueBall.y, coords.x - cueBall.x);
    }
  };

  const tryPlaceBallInHand = (x: number, y: number) => {
    const clamped = clampBallInHandPos(x, y);
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

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    unlockAudio();
    if (showSpinPopover) setShowSpinPopover(false);
    if (showPocketPopover) setShowPocketPopover(false);

    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    // Tap a pocket to Call It (essential on 8-ball, optional anytime)
    const clickedPocket = POCKETS.find((p) => Math.hypot(p.x - coords.x, p.y - coords.y) < 38);
    if (clickedPocket && !isBallInHandRef.current) {
      calledPocketIdRef.current = clickedPocket.id;
      setCalledPocketId(clickedPocket.id);
      if (soundEnabledRef.current) playBallClack(3);
      return;
    }

    if (isBallInHandRef.current) {
      isDraggingBallInHandRef.current = true;
      ballInHandHoverPosRef.current = clampBallInHandPos(coords.x, coords.y);
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
      const target = coords ? clampBallInHandPos(coords.x, coords.y) : ballInHandHoverPosRef.current;
      if (target) tryPlaceBallInHand(target.x, target.y);
    }
    if (isAimDraggingRef.current) {
      isAimDraggingRef.current = false;
      setAimAngle(aimAngleRef.current);
    }
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

  const updatePowerFromPointer = (clientX: number, clientY: number, trackEl: HTMLElement) => {
    const rect = trackEl.getBoundingClientRect();
    const relativeProgress =
      isVirtualLandscape && isPortrait
        ? (rect.right - clientX) / Math.max(1, rect.width)
        : (clientY - rect.top) / Math.max(1, rect.height);
    const clamped = Math.min(100, Math.max(0, Math.round(relativeProgress * 100)));
    applyPowerVisual(clamped);
  };

  const handlePowerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    unlockAudio();
    if (isShootingRef.current || isBallInHandRef.current || (!isPracticeRef.current && turnRef.current !== "human")) {
      return;
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

  const isHumanOnEightBall = () => {
    if (modeRef.current !== "8-ball" || humanGroupRef.current === "unassigned") return false;
    const expected = humanGroupRef.current === "solids" ? "solid" : "stripe";
    return !ballsRef.current.some((b) => !b.isPotted && b.number !== 8 && b.type === expected);
  };

  const handleShoot = (explicitPower?: number) => {
    unlockAudio();
    if (isShootingRef.current || isBallInHandRef.current) return;
    if (turnRef.current !== "human" && !isPracticeRef.current) return;

    // Require Call Pocket ONLY when shooting at the 8-ball
    if (isHumanOnEightBall() && calledPocketIdRef.current === null) {
      setTurnMessage("🎯 اختر الجيب الهدف للكرة السوداء 8 أولاً بالضغط عليه!");
      applyPowerVisual(0);
      setPower(0);
      return;
    }

    const cueBall = ballsRef.current[0];
    if (!cueBall || cueBall.isPotted) return;

    const shotPower =
      explicitPower !== undefined ? explicitPower : powerRef.current >= 12 ? powerRef.current : 65;

    activeShotCalledPocketRef.current = calledPocketIdRef.current;
    activeShotAimAngleRef.current = aimAngleRef.current;
    spinAppliedInCurrentShotRef.current = false;
    shotStartPosRef.current = { x: cueBall.x, y: cueBall.y };
    cinematicTriggeredThisShotRef.current = false;

    isShootingRef.current = true;
    setIsShooting(true);
    if (soundEnabledRef.current) playCueStrike(shotPower);

    const curCue = ALL_CUES.find((c) => c.id === selectedCueRef.current) || ALL_CUES[0];
    const forceBonus = getCueForceMultiplier(curCue);
    const speed = (shotPower / 100) * 36 * forceBonus;
    cueBall.vx = Math.cos(aimAngleRef.current) * speed;
    cueBall.vy = Math.sin(aimAngleRef.current) * speed;
  };

  // Smart Cut-Shot Bot AI Execution
  useEffect(() => {
    if (currentView !== "table") return;
    if (turn === "bot" && !isShooting && !gameOver && !isPractice && !isBallInHand) {
      const botTimer = setTimeout(() => {
        const cueBall = ballsRef.current[0];
        if (!cueBall || cueBall.isPotted) return;

        const plan = computeBotShot(ballsRef.current, botGroupRef.current, modeRef.current);
        if (!plan) return;

        calledPocketIdRef.current = plan.pocketId;
        setCalledPocketId(plan.pocketId);
        activeShotCalledPocketRef.current = plan.pocketId;

        aimAngleRef.current = plan.angle;
        setAimAngle(plan.angle);
        activeShotAimAngleRef.current = plan.angle;
        spinAppliedInCurrentShotRef.current = false;
        shotStartPosRef.current = { x: cueBall.x, y: cueBall.y };
        cinematicTriggeredThisShotRef.current = false;

        isShootingRef.current = true;
        setIsShooting(true);
        if (soundEnabledRef.current) playCueStrike(75);
        cueBall.vx = Math.cos(plan.angle) * plan.speed;
        cueBall.vy = Math.sin(plan.angle) * plan.speed;
      }, 500);

      return () => clearTimeout(botTimer);
    }
  }, [currentView, turn, isShooting, gameOver, isPractice, isBallInHand, botGroup]);

  // Launch Match with Stake Deduction
  const startMatch = (targetMode: GameMode, practice = false, tableStake = 100) => {
    unlockAudio();
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

  // Remaining Balls for Top Bar Ball Tray (recomputed cleanly via ballsVersion)
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

  const activePocketObj = POCKETS.find((p) => p.id === calledPocketId);

  return (
    <div
      className="relative w-screen h-dvh bg-[#020b14] text-slate-100 flex flex-col font-sans select-none overflow-hidden"
      dir="rtl"
    >
      {currentView === "menu" ? (
        <Lobby
          username={username}
          avatar={avatar}
          coins={coins}
          gems={gems}
          onAddCoins={(amt) => saveCoins(coins + amt)}
          onAddGems={(amt) => saveGems(gems + amt)}
          onStartMatch={startMatch}
          onOpenModal={(modal, tab) => {
            if (tab) setShopTab(tab);
            setActiveModal(modal);
          }}
        />
      ) : (
        /* ========================================================= */
        /* VIEW 2: FULL WIDESCREEN TABLE (NO SCROLL, LEFT + TOP BAR) */
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
          {/* COMPACT TOP HUD BAR: Player + Remaining Ball Tray + Spin Cue Ball + Fine Aim + Opponent */}
          <header className="h-11 sm:h-12 shrink-0 flex items-center justify-between gap-1.5 px-2 bg-slate-950/95 border-b border-slate-800/90 z-30">
            {/* Player + Remaining Ball Tray */}
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
                <img
                  src={avatar}
                  alt="You"
                  className="absolute w-6 h-6 rounded-md bg-slate-800 border border-amber-400 object-cover"
                />
              </div>

              <div className="leading-tight min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-black text-amber-300 truncate max-w-[60px] sm:max-w-[90px]">
                    {username}
                  </span>
                  {turn === "human" && !isPractice && (
                    <span
                      className={`text-[9px] font-black px-1 rounded font-mono ${
                        turnTimeLeft <= 5 ? "bg-rose-500/25 text-rose-400" : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {turnTimeLeft}s
                    </span>
                  )}
                </div>

                {/* Remaining Balls Tray */}
                <div className="flex items-center gap-0.5 mt-0.5">
                  {humanGroup === "unassigned" ? (
                    <span className="text-[9px] font-bold text-amber-400">طاولة مفتوحة</span>
                  ) : (
                    humanRemainingBalls.map((b) => (
                      <span
                        key={b.id}
                        title={`كرة ${b.number}`}
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-white/50 flex items-center justify-center text-[7px] sm:text-[8px] font-black text-slate-950 shadow-sm shrink-0"
                        style={{
                          background:
                            b.type === "stripe"
                              ? `linear-gradient(to bottom, #ffffff 25%, ${b.color} 25%, ${b.color} 75%, #ffffff 75%)`
                              : b.color,
                          color: b.number === 8 ? "#ffffff" : "#0f172a",
                        }}
                      >
                        {b.number}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Center Strip: Spin Cue Ball ("الكره") + Fine Aim + Call Pocket + Prize/Status */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              {/* Spin Cue Ball ("الكره") */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowPocketPopover(false);
                    setShowSpinPopover((prev) => !prev);
                  }}
                  className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-white via-slate-200 to-slate-400 border-2 shadow-inner flex items-center justify-center cursor-pointer active:scale-95 ${
                    showSpinPopover ? "border-amber-300 ring-2 ring-amber-400/50" : "border-amber-500/80"
                  }`}
                  title="ضبط نقطة ضرب الكرة"
                >
                  <div className="absolute w-full h-[1px] bg-slate-400/50 pointer-events-none" />
                  <div className="absolute h-full w-[1px] bg-slate-400/50 pointer-events-none" />
                  <div
                    className="w-2.5 h-2.5 bg-rose-600 rounded-full border border-white shadow pointer-events-none"
                    style={{ transform: `translate(${spinX * 10}px, ${spinY * 10}px)` }}
                  />
                </button>

                {showSpinPopover && (
                  <div
                    dir="rtl"
                    className="absolute top-11 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border-2 border-amber-400/80 rounded-2xl p-2.5 shadow-2xl flex flex-col items-center gap-1.5 w-32"
                  >
                    <span className="text-[10px] font-black text-amber-300">نقطة ضرب الكرة</span>
                    <div
                      onPointerDown={(e) => {
                        isSpinDraggingRef.current = true;
                        try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
                        updateSpinFromPointer(e.clientX, e.clientY, e.currentTarget);
                      }}
                      onPointerMove={(e) => {
                        if (!isSpinDraggingRef.current) return;
                        updateSpinFromPointer(e.clientX, e.clientY, e.currentTarget);
                      }}
                      onPointerUp={(e) => {
                        isSpinDraggingRef.current = false;
                        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
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

              {/* Call Pocket Quick Selector (Required for 8-ball, optional otherwise) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowSpinPopover(false);
                    setShowPocketPopover((prev) => !prev);
                  }}
                  className={`h-7 px-2 rounded-lg border text-[10px] font-black flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    activePocketObj
                      ? "bg-amber-500/20 border-amber-400 text-amber-300"
                      : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300"
                  }`}
                  title="تحديد الجيب (مطلوب للكرة 8)"
                >
                  <span>🎯</span>
                  <span className="hidden md:inline">{activePocketObj ? activePocketObj.name : "مفتوح"}</span>
                </button>

                {showPocketPopover && (
                  <div
                    dir="rtl"
                    className="absolute top-10 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border-2 border-amber-400/70 rounded-xl p-2 shadow-2xl grid grid-cols-3 gap-1 w-52"
                  >
                    {POCKETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          calledPocketIdRef.current = p.id;
                          setCalledPocketId(p.id);
                          setShowPocketPopover(false);
                        }}
                        className={`px-1.5 py-1 rounded text-[9px] font-black cursor-pointer ${
                          calledPocketId === p.id ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Prize + Concise Status Pill */}
              <div
                dir="rtl"
                className="hidden sm:flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1 max-w-[200px] lg:max-w-[250px]"
              >
                <span className="text-[10px] font-black text-amber-400 shrink-0">
                  {isPractice ? "تدريب" : `${prize.toLocaleString()} 🪙`}
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-[10px] font-bold text-amber-100 truncate">{turnMessage}</span>
              </div>
            </div>

            {/* Opponent + Quick Actions */}
            <div className="flex items-center gap-1.5">
              <div className="hidden md:block text-right leading-tight" dir="rtl">
                <div className="flex items-center gap-1 text-[11px] font-black text-slate-200">
                  <span>{opponentFlag}</span>
                  <span className="truncate max-w-[75px]">{opponentName}</span>
                </div>
                <div className="text-[9px] font-bold text-slate-400">
                  {isPractice
                    ? "وضع التدريب"
                    : botGroup === "unassigned"
                    ? "مفتوحة"
                    : `${botGroup === "solids" ? "سادة 🟡" : "ألوان 🔵"} (${botRemainingCount})`}
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
                <img
                  src={opponentAvatar}
                  alt="Opponent"
                  className="absolute w-6 h-6 rounded-md bg-slate-800 border border-slate-700 object-cover"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setShopTab("cues");
                  setActiveModal("shop");
                }}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/50 flex items-center justify-center text-amber-300 text-xs cursor-pointer"
                title="المتجر"
              >
                🛒
              </button>
              {isPortrait && (
                <button
                  type="button"
                  onClick={() => setIsVirtualLandscape(!isVirtualLandscape)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center text-xs cursor-pointer ${
                    isVirtualLandscape
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-400"
                      : "bg-slate-800 text-slate-300 border-slate-700"
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

          {/* MAIN WIDESCREEN STAGE: Small Left Power Strip + Full Widescreen Table */}
          <div className="flex-1 min-h-0 flex flex-row items-stretch overflow-hidden w-full">
            <aside className="w-11 sm:w-13 shrink-0 flex flex-col items-center justify-between py-1.5 px-1 bg-slate-950/85 border-r border-slate-800/80 z-20 select-none">
              <div
                ref={powerTrackRef}
                onPointerDown={handlePowerPointerDown}
                onPointerMove={handlePowerPointerMove}
                onPointerUp={handlePowerPointerUp}
                onPointerCancel={handlePowerPointerCancel}
                className="relative flex-1 w-8 sm:w-9 min-h-[100px] bg-slate-900 rounded-xl border-2 border-emerald-500/70 shadow-inner cursor-pointer touch-none flex flex-col justify-start p-0.5 overflow-hidden"
              >
                <div className="absolute inset-0 flex flex-col justify-between py-2 px-1 pointer-events-none opacity-40">
                  {[25, 50, 75, 100].map((val) => (
                    <div key={val} className="flex items-center justify-between w-full">
                      <div className="w-1.5 h-[1px] bg-white" />
                      <span className="text-[7px] font-mono text-white font-bold">{val}</span>
                      <div className="w-1.5 h-[1px] bg-white" />
                    </div>
                  ))}
                </div>

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

                <div
                  ref={powerHandleRef}
                  className="absolute left-1/2 -translate-x-1/2 w-6 sm:w-7 h-5 rounded-md bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 border border-white shadow-lg flex items-center justify-center pointer-events-none"
                  style={{ top: `calc(${power}% - 10px)` }}
                >
                  <div className="w-3 h-0.5 bg-slate-900 rounded-full" />
                </div>
              </div>

              <div
                ref={powerTextRef}
                className="text-[9px] font-black font-mono text-amber-300 bg-slate-900 px-1 py-0.5 rounded border border-slate-700 my-1"
              >
                {power}%
              </div>

              <button
                type="button"
                onClick={() => handleShoot()}
                disabled={(!isPractice && turn !== "human") || isShooting || isBallInHand}
                className={`w-8 sm:w-9 h-8 rounded-lg font-black text-xs flex items-center justify-center shadow transition-transform active:scale-95 cursor-pointer ${
                  (isPractice || turn === "human") && !isShooting && !isBallInHand
                    ? "bg-gradient-to-b from-emerald-400 to-emerald-700 text-white border border-emerald-300"
                    : "bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed opacity-50"
                }`}
                title="اضرب الكرة"
              >
                🚀
              </button>
            </aside>

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

      {/* MODALS & GAME OVER (Matches virtual landscape orientation) */}
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
