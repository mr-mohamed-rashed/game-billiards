"use client";

import React from "react";
import { Ball, BallGroup, POCKETS } from "@/types/billiards";

interface AvatarTimerProps {
  src: string;
  alt: string;
  isActive: boolean;
  timeLeft: number;
  totalTime: number;
  borderColorClass: string;
}

function AvatarTimer({ src, alt, isActive, timeLeft, totalTime, borderColorClass }: AvatarTimerProps) {
  const circumference = 2 * Math.PI * 15;
  const strokeColor = timeLeft <= 5 ? "#ef4444" : timeLeft <= 10 ? "#facc15" : "#22c55e";
  return (
    <div className="relative flex items-center justify-center shrink-0 w-9 h-9">
      <svg className="w-9 h-9 -rotate-90 pointer-events-none" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" fill="transparent" />
        {isActive && (
          <circle
            cx="18"
            cy="18"
            r="15"
            stroke={strokeColor}
            strokeWidth="2.5"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - timeLeft / Math.max(1, totalTime))}
            strokeLinecap="round"
          />
        )}
      </svg>
      <img
        src={src}
        alt={alt}
        className={`absolute w-6 h-6 rounded-md bg-slate-800 border ${borderColorClass} object-cover`}
      />
    </div>
  );
}

interface TableHUDProps {
  username: string;
  avatar: string;
  opponentName: string;
  opponentAvatar: string;
  opponentFlag: string;
  turn: "human" | "bot";
  turnTimeLeft: number;
  turnTotalTime: number;
  isPractice: boolean;
  prize: number;
  turnMessage: string;
  humanGroup: BallGroup;
  botGroup: BallGroup;
  humanRemainingBalls: Ball[];
  botRemainingCount: number;
  spinX: number;
  spinY: number;
  showSpinPopover: boolean;
  setShowSpinPopover: React.Dispatch<React.SetStateAction<boolean>>;
  showPocketPopover: boolean;
  setShowPocketPopover: React.Dispatch<React.SetStateAction<boolean>>;
  calledPocketId: number | null;
  isPortrait: boolean;
  isVirtualLandscape: boolean;
  onSpinPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onSpinPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onSpinPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onSpinPointerCancel: () => void;
  onResetSpin: () => void;
  onFineAim: (delta: number) => void;
  onSelectPocket: (pocketId: number) => void;
  onOpenShop: () => void;
  onToggleVirtualLandscape: () => void;
  onExit: () => void;
}

export function TableHUD({
  username,
  avatar,
  opponentName,
  opponentAvatar,
  opponentFlag,
  turn,
  turnTimeLeft,
  turnTotalTime,
  isPractice,
  prize,
  turnMessage,
  humanGroup,
  botGroup,
  humanRemainingBalls,
  botRemainingCount,
  spinX,
  spinY,
  showSpinPopover,
  setShowSpinPopover,
  showPocketPopover,
  setShowPocketPopover,
  calledPocketId,
  isPortrait,
  isVirtualLandscape,
  onSpinPointerDown,
  onSpinPointerMove,
  onSpinPointerUp,
  onSpinPointerCancel,
  onResetSpin,
  onFineAim,
  onSelectPocket,
  onOpenShop,
  onToggleVirtualLandscape,
  onExit,
}: TableHUDProps) {
  const activePocketObj = POCKETS.find((p) => p.id === calledPocketId);

  return (
    <header className="h-11 sm:h-12 shrink-0 flex items-center justify-between gap-1.5 px-2 bg-slate-950/95 border-b border-slate-800/90 z-30">
      {/* Player + Remaining Ball Tray */}
      <div className="flex items-center gap-1.5 min-w-0" dir="rtl">
        <AvatarTimer
          src={avatar}
          alt="You"
          isActive={turn === "human"}
          timeLeft={turnTimeLeft}
          totalTime={turnTotalTime}
          borderColorClass="border-amber-400"
        />

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

          <div className="flex items-center gap-0.5 mt-0.5">
            {humanGroup === "unassigned" ? (
              <span className="text-[9px] font-bold text-amber-400">طاولة مفتوحة</span>
            ) : (
              humanRemainingBalls.map((b) => (
                <span
                  key={b.id}
                  title={`كرة ${b.number}`}
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-white/50 flex items-center justify-center text-[7px] sm:text-[8px] font-black shadow-sm shrink-0"
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
                onPointerDown={onSpinPointerDown}
                onPointerMove={onSpinPointerMove}
                onPointerUp={onSpinPointerUp}
                onPointerCancel={onSpinPointerCancel}
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
                <span className="text-[9px] font-bold text-slate-300 truncate">
                  {[
                    spinY < -0.2 ? "توب 🔺" : spinY > 0.2 ? "اسكرو 🔻" : "",
                    spinX < -0.2 ? "شمال ◀" : spinX > 0.2 ? "يمين ▶" : "",
                  ]
                    .filter(Boolean)
                    .join(" + ") || "مركز (استوب)"}
                </span>
                <button
                  type="button"
                  onClick={onResetSpin}
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
            onClick={() => onFineAim(-0.012)}
            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 active:scale-90 text-amber-300 text-[10px] font-black flex items-center justify-center cursor-pointer"
            title="تصويب دقيق يسار"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => onFineAim(0.012)}
            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 active:scale-90 text-amber-300 text-[10px] font-black flex items-center justify-center cursor-pointer"
            title="تصويب دقيق يمين"
          >
            ▶
          </button>
        </div>

        {/* Call Pocket Quick Selector */}
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
                  onClick={() => onSelectPocket(p.id)}
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

        <AvatarTimer
          src={opponentAvatar}
          alt="Opponent"
          isActive={turn === "bot"}
          timeLeft={turnTimeLeft}
          totalTime={turnTotalTime}
          borderColorClass="border-slate-700"
        />

        <button
          type="button"
          onClick={onOpenShop}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/50 flex items-center justify-center text-amber-300 text-xs cursor-pointer"
          title="المتجر"
        >
          🛒
        </button>
        {isPortrait && (
          <button
            type="button"
            onClick={onToggleVirtualLandscape}
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
          onClick={onExit}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/50 flex items-center justify-center text-rose-300 text-xs cursor-pointer"
          title="خروج للقائمة الرئيسية"
        >
          🚪
        </button>
      </div>
    </header>
  );
}
