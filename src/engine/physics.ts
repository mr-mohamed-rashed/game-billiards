import { CueItem, TableItem } from "@/config/shopData";
import {
  BALL_CONFIG_MAP,
  BALL_RADIUS,
  Ball,
  BallGroup,
  GameMode,
  POCKETS,
  POCKET_JAWS,
  Pocket,
  TABLE_HEIGHT,
  TABLE_WIDTH,
} from "@/types/billiards";
import { playBallClack, playPocketDrop } from "@/utils/audio";

export function clampBallInHandPos(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(821, Math.max(84, x)),
    y: Math.min(377, Math.max(66, y)),
  };
}

function makeBallAxes(seed: number) {
  // Deterministic initial 3D orientation (number pole p + orthogonal stripe pole s)
  const px = Math.sin(seed * 1.37) * 0.28;
  const py = Math.cos(seed * 0.91) * 0.28;
  const pz = Math.sqrt(Math.max(0.1, 1 - px * px - py * py));

  // Build vector orthogonal to p
  const rx = Math.cos(seed * 2.13);
  const ry = Math.sin(seed * 2.13);
  const rz = 0;
  const dot = rx * px + ry * py + rz * pz;
  let sx = rx - dot * px;
  let sy = ry - dot * py;
  let sz = rz - dot * pz;
  const sn = Math.hypot(sx, sy, sz) || 1;
  sx /= sn;
  sy /= sn;
  sz /= sn;
  return { px, py, pz, sx, sy, sz };
}

export function findFreeCueBallPos(balls: Ball[]): { x: number; y: number } {
  const headX = 82 + (823 - 82) * 0.25;
  const centerY = 221.5;
  const minGap = BALL_RADIUS * 2.25;

  const isFree = (cx: number, cy: number) =>
    !balls.some((b, idx) => idx > 0 && !b.isPotted && Math.hypot(b.x - cx, b.y - cy) < minGap);

  if (isFree(headX, centerY)) return { x: headX, y: centerY };

  for (let ring = 1; ring <= 14; ring++) {
    const rad = ring * 20;
    const steps = 8 + ring * 2;
    for (let k = 0; k < steps; k++) {
      const ang = (k / steps) * Math.PI * 2;
      const cand = clampBallInHandPos(headX + Math.cos(ang) * rad, centerY + Math.sin(ang) * rad);
      if (isFree(cand.x, cand.y)) return cand;
    }
  }
  return { x: headX, y: centerY };
}

export function placeCueBallSafely(balls: Ball[]): { x: number; y: number } {
  const pos = findFreeCueBallPos(balls);
  const cb = balls[0];
  if (cb) {
    cb.x = pos.x;
    cb.y = pos.y;
    cb.vx = 0;
    cb.vy = 0;
    cb.isPotted = false;
  }
  return pos;
}

export function initBallsRack(mode: GameMode): Ball[] {
  const balls: Ball[] = [];
  const tableLeft = 82;
  const tableRight = 823;
  const centerY = 221.5;

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
    px: 0,
    py: 0,
    pz: 1,
    sx: 1,
    sy: 0,
    sz: 0,
  });

  if (mode === "8-ball") {
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
        const axes = makeBallAxes(ballNum);
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
          ...axes,
        });
      }
    }
  } else {
    let sId = 1;
    const apexX = tableLeft + (tableRight - tableLeft) * 0.75;
    const spacing = BALL_RADIUS * 2.05;
    const rowSpacing = spacing * Math.cos(Math.PI / 6);

    for (let r = 0; r < 5; r++) {
      const rowX = apexX + r * rowSpacing;
      const startY = centerY - (r * spacing) / 2;
      for (let c = 0; c <= r; c++) {
        const axes = makeBallAxes(sId);
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
          ...axes,
        });
      }
    }

    const colors = [
      { color: "#facc15", val: 2, x: 82 + 150, y: centerY + 60 },
      { color: "#16a34a", val: 3, x: 82 + 150, y: centerY - 60 },
      { color: "#78350f", val: 4, x: 82 + 150, y: centerY },
      { color: "#2563eb", val: 5, x: TABLE_WIDTH / 2, y: centerY },
      { color: "#ec4899", val: 6, x: apexX - 25, y: centerY },
      { color: "#09090b", val: 7, x: tableRight - 55, y: centerY },
    ];
    colors.forEach((c) => {
      const axes = makeBallAxes(c.val);
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
        ...axes,
      });
    });
  }

  return balls;
}

