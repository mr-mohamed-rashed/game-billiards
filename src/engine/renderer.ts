import { CueItem, TableItem } from "@/config/shopData";
import {
  BALL_RADIUS,
  Ball,
  BallGroup,
  CUSHION,
  GameMode,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  TableGeometry,
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

export interface RenderSceneParams {
  ctx: CanvasRenderingContext2D;
  balls: Ball[];
  tableCfg: TableItem;
  activeCueObj: CueItem;
  mode: GameMode;
  turn: "human" | "bot";
  isPractice: boolean;
  isShooting: boolean;
  isBotAiming?: boolean;
  isBallInHand: boolean;
  ballInHandHoverPos: { x: number; y: number } | null;
  calledPocketId: number | null;
  humanGroup: BallGroup;
  aimAngle: number;
  power: number;
  spinX: number;
  spinY: number;
  aimAssistLong: boolean;
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
  isBotAiming = false,
  isBallInHand,
  ballInHandHoverPos,
  calledPocketId,
  humanGroup,
  aimAngle,
  power,
  spinX,
  spinY,
  aimAssistLong,
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

  const { bounds, pockets } = tableCfg.geometry;

  // Snooker Baulk Line & "D" Zone
  if (mode === "snooker") {
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    const baulkX = bounds.minX + (bounds.maxX - bounds.minX) * 0.22;
    ctx.beginPath();
    ctx.moveTo(baulkX, bounds.minY - BALL_RADIUS);
    ctx.lineTo(baulkX, bounds.maxY + BALL_RADIUS);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(baulkX, (bounds.minY + bounds.maxY) / 2, 60, -Math.PI / 2, Math.PI / 2, true);
    ctx.stroke();
  }

  // Check if human player is on the 8-ball
  const remainingHumanGroupBalls =
    mode === "8-ball" && humanGroup !== "unassigned"
      ? balls.filter(
          (b) => !b.isPotted && b.number !== 8 && (humanGroup === "solids" ? b.type === "solid" : b.type === "stripe")
        )
      : [];
  const humanOnEightBall =
    mode === "8-ball" && humanGroup !== "unassigned" && remainingHumanGroupBalls.length === 0;

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
        ctx.arc(ball.x + spinX * 7, ball.y + spinY * 7, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (glossCanvas) {
      ctx.drawImage(glossCanvas, ball.x - r - 1, ball.y - r - 1);
    }
  }

  // 4. Ball in Hand Placement Guide (shows cue ball preview even when scratched)
  if (isBallInHand && ballInHandHoverPos) {
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(ballInHandHoverPos.x, ballInHandHoverPos.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    if (glossCanvas) {
      ctx.drawImage(
        glossCanvas,
        ballInHandHoverPos.x - BALL_RADIUS - 1,
        ballInHandHoverPos.y - BALL_RADIUS - 1
      );
    }

    ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(ballInHandHoverPos.x, ballInHandHoverPos.y, BALL_RADIUS + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "22px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🧤", ballInHandHoverPos.x + 14, ballInHandHoverPos.y - 12);
  }

  // 5. Aim Line Raycasting + Cue Ball Post-Collision Path + Bank Preview + Cue Stick
  const cueBall = balls[0];
  const canShowAim =
    !isShooting && !isBallInHand && cueBall && !cueBall.isPotted && (turn === "human" || isPractice || isBotAiming);
  if (canShowAim) {
    const cosA = Math.cos(aimAngle);
    const sinA = Math.sin(aimAngle);
    const collisionRadius = BALL_RADIUS * 2;

    const baseDist = aimAssistLong ? 440 : 270;
    const cueBonusDist = (activeCueObj.stats.aim / 10) * 320;
    const maxRayDist = isBotAiming ? 260 : baseDist + cueBonusDist;
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

    if (hitBall && mode === "8-ball" && !isBotAiming) {
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
      ctx.arc(endAimX, endAimY, BALL_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Bank-shot cushion reflection preview (includes Left/Right English deflection)
    if (!hitBall && cushionHit && (BANK_PERK_CUES.has(activeCueObj.id) || Math.abs(spinX) > 0.15)) {
      let rx = cushionHit.nx !== 0 ? -cosA : cosA;
      let ry = cushionHit.ny !== 0 ? -sinA : sinA;
      if (Math.abs(spinX) > 0.15) {
        const engScale = -spinX * 0.48;
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
      ctx.arc(ghostBallPos.x, ghostBallPos.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      // Target ball path
      const targetLineLen = 125 + (activeCueObj.stats.aim / 10) * 90;
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
      ctx.arc(hitBall.x, hitBall.y, BALL_RADIUS + 3, 0, Math.PI * 2);
      ctx.fill();

      if (!isAimedTargetLegal && warningText) {
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(warningText, hitBall.x, hitBall.y - 18);
      }
    }

    // 6. Transparent Cue Stick with Dynamic Pull-Back
    const cueOffset = BALL_RADIUS + 8 + (power / 100) * 85;
    const cueDrawLength = 360;
    const cueDrawThickness = activeCueObj.category === "legendary" ? 21 : 13;
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
}
