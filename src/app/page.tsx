'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

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
  type: 'cue' | 'solid' | 'stripe' | 'black' | 'red' | 'color';
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
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function playBallClack(relativeSpeed: number) {
  const now = performance.now();
  if (now - lastClackSoundTime < 45) return;
  lastClackSoundTime = now;

  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  const vol = Math.min(1, Math.max(0.12, relativeSpeed / 12));

  // High-Frequency Aramith click
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(3200, t);
  osc1.frequency.exponentialRampToValueAtTime(700, t + 0.022);
  gain1.gain.setValueAtTime(0.55 * vol, t);
  gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(t);
  osc1.stop(t + 0.022);

  // Acoustic body resonance
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(980, t);
  osc2.frequency.exponentialRampToValueAtTime(260, t + 0.04);
  gain2.gain.setValueAtTime(0.35 * vol, t);
  gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(t);
  osc2.stop(t + 0.04);
}

function playCueStrike(powerPercent: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  const vol = Math.min(1, Math.max(0.25, powerPercent / 100));

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(380, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.11);
  gain.gain.setValueAtTime(0.65 * vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.11);
}

function playPocketDrop() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(145, t);
  osc.frequency.exponentialRampToValueAtTime(32, t + 0.22);
  gain.gain.setValueAtTime(0.6, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.22);
}

function playFoulBuzzer() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(170, t);
  osc.frequency.linearRampToValueAtTime(85, t + 0.26);
  gain.gain.setValueAtTime(0.4, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.26);
}

// Official 8-Ball Ball Mapping
const BALL_CONFIG_MAP: Record<number, { color: string; type: 'solid' | 'stripe' | 'black'; nameAr: string }> = {
  1: { color: '#facc15', type: 'solid', nameAr: 'صفراء سادة (1)' },
  2: { color: '#2563eb', type: 'solid', nameAr: 'زرقاء سادة (2)' },
  3: { color: '#dc2626', type: 'solid', nameAr: 'حمراء سادة (3)' },
  4: { color: '#9333ea', type: 'solid', nameAr: 'بنفسجية سادة (4)' },
  5: { color: '#ea580c', type: 'solid', nameAr: 'برتقالية سادة (5)' },
  6: { color: '#16a34a', type: 'solid', nameAr: 'خضراء سادة (6)' },
  7: { color: '#831843', type: 'solid', nameAr: 'عنابية سادة (7)' },
  8: { color: '#09090b', type: 'black', nameAr: 'السوداء (8)' },
  9: { color: '#facc15', type: 'stripe', nameAr: 'صفراء ألوان (9)' },
  10: { color: '#2563eb', type: 'stripe', nameAr: 'زرقاء ألوان (10)' },
  11: { color: '#dc2626', type: 'stripe', nameAr: 'حمراء ألوان (11)' },
  12: { color: '#9333ea', type: 'stripe', nameAr: 'بنفسجية ألوان (12)' },
  13: { color: '#ea580c', type: 'stripe', nameAr: 'برتقالية ألوان (13)' },
  14: { color: '#16a34a', type: 'stripe', nameAr: 'خضراء ألوان (14)' },
  15: { color: '#831843', type: 'stripe', nameAr: 'عنابية ألوان (15)' },
};

