import { CueItem, TableItem } from "@/config/shopData";
import {
  BALL_CONFIG_MAP,
  BALL_RADIUS,
  Ball,
  BallGroup,
  DEFAULT_TABLE_GEOMETRY,
  GameMode,
  ONE_FIFTEEN_POCKET_1,
  ONE_FIFTEEN_POCKET_15,
  Pocket,
  SNOOKER_COLOR_ORDER,
  SnookerTargetInfo,
  TableGeometry,
  getBreakLineX,
  getModeBallRadius,
  getPlayBounds,
  getSnookerSpots,
} from "@/types/billiards";
import { playBallClack, playPocketDrop } from "@/utils/audio";

export function clampBallInHandPos(
  x: number,
  y: number,
  geom: TableGeometry = DEFAULT_TABLE_GEOMETRY,
  maxAllowedX?: number,
  ballRadius: number = BALL_RADIUS
): { x: number; y: number } {
  const bounds = getPlayBounds(geom, ballRadius);
  const upperX = maxAllowedX !== undefined ? Math.min(bounds.maxX - 2, maxAllowedX) : bounds.maxX - 2;
  return {
    x: Math.min(upperX, Math.max(bounds.minX + 2, x)),
    y: Math.min(bounds.maxY - 2, Math.max(bounds.minY + 2, y)),
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

export function findFreeCueBallPos(
  balls: Ball[],
  geom: TableGeometry = DEFAULT_TABLE_GEOMETRY,
  maxAllowedX?: number
): { x: number; y: number } {
  const r = balls[0]?.radius ?? BALL_RADIUS;
  const bounds = getPlayBounds(geom, r);
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const rawHeadX =
    maxAllowedX !== undefined
      ? Math.max(bounds.minX + 18, maxAllowedX - 28)
      : bounds.minX + (bounds.maxX - bounds.minX) * 0.25;
  const headX = clampBallInHandPos(rawHeadX, centerY, geom, maxAllowedX, r).x;
  const startY = maxAllowedX !== undefined ? centerY + 22 : centerY;
  const minGap = r * 2.25;

  const isFree = (cx: number, cy: number) =>
    !balls.some((b, idx) => idx > 0 && !b.isPotted && Math.hypot(b.x - cx, b.y - cy) < minGap);

  if (isFree(headX, startY)) return { x: headX, y: startY };
  if (isFree(headX, centerY)) return { x: headX, y: centerY };

  for (let ring = 1; ring <= 14; ring++) {
    const rad = ring * 20;
    const steps = 8 + ring * 2;
    for (let k = 0; k < steps; k++) {
      const ang = (k / steps) * Math.PI * 2;
      const cand = clampBallInHandPos(
        headX + Math.cos(ang) * rad,
        centerY + Math.sin(ang) * rad,
        geom,
        maxAllowedX,
        r
      );
      if (isFree(cand.x, cand.y)) return cand;
    }
  }
  return { x: headX, y: startY };
}

export function placeCueBallSafely(
  balls: Ball[],
  geom: TableGeometry = DEFAULT_TABLE_GEOMETRY,
  maxAllowedX?: number
): { x: number; y: number } {
  const pos = findFreeCueBallPos(balls, geom, maxAllowedX);
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

export function moveBreakCueBall(
  x: number,
  y: number,
  balls: Ball[],
  geom: TableGeometry = DEFAULT_TABLE_GEOMETRY,
  maxAllowedX?: number
): boolean {
  const cueBall = balls[0];
  if (!cueBall || cueBall.isPotted) return false;
  const r = cueBall.radius;

  let cand = clampBallInHandPos(x, y, geom, maxAllowedX, r);
  const minGap = r * 2.15;

  const overlapsAny = (cx: number, cy: number) =>
    balls.some((b, idx) => idx > 0 && !b.isPotted && Math.hypot(b.x - cx, b.y - cy) < minGap);

  if (overlapsAny(cand.x, cand.y)) {
    // Nudge gently around blocking baulk ball so dragging feels smooth
    const blocker = balls.find((b, idx) => idx > 0 && !b.isPotted && Math.hypot(b.x - cand.x, b.y - cand.y) < minGap);
    if (blocker) {
      const dx = cand.x - blocker.x;
      const dy = cand.y - blocker.y;
      const d = Math.hypot(dx, dy) || 1;
      cand = clampBallInHandPos(
        blocker.x + (dx / d) * (minGap + 1),
        blocker.y + (dy / d) * (minGap + 1),
        geom,
        maxAllowedX,
        r
      );
    }
    if (overlapsAny(cand.x, cand.y)) return false;
  }

  cueBall.x = cand.x;
  cueBall.y = cand.y;
  cueBall.vx = 0;
  cueBall.vy = 0;
  return true;
}

export function initBallsRack(
  mode: GameMode,
  geom: TableGeometry = DEFAULT_TABLE_GEOMETRY
): Ball[] {
  const balls: Ball[] = [];
  const ballRadius = getModeBallRadius(mode);
  const bounds = getPlayBounds(geom, ballRadius);
  const tableLeft = bounds.minX;
  const tableRight = bounds.maxX;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const breakLineX = getBreakLineX(mode, geom);

  balls.push({
    id: 0,
    x: mode === "snooker" ? Math.max(tableLeft + 14, breakLineX - 28) : breakLineX,
    y: mode === "snooker" ? centerY + 22 : centerY,
    vx: 0,
    vy: 0,
    radius: ballRadius,
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

  if (mode === "8-ball" || mode === "one-fifteen") {
    const RACK_NUMBERS = [1, 9, 2, 3, 8, 10, 11, 4, 12, 5, 13, 6, 14, 7, 15];
    const apexX = tableLeft + (tableRight - tableLeft) * 0.72;
    const spacing = ballRadius * 2.04;
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
          radius: ballRadius,
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
    const { apexX, spots } = getSnookerSpots(geom);
    const spacing = ballRadius * 2.05;
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
          radius: ballRadius,
          color: "#dc2626",
          number: 1,
          type: "red",
          value: 1,
          isPotted: false,
          ...axes,
        });
      }
    }

    spots.forEach((c) => {
      const axes = makeBallAxes(c.val);
      balls.push({
        id: sId++,
        x: c.x,
        y: c.y,
        vx: 0,
        vy: 0,
        radius: ballRadius,
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

export function respotBall(
  ball: Ball,
  balls: Ball[],
  geom: TableGeometry = DEFAULT_TABLE_GEOMETRY
) {
  const r = ball.radius;
  const bounds = getPlayBounds(geom, r);
  const minGap = r * 2.08;
  const isSpotFree = (tx: number, ty: number) =>
    !balls.some((b) => b.id !== ball.id && !b.isPotted && Math.hypot(b.x - tx, b.y - ty) < minGap);

  if (ball.type === "color") {
    const { spots, centerY } = getSnookerSpots(geom);
    const ownSpot = spots.find((s) => s.val === ball.value) || spots[spots.length - 1];
    let targetX = ownSpot.x;
    let targetY = ownSpot.y;
    let placed = isSpotFree(targetX, targetY);

    // Official Snooker rule: if own spot is occupied, try highest-value unoccupied spot
    if (!placed) {
      const descValues = [...SNOOKER_COLOR_ORDER].reverse();
      for (const val of descValues) {
        const altSpot = spots.find((s) => s.val === val);
        if (altSpot && isSpotFree(altSpot.x, altSpot.y)) {
          targetX = altSpot.x;
          targetY = altSpot.y;
          placed = true;
          break;
        }
      }
    }

    // Fallback: closest free spot along center line toward top cushion, then spiral
    if (!placed) {
      for (let step = 1; step <= 18; step++) {
        const candX = Math.min(bounds.maxX - 2, ownSpot.x + step * r * 2.15);
        if (isSpotFree(candX, centerY)) {
          targetX = candX;
          targetY = centerY;
          placed = true;
          break;
        }
      }
    }
    if (!placed) {
      for (let ring = 1; ring <= 14 && !placed; ring++) {
        const rad = ring * r * 2.15;
        const steps = 8 + ring * 2;
        for (let k = 0; k < steps; k++) {
          const ang = (k / steps) * Math.PI * 2;
          const cand = clampBallInHandPos(ownSpot.x + Math.cos(ang) * rad, ownSpot.y + Math.sin(ang) * rad, geom, undefined, r);
          if (isSpotFree(cand.x, cand.y)) {
            targetX = cand.x;
            targetY = cand.y;
            placed = true;
            break;
          }
        }
      }
    }

    ball.isPotted = false;
    ball.x = targetX;
    ball.y = targetY;
    ball.vx = 0;
    ball.vy = 0;
    ball.spinSide = 0;
    return;
  }

  const footSpotX = bounds.minX + (bounds.maxX - bounds.minX) * 0.72;
  const footSpotY = (bounds.minY + bounds.maxY) / 2;

  let targetX = footSpotX;
  let targetY = footSpotY;

  while (!isSpotFree(targetX, targetY)) {
    targetX += r * 2.2;
    if (targetX > bounds.maxX - 5) {
      targetX = footSpotX;
      targetY += r * 2.2;
    }
  }

  ball.isPotted = false;
  ball.x = targetX;
  ball.y = targetY;
  ball.vx = 0;
  ball.vy = 0;
  ball.spinSide = 0;
}

export function getCueForceMultiplier(cue: CueItem): number {
  const base = 0.92 + (cue.stats.force / 10) * 0.35;
  if (cue.id === "cue_dragon_flame" || cue.id === "cue_void_arcane") return base * 1.12;
  if (cue.id === "cue_carbon_red" || cue.id === "cue_titan_silver") return base * 1.06;
  return base;
}

export interface StepPhysicsCallbacks {
  onPotentialCinematic: (pocket: Pocket, ball: Ball, reason: string) => void;
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

function clampBallToStraightCushions(b: Ball, geom: TableGeometry) {
  const { railSpans } = geom;
  const bounds = getPlayBounds(geom, b.radius);
  if (
    b.y < bounds.minY &&
    ((b.x > railSpans.topLeftEndX && b.x < railSpans.topMidStartX) ||
      (b.x > railSpans.topMidEndX && b.x < railSpans.topRightStartX))
  ) {
    b.y = bounds.minY;
  }
  if (
    b.y > bounds.maxY &&
    ((b.x > railSpans.botLeftEndX && b.x < railSpans.botMidStartX) ||
      (b.x > railSpans.botMidEndX && b.x < railSpans.botRightStartX))
  ) {
    b.y = bounds.maxY;
  }
  if (b.x < bounds.minX && b.y > railSpans.leftTopEndY && b.y < railSpans.leftBotStartY) {
    b.x = bounds.minX;
  }
  if (b.x > bounds.maxX && b.y > railSpans.rightTopEndY && b.y < railSpans.rightBotStartY) {
    b.x = bounds.maxX;
  }
}

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

  const geom = tableCfg.geometry;
  const { railSpans, pockets, jaws } = geom;

  // Smooth exponential cloth damping + gentle tapered rolling resistance (no abrupt brake feel)
  const linearDamping = tableCfg.clothFriction ?? tableCfg.friction ?? 0.9927;
  const rollingResistance = tableCfg.rollingResistance ?? 0.012;
  const effectiveScale = dtNorm * timeScale;
  const invSub = effectiveScale / SUB_STEPS;
  const slideDragSub = Math.pow(linearDamping, invSub);
  const rollingDecelSub = rollingResistance * invSub;
  const CUSHION_BOUNCE = tableCfg.cushionRestitution ?? tableCfg.bounceRestitution ?? 0.805;
  const cushionSpinGrip = tableCfg.spinGrip ?? 1.0;
  const cueSpinBonus = 0.75 + (cueActive.stats.spin / 10) * 0.55;

  // Legendary Cue Perks & Natural Pocket Drop Tolerance
  const pocketDropBonus = cueActive.id === "cue_angelic_seraph" ? 4.5 : 2.5;
  const funnelPullBase = cueActive.id === "cue_angelic_seraph" ? 0.78 : 0.64;
  const screwPerkMult = cueActive.id === "cue_volcanic_magma" ? 1.65 : 1.0;
  const isDeadStopCue = cueActive.id === "cue_nature_druid";

  let anyMoving = false;

  for (let step = 0; step < SUB_STEPS; step++) {
    for (let bi = 0; bi < ballCount; bi++) {
      const ball = balls[bi];
      if (ball.isPotted) continue;
      const bounds = getPlayBounds(geom, ball.radius);

      ball.x += ball.vx * invSub;
      ball.y += ball.vy * invSub;

      const rawSpeed = Math.hypot(ball.vx, ball.vy);
      if (rawSpeed > 0.0001) {
        const lowSpeedTaper = rawSpeed < 0.75 ? 0.45 + 0.55 * (rawSpeed / 0.75) : 1.0;
        const nextSpeed = Math.max(0, rawSpeed * slideDragSub - rollingDecelSub * lowSpeedTaper);
        const ratio = nextSpeed / rawSpeed;
        ball.vx *= ratio;
        ball.vy *= ratio;
      }

      const speed = Math.hypot(ball.vx, ball.vy);

      // Straight Rubber Cushion Rails (per-table calibrated inner borders + Side English & Cushion Grip)
      const applyRailSpin = (nx: number, ny: number) => {
        const eng = ball.spinSide || 0;
        if (Math.abs(eng) > 0.05 && speed > 1.2) {
          const vn = Math.max(speed * 0.55, Math.abs(ball.vx * nx + ball.vy * ny));
          // Clockwise top-down spin (Left / spinX < 0) kicks along tangent (-ny, nx) = shooter's LEFT
          const tx = -ny;
          const ty = nx;
          const kick = -eng * (0.34 * vn + 2.4) * CUSHION_BOUNCE * cushionSpinGrip;
          ball.vx += tx * kick;
          ball.vy += ty * kick;
          ball.spinSide = eng * 0.42;
        }
      };

      if (
        ball.y < bounds.minY &&
        ((ball.x > railSpans.topLeftEndX && ball.x < railSpans.topMidStartX) ||
          (ball.x > railSpans.topMidEndX && ball.x < railSpans.topRightStartX))
      ) {
        ball.y = bounds.minY;
        ball.vy = Math.abs(ball.vy) * CUSHION_BOUNCE;
        applyRailSpin(0, 1);
        if (speed > 1.0) {
          ball.railBounces = (ball.railBounces || 0) + 1;
          if (soundEnabled) playBallClack(speed);
        }
      }
      if (
        ball.y > bounds.maxY &&
        ((ball.x > railSpans.botLeftEndX && ball.x < railSpans.botMidStartX) ||
          (ball.x > railSpans.botMidEndX && ball.x < railSpans.botRightStartX))
      ) {
        ball.y = bounds.maxY;
        ball.vy = -Math.abs(ball.vy) * CUSHION_BOUNCE;
        applyRailSpin(0, -1);
        if (speed > 1.0) {
          ball.railBounces = (ball.railBounces || 0) + 1;
          if (soundEnabled) playBallClack(speed);
        }
      }
      if (ball.x < bounds.minX && ball.y > railSpans.leftTopEndY && ball.y < railSpans.leftBotStartY) {
        ball.x = bounds.minX;
        ball.vx = Math.abs(ball.vx) * CUSHION_BOUNCE;
        applyRailSpin(1, 0);
        if (speed > 1.0) {
          ball.railBounces = (ball.railBounces || 0) + 1;
          if (soundEnabled) playBallClack(speed);
        }
      }
      if (ball.x > bounds.maxX && ball.y > railSpans.rightTopEndY && ball.y < railSpans.rightBotStartY) {
        ball.x = bounds.maxX;
        ball.vx = -Math.abs(ball.vx) * CUSHION_BOUNCE;
        applyRailSpin(-1, 0);
        if (speed > 1.0) {
          ball.railBounces = (ball.railBounces || 0) + 1;
          if (soundEnabled) playBallClack(speed);
        }
      }

      // Pocket Jaw Knuckle Bumpers (realistic angled rebounds at pocket corners)
      for (let ji = 0; ji < jaws.length; ji++) {
        const jaw = jaws[ji];
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
              if (Math.abs(vn) > 1.0) {
                ball.railBounces = (ball.railBounces || 0) + 1;
                if (soundEnabled) playBallClack(Math.abs(vn));
              }
            }
          }
        }
      }

      // Pocket Drop & Funnel Suction (aligned to exact pocket rim; accepts soft & firm shots smoothly)
      for (let pi = 0; pi < pockets.length; pi++) {
        const p = pockets[pi];
        const dx = p.x - ball.x;
        const dy = p.y - ball.y;
        const dist = Math.hypot(dx, dy);
        const funnelRadius = p.r + 16;

        if (dist < funnelRadius && dist > 0.5) {
          const pull = funnelPullBase * (1 - dist / funnelRadius) * effectiveScale;
          ball.vx += (dx / dist) * pull;
          ball.vy += (dy / dist) * pull;
        }

        if (dist < p.r + pocketDropBonus) {
          ball.isPotted = true;
          ball.vx = 0;
          ball.vy = 0;
          if (soundEnabled) playPocketDrop();
          callbacks.onPocketed(ball, p.id);
          break;
        }
      }

      // Outer table safety catch (only catches balls escaping completely outside pocket/frame limits)
      if (
        !ball.isPotted &&
        (ball.x < bounds.minX - 42 ||
          ball.x > bounds.maxX + 42 ||
          ball.y < bounds.minY - 34 ||
          ball.y > bounds.maxY + 34)
      ) {
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

          clampBallToStraightCushions(b1, geom);
          clampBallToStraightCushions(b2, geom);

          const cueBBefore = b1.type === "cue" ? b1 : b2.type === "cue" ? b2 : null;
          const prevCueVx = cueBBefore ? cueBBefore.vx : 0;
          const prevCueVy = cueBBefore ? cueBBefore.vy : 0;
          const prevCueSpeed = cueBBefore ? Math.hypot(prevCueVx, prevCueVy) : 0;

          const relVelNormal = (b1.vx - b2.vx) * nx + (b1.vy - b2.vy) * ny;
          if (relVelNormal > 0) {
            const restitution = 0.985;
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
              // hitDirectness: 1.0 for straight center hit, -> 0 for thin edge graze
              const impactSpd = Math.max(1.5, prevCueSpeed);
              const hitDirectness =
                prevCueSpeed > 0.2
                  ? Math.max(0.25, Math.min(1, Math.abs((prevCueVx / prevCueSpeed) * nx + (prevCueVy / prevCueSpeed) * ny)))
                  : 0.7;

              // Note screen Y axis: spinY < 0 is TOP of ball (Follow), spinY > 0 is BOTTOM of ball (Draw/Screw)
              if (isDeadStopCue && Math.abs(spinY) < 0.25 && Math.abs(spinX) < 0.25) {
                cueB.vx *= 0.15;
                cueB.vy *= 0.15;
              } else if (spinY > 0.15) {
                // Bottom hit -> Screw / Draw proportional to hit force
                const screwMag = spinY * (0.62 * impactSpd + Math.min(2.4, 0.32 * impactSpd)) * hitDirectness * cueSpinBonus * screwPerkMult;
                cueB.vx -= cosAim * screwMag;
                cueB.vy -= sinAim * screwMag;
              } else if (spinY < -0.15) {
                // Top hit -> Follow forward proportional to hit force
                const followMag = Math.abs(spinY) * (0.58 * impactSpd + Math.min(2.2, 0.28 * impactSpd)) * hitDirectness * cueSpinBonus;
                cueB.vx += cosAim * followMag;
                cueB.vy += sinAim * followMag;
              }
              if (Math.abs(spinX) > 0.15) {
                // Side spin deflects Left (-sinAim, +cosAim) when spinX < 0, Right when spinX > 0
                const rightX = -sinAim;
                const rightY = cosAim;
                const sideMag = spinX * (0.28 * impactSpd + Math.min(1.8, 0.22 * impactSpd)) * cueSpinBonus;
                cueB.vx += rightX * sideMag;
                cueB.vy += rightY * sideMag;
              }
            }
          }
        }
      }
    }
  }

  // Update 3D Sphere Rolling Rotation & Natural Gradual Rest (no abrupt brake threshold)
  anyMoving = false;
  for (let i = 0; i < ballCount; i++) {
    const ball = balls[i];
    if (ball.isPotted) continue;
    let curSpeed = Math.hypot(ball.vx, ball.vy);
    if (curSpeed > MAX_SPEED) {
      ball.vx = (ball.vx / curSpeed) * MAX_SPEED;
      ball.vy = (ball.vy / curSpeed) * MAX_SPEED;
      curSpeed = MAX_SPEED;
    }
    if (curSpeed <= 0.015) {
      ball.vx = 0;
      ball.vy = 0;
      ball.spinSide = 0;
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

  // Detect dramatic object-ball approach toward a pocket (triggers even if it ends up missing/lipping out)
  if (anyMoving) {
    for (let i = 1; i < ballCount; i++) {
      const ball = balls[i];
      if (ball.isPotted || ball.type === "cue") continue;
      const spd = Math.hypot(ball.vx, ball.vy);
      if (spd < 1.5 || spd > 26) continue;
      const ux = ball.vx / spd;
      const uy = ball.vy / spd;

      for (let pi = 0; pi < pockets.length; pi++) {
        const p = pockets[pi];
        const dx = p.x - ball.x;
        const dy = p.y - ball.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= p.r + 10 || dist > 160) continue;

        const alignDot = (ux * dx + uy * dy) / dist;
        if (alignDot < 0.935) continue;

        const isCalledPocket = activeShotCalledPocketId !== null && p.id === activeShotCalledPocketId;
        const isBankShot = (ball.railBounces || 0) >= 1;
        const isEightBall = ball.number === 8;
        const isSnookerFinal = ball.type === "color" && (ball.value === 7 || ball.value === 6);

        if (!isSegmentClear(ball.x, ball.y, p.x, p.y, balls, new Set([ball.id]), ball.radius * 0.85)) {
          continue;
        }

        const reason = isEightBall
          ? "eight"
          : isBankShot
          ? "bank"
          : isCalledPocket
          ? "called"
          : isSnookerFinal
          ? "snooker_final"
          : "approach";
        callbacks.onPotentialCinematic(p, ball, reason);
      }
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
  ignoreIds: Set<number>,
  ballRadius: number = BALL_RADIUS
): boolean {
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq < 1) return true;
  const minClearSq = Math.pow(ballRadius * 2.02, 2);

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
export function computeBotShot(
  balls: Ball[],
  botGroup: BallGroup,
  mode: GameMode,
  geom: TableGeometry = DEFAULT_TABLE_GEOMETRY,
  snookerTarget?: SnookerTargetInfo,
  botAimError: number = 0.048
): BotShotPlan | null {
  const cueBall = balls[0];
  if (!cueBall || cueBall.isPotted) return null;
  const ballRadius = cueBall.radius || getModeBallRadius(mode);
  const bounds = getPlayBounds(geom, ballRadius);
  const { pockets } = geom;

  const candidateBalls = balls.filter((b) => {
    if (b.isPotted || b.type === "cue") return false;
    const isPool = mode === "8-ball" || mode === "one-fifteen";
    if (isPool && botGroup !== "unassigned") {
      const botType = botGroup === "solids" ? "solid" : "stripe";
      const botBallsLeft = balls.some((x) => !x.isPotted && x.number !== 8 && x.type === botType);
      return botBallsLeft ? b.type === botType : b.number === 8;
    }
    if (isPool) return b.number !== 8;
    if (mode === "snooker" && snookerTarget) {
      if (snookerTarget.phase === "red") return b.type === "red";
      if (snookerTarget.phase === "color") return b.type === "color";
      return b.type === "color" && b.value === snookerTarget.expectedValue;
    }
    return true;
  });

  const targets = candidateBalls.length > 0 ? candidateBalls : balls.filter((b) => !b.isPotted && b.type !== "cue");
  if (targets.length === 0) return null;

  let bestScore = -Infinity;
  let bestPlan: BotShotPlan | null = null;

  for (let ti = 0; ti < targets.length; ti++) {
    const target = targets[ti];
    const ignore = new Set<number>([0, target.id]);

    for (let pi = 0; pi < pockets.length; pi++) {
      const p = pockets[pi];
      if (mode === "one-fifteen") {
        if (target.number === 1 && p.id !== ONE_FIFTEEN_POCKET_1) continue;
        if (target.number === 15 && p.id !== ONE_FIFTEEN_POCKET_15) continue;
      }
      const toPx = p.x - target.x;
      const toPy = p.y - target.y;
      const distBP = Math.hypot(toPx, toPy);
      if (distBP < 1) continue;

      const uBPx = toPx / distBP;
      const uBPy = toPy / distBP;

      // Ghost ball impact point
      const gx = target.x - uBPx * (ballRadius * 2);
      const gy = target.y - uBPy * (ballRadius * 2);
      if (gx < bounds.minX - 6 || gx > bounds.maxX + 6 || gy < bounds.minY - 6 || gy > bounds.maxY + 6) continue;

      const toGx = gx - cueBall.x;
      const toGy = gy - cueBall.y;
      const distCG = Math.hypot(toGx, toGy);
      if (distCG < 1) continue;

      const uCGx = toGx / distCG;
      const uCGy = toGy / distCG;
      const cutDot = uCGx * uBPx + uCGy * uBPy;
      if (cutDot <= 0.18) continue; // Impossible >80 deg cut

      const clearCueToGhost = isSegmentClear(cueBall.x, cueBall.y, gx, gy, balls, ignore, ballRadius);
      const clearBallToPocket = isSegmentClear(target.x, target.y, p.x, p.y, balls, ignore, ballRadius);

      let score = cutDot * 120 - (distCG + distBP) * 0.08;
      if (mode === "snooker" && snookerTarget?.phase === "color") {
        score += (target.value || 2) * 6;
      }
      if (!clearCueToGhost) score -= 200;
      if (!clearBallToPocket) score -= 180;

      if (score > bestScore) {
        bestScore = score;
        const variance = (Math.random() - 0.5) * botAimError;
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
    const bestPocket =
      mode === "one-fifteen" && closest.number === 1
        ? pockets[ONE_FIFTEEN_POCKET_1]
        : mode === "one-fifteen" && closest.number === 15
        ? pockets[ONE_FIFTEEN_POCKET_15]
        : pockets.reduce((prev, curr) => {
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
