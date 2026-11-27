"use client";

import { useEffect, useRef } from "react";
import { TableItem } from "@/config/shopData";
import { GameMode } from "@/types/billiards";

interface TableEntranceOverlayProps {
  table: TableItem;
  mode: GameMode;
  username: string;
  opponentName: string;
  isPractice: boolean;
  prize: number;
  onFinish: () => void;
}

export function TableEntranceOverlay({
  table,
  mode,
  username,
  opponentName,
  isPractice,
  prize,
  onFinish,
}: TableEntranceOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cameraImgRef = useRef<HTMLImageElement | null>(null);
  const leftBeamRef = useRef<HTMLDivElement | null>(null);
  const rightBeamRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const DURATION_MS = 2400;
    const FADE_START_MS = 2000;
    const startTime = performance.now();
    let rafId = 0;

    // Set initial camera frame immediately before first paint
    const applyCameraFrame = (elapsed: number) => {
      const raw = Math.min(1, Math.max(0, elapsed / DURATION_MS));
      // Smooth sine ease-in-out for continuous Steadicam cameraman motion
      const ease = 0.5 - 0.5 * Math.cos(raw * Math.PI);

      // Smooth circular arc (never reverses direction) + gentle slow-mo zoom
      const arcAngle = -0.45 + ease * 0.95; // radians
      const tx = -Math.sin(arcAngle) * 2.4;
      const ty = (1 - Math.cos(arcAngle)) * 1.4 - 0.4;
      const scale = 1.15 + raw * 0.09;
      const rotDeg = -1.4 + ease * 2.8;

      if (cameraImgRef.current) {
        cameraImgRef.current.style.transform = `translate3d(${tx.toFixed(3)}%, ${ty.toFixed(3)}%, 0) scale(${scale.toFixed(4)}) rotate(${rotDeg.toFixed(3)}deg)`;
      }

      if (leftBeamRef.current) {
        const leftRot = -24 + ease * 10;
        leftBeamRef.current.style.transform = `rotate(${leftRot.toFixed(2)}deg)`;
      }
      if (rightBeamRef.current) {
        const rightRot = 24 - ease * 10;
        rightBeamRef.current.style.transform = `rotate(${rightRot.toFixed(2)}deg)`;
      }

      if (containerRef.current) {
        if (elapsed >= FADE_START_MS) {
          const fadeT = Math.min(1, (elapsed - FADE_START_MS) / (DURATION_MS - FADE_START_MS));
          containerRef.current.style.opacity = `${(1 - fadeT).toFixed(3)}`;
        } else {
          containerRef.current.style.opacity = "1";
        }
      }
    };

    applyCameraFrame(0);

    const tick = (now: number) => {
      const elapsed = now - startTime;
      applyCameraFrame(elapsed);
      if (elapsed >= DURATION_MS) {
        onFinish();
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [onFinish]);

  const showcaseImage = table.sideImage || table.image;

  return (
    <div
      ref={containerRef}
      onClick={onFinish}
      dir="rtl"
      className="absolute inset-0 z-[75] bg-[#02050d] overflow-hidden flex flex-col justify-between cursor-pointer select-none will-change-[opacity]"
    >
      {/* Continuous Steadicam Circular Slow-Mo Zoom on 3D Table */}
      {showcaseImage && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
          <img
            ref={cameraImgRef}
            src={showcaseImage}
            alt={table.nameAr}
            className="w-full h-full object-cover will-change-transform"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/75" />
        </div>
      )}

      {/* Overhead Arena Truss & Smooth Volumetric Spotlights */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[78%] h-3 bg-gradient-to-b from-slate-700/80 to-transparent flex items-center justify-around">
          <span className="w-4 h-2 rounded-full bg-white shadow-[0_0_22px_8px_rgba(255,255,255,0.85)]" />
          <span
            className="w-5 h-2.5 rounded-full bg-white"
            style={{ boxShadow: `0 0 28px 10px ${table.cushionGlow}` }}
          />
          <span className="w-4 h-2 rounded-full bg-white shadow-[0_0_22px_8px_rgba(255,255,255,0.85)]" />
        </div>

        <div
          ref={leftBeamRef}
          className="absolute -top-8 left-[16%] w-44 sm:w-72 h-[115%] origin-top opacity-70 will-change-transform"
          style={{
            background: `linear-gradient(to bottom, rgba(255,255,255,0.38), ${table.cushionGlow}24 45%, transparent 88%)`,
            clipPath: "polygon(38% 0%, 62% 0%, 100% 100%, 0% 100%)",
            filter: "blur(6px)",
          }}
        />

        <div
          className="absolute -top-6 left-1/2 -translate-x-1/2 w-64 sm:w-96 h-[110%] origin-top opacity-65"
          style={{
            background: `linear-gradient(to bottom, rgba(255,255,255,0.3), ${table.cushionGlow}20 48%, transparent 85%)`,
            clipPath: "polygon(34% 0%, 66% 0%, 100% 100%, 0% 100%)",
            filter: "blur(10px)",
          }}
        />

        <div
          ref={rightBeamRef}
          className="absolute -top-8 right-[16%] w-44 sm:w-72 h-[115%] origin-top opacity-70 will-change-transform"
          style={{
            background: `linear-gradient(to bottom, rgba(255,255,255,0.38), ${table.cushionGlow}24 45%, transparent 88%)`,
            clipPath: "polygon(38% 0%, 62% 0%, 100% 100%, 0% 100%)",
            filter: "blur(6px)",
          }}
        />
      </div>

      {/* Top Broadcast Letterbox Bar */}
      <div className="relative z-10 px-4 sm:px-8 py-3 bg-gradient-to-b from-black/95 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black tracking-wide shadow">
            🔴 LIVE ARENA
          </span>
          <span className="text-xs sm:text-sm font-black text-amber-300">
            {mode === "snooker"
              ? "بطولة السنوكر الإنجليزي"
              : mode === "one-fifteen"
              ? "بطولة بلياردو (1 و 15)"
              : "بطولة بلياردو 8-Ball"}
          </span>
        </div>
        <span className="text-[11px] font-bold text-slate-300 bg-black/60 px-2.5 py-1 rounded-full border border-white/15">
          اضغط للتخطي ⏭️
        </span>
      </div>

      {/* Bottom Arena Matchup & Table Title */}
      <div className="relative z-10 px-4 sm:px-8 py-4 sm:py-6 bg-gradient-to-t from-black via-black/85 to-transparent flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="text-center sm:text-right">
          <div className="text-[11px] font-bold text-cyan-300">{table.tierLabelAr}</div>
          <h2 className="text-lg sm:text-2xl font-black text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            {table.nameAr}
          </h2>
        </div>

        <div className="flex items-center gap-3 bg-slate-950/85 border border-amber-400/40 rounded-2xl px-4 py-2 shadow-xl">
          <span className="text-xs sm:text-sm font-black text-amber-300">{username}</span>
          <span className="text-xs font-black px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">
            VS
          </span>
          <span className="text-xs sm:text-sm font-black text-slate-100">
            {isPractice ? "وضع التدريب 🎯" : opponentName}
          </span>
          {!isPractice && prize > 0 && (
            <span className="text-xs font-black text-emerald-400 border-r border-slate-700 pr-2.5 font-mono">
              🏆 {prize.toLocaleString()} 🪙
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