function CueMasterApp() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId') || 'guest';
  const username = searchParams.get('username') || 'لاعب 1';
  const avatar = searchParams.get('avatar') || 'https://api.dicebear.com/7.x/bottts/svg?seed=CueMaster';
  const initialStake = parseInt(searchParams.get('stake') || '100');
  const initialPrize = parseInt(searchParams.get('prize') || '190');
  const initialMode = (searchParams.get('mode') as '8-ball' | 'snooker') || '8-ball';
  const opponentName = searchParams.get('opponentName') || 'أحمد_البرنس';
  const opponentAvatar = searchParams.get('opponentAvatar') || 'https://api.dicebear.com/7.x/bottts/svg?seed=AhmedEG';
  const opponentFlag = searchParams.get('opponentFlag') || '🇪🇬';

  // Navigation & Modals
  const [currentView, setCurrentView] = useState<'menu' | 'table'>('menu');
  const [activeModal, setActiveModal] = useState<'settings' | 'shop' | 'leaderboard' | 'tournaments' | 'stake_select' | null>(null);

  // Settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [aimAssistLong, setAimAssistLong] = useState(true);
  const [feltColor, setFeltColor] = useState<'green' | 'blue' | 'snooker'>('green');
  const [selectedCue, setSelectedCue] = useState('classic');

  // Match State
  const [mode, setMode] = useState<'8-ball' | 'snooker'>(initialMode);
  const [isPractice, setIsPractice] = useState(false);
  const [stake, setStake] = useState(initialStake);
  const [prize, setPrize] = useState(initialPrize);
  const [coins, setCoins] = useState(10500);
  const [gems, setGems] = useState(150);

  // Official 8-Ball Game State: Groups Assignment (سادة 1-7 أم ألوان 9-15)
  const [humanGroup, setHumanGroup] = useState<'unassigned' | 'solids' | 'stripes'>('unassigned');
  const [botGroup, setBotGroup] = useState<'unassigned' | 'solids' | 'stripes'>('unassigned');
  const [groupAnnouncement, setGroupAnnouncement] = useState<{ title: string; human: string; bot: string } | null>(null);

  const [calledPocketId, setCalledPocketId] = useState<number | null>(0);
  const [isBallInHand, setIsBallInHand] = useState(false);
  const [ballInHandHoverPos, setBallInHandHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Cue Stick Spin / English Control (اسكروه، باك سبن، توب سبن)
  const [spinX, setSpinX] = useState(0);
  const [spinY, setSpinY] = useState(0);

  // Cue Stick Drag Pull-Back State
  const [isDraggingCueStick, setIsDraggingCueStick] = useState(false);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Table Engine State
  const [turn, setTurn] = useState<'human' | 'bot'>('human');
  const [turnMessage, setTurnMessage] = useState('طاولة مفتوحة: أول كرة تسقطها تحدد صنفك (سادة أم ألوان)!');
  const [humanScore, setHumanScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [power, setPower] = useState(65);
  const [aimAngle, setAimAngle] = useState(0);
  const [isShooting, setIsShooting] = useState(false);
  const [gameOver, setGameOver] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballsRef = useRef<Ball[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Track Shot Events: First Ball Hit & Potted Balls with their Pockets
  const firstBallHitInShotRef = useRef<Ball | null>(null);
  const pottedInCurrentShotRef = useRef<{ ball: Ball; pocketId: number }[]>([]);
  const cueScratchedInShotRef = useRef<boolean>(false);

  // Table Dimensions
  const TABLE_WIDTH = 900;
  const TABLE_HEIGHT = 450;
  const CUSHION = 30;
  const BALL_RADIUS = 12;

  // 6 Official Table Pockets
  const pockets: Pocket[] = [
    { id: 0, name: 'أعلى يسار', x: CUSHION + 10, y: CUSHION + 10 },
    { id: 1, name: 'أعلى وسط', x: TABLE_WIDTH / 2, y: CUSHION + 5 },
    { id: 2, name: 'أعلى يمين', x: TABLE_WIDTH - CUSHION - 10, y: CUSHION + 10 },
    { id: 3, name: 'أسفل يسار', x: CUSHION + 10, y: TABLE_HEIGHT - CUSHION - 10 },
    { id: 4, name: 'أسفل وسط', x: TABLE_WIDTH / 2, y: TABLE_HEIGHT - CUSHION - 5 },
    { id: 5, name: 'أسفل يمين', x: TABLE_WIDTH - CUSHION - 10, y: TABLE_HEIGHT - CUSHION - 10 }
  ];

  // Initialize Rack with Official Standard 8-Ball Positions
  const initBalls = (currentMode: '8-ball' | 'snooker') => {
    const balls: Ball[] = [];
    const tableLeft = CUSHION;
    const tableRight = TABLE_WIDTH - CUSHION;
    const centerY = TABLE_HEIGHT / 2;

    // 1. White Cue Ball
    balls.push({
      id: 0,
      x: tableLeft + (tableRight - tableLeft) * 0.25,
      y: centerY,
      vx: 0,
      vy: 0,
      radius: BALL_RADIUS,
      color: '#ffffff',
      number: 0,
      type: 'cue',
      isPotted: false
    });

    if (currentMode === '8-ball') {
      const startX = tableLeft + (tableRight - tableLeft) * 0.7;

      const RACK_NUMBERS = [
        1,
        9, 2,
        3, 8, 10,
        11, 4, 12, 5,
        13, 6, 14, 7, 15
      ];

      let rackIdx = 0;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c <= r; c++) {
          if (rackIdx >= RACK_NUMBERS.length) break;
          const ballNum = RACK_NUMBERS[rackIdx];
          const cfg = BALL_CONFIG_MAP[ballNum];

          const x = startX + r * (BALL_RADIUS * 1.85);
          const y = centerY + (c - r / 2) * (BALL_RADIUS * 2.1);

          balls.push({
            id: ballNum,
            x,
            y,
            vx: 0,
            vy: 0,
            radius: BALL_RADIUS,
            color: cfg.color,
            number: ballNum,
            type: cfg.type,
            isPotted: false
          });
          rackIdx++;
        }
      }
    } else {
      // Snooker Setup
      const startX = tableLeft + (tableRight - tableLeft) * 0.72;
      let redId = 1;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c <= r; c++) {
          balls.push({
            id: redId,
            x: startX + r * (BALL_RADIUS * 1.8),
            y: centerY + (c - r / 2) * (BALL_RADIUS * 2.05),
            vx: 0,
            vy: 0,
            radius: BALL_RADIUS * 0.95,
            color: '#ef4444',
            number: 1,
            type: 'red',
            value: 1,
            isPotted: false
          });
          redId++;
        }
      }

      const colors = [
        { name: 'Yellow', color: '#eab308', val: 2, x: tableLeft + 150, y: centerY - 60 },
        { name: 'Green', color: '#16a34a', val: 3, x: tableLeft + 150, y: centerY + 60 },
        { name: 'Brown', color: '#78350f', val: 4, x: tableLeft + 150, y: centerY },
        { name: 'Blue', color: '#2563eb', val: 5, x: TABLE_WIDTH / 2, y: centerY },
        { name: 'Pink', color: '#f43f5e', val: 6, x: startX - 35, y: centerY },
        { name: 'Black', color: '#09090b', val: 7, x: tableRight - 60, y: centerY },
      ];

      colors.forEach((c, idx) => {
        balls.push({
          id: 50 + idx,
          x: c.x,
          y: c.y,
          vx: 0,
          vy: 0,
          radius: BALL_RADIUS * 0.95,
          color: c.color,
          number: c.val,
          type: 'color',
          value: c.val,
          isPotted: false
        });
      });
    }

    ballsRef.current = balls;
    setHumanGroup('unassigned');
    setBotGroup('unassigned');
    setGroupAnnouncement(null);
    setIsBallInHand(false);
    setCalledPocketId(0);
    firstBallHitInShotRef.current = null;
    pottedInCurrentShotRef.current = [];
    cueScratchedInShotRef.current = false;
  };

  useEffect(() => {
    initBalls(mode);
  }, [mode]);

  // Handle Game Over
  const triggerGameOver = (winner: 'human' | 'bot', message: string) => {
    setGameOver(message);
    if (winner === 'human') {
      setCoins(c => c + prize);
    }
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'GAME_OVER',
        game: 'billiards',
        winner,
        coins: winner === 'human' ? prize : 0,
        isHuman: winner === 'human'
      }, '*');
    }
  };

  const handleCloseToParent = () => {
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'CLOSE_GAME' }, '*');
    }
  };

  // Ball in Hand placement validation
  const isValidPlacement = (x: number, y: number) => {
    const minX = CUSHION + BALL_RADIUS + 5;
    const maxX = TABLE_WIDTH - CUSHION - BALL_RADIUS - 5;
    const minY = CUSHION + BALL_RADIUS + 5;
    const maxY = TABLE_HEIGHT - CUSHION - BALL_RADIUS - 5;
    if (x < minX || x > maxX || y < minY || y > maxY) return false;

    for (const b of ballsRef.current) {
      if (b.type === 'cue' || b.isPotted) continue;
      if (Math.hypot(b.x - x, b.y - y) < BALL_RADIUS * 2.2) return false;
    }
    return true;
  };

  const handlePlaceCueBall = (x: number, y: number) => {
    if (!isValidPlacement(x, y)) return;
    const cueBall = ballsRef.current[0];
    if (cueBall) {
      cueBall.x = x;
      cueBall.y = y;
      cueBall.vx = 0;
      cueBall.vy = 0;
      cueBall.isPotted = false;
    }
    setIsBallInHand(false);
    setBallInHandHoverPos(null);
    if (soundEnabled) playBallClack(8);
    setTurnMessage('✅ تم وضع الكرة بنجاح! حان وقت التصويب والضرب.');
  };

  const respotBall = (ball: Ball) => {
    const tableRight = TABLE_WIDTH - CUSHION;
    const footSpotX = CUSHION + (tableRight - CUSHION) * 0.72;
    const footSpotY = TABLE_HEIGHT / 2;

    let targetX = footSpotX;
    let targetY = footSpotY;

    while (ballsRef.current.some(b => !b.isPotted && Math.hypot(b.x - targetX, b.y - targetY) < BALL_RADIUS * 2.1)) {
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

  // Physics Engine & Renderer Loop
  useEffect(() => {
    if (currentView !== 'table') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const FRICTION = 0.985;
    const POCKET_RADIUS = 24;

    const updatePhysics = () => {
      const balls = ballsRef.current;
      let anyMoving = false;

      // 1. Position & Cushion Updates
      balls.forEach((ball) => {
        if (ball.isPotted) return;

        ball.x += ball.vx;
        ball.y += ball.vy;
        ball.vx *= FRICTION;
        ball.vy *= FRICTION;

        if (Math.hypot(ball.vx, ball.vy) < 0.05) {
          ball.vx = 0;
          ball.vy = 0;
        } else {
          anyMoving = true;
        }

        const minX = CUSHION + ball.radius;
        const maxX = TABLE_WIDTH - CUSHION - ball.radius;
        const minY = CUSHION + ball.radius;
        const maxY = TABLE_HEIGHT - CUSHION - ball.radius;

        const speed = Math.hypot(ball.vx, ball.vy);
        if (ball.x < minX) { ball.x = minX; ball.vx = -ball.vx * 0.85; if (soundEnabled && speed > 1) playBallClack(speed); }
        if (ball.x > maxX) { ball.x = maxX; ball.vx = -ball.vx * 0.85; if (soundEnabled && speed > 1) playBallClack(speed); }
        if (ball.y < minY) { ball.y = minY; ball.vy = -ball.vy * 0.85; if (soundEnabled && speed > 1) playBallClack(speed); }
        if (ball.y > maxY) { ball.y = maxY; ball.vy = -ball.vy * 0.85; if (soundEnabled && speed > 1) playBallClack(speed); }

        // Pocket Detection
        pockets.forEach((p) => {
          const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
          if (dist < POCKET_RADIUS) {
            ball.isPotted = true;
            ball.vx = 0;
            ball.vy = 0;
            if (soundEnabled) playPocketDrop();

            if (ball.type === 'cue') {
              cueScratchedInShotRef.current = true;
            } else {
              pottedInCurrentShotRef.current.push({ ball, pocketId: p.id });
            }
          }
        });
      });

      // 2. Ball-to-Ball Collisions
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const b1 = balls[i];
          const b2 = balls[j];
          if (b1.isPotted || b2.isPotted) continue;

          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.hypot(dx, dy);

          if (dist < b1.radius + b2.radius && dist > 0) {
            const nx = dx / dist;
            const ny = dy / dist;

            const overlap = b1.radius + b2.radius - dist;
            b1.x -= nx * overlap * 0.5;
            b1.y -= ny * overlap * 0.5;
            b2.x += nx * overlap * 0.5;
            b2.y += ny * overlap * 0.5;

            const kx = b1.vx - b2.vx;
            const ky = b1.vy - b2.vy;
            const p = 2 * (nx * kx + ny * ky) / 2;

            b1.vx -= p * nx * 0.92;
            b1.vy -= p * ny * 0.92;
            b2.vx += p * nx * 0.92;
            b2.vy += p * ny * 0.92;

            // Track First Ball Hit by Cue Ball
            if (b1.type === 'cue' || b2.type === 'cue') {
              const targetB = b1.type === 'cue' ? b2 : b1;
              const cueB = b1.type === 'cue' ? b1 : b2;

              if (!firstBallHitInShotRef.current) {
                firstBallHitInShotRef.current = targetB;
              }

              // Spin (Screw / Topspin / English)
              if (spinY < -0.2) {
                const screwForce = Math.abs(spinY) * 5.5;
                cueB.vx += -nx * screwForce;
                cueB.vy += -ny * screwForce;
              } else if (spinY > 0.2) {
                const followForce = spinY * 4.2;
                cueB.vx += nx * followForce;
                cueB.vy += ny * followForce;
              }
              if (Math.abs(spinX) > 0.2) {
                cueB.vx += -ny * spinX * 3;
                cueB.vy += nx * spinX * 3;
              }
            }

            anyMoving = true;
            const relSpeed = Math.hypot(kx, ky);
            if (soundEnabled && relSpeed > 0.8) {
              playBallClack(relSpeed);
            }
          }
        }
      }

      // 3. Handle Shot Completion & Official 8-Ball Rules Judgment
      if (isShooting && !anyMoving) {
        setIsShooting(false);

        const pottedList = pottedInCurrentShotRef.current;
        const cueScratched = cueScratchedInShotRef.current;
        const firstHit = firstBallHitInShotRef.current;
        const activeShooter = turn;

        pottedInCurrentShotRef.current = [];
        cueScratchedInShotRef.current = false;
        firstBallHitInShotRef.current = null;

        if (mode === '8-ball') {
          const shooterGroup = activeShooter === 'human' ? humanGroup : botGroup;
          const remainingTargetBalls = ballsRef.current.filter(b => 
            !b.isPotted && b.number !== 8 && (shooterGroup === 'solids' ? b.type === 'solid' : b.type === 'stripe')
          );

          // CHECK RULE: 8-Ball Potting
          const black8Entry = pottedList.find(item => item.ball.number === 8);
          if (black8Entry) {
            if (cueScratched) {
              if (activeShooter === 'human') triggerGameOver('bot', '❌ خسرت المباراة! أسقطت الكرة البيضاء مع الكرة السوداء رقم 8.');
              else triggerGameOver('human', '🎉 مبروك الفوز! الخصم أسقط الكرة البيضاء مع الكرة السوداء رقم 8.');
              return;
            }

            if (remainingTargetBalls.length > 0 || shooterGroup === 'unassigned') {
              if (activeShooter === 'human') triggerGameOver('bot', '❌ خسرت المباراة! أسقطت الكرة السوداء رقم 8 قبل تصفية جميع كراتك.');
              else triggerGameOver('human', '🎉 مبروك الفوز! الخصم أسقط الكرة السوداء رقم 8 قبل تصفية كراته.');
              return;
            }

            if (calledPocketId !== null && black8Entry.pocketId !== calledPocketId) {
              if (activeShooter === 'human') triggerGameOver('bot', '❌ خسرت المباراة! الكرة السوداء 8 سقطت في جيب غير الجيب المحدد.');
              else triggerGameOver('human', '🎉 مبروك الفوز! الخصم أسقط الكرة السوداء 8 في جيب غير الجيب المحدد.');
              return;
            }

            if (activeShooter === 'human') triggerGameOver('human', '🏆 مبروك الفوز الساحق! أحرزت الكرة السوداء رقم 8 في الجيب المحدد بعد تصفية كراتك!');
            else triggerGameOver('bot', 'خسرت المباراة! الخصم أحرز الكرة السوداء رقم 8 وفاز بالجولة.');
            return;
          }

          // CHECK FOUL RULES:
          let foulOccurred = false;
          let foulReason = '';

          if (cueScratched) {
            foulOccurred = true;
            foulReason = 'سقوط الكرة البيضاء في الجيب (Scratch).';
          } else if (!firstHit) {
            foulOccurred = true;
            foulReason = 'الكرة البيضاء لم تلمس أي كرة على الإطلاق!';
          } else if (shooterGroup === 'unassigned' && firstHit.number === 8) {
            foulOccurred = true;
            foulReason = 'الطاولة مفتوحة: لا يجوز لمس الكرة السوداء رقم 8 أولاً!';
          } else if (shooterGroup !== 'unassigned') {
            if (remainingTargetBalls.length > 0) {
              const expectedType = shooterGroup === 'solids' ? 'solid' : 'stripe';
              if (firstHit.type !== expectedType) {
                foulOccurred = true;
                foulReason = firstHit.number === 8 
                  ? 'لمست الكرة السوداء رقم 8 أولاً قبل تصفية كراتك!' 
                  : (shooterGroup === 'solids' ? 'لمست كرة (ألوان/مخطط) وصنفك هو سادة!' : 'لمست كرة (سادة) وصنفك هو ألوان/مخطط!');
              }
            } else {
              if (firstHit.number !== 8) {
                foulOccurred = true;
                foulReason = 'أنهيت كراتك، يجب لمس الكرة السوداء رقم 8 أولاً!';
              }
            }
          }

          if (foulOccurred) {
            if (soundEnabled) playFoulBuzzer();
            if (!isPractice) {
              const nextTurn = activeShooter === 'human' ? 'bot' : 'human';
              setTurn(nextTurn);
              if (nextTurn === 'human') {
                setIsBallInHand(true);
                setTurnMessage(`✋ خطأ على الخصم: (${foulReason}) الكرة في يدك الآن!`);
              } else {
                setTurnMessage(`⚠️ فاول عليك: (${foulReason}) الكرة في يد الخصم الآن.`);
                setTimeout(() => {
                  const cb = ballsRef.current[0];
                  if (cb) {
                    cb.x = CUSHION + 180 + Math.random() * 80;
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

          // CHECK CALL POCKET RULE: Potted in uncalled pocket returns to table!
          const legallyCalledPots: Ball[] = [];
          const wrongPocketPots: Ball[] = [];

          pottedList.forEach(({ ball, pocketId }) => {
            if (calledPocketId !== null && pocketId === calledPocketId) {
              legallyCalledPots.push(ball);
            } else {
              wrongPocketPots.push(ball);
              respotBall(ball);
            }
          });

          if (wrongPocketPots.length > 0) {
            setTurnMessage(`⚠️ كرة سقطت في جيب غير محدد (${wrongPocketPots.map(b => b.number).join(',')})! تم إرجاعها للطاولة.`);
          }

          // ASSIGN GROUPS: First legal pot determines Solids (سادة) vs Stripes (ألوان)
          if (humanGroup === 'unassigned' && legallyCalledPots.length > 0) {
            const firstLegal = legallyCalledPots.find(b => b.type === 'solid' || b.type === 'stripe');
            if (firstLegal) {
              const isSolid = firstLegal.type === 'solid';
              if (activeShooter === 'human') {
                setHumanGroup(isSolid ? 'solids' : 'stripes');
                setBotGroup(isSolid ? 'stripes' : 'solids');
                setGroupAnnouncement({
                  title: '🎉 أحرزت أول كرة بنجاح وتم تحديد الأصناف!',
                  human: isSolid ? 'سادة (Solids 1-7) 🟡🔴' : 'ألوان (Stripes 9-15) 🔵⚪',
                  bot: isSolid ? 'ألوان (Stripes 9-15) 🔵⚪' : 'سادة (Solids 1-7) 🟡🔴'
                });
                setTurnMessage(`🎱 كراتك أصبحت: [${isSolid ? 'سادة 🟡 (1-7)' : 'ألوان 🔵 (9-15)'}]!`);
              } else {
                setBotGroup(isSolid ? 'solids' : 'stripes');
                setHumanGroup(isSolid ? 'stripes' : 'solids');
                setGroupAnnouncement({
                  title: '🤖 الخصم أحرز أول كرة وتم تحديد الأصناف!',
                  human: isSolid ? 'ألوان (Stripes 9-15) 🔵⚪' : 'سادة (Solids 1-7) 🟡🔴',
                  bot: isSolid ? 'سادة (Solids 1-7) 🟡🔴' : 'ألوان (Stripes 9-15) 🔵⚪'
                });
                setTurnMessage(`🎱 كراتك أصبحت: [${isSolid ? 'ألوان 🔵 (9-15)' : 'سادة 🟡 (1-7)'}]!`);
              }
              setTimeout(() => setGroupAnnouncement(null), 4500);
            }
          }

          // Check if Shooter keeps their turn
          const currentShooterGroup = activeShooter === 'human' ? humanGroup : botGroup;
          const pottedLegalBallInCalledPocket = legallyCalledPots.some(b => 
            currentShooterGroup === 'unassigned'
              ? (b.type === 'solid' || b.type === 'stripe')
              : (currentShooterGroup === 'solids' ? b.type === 'solid' : b.type === 'stripe')
          );

          if (pottedLegalBallInCalledPocket) {
            if (activeShooter === 'human') setHumanScore(s => s + legallyCalledPots.length);
            else setBotScore(s => s + legallyCalledPots.length);
            setTurnMessage('🔥 ضربة صحيحة في الجيب المحدد! دورك مستمر للضربة التالية!');
          } else {
            if (!isPractice) {
              setTurn(activeShooter === 'human' ? 'bot' : 'human');
              setTurnMessage(activeShooter === 'human' ? 'دور الخصم الآن...' : 'دورك الآن! تأكد من لمس صنفك أولاً.');
            }
          }

        } else {
          // Snooker Logic
          if (cueScratched) {
            if (!isPractice) setTurn(activeShooter === 'human' ? 'bot' : 'human');
            const cb = ballsRef.current[0];
            if (cb) {
              cb.x = CUSHION + 150;
              cb.y = TABLE_HEIGHT / 2;
              cb.isPotted = false;
            }
          } else {
            const totalPoints = pottedList.reduce((acc, item) => acc + (item.ball.value || 1), 0);
            if (totalPoints > 0) {
              if (activeShooter === 'human') setHumanScore(s => s + totalPoints);
              else setBotScore(s => s + totalPoints);
            } else {
              if (!isPractice) setTurn(activeShooter === 'human' ? 'bot' : 'human');
            }
          }
        }
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

      // 1. Wood Frame
      ctx.fillStyle = '#1c100b';
      ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, TABLE_WIDTH - 16, TABLE_HEIGHT - 16);

      // 2. Cloth Felt
      const feltGradient = ctx.createRadialGradient(
        TABLE_WIDTH / 2, TABLE_HEIGHT / 2, 80,
        TABLE_WIDTH / 2, TABLE_HEIGHT / 2, 450
      );

      if (feltColor === 'blue') {
        feltGradient.addColorStop(0, '#1e40af');
        feltGradient.addColorStop(1, '#172554');
      } else if (feltColor === 'snooker' || mode === 'snooker') {
        feltGradient.addColorStop(0, '#047857');
        feltGradient.addColorStop(1, '#064e3b');
      } else {
        feltGradient.addColorStop(0, '#15803d');
        feltGradient.addColorStop(1, '#052e16');
      }

      ctx.fillStyle = feltGradient;
      ctx.fillRect(CUSHION, CUSHION, TABLE_WIDTH - 2 * CUSHION, TABLE_HEIGHT - 2 * CUSHION);

      // Snooker Baulk Line & "D" Zone
      if (mode === 'snooker') {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;
        const baulkX = CUSHION + 150;
        ctx.beginPath();
        ctx.moveTo(baulkX, CUSHION);
        ctx.lineTo(baulkX, TABLE_HEIGHT - CUSHION);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(baulkX, TABLE_HEIGHT / 2, 60, -Math.PI / 2, Math.PI / 2, true);
        ctx.stroke();
      }

      // 3. Pockets & Target Call Pocket Highlight
      pockets.forEach((p) => {
        const isTarget = calledPocketId === p.id;

        ctx.fillStyle = '#05070a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isTarget ? '#eab308' : '#475569';
        ctx.lineWidth = isTarget ? 3.5 : 2;
        ctx.stroke();

        if (isTarget) {
          ctx.strokeStyle = 'rgba(234, 179, 8, 0.9)';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(p.x, p.y, POCKET_RADIUS + 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#eab308';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🎯 الهدف', p.x, p.y + (p.y < TABLE_HEIGHT / 2 ? 36 : -30));
        }
      });

      // 4. Balls (Accurate Solids & Stripes Rendering)
      const balls = ballsRef.current;
      balls.forEach((ball) => {
        if (ball.isPotted) return;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.arc(ball.x + 3, ball.y + 4, ball.radius, 0, Math.PI * 2);
        ctx.fill();

        if (ball.type === 'stripe') {
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.save();
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
          ctx.clip();
          ctx.fillStyle = ball.color;
          ctx.fillRect(ball.x - ball.radius, ball.y - ball.radius * 0.52, ball.radius * 2, ball.radius * 1.04);
          ctx.restore();
        } else {
          ctx.fillStyle = ball.color;
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
          ctx.fill();
        }

        // Highlight sheen
        const grad = ctx.createRadialGradient(
          ball.x - 3, ball.y - 3, 1,
          ball.x, ball.y, ball.radius
        );
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();

        // Number Circle for 8-ball
        if (mode === '8-ball' && ball.number > 0) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius * 0.44, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#000000';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ball.number.toString(), ball.x, ball.y + 0.5);
        }
      });

      // 5. Ball-in-Hand Gloved Preview
      if (isBallInHand && ballInHandHoverPos) {
        const isValid = isValidPlacement(ballInHandHoverPos.x, ballInHandHoverPos.y);
        ctx.fillStyle = isValid ? 'rgba(255, 255, 255, 0.75)' : 'rgba(239, 68, 68, 0.6)';
        ctx.beginPath();
        ctx.arc(ballInHandHoverPos.x, ballInHandHoverPos.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isValid ? '#10b981' : '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧤', ballInHandHoverPos.x, ballInHandHoverPos.y - 18);
      }

      // 6. AIM LINE RAYCASTING & LEGAL TARGET VALIDATION (Red line if foul target!)
      const cueBall = balls[0];
      if ((turn === 'human' || isPractice) && !isShooting && !isBallInHand && cueBall && !cueBall.isPotted) {
        const cosA = Math.cos(aimAngle);
        const sinA = Math.sin(aimAngle);
        const collisionRadius = BALL_RADIUS * 2;

        let closestHitDist = aimAssistLong ? 550 : 320;
        let hitBall: Ball | null = null;
        let ghostBallPos: { x: number; y: number } | null = null;
        let targetDeflectDir: { dx: number; dy: number } | null = null;

        // Clip to cushions
        const leftDist = cosA < 0 ? (CUSHION + BALL_RADIUS - cueBall.x) / cosA : 9999;
        const rightDist = cosA > 0 ? (TABLE_WIDTH - CUSHION - BALL_RADIUS - cueBall.x) / cosA : 9999;
        const topDist = sinA < 0 ? (CUSHION + BALL_RADIUS - cueBall.y) / sinA : 9999;
        const bottomDist = sinA > 0 ? (TABLE_HEIGHT - CUSHION - BALL_RADIUS - cueBall.y) / sinA : 9999;
        closestHitDist = Math.min(closestHitDist, Math.max(0, Math.min(leftDist, rightDist, topDist, bottomDist)));

        // Ray-Circle intersection with each ball
        for (let i = 1; i < balls.length; i++) {
          const b = balls[i];
          if (b.isPotted) continue;

          const vx = b.x - cueBall.x;
          const vy = b.y - cueBall.y;
          const proj = vx * cosA + vy * sinA;
          if (proj <= 0) continue;

          const perpSq = (vx * vx + vy * vy) - (proj * proj);
          if (perpSq >= 0 && perpSq < collisionRadius * collisionRadius) {
            const d = proj - Math.sqrt(collisionRadius * collisionRadius - perpSq);
            if (d > 0 && d < closestHitDist) {
              closestHitDist = d;
              hitBall = b;
              const gx = cueBall.x + cosA * d;
              const gy = cueBall.y + sinA * d;
              ghostBallPos = { x: gx, y: gy };
              const nLen = Math.hypot(b.x - gx, b.y - gy) || 1;
              targetDeflectDir = { dx: (b.x - gx) / nLen, dy: (b.y - gy) / nLen };
            }
          }
        }

        // Check if aimed hitBall is legal or illegal!
        let isAimedTargetLegal = true;
        let warningText = '';

        if (hitBall && mode === '8-ball') {
          if (humanGroup === 'unassigned') {
            if (hitBall.number === 8) {
              isAimedTargetLegal = false;
              warningText = '⚠️ فاول: لا تلمس 8 الآن!';
            }
          } else {
            const remainingHumanBalls = balls.filter(b => 
              !b.isPotted && b.number !== 8 && (humanGroup === 'solids' ? b.type === 'solid' : b.type === 'stripe')
            );
            if (remainingHumanBalls.length > 0) {
              const expectedType = humanGroup === 'solids' ? 'solid' : 'stripe';
              if (hitBall.type !== expectedType) {
                isAimedTargetLegal = false;
                warningText = hitBall.number === 8 ? '⚠️ فاول: لا تلمس 8 الآن!' : '⚠️ فاول: صنف الخصم!';
              }
            } else {
              // Final ball is 8
              if (hitBall.number !== 8) {
                isAimedTargetLegal = false;
                warningText = '⚠️ فاول: هدفك الكرة 8!';
              }
            }
          }
        }

        const endAimX = cueBall.x + cosA * closestHitDist;
        const endAimY = cueBall.y + sinA * closestHitDist;

        // Line color: Red if illegal, white if legal
        ctx.strokeStyle = isAimedTargetLegal ? 'rgba(255, 255, 255, 0.75)' : 'rgba(239, 68, 68, 0.9)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cueBall.x, cueBall.y);
        ctx.lineTo(endAimX, endAimY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Ghost Ball & Target Ball Path
        if (ghostBallPos && hitBall && targetDeflectDir) {
          ctx.strokeStyle = isAimedTargetLegal ? 'rgba(255, 255, 255, 0.65)' : 'rgba(239, 68, 68, 0.85)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(ghostBallPos.x, ghostBallPos.y, BALL_RADIUS, 0, Math.PI * 2);
          ctx.stroke();

          // Target Ball Guide Line
          ctx.strokeStyle = isAimedTargetLegal ? 'rgba(250, 204, 21, 0.85)' : 'rgba(239, 68, 68, 0.7)';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(hitBall.x, hitBall.y);
          ctx.lineTo(
            hitBall.x + targetDeflectDir.dx * 130,
            hitBall.y + targetDeflectDir.dy * 130
          );
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = isAimedTargetLegal ? 'rgba(250, 204, 21, 0.35)' : 'rgba(239, 68, 68, 0.4)';
          ctx.beginPath();
          ctx.arc(hitBall.x, hitBall.y, BALL_RADIUS + 3, 0, Math.PI * 2);
          ctx.fill();

          if (!isAimedTargetLegal && warningText) {
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(warningText, hitBall.x, hitBall.y - 18);
          }
        }

        // 7. Cue Stick with Dynamic Pull-Back
        const cueLength = 260;
        const cueOffset = 22 + (power / 100) * 65;
        const cueStartX = cueBall.x - cosA * cueOffset;
        const cueStartY = cueBall.y - sinA * cueOffset;
        const cueEndX = cueBall.x - cosA * (cueOffset + cueLength);
        const cueEndY = cueBall.y - sinA * (cueOffset + cueLength);

        let cueColor = '#d97706';
        if (selectedCue === 'dragon') cueColor = '#dc2626';
        else if (selectedCue === 'neon') cueColor = '#06b6d4';
        else if (selectedCue === 'gold') cueColor = '#fbbf24';

        ctx.strokeStyle = cueColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(cueStartX, cueStartY);
        ctx.lineTo(cueEndX, cueEndY);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(cueStartX, cueStartY);
        ctx.lineTo(cueStartX - cosA * 8, cueStartY - sinA * 8);
        ctx.stroke();
      }

      updatePhysics();
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [currentView, mode, turn, aimAngle, power, isShooting, soundEnabled, aimAssistLong, feltColor, selectedCue, isPractice, isBallInHand, ballInHandHoverPos, calledPocketId, humanGroup, botGroup, spinX, spinY]);

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
      setBallInHandHoverPos({ x: mouseX, y: mouseY });
      return;
    }

    if ((turn !== 'human' && !isPractice) || isShooting) return;

    const cueBall = ballsRef.current[0];
    if (cueBall) {
      if (isDraggingCueStick && dragStartPosRef.current) {
        const cosA = Math.cos(aimAngle);
        const sinA = Math.sin(aimAngle);
        const pullDist = -((mouseX - dragStartPosRef.current.x) * cosA + (mouseY - dragStartPosRef.current.y) * sinA);
        if (pullDist > 5) {
          const calculatedPower = Math.min(100, Math.max(15, Math.round((pullDist / 130) * 100)));
          setPower(calculatedPower);
        }
      } else {
        const angle = Math.atan2(mouseY - cueBall.y, mouseX - cueBall.x);
        setAimAngle(angle);
      }
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isBallInHand || isShooting || (turn !== 'human' && !isPractice)) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = TABLE_WIDTH / rect.width;
    const scaleY = TABLE_HEIGHT / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    for (const p of pockets) {
      if (Math.hypot(p.x - mouseX, p.y - mouseY) < 32) {
        setCalledPocketId(p.id);
        if (soundEnabled) playBallClack(6);
        setTurnMessage(`🎯 تم تحديد ${p.name} كجيب مستهدف!`);
        return;
      }
    }

    setIsDraggingCueStick(true);
    dragStartPosRef.current = { x: mouseX, y: mouseY };
  };

  const handleCanvasMouseUp = () => {
    if (isDraggingCueStick) {
      setIsDraggingCueStick(false);
      dragStartPosRef.current = null;
      if (power >= 25) {
        handleShoot();
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = TABLE_WIDTH / rect.width;
    const scaleY = TABLE_HEIGHT / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    if (isBallInHand) {
      handlePlaceCueBall(mouseX, mouseY);
      return;
    }

    for (const p of pockets) {
      if (Math.hypot(p.x - mouseX, p.y - mouseY) < 32) {
        setCalledPocketId(p.id);
        if (soundEnabled) playBallClack(6);
        setTurnMessage(`🎯 تم تحديد ${p.name} كجيب مستهدف!`);
        return;
      }
    }
  };

  const handleShoot = () => {
    if ((turn !== 'human' && !isPractice) || isShooting || isBallInHand) return;
    const cueBall = ballsRef.current[0];
    if (!cueBall || cueBall.isPotted) return;

    setIsShooting(true);
    if (soundEnabled) playCueStrike(power);
    const speed = (power / 100) * 27;
    cueBall.vx = Math.cos(aimAngle) * speed;
    cueBall.vy = Math.sin(aimAngle) * speed;
  };

  // Bot Turn Automation with Pocket Selection
  useEffect(() => {
    if (currentView === 'table' && turn === 'bot' && !isShooting && !gameOver && !isPractice && !isBallInHand) {
      const botTimer = setTimeout(() => {
        const cueBall = ballsRef.current[0];
        let targetBalls = ballsRef.current.filter(b => !b.isPotted && b.type !== 'cue');

        if (botGroup !== 'unassigned') {
          const groupBalls = targetBalls.filter(b => botGroup === 'solids' ? b.type === 'solid' : b.type === 'stripe');
          if (groupBalls.length > 0) targetBalls = groupBalls;
          else {
            const b8 = targetBalls.find(b => b.number === 8);
            if (b8) targetBalls = [b8];
          }
        }

        if (cueBall && targetBalls.length > 0) {
          let closest = targetBalls[0];
          let minDist = 9999;
          targetBalls.forEach(b => {
            const d = Math.hypot(b.x - cueBall.x, b.y - cueBall.y);
            if (d < minDist) {
              minDist = d;
              closest = b;
            }
          });

          let bestPocket = pockets[0];
          let minPocketDist = 9999;
          pockets.forEach(p => {
            const pd = Math.hypot(p.x - closest.x, p.y - closest.y);
            if (pd < minPocketDist) {
              minPocketDist = pd;
              bestPocket = p;
            }
          });
          setCalledPocketId(bestPocket.id);

          const variance = (Math.random() - 0.5) * 0.11;
          const targetAngle = Math.atan2(closest.y - cueBall.y, closest.x - cueBall.x) + variance;
          setAimAngle(targetAngle);

          setIsShooting(true);
          if (soundEnabled) playCueStrike(65);
          const botSpeed = 15 + Math.random() * 8;
          cueBall.vx = Math.cos(targetAngle) * botSpeed;
          cueBall.vy = Math.sin(targetAngle) * botSpeed;
        }
      }, 2300);

      return () => clearTimeout(botTimer);
    }
  }, [currentView, turn, isShooting, gameOver, isPractice, isBallInHand, botGroup, soundEnabled]);

  // Launch Table Match
  const startMatch = (targetMode: '8-ball' | 'snooker', practice = false, tableStake = 100) => {
    setMode(targetMode);
    setIsPractice(practice);
    setStake(tableStake);
    setPrize(Math.round(tableStake * 1.9));
    setHumanScore(0);
    setBotScore(0);
    setGameOver(null);
    setTurn('human');
    setActiveModal(null);
    setTurnMessage('طاولة مفتوحة: أول كرة تسقطها تحدد صنفك (سادة أم ألوان)!');
    initBalls(targetMode);
    setCurrentView('table');
  };

  // Helper to get array of remaining balls for a group (1-7 or 9-15)
  const getGroupBalls = (group: 'solids' | 'stripes') => {
    const min = group === 'solids' ? 1 : 9;
    const max = group === 'solids' ? 7 : 15;
    const res: { num: number; potted: boolean; color: string }[] = [];
    for (let i = min; i <= max; i++) {
      const b = ballsRef.current.find(ball => ball.number === i);
      res.push({
        num: i,
        potted: b ? b.isPotted : false,
        color: BALL_CONFIG_MAP[i]?.color || '#ffffff'
      });
    }
    return res;
  };

  return (
    <div className="w-full h-full min-h-screen bg-[#02070f] text-slate-100 flex flex-col font-sans select-none overflow-x-hidden relative" dir="rtl">

      {/* ======================================================== */}
      {/* 1. CUE MASTER LOBBY / MAIN MENU                          */}
      {/* ======================================================== */}
      {currentView === 'menu' && (
        <div
          className="relative flex-1 flex flex-col justify-between p-4 md:p-8 bg-cover bg-center overflow-hidden min-h-screen"
          style={{
            backgroundImage: `linear-gradient(rgba(2, 7, 15, 0.45), rgba(2, 7, 15, 0.7)), url('/cue_master_bg.jpg')`,
            backgroundPosition: 'center 45%'
          }}
        >
          {/* Top Bar: Profile & Currencies */}
          <div className="flex justify-between items-center z-10 w-full max-w-6xl mx-auto">
            
            <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-700/60 shadow-xl">
              <img
                src={avatar}
                alt={username}
                className="w-12 h-12 rounded-full border-2 border-amber-400 bg-slate-900 shadow-md"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">{username}</span>
                  <span className="text-[10px] bg-slate-800 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-slate-700">
                    Level 1
                  </span>
                </div>
                <div className="w-24 h-2 bg-slate-800 rounded-full mt-1.5 overflow-hidden border border-slate-700">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-green-400 w-3/5 rounded-full" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-amber-500/40 shadow-lg">
                <button
                  onClick={() => setCoins(c => c + 1000)}
                  className="w-5 h-5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center cursor-pointer shadow"
                >
                  +
                </button>
                <span className="text-[11px] font-black text-amber-300 font-mono">
                  {coins.toLocaleString()}
                </span>
                <span className="text-sm">🪙</span>
                <span className="text-[9px] font-bold text-slate-400 tracking-wider">COINS</span>
              </div>

              <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-fuchsia-500/40 shadow-lg">
                <button
                  onClick={() => setGems(g => g + 50)}
                  className="w-5 h-5 rounded-md bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-black text-xs flex items-center justify-center cursor-pointer shadow"
                >
                  +
                </button>
                <span className="text-[11px] font-black text-fuchsia-300 font-mono">
                  {gems.toLocaleString()}
                </span>
                <span className="text-sm">💎</span>
                <span className="text-[9px] font-bold text-slate-400 tracking-wider">GEMS</span>
              </div>
            </div>

          </div>

          {/* Center Logo */}
          <div className="flex flex-col items-center justify-center my-auto z-10 text-center animate-fade-in py-6">
            <div className="relative select-none">
              <h1 className="text-6xl md:text-8xl font-black italic tracking-wide text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 drop-shadow-[0_8px_16px_rgba(0,0,0,0.9)]">
                CUE
              </h1>
              <div className="text-4xl md:text-6xl font-black tracking-widest text-cyan-300 drop-shadow-[0_0_25px_rgba(6,182,212,0.8)] -mt-3 md:-mt-5">
                MASTER
              </div>
            </div>
            <p className="text-xs md:text-sm font-bold text-amber-200/90 mt-2 bg-black/50 px-4 py-1 rounded-full border border-amber-500/30 backdrop-blur-sm">
              🎱 البلياردو والسنوكر الاحترافي • تحدي الأساطير
            </p>

            {/* 4 Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mt-8">
              
              <button
                onClick={() => setActiveModal('stake_select')}
                className="group relative flex items-center justify-center gap-3 py-3.5 px-6 rounded-2xl bg-gradient-to-b from-emerald-500 via-green-600 to-emerald-800 hover:from-emerald-400 hover:to-green-700 border-2 border-emerald-300/80 shadow-[0_6px_0_#064e3b,0_10px_20px_rgba(16,185,129,0.4)] active:translate-y-1 active:shadow-[0_2px_0_#064e3b] transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/40 flex items-center justify-center shadow-inner">
                  <span className="text-white text-base">▶</span>
                </div>
                <span className="text-lg md:text-xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wider">
                  PLAY NOW
                </span>
              </button>

              <button
                onClick={() => setActiveModal('stake_select')}
                className="group relative flex items-center justify-center gap-3 py-3.5 px-6 rounded-2xl bg-gradient-to-b from-blue-500 via-sky-600 to-blue-800 hover:from-blue-400 hover:to-sky-700 border-2 border-sky-300/80 shadow-[0_6px_0_#1e3a8a,0_10px_20px_rgba(14,165,233,0.4)] active:translate-y-1 active:shadow-[0_2px_0_#1e3a8a] transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/40 flex items-center justify-center shadow-inner">
                  <span className="text-white text-base">👥</span>
                </div>
                <span className="text-lg md:text-xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wider">
                  MULTIPLAYER
                </span>
              </button>

              <button
                onClick={() => setActiveModal('tournaments')}
                className="group relative flex items-center justify-center gap-3 py-3.5 px-6 rounded-2xl bg-gradient-to-b from-amber-500 via-orange-600 to-amber-800 hover:from-amber-400 hover:to-orange-700 border-2 border-amber-300/80 shadow-[0_6px_0_#7c2d12,0_10px_20px_rgba(245,158,11,0.4)] active:translate-y-1 active:shadow-[0_2px_0_#7c2d12] transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/40 flex items-center justify-center shadow-inner">
                  <span className="text-amber-200 text-base">🏆</span>
                </div>
                <span className="text-lg md:text-xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wider">
                  TOURNAMENTS
                </span>
              </button>

              <button
                onClick={() => startMatch('8-ball', true, 0)}
                className="group relative flex items-center justify-center gap-3 py-3.5 px-6 rounded-2xl bg-gradient-to-b from-slate-400 via-slate-600 to-slate-800 hover:from-slate-300 hover:to-slate-700 border-2 border-slate-300/80 shadow-[0_6px_0_#1e293b,0_10px_20px_rgba(100,116,139,0.4)] active:translate-y-1 active:shadow-[0_2px_0_#1e293b] transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/40 flex items-center justify-center shadow-inner">
                  <span className="text-white text-base">🎯</span>
                </div>
                <span className="text-lg md:text-xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wider">
                  PRACTICE
                </span>
              </button>

            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex justify-between items-end z-10 w-full max-w-5xl mx-auto pt-4">
            <button
              onClick={() => setActiveModal('settings')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-xl text-xs font-black shadow-lg cursor-pointer transition-all active:scale-95"
            >
              <span>⚙️</span>
              <span>SETTINGS</span>
            </button>

            <div className="flex flex-col items-center -mb-2">
              <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-amber-500 mb-0.5" />
              <button
                onClick={() => setActiveModal('shop')}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-t from-black via-slate-950 to-slate-900 text-amber-300 border-2 border-amber-500/80 rounded-t-2xl text-xs font-black shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:text-white cursor-pointer transition-all"
              >
                <span>🛒</span>
                <span>SHOP</span>
              </button>
            </div>

            <button
              onClick={() => setActiveModal('leaderboard')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-xl text-xs font-black shadow-lg cursor-pointer transition-all active:scale-95"
            >
              <span>LEADERBOARD</span>
              <span>🏆</span>
            </button>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* 2. PLAYABLE CANVAS TABLE SCREEN WITH RULES & CONTROLS    */}
      {/* ======================================================== */}
      {currentView === 'table' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden relative">
          
          {/* Top Bar: Players, Groups (سادة أم ألوان) & Real-time Ball Status */}
          <div className="bg-slate-950/95 border-b border-slate-800 p-3 md:p-4 flex flex-wrap justify-between items-center gap-4 z-20">
            
            {/* Human Player Card */}
            <div className={`flex items-center gap-3 p-2.5 rounded-2xl transition-all ${turn === 'human' || isPractice ? 'bg-indigo-950/70 border border-indigo-500/70 shadow-[0_0_20px_rgba(99,102,241,0.35)]' : 'opacity-75'}`}>
              <img src={avatar} alt={username} className="w-12 h-12 rounded-full border-2 border-indigo-400 bg-slate-900" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">{username}</span>
                  {(turn === 'human' || isPractice) && <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">دورك!</span>}
                </div>

                {/* Group Badge & Mini Balls List */}
                {mode === '8-ball' ? (
                  <div className="mt-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-black ${
                        humanGroup === 'unassigned' 
                          ? 'bg-slate-800 text-slate-300 border border-slate-700' 
                          : humanGroup === 'solids' 
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      }`}>
                        {humanGroup === 'unassigned' ? 'طاولة مفتوحة ⚪' : humanGroup === 'solids' ? 'صنفك: سادة 🟡 (1-7)' : 'صنفك: ألوان 🔵 (9-15)'}
                      </span>
                    </div>

                    {/* Visual Ball Inventory */}
                    {humanGroup !== 'unassigned' && (
                      <div className="flex gap-1 mt-1.5">
                        {getGroupBalls(humanGroup).map(b => (
                          <div
                            key={b.num}
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black border transition-all ${
                              b.potted 
                                ? 'bg-slate-900 border-slate-800 text-slate-600 line-through opacity-30' 
                                : 'text-slate-950 font-bold border-white/60 shadow'
                            }`}
                            style={{ backgroundColor: b.potted ? '#1e293b' : b.color }}
                            title={`كرة رقم ${b.num} ${b.potted ? '(تم إسقاطها)' : '(متبقية)'}`}
                          >
                            {!b.potted && b.num}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] font-bold text-amber-300 mt-1">النقاط: {humanScore}</div>
                )}
              </div>
            </div>

            {/* Center Status Banner & Call Pocket Alert */}
            <div className="text-center max-w-sm">
              <div className="text-xs font-black px-3.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {turnMessage}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-center gap-2">
                <span>{calledPocketId !== null ? `🎯 الجيب المختار: ${pockets[calledPocketId].name}` : 'اضغط على أي جيب لتحديده'}</span>
                {isBallInHand && <span className="text-emerald-400 font-bold animate-bounce">✋ الكرة في اليد</span>}
              </div>
            </div>

            {/* Opponent Card */}
            <div className="flex items-center gap-3">
              {!isPractice ? (
                <div className={`flex items-center gap-3 p-2.5 rounded-2xl transition-all ${turn === 'bot' ? 'bg-rose-950/70 border border-rose-500/70 shadow-[0_0_20px_rgba(244,63,94,0.35)]' : 'opacity-75'}`}>
                  <div className="text-left">
                    <div className="flex items-center justify-end gap-1.5">
                      {turn === 'bot' && <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">يفكر...</span>}
                      <span className="text-xs font-black text-white">{opponentName}</span>
                      <span className="text-xs">{opponentFlag}</span>
                    </div>

                    {mode === '8-ball' ? (
                      <div className="mt-1">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-black ${
                            botGroup === 'unassigned' 
                              ? 'bg-slate-800 text-slate-300 border border-slate-700' 
                              : botGroup === 'solids' 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          }`}>
                            {botGroup === 'unassigned' ? 'طاولة مفتوحة ⚪' : botGroup === 'solids' ? 'صنفه: سادة 🟡 (1-7)' : 'صنفه: ألوان 🔵 (9-15)'}
                          </span>
                        </div>

                        {botGroup !== 'unassigned' && (
                          <div className="flex gap-1 mt-1.5 justify-end">
                            {getGroupBalls(botGroup).map(b => (
                              <div
                                key={b.num}
                                className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black border transition-all ${
                                  b.potted 
                                    ? 'bg-slate-900 border-slate-800 text-slate-600 line-through opacity-30' 
                                    : 'text-slate-950 font-bold border-white/60 shadow'
                                }`}
                                style={{ backgroundColor: b.potted ? '#1e293b' : b.color }}
                                title={`كرة الخصم رقم ${b.num} ${b.potted ? '(سقطت)' : '(متبقية)'}`}
                              >
                                {!b.potted && b.num}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] font-bold text-amber-300 text-left mt-1">النقاط: {botScore}</div>
                    )}
                  </div>
                  <img src={opponentAvatar} alt={opponentName} className="w-12 h-12 rounded-full border-2 border-rose-400 bg-slate-900" />
                </div>
              ) : (
                <div className="px-3 py-2 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-400 font-bold">
                  تدريب فردي بدون خصم
                </div>
              )}

              {/* Menu Button */}
              <button
                onClick={() => setCurrentView('menu')}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 text-xs font-black transition-all cursor-pointer shadow"
              >
                🏠 قائمة كيو ماستر
              </button>

              <button
                onClick={handleCloseToParent}
                className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
                title="إغلاق"
              >
                ✕
              </button>
            </div>

          </div>

          {/* Group Assignment Big Announcement Modal */}
          {groupAnnouncement && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 bg-slate-950/95 border-2 border-amber-400 p-6 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.5)] flex flex-col items-center justify-center space-y-4 animate-bounce text-center">
              <span className="text-4xl">🎱</span>
              <h3 className="text-lg font-black text-amber-300">{groupAnnouncement.title}</h3>
              <div className="flex gap-4 items-center">
                <div className="bg-slate-900 border border-indigo-500/50 px-4 py-2 rounded-2xl text-center">
                  <div className="text-[10px] text-slate-400 font-bold">{username} (أنت)</div>
                  <div className="text-sm font-black text-emerald-400 mt-0.5">{groupAnnouncement.human}</div>
                </div>
                <span className="text-slate-500 font-black text-xs">VS</span>
                <div className="bg-slate-900 border border-rose-500/50 px-4 py-2 rounded-2xl text-center">
                  <div className="text-[10px] text-slate-400 font-bold">{opponentName} (الخصم)</div>
                  <div className="text-sm font-black text-rose-400 mt-0.5">{groupAnnouncement.bot}</div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400">أي كرة تلمسها من صنف الخصم أولاً ستعتبر فاول فوري!</p>
            </div>
          )}

          {/* Canvas Table Area with Interactive Controls */}
          <div className="flex-1 flex flex-col items-center justify-center p-2 md:p-4 overflow-hidden relative">
            
            <div className="w-full max-w-[960px] aspect-[2/1] relative rounded-3xl overflow-hidden shadow-[0_0_70px_rgba(0,0,0,0.95)] border-4 border-amber-950">
              <canvas
                ref={canvasRef}
                width={TABLE_WIDTH}
                height={TABLE_HEIGHT}
                onMouseMove={handleCanvasMouseMove}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                onClick={handleCanvasClick}
                className={`w-full h-full ${isBallInHand ? 'cursor-grab' : 'cursor-crosshair'}`}
              />

              {/* Game Over Modal */}
              {gameOver && (
                <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-4 animate-fade-in z-30">
                  <span className="text-5xl">🏆</span>
                  <h2 className="text-xl md:text-2xl font-black text-amber-400 text-center max-w-md">{gameOver}</h2>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setGameOver(null);
                        initBalls(mode);
                      }}
                      className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg cursor-pointer"
                    >
                      جولة جديدة 🔄
                    </button>
                    <button
                      onClick={() => setCurrentView('menu')}
                      className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-sm shadow-lg cursor-pointer"
                    >
                      القائمة الرئيسية 🏠
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Controls Bar: Pockets Selector, Spin Controller, Cue Pull-Back Gauge */}
            <div className="w-full max-w-[960px] mt-3 bg-slate-950/90 border border-slate-800 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3">
              
              {/* 1. Quick Call Pocket Selector */}
              <div className="flex items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
                <span className="text-[10px] font-black text-amber-300 ml-1">🎯 الجيب:</span>
                {pockets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setCalledPocketId(p.id);
                      if (soundEnabled) playBallClack(6);
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-all ${calledPocketId === p.id ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {/* 2. Cue Ball Spin / English Widget */}
              <div className="flex items-center gap-2.5 bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                <div
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-white via-slate-100 to-slate-300 relative shadow-inner border-2 border-slate-600 cursor-pointer flex items-center justify-center overflow-hidden"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const rx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                    const ry = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
                    setSpinX(Math.max(-0.9, Math.min(0.9, rx)));
                    setSpinY(Math.max(-0.9, Math.min(0.9, ry)));
                  }}
                  title="اضغط على الكرة لتحديد نقطة ضرب المضرب (اسكروه أو توب سبن)"
                >
                  <div className="absolute w-full h-[1px] bg-slate-300" />
                  <div className="absolute h-full w-[1px] bg-slate-300" />
                  <div
                    className="w-3.5 h-3.5 rounded-full bg-red-600 shadow-md border border-white absolute transition-all"
                    style={{
                      transform: `translate(${spinX * 18}px, ${-spinY * 18}px)`
                    }}
                  />
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black text-amber-300">
                    {spinY < -0.2 ? '🔴 اسكروه (Backspin)' : spinY > 0.2 ? '🟢 توب سبن (Follow)' : '⚪ ضربة عادية'}
                  </div>
                  <div className="flex gap-1 mt-1">
                    <button
                      onClick={() => { setSpinX(0); setSpinY(-0.8); }}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${spinY < -0.2 ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                    >
                      اسكروه
                    </button>
                    <button
                      onClick={() => { setSpinX(0); setSpinY(0.8); }}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${spinY > 0.2 ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                    >
                      توب
                    </button>
                    <button
                      onClick={() => { setSpinX(0); setSpinY(0); }}
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400"
                    >
                      وسط
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Interactive Cue Stick Pull-Back Gauge */}
              <div className="flex items-center gap-2.5 flex-1 max-w-[200px] bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                <span className="text-[11px] font-black text-amber-300 whitespace-nowrap">سحب المضرب:</span>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={power}
                  onChange={(e) => setPower(parseInt(e.target.value))}
                  disabled={(!isPractice && turn !== 'human') || isShooting || isBallInHand}
                  className="flex-1 accent-amber-500 cursor-pointer"
                />
                <span className="text-[11px] font-black text-amber-400 w-8 text-center">{power}%</span>
              </div>

              {/* 4. Action Shoot Button */}
              <button
                onClick={handleShoot}
                disabled={(!isPractice && turn !== 'human') || isShooting || isBallInHand}
                className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-lg cursor-pointer ${
                  (isPractice || turn === 'human') && !isShooting && !isBallInHand
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white active:scale-95'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                {isShooting ? 'الكرات تتحرك... 🎱' : isBallInHand ? 'ضع الكرة باليد أولاً ✋' : (isPractice || turn === 'human') ? 'اضرب الكرة! 🚀' : 'انتظر دور الخصم...'}
              </button>

            </div>

          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MODALS (STAKE SELECT, SETTINGS, SHOP, LEADERBOARD)     */}
      {/* ======================================================== */}

      {/* Stake Selector */}
      {activeModal === 'stake_select' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0b121e] border border-amber-500/40 rounded-3xl p-6 w-full max-w-lg relative shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-amber-300 flex items-center gap-2">
                <span>🎱</span> اختيار طاولة ومبلغ الرهان
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white cursor-pointer text-sm font-bold">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-1 bg-slate-900 rounded-2xl border border-slate-800">
              <button
                onClick={() => setMode('8-ball')}
                className={`py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${mode === '8-ball' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400'}`}
              >
                🎱 8-Ball Pool (أمريكي)
              </button>
              <button
                onClick={() => setMode('snooker')}
                className={`py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${mode === 'snooker' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400'}`}
              >
                🟢 Royal Snooker (سنوكر)
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {[
                { name: 'طاولة القاهرة (Cairo)', fee: 100, win: 190, icon: '🇪🇬' },
                { name: 'طاولة الإسكندرية (Alexandria)', fee: 500, win: 950, icon: '🌊' },
                { name: 'طاولة دبي الذهبية (Dubai)', fee: 2500, win: 4750, icon: '🇦🇪' },
                { name: 'طاولة لندن الملكية (London)', fee: 10000, win: 19000, icon: '🇬🇧' },
              ].map((tbl) => (
                <div key={tbl.fee} className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800 rounded-2xl hover:border-amber-500/50 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{tbl.icon}</span>
                    <div>
                      <div className="text-xs font-black text-white">{tbl.name}</div>
                      <div className="text-[10px] text-amber-300 font-mono">الرهان: {tbl.fee} 🪙 • الجائزة: {tbl.win} 🪙</div>
                    </div>
                  </div>
                  <button
                    onClick={() => startMatch(mode, false, tbl.fee)}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow cursor-pointer active:scale-95"
                  >
                    العب الآن ▶
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tournaments Modal */}
      {activeModal === 'tournaments' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0b121e] border border-amber-500/40 rounded-3xl p-6 w-full max-w-xl relative shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-amber-300 flex items-center gap-2">
                <span>🏆</span> بطولات كيو ماستر الإقصائية (8 Players)
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-200">
              نظام خروج المغلوب من 3 أدوار (ربع النهائي ⬅️ نصف النهائي ⬅️ النهائي الكبير).
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { title: 'كأس القاهرة المفتوح', fee: 500, prize: 3500 },
                { title: 'بطولة دبي الدولية', fee: 2000, prize: 14000 },
              ].map((tourn) => (
                <div key={tourn.title} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-between gap-3">
                  <div>
                    <h4 className="font-black text-sm text-white">{tourn.title}</h4>
                    <p className="text-[11px] text-amber-300 mt-1">الدخول: {tourn.fee} 🪙 • الجائزة الكبرى: {tourn.prize} 🪙</p>
                  </div>
                  <button
                    onClick={() => startMatch('8-ball', false, tourn.fee)}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow cursor-pointer"
                  >
                    دخول البطولة ⚔️
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Shop Modal */}
      {activeModal === 'shop' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0b121e] border border-amber-500/40 rounded-3xl p-6 w-full max-w-md relative shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-amber-300 flex items-center gap-2">
                <span>🛒</span> متجر عصي البلياردو (Cue Sticks)
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              {[
                { id: 'classic', name: 'عصا الخشب الكلاسيكية', color: '#d97706', cost: 'مملوكة' },
                { id: 'dragon', name: 'عصا التنين الناري', color: '#dc2626', cost: '5,000 🪙' },
                { id: 'neon', name: 'عصا النيون السيبرانية', color: '#06b6d4', cost: '15,000 🪙' },
                { id: 'gold', name: 'عصا الفراعنة الذهبية', color: '#fbbf24', cost: '50,000 🪙' },
              ].map((c) => (
                <div key={c.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${selectedCue === c.id ? 'bg-amber-500/10 border-amber-400' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-xs font-black text-white">{c.name}</span>
                  </div>
                  <button
                    onClick={() => setSelectedCue(c.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${selectedCue === c.id ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
                  >
                    {selectedCue === c.id ? 'مجهزة ✓' : c.cost}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {activeModal === 'settings' && (
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
                  className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer ${soundEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                  {soundEnabled ? 'مفعل 🔊' : 'مكتوم 🔇'}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span>خط التوجيه المساعد:</span>
                <button
                  onClick={() => setAimAssistLong(!aimAssistLong)}
                  className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer ${aimAssistLong ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                  {aimAssistLong ? 'طويل (Pro)' : 'قصير'}
                </button>
              </div>

              <div>
                <span className="block mb-2">لون قماش الطاولة:</span>
                <div className="flex gap-2">
                  <button onClick={() => setFeltColor('green')} className={`flex-1 py-1.5 rounded-xl text-[11px] ${feltColor === 'green' ? 'bg-green-700 text-white' : 'bg-slate-800'}`}>أخضر</button>
                  <button onClick={() => setFeltColor('blue')} className={`flex-1 py-1.5 rounded-xl text-[11px] ${feltColor === 'blue' ? 'bg-blue-700 text-white' : 'bg-slate-800'}`}>أزرق</button>
                  <button onClick={() => setFeltColor('snooker')} className={`flex-1 py-1.5 rounded-xl text-[11px] ${feltColor === 'snooker' ? 'bg-emerald-800 text-white' : 'bg-slate-800'}`}>سنوكر</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {activeModal === 'leaderboard' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0b121e] border border-amber-500/40 rounded-3xl p-6 w-full max-w-md relative shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-amber-300">🏆 صدارة ملوك كيو ماستر</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="space-y-2">
              {[
                { rank: 1, name: 'فخر_العرب_8BP', coins: '1,450,000 🪙', badge: '🥇' },
                { rank: 2, name: 'سلطان_السنوكر', coins: '980,000 🪙', badge: '🥈' },
                { rank: 3, name: 'كايزن_بلياردو', coins: '720,000 🪙', badge: '🥉' },
                { rank: 4, name: username, coins: `${coins.toLocaleString()} 🪙`, badge: '⭐ أنت' },
              ].map((p) => (
                <div key={p.rank} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-amber-400">{p.badge}</span>
                    <span className="font-bold text-white">{p.name}</span>
                  </div>
                  <span className="text-amber-300 font-mono font-bold">{p.coins}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
