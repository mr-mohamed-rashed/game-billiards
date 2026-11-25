import { CueItem, TableItem } from "@/config/shopData";
import {
  BALL_RADIUS,
  Ball,
  BallGroup,
  CUSHION,
  GameMode,
  POCKETS,
  TABLE_HEIGHT,
  TABLE_WIDTH,
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
  maxDist: number
): { dist: number; nx: number; ny: number } {
  let best = maxDist;
  let nx = 0;
  let ny = 0;

  if (dx < -0.0001) {
    const t = (82 - ox) / dx;
    if (t > 0 && t < best) { best = t; nx = 1; ny = 0; }
  } else if (dx > 0.0001) {
    const t = (823 - ox) / dx;
    if (t > 0 && t < best) { best = t; nx = -1; ny = 0; }
  }
  if (dy < -0.0001) {
    const t = (64 - oy) / dy;
    if (t > 0 && t < best) { best = t; nx = 0; ny = 1; }
  } else if (dy > 0.0001) {
    const t = (379 - oy) / dy;
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

  // Check if human player is on the 8-ball
  const remainingHumanGroupBalls =
    mode === "8-ball" && humanGroup !== "unassigned"
      ? balls.filter(
          (b) => !b.isPotted && b.number !== 8 && (humanGroup === "solids" ? b.type === "solid" : b.type === "stripe")
        )
      : [];
  const humanOnEightBall =
    mode === "8-ball" && humanGroup !== "unassigned" && remainingHumanGroupBalls.length === 0;

  // 2. Pocket Target Call Highlight (Required on 8-ball, optional on other shots)
  if (calledPocketId !== null) {
    const p = POCKETS[calledPocketId];
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
  } else if (humanOnEightBall && (turn === "human" || isPractice) && !isShooting) {
    // Prompt visual rings on all 6 pockets so player sees where to tap for the 8-ball
    ctx.strokeStyle = "rgba(250, 204, 21, 0.65)";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    for (let i = 0; i < POCKETS.length; i++) {
      const p = POCKETS[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // 3. Balls Rendering (Realistic 3D Sphere Roll + Cached Offscreen Gloss Overlay)
  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i];
    if (ball.isPotted) continue;
    const r = ball.radius;

    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.beginPath();
    ctx.arc(ball.x + 2, ball.y + 3, r, 0, Math.PI * 2);
    ctx.fill();

    if (ball.type === "stripe") {
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
      ctx.clip();

      const bandAng = Math.atan2(ball.py, ball.px);
      ctx.translate(ball.x + ball.px * r * 0.55, ball.y + ball.py * r * 0.55);
      ctx.rotate(bandAng);
      ctx.fillStyle = ball.color;
      ctx.fillRect(-r * 1.35, -r * 0.58, r * 2.7, r * 1.16);
      ctx.restore();
    } else {
      ctx.fillStyle = ball.color;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (ball.type === "solid" || ball.type === "stripe" || ball.type === "black") {
      if (ball.pz > 0.06) {
        const spotX = ball.x + ball.px * r * 0.72;
        const spotY = ball.y + ball.py * r * 0.72;
        const spotAng = Math.atan2(ball.py, ball.px);
        const scaleZ = Math.max(0.18, ball.pz);
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

        if (ball.pz > 0.25) {
          ctx.fillStyle = "#0f172a";
          ctx.font = `bold ${ball.number >= 10 ? "8px" : "9px"} sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(ball.number.toString(), 0, 0.5);
        }
        ctx.restore();
      }
    }

    if (ball.type === "cue") {
      if (ball.pz > 0.1) {
        ctx.fillStyle = "rgba(220, 38, 38, 0.48)";
        ctx.beginPath();
        ctx.arc(
          ball.x + ball.px * r * 0.72,
          ball.y + ball.py * r * 0.72,
          2.0 * Math.max(0.4, ball.pz),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      if (-ball.pz > 0.1) {
        ctx.fillStyle = "rgba(30, 41, 59, 0.35)";
        ctx.beginPath();
        ctx.arc(
          ball.x - ball.px * r * 0.72,
          ball.y - ball.py * r * 0.72,
          2.0 * Math.max(0.4, -ball.pz),
          0,
          Math.PI * 2
        );
        ctx.fill();
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

  // 4. Ball in Hand Placement Guide
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

    ctx.font = "22px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🧤", ballInHandHoverPos.x + 14, ballInHandHoverPos.y - 12);
  }

  // 5. Aim Line Raycasting + Cue Ball Post-Collision Path + Bank Preview + Cue Stick
  const cueBall = balls[0];
  if ((turn === "human" || isPractice) && !isShooting && !isBallInHand && cueBall && !cueBall.isPotted) {
    const cosA = Math.cos(aimAngle);
    const sinA = Math.sin(aimAngle);
    const collisionRadius = BALL_RADIUS * 2;

    const baseDist = aimAssistLong ? 440 : 270;
    const cueBonusDist = (activeCueObj.stats.aim / 10) * 320;
    const maxRayDist = baseDist + cueBonusDist;
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

    if (hitBall && mode === "8-ball") {
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
      const cHit = rayToCushion(cueBall.x, cueBall.y, cosA, sinA, closestHitDist);
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

    // Bank-shot cushion reflection preview for precision/legendary cues
    if (!hitBall && cushionHit && BANK_PERK_CUES.has(activeCueObj.id)) {
      const rx = cushionHit.nx !== 0 ? -cosA : cosA;
      const ry = cushionHit.ny !== 0 ? -sinA : sinA;
      const bankLen = activeCueObj.id === "cue_cosmic_nebula" ? 180 : 125;
      ctx.strokeStyle = activeCueObj.glowColor;
      ctx.globalAlpha = 0.72;
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

      // Cue ball post-collision path (Tangent line + spin bias)
      const dot = cosA * targetDeflectDir.dx + sinA * targetDeflectDir.dy;
      let cueDefX = cosA - dot * targetDeflectDir.dx;
      let cueDefY = sinA - dot * targetDeflectDir.dy;
      // Add subtle topspin/backspin curve indicator along aim vector
      if (Math.abs(spinY) > 0.15) {
        cueDefX += cosA * spinY * 0.45;
        cueDefY += sinA * spinY * 0.45;
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