export function respotBall(ball: Ball, balls: Ball[]) {
  const tableLeft = 82;
  const tableRight = 823;
  const footSpotX = tableLeft + (tableRight - tableLeft) * 0.72;
  const footSpotY = TABLE_HEIGHT / 2;

  let targetX = footSpotX;
  let targetY = footSpotY;

  while (balls.some((b) => !b.isPotted && Math.hypot(b.x - targetX, b.y - targetY) < BALL_RADIUS * 2.1)) {
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
}

export function getCueForceMultiplier(cue: CueItem): number {
  const base = 0.92 + (cue.stats.force / 10) * 0.35;
  if (cue.id === "cue_dragon_flame" || cue.id === "cue_void_arcane") return base * 1.12;
  if (cue.id === "cue_carbon_red" || cue.id === "cue_titan_silver") return base * 1.06;
  return base;
}

export interface StepPhysicsCallbacks {
  onPotentialCinematic: (pocket: Pocket, ball: Ball) => void;
  onPocketed: (ball: Ball, pocketId: number) => void;
  onFirstBallHit: (target: Ball) => void;
}

export interface StepPhysicsParams {
  balls: Ball[];
  dtNorm: number;
  timeScale: number;
  tableCfg: TableItem;
  cueActive: CueItem;
  soundEnabled: boolean;
  activeShotCalledPocketId: number | null;
  activeShotAimAngle: number;
  spinX: number;
  spinY: number;
  spinAppliedRef: { current: boolean };
  firstBallHitRef: { current: Ball | null };
  callbacks: StepPhysicsCallbacks;
}

const SUB_STEPS = 10;
const MAX_SPEED = 42;

export function stepPhysics({
  balls,
  dtNorm,
  timeScale,
  tableCfg,
  cueActive,
  soundEnabled,
  activeShotCalledPocketId,
  activeShotAimAngle,
  spinX,
  spinY,
  spinAppliedRef,
  firstBallHitRef,
  callbacks,
}: StepPhysicsParams): boolean {
  const ballCount = balls.length;
  if (ballCount === 0) return false;

  const FRICTION = tableCfg.friction;
  const subFriction = Math.pow(FRICTION, 1 / SUB_STEPS);
  const effectiveScale = dtNorm * timeScale;
  const stepFriction = Math.pow(subFriction, effectiveScale);
  const invSub = effectiveScale / SUB_STEPS;
  const CUSHION_BOUNCE = tableCfg.bounceRestitution;
  const cueSpinBonus = 0.75 + (cueActive.stats.spin / 10) * 0.55;

  // Legendary Cue Perks
  const pocketDropRadius = cueActive.id === "cue_angelic_seraph" ? 25 : 22;
  const funnelPullBase = cueActive.id === "cue_angelic_seraph" ? 0.58 : 0.48;
  const screwPerkMult = cueActive.id === "cue_volcanic_magma" ? 1.65 : 1.0;
  const isDeadStopCue = cueActive.id === "cue_nature_druid";

  let anyMoving = false;

  for (let step = 0; step < SUB_STEPS; step++) {
    for (let bi = 0; bi < ballCount; bi++) {
      const ball = balls[bi];
      if (ball.isPotted) continue;

      ball.x += ball.vx * invSub;
      ball.y += ball.vy * invSub;
      ball.vx *= stepFriction;
      ball.vy *= stepFriction;

      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed > 0.15) anyMoving = true;

      // Straight Rubber Cushion Rails
      if (ball.y < 64 && ((ball.x > 94 && ball.x < 422) || (ball.x > 478 && ball.x < 806))) {
        ball.y = 64;
        ball.vy = Math.abs(ball.vy) * CUSHION_BOUNCE;
        if (soundEnabled && speed > 1.0) playBallClack(speed);
      }
      if (ball.y > 379 && ((ball.x > 94 && ball.x < 422) || (ball.x > 478 && ball.x < 806))) {
        ball.y = 379;
        ball.vy = -Math.abs(ball.vy) * CUSHION_BOUNCE;
        if (soundEnabled && speed > 1.0) playBallClack(speed);
      }
      if (ball.x < 82 && ball.y > 86 && ball.y < 364) {
        ball.x = 82;
        ball.vx = Math.abs(ball.vx) * CUSHION_BOUNCE;
        if (soundEnabled && speed > 1.0) playBallClack(speed);
      }
      if (ball.x > 823 && ball.y > 86 && ball.y < 364) {
        ball.x = 823;
        ball.vx = -Math.abs(ball.vx) * CUSHION_BOUNCE;
        if (soundEnabled && speed > 1.0) playBallClack(speed);
      }

      // Pocket Jaw Knuckle Bumpers (realistic angled rebounds at pocket corners)
      for (let ji = 0; ji < POCKET_JAWS.length; ji++) {
        const jaw = POCKET_JAWS[ji];
        const jdx = ball.x - jaw.x;
        const jdy = ball.y - jaw.y;
        const minJawDist = ball.radius + jaw.r;
        if (Math.abs(jdx) < minJawDist && Math.abs(jdy) < minJawDist) {
          const jDist = Math.hypot(jdx, jdy);
          if (jDist < minJawDist && jDist > 0.001) {
            const nx = jdx / jDist;
            const ny = jdy / jDist;
            ball.x = jaw.x + nx * minJawDist;
            ball.y = jaw.y + ny * minJawDist;
            const vn = ball.vx * nx + ball.vy * ny;
            if (vn < 0) {
              ball.vx -= (1 + CUSHION_BOUNCE) * vn * nx;
              ball.vy -= (1 + CUSHION_BOUNCE) * vn * ny;
              if (soundEnabled && Math.abs(vn) > 1.0) playBallClack(Math.abs(vn));
            }
          }
        }
      }

      // Pocket Drop & Funnel Suction
      for (let pi = 0; pi < POCKETS.length; pi++) {
        const p = POCKETS[pi];
        const dx = p.x - ball.x;
        const dy = p.y - ball.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 30 && dist > 0.5) {
          const pull = funnelPullBase * (1 - dist / 30) * effectiveScale;
          ball.vx += (dx / dist) * pull;
          ball.vy += (dy / dist) * pull;
        }

        const isTargetOrEight =
          (activeShotCalledPocketId !== null && p.id === activeShotCalledPocketId) || ball.number === 8;
        if (dist < 36 && dist > 14 && speed > 1.8 && isTargetOrEight && ball.type !== "cue") {
          callbacks.onPotentialCinematic(p, ball);
        }

        if (dist < pocketDropRadius) {
          ball.isPotted = true;
          ball.vx = 0;
          ball.vy = 0;
          if (soundEnabled) playPocketDrop();
          callbacks.onPocketed(ball, p.id);
          break;
        }
      }

      // Outer table safety catch
      if (!ball.isPotted && (ball.x < 42 || ball.x > TABLE_WIDTH - 42 || ball.y < 32 || ball.y > TABLE_HEIGHT - 32)) {
        let nearestP = POCKETS[0];
        let bestDist = Infinity;
        for (let pi = 0; pi < POCKETS.length; pi++) {
          const d = Math.hypot(POCKETS[pi].x - ball.x, POCKETS[pi].y - ball.y);
          if (d < bestDist) {
            bestDist = d;
            nearestP = POCKETS[pi];
          }
        }
        ball.isPotted = true;
        ball.vx = 0;
        ball.vy = 0;
        if (soundEnabled) playPocketDrop();
        callbacks.onPocketed(ball, nearestP.id);
      }
    }

    // Ball-to-Ball Elastic Collisions
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
            if (soundEnabled && relVelNormal > 0.8) {
              playBallClack(relVelNormal);
            }
          }

          if (b1.type === "cue" || b2.type === "cue") {
            const targetB = b1.type === "cue" ? b2 : b1;
            const cueB = b1.type === "cue" ? b1 : b2;

            if (!firstBallHitRef.current) {
              firstBallHitRef.current = targetB;
              callbacks.onFirstBallHit(targetB);
            }

            if (!spinAppliedRef.current) {
              spinAppliedRef.current = true;
              const cosAim = Math.cos(activeShotAimAngle);
              const sinAim = Math.sin(activeShotAimAngle);

              if (isDeadStopCue && Math.abs(spinY) < 0.25 && Math.abs(spinX) < 0.25) {
                cueB.vx *= 0.25;
                cueB.vy *= 0.25;
              } else if (spinY < -0.15) {
                const screwMag = Math.abs(spinY) * 5.6 * cueSpinBonus * screwPerkMult;
                cueB.vx -= cosAim * screwMag;
                cueB.vy -= sinAim * screwMag;
              } else if (spinY > 0.15) {
                const followMag = spinY * 4.4 * cueSpinBonus;
                cueB.vx += cosAim * followMag;
                cueB.vy += sinAim * followMag;
              }
              if (Math.abs(spinX) > 0.15) {
                const sideMag = spinX * 2.6 * cueSpinBonus;
                cueB.vx += -sinAim * sideMag;
                cueB.vy += cosAim * sideMag;
              }
            }
          }
        }
      }
    }
  }

  // Update 3D Sphere Rolling Rotation & Clean Stop Threshold
  const lowSpeedDamp = Math.pow(0.93, dtNorm);
  for (let i = 0; i < ballCount; i++) {
    const ball = balls[i];
    if (ball.isPotted) continue;
    let curSpeed = Math.hypot(ball.vx, ball.vy);
    if (curSpeed > MAX_SPEED) {
      ball.vx = (ball.vx / curSpeed) * MAX_SPEED;
      ball.vy = (ball.vy / curSpeed) * MAX_SPEED;
      curSpeed = MAX_SPEED;
    }
    if (curSpeed > 0.15 && curSpeed < 0.85) {
      ball.vx *= lowSpeedDamp;
      ball.vy *= lowSpeedDamp;
      curSpeed = Math.hypot(ball.vx, ball.vy);
    }
    if (curSpeed <= 0.15) {
      ball.vx = 0;
      ball.vy = 0;
    } else {
      anyMoving = true;
      // Smooth anti-strobing 3D sphere roll rotation for both pole (p) and stripe axis (s)
      const theta = Math.min(0.42 * dtNorm, (curSpeed * effectiveScale) / (ball.radius * 1.45));
      const ax = -ball.vy / curSpeed;
      const ay = ball.vx / curSpeed;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const oneMinusCos = 1 - cosT;

      const dotP = ax * ball.px + ay * ball.py;
      const npx = ball.px * cosT + ay * ball.pz * sinT + ax * dotP * oneMinusCos;
      const npy = ball.py * cosT - ax * ball.pz * sinT + ay * dotP * oneMinusCos;
      const npz = ball.pz * cosT + (ax * ball.py - ay * ball.px) * sinT;
      const normP = Math.hypot(npx, npy, npz) || 1;
      ball.px = npx / normP;
      ball.py = npy / normP;
      ball.pz = npz / normP;

      const dotS = ax * ball.sx + ay * ball.sy;
      let nsx = ball.sx * cosT + ay * ball.sz * sinT + ax * dotS * oneMinusCos;
      let nsy = ball.sy * cosT - ax * ball.sz * sinT + ay * dotS * oneMinusCos;
      let nsz = ball.sz * cosT + (ax * ball.sy - ay * ball.sx) * sinT;
      // Re-orthogonalize s against p so float drift never accumulates
      const ps = nsx * ball.px + nsy * ball.py + nsz * ball.pz;
      nsx -= ps * ball.px;
      nsy -= ps * ball.py;
      nsz -= ps * ball.pz;
      const normS = Math.hypot(nsx, nsy, nsz) || 1;
      ball.sx = nsx / normS;
      ball.sy = nsy / normS;
      ball.sz = nsz / normS;
    }
  }

  return anyMoving;
}

