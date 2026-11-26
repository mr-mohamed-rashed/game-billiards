"use client";

import { useEffect, useRef } from "react";

interface IntroVideoProps {
  onFinish: () => void;
}

interface IntroBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  stripe: boolean;
  num: number;
}

const INTRO_COLORS = [
  "#facc15",
  "#2563eb",
  "#dc2626",
  "#9333ea",
  "#ea580c",
  "#16a34a",
  "#831843",
  "#09090b",
  "#facc15",
  "#2563eb",
  "#dc2626",
  "#9333ea",
  "#ea580c",
  "#16a34a",
  "#831843",
];

export function IntroVideo({ onFinish }: IntroVideoProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const finishedRef = useRef(false);

  const handleComplete = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 900;
    const H = 500;
    const R = 14;
    const apexX = 560;
    const centerY = H / 2;

    const balls: IntroBall[] = [];
    const spacing = R * 2.04;
    const rowStep = spacing * Math.cos(Math.PI / 6);
    const nums = [1, 9, 2, 3, 8, 10, 11, 4, 12, 5, 13, 6, 14, 7, 15];
    let idx = 0;

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c <= r; c++) {
        const n = nums[idx++];
        balls.push({
          x: apexX + r * rowStep,
          y: centerY - (r * spacing) / 2 + c * spacing,
          vx: 0,
          vy: 0,
          color: INTRO_COLORS[n - 1],
          stripe: n > 8,
          num: n,
        });
      }
    }

    const cueBall = { x: 240, y: centerY, vx: 0, vy: 0 };
    const sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

    const startTime = performance.now();
    const IMPACT_MS = 1050;
    const DURATION_MS = 3400;
    let impacted = false;
    let rafId = 0;
    let lastTs = startTime;

    const drawGlossyBall = (x: number, y: number, color: string, stripe: boolean, num: number) => {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.arc(x + 3, y + 5, R, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fill();

      if (stripe) {
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.arc(x, y, R, -0.55, 0.55);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, R, Math.PI - 0.55, Math.PI + 0.55);
        ctx.fill();
      }

      if (num > 0) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x, y, R * 0.44, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(num), x, y + 0.5);
      }

      const grad = ctx.createRadialGradient(x - R * 0.35, y - R * 0.35, 1, x, y, R);
      grad.addColorStop(0, "rgba(255,255,255,0.75)");
      grad.addColorStop(0.45, "rgba(255,255,255,0.06)");
      grad.addColorStop(1, "rgba(0,0,0,0.38)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const dt = Math.min(2, (now - lastTs) / 16.6667);
      lastTs = now;

      if (elapsed >= DURATION_MS) {
        handleComplete();
        return;
      }

      // 1. Background luxury table spotlight
      ctx.fillStyle = "#020b14";
      ctx.fillRect(0, 0, W, H);

      const spot = ctx.createRadialGradient(W * 0.5, H * 0.5, 40, W * 0.5, H * 0.5, 480);
      spot.addColorStop(0, "rgba(21, 128, 61, 0.48)");
      spot.addColorStop(0.55, "rgba(6, 78, 59, 0.28)");
      spot.addColorStop(1, "rgba(2, 11, 20, 0.96)");
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, W, H);

      // Subtle championship table rim frame
      ctx.strokeStyle = "rgba(251, 191, 36, 0.25)";
      ctx.lineWidth = 3;
      ctx.strokeRect(48, 36, W - 96, H - 72);

      // Cue motion (0 -> IMPACT_MS)
      if (!impacted) {
        const pullT = Math.min(1, elapsed / 750);
        const strikeT = elapsed > 750 ? Math.min(1, (elapsed - 750) / (IMPACT_MS - 750)) : 0;

        if (elapsed < 750) {
          cueBall.x = 240;
          const pullDist = Math.sin(pullT * Math.PI * 0.5) * 62;
          // Draw golden cue stick pulling back
          ctx.save();
          const stickGrad = ctx.createLinearGradient(cueBall.x - R - 10 - pullDist - 220, 0, cueBall.x - R - 10 - pullDist, 0);
          stickGrad.addColorStop(0, "#0f172a");
          stickGrad.addColorStop(0.5, "#d97706");
          stickGrad.addColorStop(1, "#fef08a");
          ctx.fillStyle = stickGrad;
          ctx.fillRect(cueBall.x - R - 10 - pullDist - 220, centerY - 4, 220, 8);
          ctx.restore();
        } else {
          // Cue strikes cue ball and launches it into apex
          const easeStrike = strikeT * strikeT;
          cueBall.x = 240 + (apexX - R * 2 - 240) * easeStrike;
          if (strikeT >= 0.98) {
            impacted = true;
            cueBall.vx = -6.5;
            cueBall.vy = 2.4;
            for (let i = 0; i < balls.length; i++) {
              const b = balls[i];
              const ang = Math.atan2(b.y - centerY, b.x - apexX) + (Math.random() - 0.5) * 0.42;
              const spd = 7 + Math.random() * 11;
              b.vx = Math.cos(ang) * spd;
              b.vy = Math.sin(ang) * spd;
            }
            for (let s = 0; s < 32; s++) {
              const a = Math.random() * Math.PI * 2;
              const sp = 2 + Math.random() * 8;
              sparks.push({
                x: apexX - R,
                y: centerY,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: 1,
              });
            }
          }
        }
      } else {
        // Animate break scatter physics + sparks
        cueBall.x += cueBall.vx * dt;
        cueBall.y += cueBall.vy * dt;
        cueBall.vx *= Math.pow(0.985, dt);
        cueBall.vy *= Math.pow(0.985, dt);

        for (let i = 0; i < balls.length; i++) {
          const b = balls[i];
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.vx *= Math.pow(0.985, dt);
          b.vy *= Math.pow(0.985, dt);
          if (b.x < 68 || b.x > W - 68) b.vx *= -0.85;
          if (b.y < 56 || b.y > H - 56) b.vy *= -0.85;
        }
      }

      // Draw balls
      drawGlossyBall(cueBall.x, cueBall.y, "#f8fafc", false, 0);
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        drawGlossyBall(b.x, b.y, b.color, b.stripe, b.num);
      }

      // Golden break sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.life -= 0.032 * dt;
        if (sp.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(250, 204, 21, ${sp.life})`;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Brand reveal overlay (fades in strongly after break impact)
      if (elapsed > IMPACT_MS - 100) {
        const logoAlpha = Math.min(1, (elapsed - (IMPACT_MS - 100)) / 550);
        const fadeOut = elapsed > DURATION_MS - 400 ? Math.max(0, (DURATION_MS - elapsed) / 400) : 1;
        ctx.save();
        ctx.globalAlpha = logoAlpha * fadeOut;
        ctx.fillStyle = "rgba(2, 11, 20, 0.52)";
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = "center";
        ctx.fillStyle = "#facc15";
        ctx.font = "900 54px sans-serif";
        ctx.shadowColor = "rgba(250, 204, 21, 0.65)";
        ctx.shadowBlur = 24;
        ctx.fillText("CUE MASTER", W / 2, H / 2 - 12);

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("كيو ماستر • بلياردو & سنوكر", W / 2, H / 2 + 28);
        ctx.restore();
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      onClick={handleComplete}
      className="relative w-full h-full bg-[#020b14] flex items-center justify-center overflow-hidden cursor-pointer"
    >
      <canvas
        ref={canvasRef}
        width={900}
        height={500}
        className="w-full h-full object-contain"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleComplete();
        }}
        className="absolute bottom-4 left-4 z-20 px-4 py-1.5 rounded-full bg-slate-900/85 hover:bg-slate-800 border border-amber-400/50 text-amber-300 text-xs font-black shadow-lg active:scale-95"
      >
        تخطي ⏭️
      </button>
    </div>
  );
}
