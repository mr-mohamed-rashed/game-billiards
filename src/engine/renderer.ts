import { CueItem, TableItem } from "@/config/shopData";
import {
  BALL_RADIUS,
  Ball,
  BallGroup,
  CUSHION,
  CinematicCamState,
  GameMode,
  ONE_FIFTEEN_POCKET_1,
  ONE_FIFTEEN_POCKET_15,
  SNOOKER_COLOR_META,
  SnookerTargetInfo,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  TableGeometry,
  getBreakLineX,
  getModeBallRadius,
  getPlayBounds,
  getSnookerSpots,
} from "@/types/billiards";

export function createBallGlossCanvas(): HTMLCanvasElement {
  const gc = document.createElement("canvas");
  const size = BALL_RADIUS * 2 + 2;
  gc.width = size;
  gc.height = size;
  const gctx = gc.getContext("2d");
  if (gctx) {
    const cx = size / 2;
    const cy = size / 2;
    const glossGrad = gctx.createRadialGradient(
      cx - BALL_RADIUS * 0.35,
      cy - BALL_RADIUS * 0.35,
      1,
      cx,
      cy,
      BALL_RADIUS
    );
    glossGrad.addColorStop(0, "rgba(255,255,255,0.72)");
    glossGrad.addColorStop(0.4, "rgba(255,255,255,0.08)");
    glossGrad.addColorStop(1, "rgba(0,0,0,0.35)");
    gctx.fillStyle = glossGrad;
    gctx.beginPath();
    gctx.arc(cx, cy, BALL_RADIUS, 0, Math.PI * 2);
    gctx.fill();
  }
  return gc;
}

const BANK_PERK_CUES = new Set([
  "cue_apex_gold",
  "cue_frost_rune",
  "cue_cosmic_nebula",
  "cue_cyberpunk_neon",
  "cue_dark_damascus",
  "cue_void_arcane",
]);

function rayToCushion(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxDist: number,
  bounds: TableGeometry["bounds"]
): { dist: number; nx: number; ny: number } {
  let best = maxDist;
  let nx = 0;
  let ny = 0;

  if (dx < -0.0001) {
    const t = (bounds.minX - ox) / dx;
    if (t > 0 && t < best) { best = t; nx = 1; ny = 0; }
  } else if (dx > 0.0001) {
    const t = (bounds.maxX - ox) / dx;
    if (t > 0 && t < best) { best = t; nx = -1; ny = 0; }
  }
  if (dy < -0.0001) {
    const t = (bounds.minY - oy) / dy;
    if (t > 0 && t < best) { best = t; nx = 0; ny = 1; }
  } else if (dy > 0.0001) {
    const t = (bounds.maxY - oy) / dy;
    if (t > 0 && t < best) { best = t; nx = 0; ny = -1; }
  }

  return { dist: best, nx, ny };
}

function drawHandIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isGrabbing: boolean
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.8;

  if (isGrabbing) {
    // Closed grabbing hand
    ctx.beginPath();
    ctx.roundRect(-7, -5, 14, 11, 4);
    ctx.fill();
    ctx.stroke();

    // Curled fingers
    for (let f = -4.5; f <= 4.5; f += 3) {
      ctx.beginPath();
      ctx.roundRect(f - 1.4, -7.5, 2.8, 5, 1.4);
      ctx.fill();
      ctx.stroke();
    }
    // Thumb gripping from side
    ctx.beginPath();
    ctx.roundRect(-9.5, -2.5, 4.5, 6.5, 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // Open hand (5 fingers)
    // Palm
    ctx.beginPath();
    ctx.roundRect(-6.5, -2.5, 13, 9.5, 3.5);
    ctx.fill();
    ctx.stroke();

    // 4 upright fingers
    const fingers = [
      { fx: -5.0, top: -10.5 },
      { fx: -1.8, top: -12.5 },
      { fx: 1.5, top: -12.0 },
      { fx: 4.8, top: -9.8 },
    ];
    for (let i = 0; i < fingers.length; i++) {
      const f = fingers[i];
      ctx.beginPath();
      ctx.roundRect(f.fx - 1.35, f.top, 2.7, -f.top - 1, 1.35);
      ctx.fill();
      ctx.stroke();
    }

    // Thumb out to the left
    ctx.beginPath();
    ctx.moveTo(-6.2, 2);
    ctx.lineTo(-10.5, -1.5);
    ctx.lineTo(-8.5, -4);
    ctx.lineTo(-5.2, -0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

export interface RenderSceneParams {
  ctx: CanvasRenderingContext2D;
  balls: Ball[];
  tableCfg: TableItem;
  activeCueObj: CueItem;
  mode: GameMode;
  turn: "human" | "bot";
  isPractice: boolean;
  isShooting: boolean;
  isBreakShot?: boolean;
  isBotAiming?: boolean;
  isBallInHand: boolean;
  ballInHandHoverPos: { x: number; y: number } | null;
  isDraggingBall?: boolean;
  isHoveringBreakCue?: boolean;
  slowMoCam?: CinematicCamState | null;
  slowMoIntensity?: number;
  calledPocketId: number | null;
  humanGroup: BallGroup;
  snookerTarget?: SnookerTargetInfo;
  aimAngle: number;
  power: number;
  spinX: number;
  spinY: number;
  aimAssistLong: boolean;
  aimScale?: number;
  maxAimDistCap?: number;
  targetLineScale?: number;
  glossCanvas: HTMLCanvasElement | null;
  tableImageCache: Record<string, HTMLImageElement>;
  cueImageCache: Record<string, HTMLImageElement>;
  proceduralTableCache: Record<string, HTMLCanvasElement>;
}

export function renderTableScene({
  ctx,
  balls,
  tableCfg,
  activeCueObj,
  mode,
  turn,
  isPractice,
  isShooting,
  isBreakShot = false,
  isBotAiming = false,
  isBallInHand,
  ballInHandHoverPos,
  isDraggingBall = false,
  isHoveringBreakCue = false,
  slowMoCam = null,
  slowMoIntensity = 0,
  calledPocketId,
  humanGroup,
  snookerTarget,
  aimAngle,
  power,
  spinX,
  spinY,
  aimAssistLong,
  aimScale = 1,
  maxAimDistCap = 800,
  targetLineScale = 1,
  glossCanvas,
  tableImageCache,
  cueImageCache,
  proceduralTableCache,
}: RenderSceneParams) {
  // 1. Table Background & Cushion Rendering
  const tableImg = tableCfg.image ? tableImageCache[tableCfg.id] : null;
  if (tableImg && tableImg.complete && tableImg.naturalWidth > 0) {
    ctx.drawImage(tableImg, 0, 0, TABLE_WIDTH, TABLE_HEIGHT);
  } else {
    let cachedBg = proceduralTableCache[tableCfg.id];
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
          TABLE_WIDTH / 2,
          TABLE_HEIGHT / 2,
          80,
          TABLE_WIDTH / 2,
          TABLE_HEIGHT / 2,
          450
        );
        feltGradient.addColorStop(0, tableCfg.feltColor);
        feltGradient.addColorStop(1, "#021c10");
        bctx.fillStyle = feltGradient;
        bctx.fillRect(CUSHION, CUSHION, TABLE_WIDTH - 2 * CUSHION, TABLE_HEIGHT - 2 * CUSHION);
      }
      proceduralTableCache[tableCfg.id] = cachedBg;
    }
    ctx.drawImage(cachedBg, 0, 0);
  }

  const { walls, pockets } = tableCfg.geometry;
  const ballRadius = balls[0]?.radius ?? getModeBallRadius(mode);
  const bounds = getPlayBounds(tableCfg.geometry, ballRadius);
  const breakLineX = getBreakLineX(mode, tableCfg.geometry);

  // Snooker Baulk Line, "D" Zone & Color Spot Markers
  if (mode === "snooker") {
    const { baulkX, centerY, dRadius, spots } = getSnookerSpots(tableCfg.geometry);
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(baulkX, walls.top);
    ctx.lineTo(baulkX, walls.bottom);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(baulkX, centerY, dRadius, -Math.PI / 2, Math.PI / 2, true);
    ctx.stroke();

    // Subtle spot markers on the felt for the 6 Snooker colors
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1.2;
    for (let si = 0; si < spots.length; si++) {
      const sp = spots[si];
      ctx.beginPath();
      ctx.moveTo(sp.x - 3.5, sp.y);
      ctx.lineTo(sp.x + 3.5, sp.y);
      ctx.moveTo(sp.x, sp.y - 3.5);
      ctx.lineTo(sp.x, sp.y + 3.5);
      ctx.stroke();
    }
  }

  // Highlight legal behind-the-line zone on Break Shot (or Snooker / 1&15 Ball-in-Hand)
  if (
    ((isBreakShot && !isShooting) || (isBallInHand && (mode === "snooker" || mode === "one-fifteen"))) &&
    (turn === "human" || isPractice)
  ) {
    ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
    ctx.fillRect(
      walls.left,
      walls.top,
      breakLineX - walls.left,
      walls.bottom - walls.top
    );
    ctx.save();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.72)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(breakLineX, walls.top);
    ctx.lineTo(breakLineX, walls.bottom);
    ctx.stroke();
    ctx.restore();
  }

  // 1 & 15 Fixed Middle Pocket Badges (Ball 1 -> Top Middle / شمال الكسرة, Ball 15 -> Bottom Middle / يمين الكسرة)
  if (mode === "one-fifteen") {
    const p1 = pockets[ONE_FIFTEEN_POCKET_1];
    const p15 = pockets[ONE_FIFTEEN_POCKET_15];
    if (p1) {
      ctx.save();
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(p1.x, p1.y - 16, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("1", p1.x, p1.y - 15.5);
      ctx.restore();
    }
    if (p15) {
      ctx.save();
      ctx.fillStyle = "#831843";
      ctx.beginPath();
      ctx.arc(p15.x, p15.y + 16, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("15", p15.x, p15.y + 16.5);
      ctx.restore();
    }
  }

  // Check if human player is on the 8-ball
  const remainingHumanGroupBalls =
    (mode === "8-ball" || mode === "one-fifteen") && humanGroup !== "unassigned"
      ? balls.filter(
          (b) => !b.isPotted && b.number !== 8 && (humanGroup === "solids" ? b.type === "solid" : b.type === "stripe")
        )
      : [];
  const humanOnEightBall =
    (mode === "8-ball" || mode === "one-fifteen") && humanGroup !== "unassigned" && remainingHumanGroupBalls.length === 0;

  // 2. Pocket Target Call Highlight (Ring aligned flush to exact outer black pocket rim)
  if (calledPocketId !== null) {
    const p = pockets[calledPocketId];
    if (p) {
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(234, 179, 8, 0.16)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(8, p.r - 2), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#eab308";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🎯 الهدف", p.x, p.y + (p.y < TABLE_HEIGHT / 2 ? p.r + 12 : -(p.r + 6)));
    }
  } else if (humanOnEightBall && (turn === "human" || isPractice) && !isShooting) {
    // Prompt visual rings on all 6 pockets so player sees where to tap for the 8-ball
    ctx.strokeStyle = "rgba(250, 204, 21, 0.72)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i < pockets.length; i++) {
      const p = pockets[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // 3. Balls Rendering (Seamless 3D Sphere Roll + Dual-Pole Numbers + 6-Dot Cue Ball)
  const drawBallNumberPole = (
    ball: Ball,
    dirX: number,
    dirY: number,
    dirZ: number
  ) => {
    if (dirZ <= 0.1) return;
    const r = ball.radius;
    const spotX = ball.x + dirX * r * 0.86;
    const spotY = ball.y + dirY * r * 0.86;
    const spotAng = Math.hypot(dirX, dirY) > 0.001 ? Math.atan2(dirY, dirX) : 0;
    const scaleZ = Math.max(0.16, dirZ);
    const discR = r * 0.43;

    ctx.save();
    ctx.translate(spotX, spotY);
    ctx.rotate(spotAng);
    ctx.scale(scaleZ, 1);
    ctx.rotate(-spotAng);

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, discR, 0, Math.PI * 2);
    ctx.fill();

    if (dirZ > 0.24) {
      ctx.fillStyle = "#0f172a";
      ctx.font = `bold ${ball.number >= 10 ? "8px" : "9px"} sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ball.number.toString(), 0, 0.5);
    }
    ctx.restore();
  };

  const drawPolarCap = (
    ball: Ball,
    cx: number,
    cy: number,
    cz: number
  ) => {
    if (cz <= -0.52) return;
    const r = ball.radius;
    const xyHyp = Math.hypot(cx, cy);
    const ang = xyHyp > 0.001 ? Math.atan2(cy, cx) : 0;
    const xOff = 0.56 * r * xyHyp;
    const ry = 0.83 * r;
    const rx = Math.max(0.5, 0.83 * r * Math.abs(cz));

    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ang);
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    if (cz >= 0.45) {
      ctx.ellipse(xOff, 0, rx, ry, 0, 0, Math.PI * 2);
    } else if (cz >= 0) {
      ctx.ellipse(xOff, 0, rx, ry, 0, Math.PI / 2, -Math.PI / 2, false);
      ctx.lineTo(r * 1.15, -r * 1.15);
      ctx.lineTo(r * 1.15, r * 1.15);
      ctx.closePath();
    } else {
      ctx.ellipse(xOff, 0, rx, ry, 0, Math.PI / 2, -Math.PI / 2, true);
      ctx.lineTo(r * 1.15, -r * 1.15);
      ctx.lineTo(r * 1.15, r * 1.15);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  };

  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i];
    if (ball.isPotted) continue;
    const r = ball.radius;

    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.beginPath();
    ctx.arc(ball.x + 2, ball.y + 3, r, 0, Math.PI * 2);
    ctx.fill();

    // Base sphere color
    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
    ctx.fill();

    if (ball.type === "stripe") {
      ctx.save();
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
      ctx.clip();
      drawPolarCap(ball, ball.sx, ball.sy, ball.sz);
      drawPolarCap(ball, -ball.sx, -ball.sy, -ball.sz);
      ctx.restore();
    }

    if (ball.type === "solid" || ball.type === "stripe" || ball.type === "black") {
      ctx.save();
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
      ctx.clip();
      drawBallNumberPole(ball, ball.px, ball.py, ball.pz);
      drawBallNumberPole(ball, -ball.px, -ball.py, -ball.pz);
      ctx.restore();
    }

    if (ball.type === "cue") {
      // Classic 6-dot Pro-Cup rolling reference spots (p, -p, s, -s, t, -t)
      const tx = ball.py * ball.sz - ball.pz * ball.sy;
      const ty = ball.pz * ball.sx - ball.px * ball.sz;
      const tz = ball.px * ball.sy - ball.py * ball.sx;
      const cueDots: [number, number, number][] = [
        [ball.px, ball.py, ball.pz],
        [-ball.px, -ball.py, -ball.pz],
        [ball.sx, ball.sy, ball.sz],
        [-ball.sx, -ball.sy, -ball.sz],
        [tx, ty, tz],
        [-tx, -ty, -tz],
      ];
      for (let d = 0; d < cueDots.length; d++) {
        const [dx, dy, dz] = cueDots[d];
        if (dz > 0.15) {
          ctx.fillStyle = "rgba(220, 38, 38, 0.42)";
          ctx.beginPath();
          ctx.arc(
            ball.x + dx * r * 0.82,
            ball.y + dy * r * 0.82,
            1.7 * Math.max(0.45, dz),
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
      if (!isShooting && (Math.abs(spinX) > 0.05 || Math.abs(spinY) > 0.05)) {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(ball.x + spinX * (r * 0.58), ball.y + spinY * (r * 0.58), Math.max(1.8, r * 0.2), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (glossCanvas) {
      ctx.drawImage(glossCanvas, ball.x - r - 1, ball.y - r - 1, r * 2 + 2, r * 2 + 2);
    }
  }

  // 4. Ball in Hand Placement Guide (shows cue ball preview even when scratched)
  if (isBallInHand && ballInHandHoverPos) {
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(ballInHandHoverPos.x, ballInHandHoverPos.y, ballRadius, 0, Math.PI * 2);
    ctx.fill();
    if (glossCanvas) {
      ctx.drawImage(
        glossCanvas,
        ballInHandHoverPos.x - ballRadius - 1,
        ballInHandHoverPos.y - ballRadius - 1,
        ballRadius * 2 + 2,
        ballRadius * 2 + 2
      );
    }

    ctx.fillStyle = isDraggingBall ? "rgba(56, 189, 248, 0.34)" : "rgba(59, 130, 246, 0.24)";
    ctx.strokeStyle = isDraggingBall ? "#38bdf8" : "#3b82f6";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(ballInHandHoverPos.x, ballInHandHoverPos.y, ballRadius + 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    drawHandIcon(ctx, ballInHandHoverPos.x + 14, ballInHandHoverPos.y - 12, isDraggingBall);
  }

  // 4b. Opening Break Shot Grab Halo around Cue Ball (lets player drag cue ball anywhere behind line)
  const cueBall = balls[0];
  if (
    isBreakShot &&
    !isShooting &&
    !isBallInHand &&
    cueBall &&
    !cueBall.isPotted &&
    (turn === "human" || isPractice)
  ) {
    ctx.save();
    const activeGrab = isDraggingBall || isHoveringBreakCue;
    ctx.strokeStyle = activeGrab ? "rgba(250, 204, 21, 0.95)" : "rgba(56, 189, 248, 0.9)";
    ctx.lineWidth = activeGrab ? 2.4 : 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(cueBall.x, cueBall.y, ballRadius + (activeGrab ? 6.5 : 5), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    drawHandIcon(ctx, cueBall.x, cueBall.y - ballRadius - 13, isDraggingBall);
    ctx.restore();
  }

  // 5. Aim Line Raycasting + Cue Ball Post-Collision Path + Bank Preview + Cue Stick
  const canShowAim =
    !isShooting && !isBallInHand && cueBall && !cueBall.isPotted && (turn === "human" || isPractice || isBotAiming);
  if (canShowAim) {
    const cosA = Math.cos(aimAngle);
    const sinA = Math.sin(aimAngle);
    const collisionRadius = ballRadius * 2;

    const baseDist = aimAssistLong ? 440 : 270;
    const cueBonusDist = (activeCueObj.stats.aim / 10) * 320;
    const scaledHumanDist = Math.min(maxAimDistCap, (baseDist + cueBonusDist) * aimScale);
    const maxRayDist = isBotAiming ? Math.min(260, maxAimDistCap) : scaledHumanDist;
    let closestHitDist = maxRayDist;

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
        const perpDistSq = toBx * toBx + toBy * toBy - projDist * projDist;
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

    if (hitBall && (mode === "8-ball" || mode === "one-fifteen") && !isBotAiming) {
      if (humanGroup === "unassigned") {
        if (hitBall.number === 8) {
          isAimedTargetLegal = false;
          warningText = "⚠️ طاولة مفتوحة: لا يجوز ضرب 8!";
        }
      } else if (remainingHumanGroupBalls.length > 0) {
        const expectedType = humanGroup === "solids" ? "solid" : "stripe";
        if (hitBall.type !== expectedType) {
          isAimedTargetLegal = false;
          warningText = hitBall.number === 8 ? "⚠️ فاول: لا تلمس 8 الآن!" : "⚠️ فاول: صنف الخصم!";
        }
      } else if (hitBall.number !== 8) {
        isAimedTargetLegal = false;
        warningText = "⚠️ فاول: هدفك الكرة 8!";
      }
      if (isAimedTargetLegal && mode === "one-fifteen" && !isBreakShot) {
        if (hitBall.number === 1 && calledPocketId !== ONE_FIFTEEN_POCKET_1) {
          warningText = "🟡 الكرة 1 تنزل في الميدل الأعلى فقط!";
        } else if (hitBall.number === 15 && calledPocketId !== ONE_FIFTEEN_POCKET_15) {
          warningText = "🟤 الكرة 15 تنزل في الميدل الأسفل فقط!";
        }
      }
    } else if (hitBall && mode === "snooker" && snookerTarget && !isBotAiming) {
      if (snookerTarget.phase === "red" && hitBall.type !== "red") {
        isAimedTargetLegal = false;
        warningText = "⚠️ فاول: يجب ضرب كرة حمراء!";
      } else if (snookerTarget.phase === "color" && hitBall.type !== "color") {
        isAimedTargetLegal = false;
        warningText = "⚠️ فاول: اختر كرة ملونة!";
      } else if (
        snookerTarget.phase === "clearance" &&
        (hitBall.type !== "color" || hitBall.value !== snookerTarget.expectedValue)
      ) {
        const expectedName = SNOOKER_COLOR_META[snookerTarget.expectedValue]?.nameAr || "";
        isAimedTargetLegal = false;
        warningText = `⚠️ فاول: المطلوب ${expectedName} (${snookerTarget.expectedValue})!`;
      }
    }

    // Clamp ray to cushion if no ball hit before rail
    let endAimX = cueBall.x + cosA * closestHitDist;
    let endAimY = cueBall.y + sinA * closestHitDist;
    let cushionHit: { dist: number; nx: number; ny: number } | null = null;
    if (!hitBall) {
      const cHit = rayToCushion(cueBall.x, cueBall.y, cosA, sinA, closestHitDist, bounds);
      if (cHit.dist < closestHitDist && (cHit.nx !== 0 || cHit.ny !== 0)) {
        closestHitDist = cHit.dist;
        endAimX = cueBall.x + cosA * closestHitDist;
        endAimY = cueBall.y + sinA * closestHitDist;
        cushionHit = cHit;
      }
    }

    const aimLineColor = !isAimedTargetLegal
      ? "rgba(239, 68, 68, 0.95)"
      : activeCueObj.category === "legendary"
      ? activeCueObj.glowColor
      : "rgba(255, 255, 255, 0.85)";

    ctx.strokeStyle = aimLineColor;
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = activeCueObj.category === "legendary" ? 2.4 : 1.5;
    ctx.beginPath();
    ctx.moveTo(cueBall.x, cueBall.y);
    ctx.lineTo(endAimX, endAimY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ghost ball preview right where cue ball edge kisses the cushion
    if (!hitBall && cushionHit) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(endAimX, endAimY, ballRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Bank-shot cushion reflection preview (includes Left/Right English deflection)
    if (!hitBall && cushionHit && (BANK_PERK_CUES.has(activeCueObj.id) || Math.abs(spinX) > 0.15)) {
      let rx = cushionHit.nx !== 0 ? -cosA : cosA;
      let ry = cushionHit.ny !== 0 ? -sinA : sinA;
      if (Math.abs(spinX) > 0.15) {
        const engScale = -spinX * 0.48 * (tableCfg.spinGrip ?? 1.0);
        const tx = -cushionHit.ny;
        const ty = cushionHit.nx;
        rx += tx * engScale;
        ry += ty * engScale;
        const rLen = Math.hypot(rx, ry) || 1;
        rx /= rLen;
        ry /= rLen;
      }
      const bankLen = activeCueObj.id === "cue_cosmic_nebula" ? 180 : 115;
      ctx.strokeStyle = Math.abs(spinX) > 0.15 ? "rgba(56, 189, 248, 0.85)" : activeCueObj.glowColor;
      ctx.globalAlpha = 0.75;
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(endAimX, endAimY);
      ctx.lineTo(endAimX + rx * bankLen, endAimY + ry * bankLen);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;
    }

    if (hitBall) {
      // Ghost ball circle
      ctx.strokeStyle = isAimedTargetLegal ? "rgba(255, 255, 255, 0.75)" : "rgba(239, 68, 68, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ghostBallPos.x, ghostBallPos.y, ballRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Target ball path (scales down on higher-stake pro/legend tables!)
      const targetLineLen = (125 + (activeCueObj.stats.aim / 10) * 90) * targetLineScale;
      ctx.strokeStyle = isAimedTargetLegal
        ? activeCueObj.category === "legendary"
          ? activeCueObj.glowColor
          : "#facc15"
        : "#ef4444";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hitBall.x, hitBall.y);
      ctx.lineTo(
        hitBall.x + targetDeflectDir.dx * targetLineLen,
        hitBall.y + targetDeflectDir.dy * targetLineLen
      );
      ctx.stroke();
      ctx.setLineDash([]);

      // Cue ball post-collision path (Tangent stun + Follow/Draw + Left/Right spin bias)
      const dot = cosA * targetDeflectDir.dx + sinA * targetDeflectDir.dy;
      let cueDefX = cosA - dot * targetDeflectDir.dx;
      let cueDefY = sinA - dot * targetDeflectDir.dy;
      // Top (-spinY > 0) pulls forward, Bottom (-spinY < 0) pulls backward
      const topFollow = -spinY;
      if (Math.abs(topFollow) > 0.15) {
        cueDefX += cosA * topFollow * 0.72 * Math.max(0.35, dot);
        cueDefY += sinA * topFollow * 0.72 * Math.max(0.35, dot);
      }
      if (Math.abs(spinX) > 0.15) {
        cueDefX += -sinA * spinX * 0.45;
        cueDefY += cosA * spinX * 0.45;
      }
      const cueDefLen = Math.hypot(cueDefX, cueDefY);
      if (cueDefLen > 0.08) {
        const ux = cueDefX / cueDefLen;
        const uy = cueDefY / cueDefLen;
        const cuePathLen = Math.min(130, 55 + cueDefLen * 65 + (activeCueObj.stats.aim / 10) * 35);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.85)";
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(ghostBallPos.x, ghostBallPos.y);
        ctx.lineTo(ghostBallPos.x + ux * cuePathLen, ghostBallPos.y + uy * cuePathLen);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = isAimedTargetLegal ? "rgba(250, 204, 21, 0.32)" : "rgba(239, 68, 68, 0.4)";
      ctx.beginPath();
      ctx.arc(hitBall.x, hitBall.y, ballRadius + 3, 0, Math.PI * 2);
      ctx.fill();

      if (!isAimedTargetLegal && warningText) {
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(warningText, hitBall.x, hitBall.y - 18);
      }
    }

    // 6. Transparent Cue Stick with Dynamic Pull-Back
    const cueOffset = ballRadius + 8 + (power / 100) * 85;
    const cueDrawLength = 360;
    const baseCueThickness = activeCueObj.category === "legendary" ? 21 : 13;
    const cueDrawThickness = mode === "snooker" ? Math.round(baseCueThickness * 0.82) : baseCueThickness;
    const cueImg = activeCueObj.image ? cueImageCache[activeCueObj.id] : null;

    ctx.save();
    ctx.translate(cueBall.x, cueBall.y);
    ctx.rotate(aimAngle);

    ctx.strokeStyle = "rgba(0,0,0,0.32)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-cueOffset - 4, 4);
    ctx.lineTo(-cueOffset - cueDrawLength + 6, 6);
    ctx.stroke();

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

    ctx.restore();
  }

  // 7. Special-Play Slow Motion Visual Effect (Vignette, Target Pocket Beacon & Ball Comet Trail)
  if (slowMoCam && slowMoIntensity > 0.02) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.014);
    const alpha = Math.min(1, slowMoIntensity);

    // Subtle cinematic vignette focusing on the table action
    const vig = ctx.createRadialGradient(
      slowMoCam.pocket.x,
      slowMoCam.pocket.y,
      90,
      TABLE_WIDTH / 2,
      TABLE_HEIGHT / 2,
      TABLE_WIDTH * 0.72
    );
    vig.addColorStop(0, "rgba(2, 6, 23, 0)");
    vig.addColorStop(0.55, `rgba(2, 6, 23, ${0.18 * alpha})`);
    vig.addColorStop(1, `rgba(2, 6, 23, ${0.58 * alpha})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

    // Target pocket pulsing beacon
    ctx.save();
    const pk = slowMoCam.pocket;
    const ringR = pk.r + 5 + pulse * 8;
    ctx.strokeStyle = `rgba(56, 189, 248, ${(0.55 + pulse * 0.35) * alpha})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(pk.x, pk.y, ringR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(250, 204, 21, ${0.7 * alpha})`;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(pk.x, pk.y, pk.r + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Featured ball comet trail & aura (while heading toward pocket or gliding)
    const featuredBall =
      slowMoCam.ballId !== undefined
        ? balls.find((b) => b.id === slowMoCam.ballId)
        : balls.find((b) => b.number === slowMoCam.ballNum && b.type !== "cue");

    if (featuredBall && !featuredBall.isPotted) {
      const spd = Math.hypot(featuredBall.vx, featuredBall.vy);
      const r = featuredBall.radius;
      ctx.save();

      if (spd > 0.25) {
        const ux = featuredBall.vx / spd;
        const uy = featuredBall.vy / spd;
        const trailLen = Math.min(72, 26 + spd * 4.5);
        const tailX = featuredBall.x - ux * trailLen;
        const tailY = featuredBall.y - uy * trailLen;

        const trailGrad = ctx.createLinearGradient(tailX, tailY, featuredBall.x, featuredBall.y);
        trailGrad.addColorStop(0, "rgba(56, 189, 248, 0)");
        trailGrad.addColorStop(0.55, `rgba(56, 189, 248, ${0.32 * alpha})`);
        trailGrad.addColorStop(1, `rgba(250, 204, 21, ${0.65 * alpha})`);

        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = r * 1.45;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(featuredBall.x, featuredBall.y);
        ctx.stroke();

        // Guiding vector ray toward pocket
        ctx.strokeStyle = `rgba(250, 204, 21, ${0.42 * alpha})`;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(featuredBall.x, featuredBall.y);
        ctx.lineTo(pk.x, pk.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Outer energy halo around the ball
      ctx.strokeStyle = `rgba(250, 204, 21, ${(0.65 + pulse * 0.35) * alpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(featuredBall.x, featuredBall.y, r + 4 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  // 8. TEMPORARY DEBUG OVERLAY: Red Table Bounds & Pockets Calibration Box
  {
    const { jaws: debugJaws, railSpans } = tableCfg.geometry;
    ctx.save();

    // Inner playable cushion rectangle (walls)
    ctx.strokeStyle = "#ff1e1e";
    ctx.lineWidth = 2.2;
    ctx.strokeRect(
      walls.left,
      walls.top,
      walls.right - walls.left,
      walls.bottom - walls.top
    );

    // Straight rail spans highlight
    ctx.strokeStyle = "rgba(255, 60, 60, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(railSpans.topLeftEndX, walls.top);
    ctx.lineTo(railSpans.topMidStartX, walls.top);
    ctx.moveTo(railSpans.topMidEndX, walls.top);
    ctx.lineTo(railSpans.topRightStartX, walls.top);
    ctx.moveTo(railSpans.botLeftEndX, walls.bottom);
    ctx.lineTo(railSpans.botMidStartX, walls.bottom);
    ctx.moveTo(railSpans.botMidEndX, walls.bottom);
    ctx.lineTo(railSpans.botRightStartX, walls.bottom);
    ctx.moveTo(walls.left, railSpans.leftTopEndY);
    ctx.lineTo(walls.left, railSpans.leftBotStartY);
    ctx.moveTo(walls.right, railSpans.rightTopEndY);
    ctx.lineTo(walls.right, railSpans.rightBotStartY);
    ctx.stroke();

    // Pocket circles & centers
    for (let pi = 0; pi < pockets.length; pi++) {
      const p = pockets[pi];
      ctx.fillStyle = "rgba(255, 30, 30, 0.18)";
      ctx.strokeStyle = "#ff1e1e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Center crosshair
      ctx.beginPath();
      ctx.moveTo(p.x - 4, p.y);
      ctx.lineTo(p.x + 4, p.y);
      ctx.moveTo(p.x, p.y - 4);
      ctx.lineTo(p.x, p.y + 4);
      ctx.stroke();
    }

    // Pocket jaws
    ctx.fillStyle = "rgba(255, 120, 0, 0.85)";
    for (let ji = 0; ji < debugJaws.length; ji++) {
      const jw = debugJaws[ji];
      ctx.beginPath();
      ctx.arc(jw.x, jw.y, jw.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dimension label
    ctx.fillStyle = "rgba(255, 30, 30, 0.9)";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(
      `DEBUG L:${walls.left} R:${walls.right} T:${walls.top} B:${walls.bottom}`,
      walls.left + 8,
      walls.top + 14
    );

    ctx.restore();
  }
}
