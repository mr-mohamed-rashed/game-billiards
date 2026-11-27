"use client";

import { GameMode } from "@/types/billiards";

interface ModeSelectTrianglesProps {
  onSelectMode: (mode: GameMode) => void;
}

const POOL_RACK_BALLS = [
  // Row 1 (apex)
  [{ cx: 120, cy: 48, color: "#facc15", stripe: false, num: "1" }],
  // Row 2
  [
    { cx: 108, cy: 69, color: "#2563eb", stripe: false, num: "2" },
    { cx: 132, cy: 69, color: "#dc2626", stripe: true, num: "9" },
  ],
  // Row 3 (8-ball center)
  [
    { cx: 96, cy: 90, color: "#dc2626", stripe: false, num: "3" },
    { cx: 120, cy: 90, color: "#09090b", stripe: false, num: "8" },
    { cx: 144, cy: 90, color: "#2563eb", stripe: true, num: "10" },
  ],
  // Row 4
  [
    { cx: 84, cy: 111, color: "#9333ea", stripe: false, num: "4" },
    { cx: 108, cy: 111, color: "#ea580c", stripe: true, num: "13" },
    { cx: 132, cy: 111, color: "#16a34a", stripe: false, num: "6" },
    { cx: 156, cy: 111, color: "#9333ea", stripe: true, num: "12" },
  ],
  // Row 5
  [
    { cx: 72, cy: 132, color: "#ea580c", stripe: false, num: "5" },
    { cx: 96, cy: 132, color: "#16a34a", stripe: true, num: "14" },
    { cx: 120, cy: 132, color: "#831843", stripe: false, num: "7" },
    { cx: 144, cy: 132, color: "#facc15", stripe: true, num: "11" },
    { cx: 168, cy: 132, color: "#831843", stripe: true, num: "15" },
  ],
].flat();

const SNOOKER_RACK_BALLS = [
  [{ cx: 120, cy: 48 }],
  [{ cx: 108, cy: 69 }, { cx: 132, cy: 69 }],
  [{ cx: 96, cy: 90 }, { cx: 120, cy: 90 }, { cx: 144, cy: 90 }],
  [{ cx: 84, cy: 111 }, { cx: 108, cy: 111 }, { cx: 132, cy: 111 }, { cx: 156, cy: 111 }],
  [
    { cx: 72, cy: 132 },
    { cx: 96, cy: 132 },
    { cx: 120, cy: 132 },
    { cx: 144, cy: 132 },
    { cx: 168, cy: 132 },
  ],
].flat();

