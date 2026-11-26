"use client";

import React from "react";

interface PowerMeterProps {
  power: number;
  disabled: boolean;
  trackRef: React.RefObject<HTMLDivElement | null>;
  fillRef: React.RefObject<HTMLDivElement | null>;
  handleRef: React.RefObject<HTMLDivElement | null>;
  textRef: React.RefObject<HTMLDivElement | null>;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  onQuickShoot: () => void;
}

export function PowerMeter({
  power,
  disabled,
  trackRef,
  fillRef,
  handleRef,
  textRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onQuickShoot,
}: PowerMeterProps) {
  return (
    <aside className="w-11 sm:w-13 shrink-0 flex flex-col items-center justify-between py-1.5 px-1 bg-slate-950/85 border-r border-slate-800/80 z-20 select-none">
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
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
          ref={fillRef}
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
          ref={handleRef}
          className="absolute left-1/2 -translate-x-1/2 w-6 sm:w-7 h-5 rounded-md bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 border border-white shadow-lg flex items-center justify-center pointer-events-none"
          style={{ top: `calc(${power}% - 10px)` }}
        >
          <div className="w-3 h-0.5 bg-slate-900 rounded-full" />
        </div>
      </div>

      <div
        ref={textRef}
        className="text-[9px] font-black font-mono text-amber-300 bg-slate-900 px-1 py-0.5 rounded border border-slate-700 my-1"
      >
        {power}%
      </div>

      <button
        type="button"
        onClick={onQuickShoot}
        disabled={disabled}
        className={`w-8 sm:w-9 h-8 rounded-lg font-black text-xs flex items-center justify-center shadow transition-transform active:scale-95 cursor-pointer ${
          !disabled
            ? "bg-gradient-to-b from-emerald-400 to-emerald-700 text-white border border-emerald-300"
            : "bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed opacity-50"
        }`}
        title="اضرب الكرة"
      >
        🚀
      </button>
    </aside>
  );
}