// Segment-to-circle occlusion helper for Bot Cut-Shot AI
function isSegmentClear(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  balls: Ball[],
  ignoreIds: Set<number>
): boolean {
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq < 1) return true;
  const minClearSq = Math.pow(BALL_RADIUS * 2.02, 2);

  for (let i = 0; i < balls.length; i++) {
    const o = balls[i];
    if (o.isPotted || ignoreIds.has(o.id)) continue;
    const t = Math.max(0, Math.min(1, ((o.x - ax) * abx + (o.y - ay) * aby) / abLenSq));
    const px = ax + t * abx;
    const py = ay + t * aby;
    const dSq = (o.x - px) * (o.x - px) + (o.y - py) * (o.y - py);
    if (dSq < minClearSq) return false;
  }
  return true;
}

export interface BotShotPlan {
  angle: number;
  pocketId: number;
  speed: number;
}

// Smart Cut-Shot / Ghost-Ball Bot AI with Line-of-Sight Obstruction Check
export function computeBotShot(balls: Ball[], botGroup: BallGroup, mode: GameMode): BotShotPlan | null {
  const cueBall = balls[0];
  if (!cueBall || cueBall.isPotted) return null;

  const candidateBalls = balls.filter((b) => {
    if (b.isPotted || b.type === "cue") return false;
    if (mode === "8-ball" && botGroup !== "unassigned") {
      const botType = botGroup === "solids" ? "solid" : "stripe";
      const botBallsLeft = balls.some((x) => !x.isPotted && x.number !== 8 && x.type === botType);
      return botBallsLeft ? b.type === botType : b.number === 8;
    }
    if (mode === "8-ball") return b.number !== 8;
    return true;
  });

  const targets = candidateBalls.length > 0 ? candidateBalls : balls.filter((b) => !b.isPotted && b.type !== "cue");
  if (targets.length === 0) return null;

  let bestScore = -Infinity;
  let bestPlan: BotShotPlan | null = null;

  for (let ti = 0; ti < targets.length; ti++) {
    const target = targets[ti];
    const ignore = new Set<number>([0, target.id]);

    for (let pi = 0; pi < POCKETS.length; pi++) {
      const p = POCKETS[pi];
      const toPx = p.x - target.x;
      const toPy = p.y - target.y;
      const distBP = Math.hypot(toPx, toPy);
      if (distBP < 1) continue;

      const uBPx = toPx / distBP;
      const uBPy = toPy / distBP;

      // Ghost ball impact point
      const gx = target.x - uBPx * (BALL_RADIUS * 2);
      const gy = target.y - uBPy * (BALL_RADIUS * 2);
      if (gx < 72 || gx > 833 || gy < 54 || gy > 389) continue;

      const toGx = gx - cueBall.x;
      const toGy = gy - cueBall.y;
      const distCG = Math.hypot(toGx, toGy);
      if (distCG < 1) continue;

      const uCGx = toGx / distCG;
      const uCGy = toGy / distCG;
      const cutDot = uCGx * uBPx + uCGy * uBPy;
      if (cutDot <= 0.18) continue; // Impossible >80 deg cut

      const clearCueToGhost = isSegmentClear(cueBall.x, cueBall.y, gx, gy, balls, ignore);
      const clearBallToPocket = isSegmentClear(target.x, target.y, p.x, p.y, balls, ignore);

      let score = cutDot * 120 - (distCG + distBP) * 0.08;
      if (!clearCueToGhost) score -= 200;
      if (!clearBallToPocket) score -= 180;

      if (score > bestScore) {
        bestScore = score;
        const variance = (Math.random() - 0.5) * 0.048;
        const speed = Math.min(34, Math.max(18, 17 + (distCG + distBP) * 0.018 + (1 - cutDot) * 6));
        bestPlan = {
          angle: Math.atan2(toGy, toGx) + variance,
          pocketId: p.id,
          speed,
        };
      }
    }
  }

  // Fallback if all pockets are cut-blocked: hit the closest legal ball cleanly
  if (!bestPlan) {
    const closest = targets.reduce((prev, curr) => {
      const d1 = Math.hypot(prev.x - cueBall.x, prev.y - cueBall.y);
      const d2 = Math.hypot(curr.x - cueBall.x, curr.y - cueBall.y);
      return d1 < d2 ? prev : curr;
    });
    const bestPocket = POCKETS.reduce((prev, curr) => {
      const d1 = Math.hypot(prev.x - closest.x, prev.y - closest.y);
      const d2 = Math.hypot(curr.x - closest.x, curr.y - closest.y);
      return d1 < d2 ? prev : curr;
    });
    return {
      angle: Math.atan2(closest.y - cueBall.y, closest.x - cueBall.x),
      pocketId: bestPocket.id,
      speed: 22,
    };
  }

  return bestPlan;
}