export function ModeSelectTriangles({ onSelectMode }: ModeSelectTrianglesProps) {
  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center bg-cover bg-center overflow-hidden px-4 py-3"
      style={{ backgroundImage: "url('/cue_master_bg.jpg')" }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/70 to-black/95 pointer-events-none" />

      <div className="relative z-10 text-center mb-3 sm:mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[11px] font-black mb-1.5">
          <span>🎱</span>
          <span>كيو ماستر (CUE MASTER)</span>
        </div>
        <h1 className="text-xl sm:text-3xl font-black text-white drop-shadow">
          اختر مثلث اللعب لبدء البطولة
        </h1>
      </div>

      {/* Three Mode Cards Side-by-Side (Compact on narrow mobile) */}
      <div className="relative z-10 w-full max-w-5xl grid grid-cols-3 gap-2 sm:gap-5 items-stretch">
        {/* Triangle 1: 8-Ball Billiards */}
        <button
          type="button"
          onClick={() => onSelectMode("8-ball")}
          className="group relative flex flex-col items-center justify-between rounded-3xl border-2 border-emerald-400/50 hover:border-amber-400 bg-gradient-to-b from-emerald-950/90 via-[#042318]/95 to-slate-950/95 p-3 sm:p-6 shadow-[0_12px_35px_rgba(16,185,129,0.28)] hover:shadow-[0_14px_45px_rgba(250,204,21,0.38)] active:scale-95 transition-all cursor-pointer"
        >
          <div className="w-full flex items-center justify-center py-1 sm:py-2">
            <svg viewBox="0 0 240 165" className="w-full max-w-[205px] drop-shadow-[0_10px_20px_rgba(0,0,0,0.85)] group-hover:scale-105 transition-transform">
              {/* Outer Triangle Rack */}
              <polygon
                points="120,16 36,152 204,152"
                fill="rgba(6, 78, 59, 0.55)"
                stroke="#fbbf24"
                strokeWidth="7"
                strokeLinejoin="round"
              />
              <polygon
                points="120,23 44,147 196,147"
                fill="none"
                stroke="#78350f"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {POOL_RACK_BALLS.map((b, i) => (
                <g key={i}>
                  <circle cx={b.cx + 1.5} cy={b.cy + 2} r="10.5" fill="rgba(0,0,0,0.45)" />
                  <circle cx={b.cx} cy={b.cy} r="10.5" fill={b.color} />
                  {b.stripe && (
                    <rect x={b.cx - 10} y={b.cy - 4} width="20" height="8" rx="3" fill="#f8fafc" opacity="0.92" />
                  )}
                  <circle cx={b.cx} cy={b.cy} r="4.6" fill="#ffffff" />
                  <text
                    x={b.cx}
                    y={b.cy + 2.5}
                    textAnchor="middle"
                    fontSize="6.5"
                    fontWeight="900"
                    fill="#0f172a"
                  >
                    {b.num}
                  </text>
                  <circle cx={b.cx - 3.5} cy={b.cy - 3.5} r="2.8" fill="rgba(255,255,255,0.5)" />
                </g>
              ))}
            </svg>
          </div>

          <div className="text-center space-y-1 mt-1">
            <h2 className="text-base sm:text-2xl font-black text-amber-300 group-hover:text-white transition-colors">
              بلياردو (8-Ball)
            </h2>
            <p className="text-[10px] sm:text-xs font-bold text-slate-300">
              15 كرة سادة وألوان + الكرة 8
            </p>
            <div className="pt-1.5">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-xs sm:text-sm shadow-lg">
                <span>دخول البلياردو</span>
                <span>🎱</span>
              </span>
            </div>
          </div>
        </button>

        {/* Triangle 2: Snooker */}
        <button
          type="button"
          onClick={() => onSelectMode("snooker")}
          className="group relative flex flex-col items-center justify-between rounded-3xl border-2 border-rose-500/50 hover:border-amber-400 bg-gradient-to-b from-rose-950/80 via-[#230612]/95 to-slate-950/95 p-3 sm:p-6 shadow-[0_12px_35px_rgba(225,29,72,0.28)] hover:shadow-[0_14px_45px_rgba(250,204,21,0.38)] active:scale-95 transition-all cursor-pointer"
        >
          <div className="w-full flex items-center justify-center py-1 sm:py-2">
            <svg viewBox="0 0 240 165" className="w-full max-w-[205px] drop-shadow-[0_10px_20px_rgba(0,0,0,0.85)] group-hover:scale-105 transition-transform">
              {/* Outer Mahogany Snooker Triangle Rack */}
              <polygon
                points="120,16 36,152 204,152"
                fill="rgba(76, 5, 25, 0.55)"
                stroke="#fb7185"
                strokeWidth="7"
                strokeLinejoin="round"
              />
              <polygon
                points="120,23 44,147 196,147"
                fill="none"
                stroke="#450a0a"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {SNOOKER_RACK_BALLS.map((b, i) => (
                <g key={i}>
                  <circle cx={b.cx + 1.5} cy={b.cy + 2} r="10.5" fill="rgba(0,0,0,0.45)" />
                  <circle cx={b.cx} cy={b.cy} r="10.5" fill="#dc2626" />
                  <circle cx={b.cx - 3.5} cy={b.cy - 3.5} r="3" fill="rgba(255,255,255,0.55)" />
                </g>
              ))}
              {/* Signature Snooker Pink & Blue Top Accent */}
              <circle cx="198" cy="36" r="9.5" fill="#ec4899" stroke="#fbcfe8" strokeWidth="1.2" />
              <circle cx="42" cy="36" r="9.5" fill="#2563eb" stroke="#bfdbfe" strokeWidth="1.2" />
            </svg>
          </div>

          <div className="text-center space-y-1 mt-1">
            <h2 className="text-base sm:text-2xl font-black text-rose-300 group-hover:text-white transition-colors">
              سنوكر (Snooker)
            </h2>
            <p className="text-[10px] sm:text-xs font-bold text-slate-300">
              15 كرة حمراء + الكرات الملونة
            </p>
            <div className="pt-1.5">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-600 text-white font-black text-xs sm:text-sm shadow-lg">
                <span>دخول السنوكر</span>
                <span>🔴</span>
              </span>
            </div>
          </div>
        </button>

        {/* Card 3: 1 & 15 Billiards */}
        <button
          type="button"
          onClick={() => onSelectMode("one-fifteen")}
          className="group relative flex flex-col items-center justify-between rounded-3xl border-2 border-amber-400/50 hover:border-yellow-300 bg-gradient-to-b from-amber-950/80 via-[#1d1106]/95 to-slate-950/95 p-3 sm:p-6 shadow-[0_12px_35px_rgba(245,158,11,0.28)] hover:shadow-[0_14px_45px_rgba(250,204,21,0.42)] active:scale-95 transition-all cursor-pointer"
        >
          <div className="w-full flex items-center justify-center py-1 sm:py-2">
            <svg viewBox="0 0 240 165" className="w-full max-w-[205px] drop-shadow-[0_10px_20px_rgba(0,0,0,0.85)] group-hover:scale-105 transition-transform">
              {/* Green Felt Backdrop Ring */}
              <ellipse cx="120" cy="88" rx="92" ry="62" fill="rgba(6, 78, 59, 0.45)" stroke="#fbbf24" strokeWidth="3" strokeDasharray="6 4" />
              {/* Ball 1 (Yellow Solid) */}
              <g>
                <circle cx="84" cy="92" r="34" fill="rgba(0,0,0,0.45)" />
                <circle cx="82" cy="86" r="34" fill="#facc15" stroke="#fef08a" strokeWidth="2" />
                <circle cx="82" cy="86" r="14" fill="#ffffff" />
                <text x="82" y="92" textAnchor="middle" fontSize="18" fontWeight="900" fill="#0f172a">
                  1
                </text>
                <ellipse cx="70" cy="70" rx="10" ry="6" transform="rotate(-25 70 70)" fill="rgba(255,255,255,0.55)" />
              </g>
              {/* Ball 15 (Maroon Stripe) */}
              <g>
                <circle cx="160" cy="92" r="34" fill="rgba(0,0,0,0.45)" />
                <circle cx="158" cy="86" r="34" fill="#f8fafc" stroke="#fda4af" strokeWidth="2" />
                <rect x="125" y="72" width="66" height="28" rx="10" fill="#831843" />
                <circle cx="158" cy="86" r="14" fill="#ffffff" />
                <text x="158" y="92" textAnchor="middle" fontSize="16" fontWeight="900" fill="#0f172a">
                  15
                </text>
                <ellipse cx="146" cy="70" rx="10" ry="6" transform="rotate(-25 146 70)" fill="rgba(255,255,255,0.55)" />
              </g>
            </svg>
          </div>

          <div className="text-center space-y-1 mt-1">
            <h2 className="text-base sm:text-2xl font-black text-amber-300 group-hover:text-white transition-colors">
              بلياردو (1 و 15)
            </h2>
            <p className="text-[10px] sm:text-xs font-bold text-slate-300">
              1 ميدل شمال • 15 ميدل يمين • تحديد كل جيب
            </p>
            <div className="pt-1.5">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 text-white font-black text-xs sm:text-sm shadow-lg">
                <span>دخول 1 و 15</span>
                <span>🟡</span>
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
