"use client";

import { ActiveModalType, GameMode } from "@/types/billiards";

interface LobbyProps {
  username: string;
  avatar: string;
  coins: number;
  gems: number;
  onAddCoins: (amount: number) => void;
  onAddGems: (amount: number) => void;
  onStartMatch: (mode: GameMode, practice: boolean, stake: number) => void;
  onOpenModal: (modal: ActiveModalType, shopTab?: "cues" | "tables") => void;
}

export function Lobby({
  username,
  avatar,
  coins,
  gems,
  onAddCoins,
  onAddGems,
  onStartMatch,
  onOpenModal,
}: LobbyProps) {
  return (
    <div
      className="relative w-full h-full flex flex-col justify-between bg-cover bg-center overflow-y-auto"
      style={{ backgroundImage: "url('/cue_master_bg.jpg')" }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/55 to-black/90 pointer-events-none" />

      {/* Top Bar: Profile, Level, Trophies, & Currencies */}
      <header className="relative z-10 flex flex-wrap items-center justify-between px-4 md:px-6 py-3 border-b border-slate-800/60 bg-black/60 gap-3">
        <div className="flex items-center gap-3 bg-black/60 px-3.5 py-1.5 rounded-2xl border border-amber-500/40 shadow-lg">
          <div className="relative">
            <img
              src={avatar}
              alt="Avatar"
              className="w-10 h-10 rounded-xl bg-amber-400/20 p-0.5 border-2 border-amber-400 object-cover shadow"
            />
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 font-black text-[9px] px-1 rounded-full border border-slate-900">
              Lvl 1
            </div>
          </div>
          <div>
            <span className="font-black text-amber-300 text-xs md:text-sm block leading-none">{username}</span>
            <div className="w-20 bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div className="bg-emerald-400 h-full w-2/5 rounded-full shadow-[0_0_8px_#34d399]" />
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-black/60 px-3.5 py-1.5 rounded-2xl border border-blue-500/30">
          <span className="text-base">🏆</span>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold leading-tight">الكؤوس والجوائز</span>
            <span className="text-xs font-black text-amber-300 leading-tight">4 / 12</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-2xl border border-amber-500/40">
            <span className="text-base">🪙</span>
            <span className="font-black text-amber-400 text-xs md:text-sm">{coins.toLocaleString()}</span>
            <button
              onClick={() => onAddCoins(5000)}
              className="w-5 h-5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center cursor-pointer shadow active:scale-90"
              title="إضافة 5000 كوينز مجاناً"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-2xl border border-fuchsia-500/40">
            <span className="text-base">💎</span>
            <span className="font-black text-fuchsia-400 text-xs md:text-sm">{gems.toLocaleString()}</span>
            <button
              onClick={() => onAddGems(50)}
              className="w-5 h-5 rounded-md bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-black text-xs flex items-center justify-center cursor-pointer shadow active:scale-90"
              title="إضافة 50 جوهرة مجاناً"
            >
              +
            </button>
          </div>
        </div>
      </header>

      {/* Main Lobby Hub Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-4 max-w-4xl mx-auto w-full space-y-4">
        {/* HERO CARD: DOWNTOWN LONDON PUB */}
        <div className="relative w-full rounded-3xl overflow-hidden border-2 border-amber-400/80 shadow-[0_10px_35px_rgba(0,0,0,0.85)] bg-gradient-to-b from-blue-950 via-[#071c36] to-slate-950 p-5 md:p-6 text-center">
          <div className="absolute top-2 left-3 text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full shadow">
            طاولة لندن الرسمية 🇬🇧
          </div>

          <div className="flex flex-col items-center justify-center my-1">
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-300 drop-shadow">DOWNTOWN</div>
            <div className="flex items-center gap-2 text-3xl md:text-5xl font-black italic tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
              <span>LONDON</span>
              <span className="w-8 h-8 md:w-11 md:h-11 rounded-full bg-slate-950 border-2 border-white flex items-center justify-center text-sm md:text-lg font-black not-italic text-white shadow-lg">
                8
              </span>
              <span>PUB</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 my-2 text-xs md:text-sm font-bold text-slate-200">
            <div className="flex items-center gap-1">
              <span>فوز:</span>
              <span className="text-amber-400 font-black">4 🏆</span>
            </div>
            <div className="w-24 bg-slate-900 h-2 rounded-full border border-slate-700 overflow-hidden">
              <div className="bg-amber-400 h-full w-1/3 rounded-full" />
            </div>
            <div className="flex items-center gap-1">
              <span>خسارة:</span>
              <span className="text-slate-400 font-black">0 🏆</span>
            </div>
          </div>

          <div className="text-sm md:text-base font-black text-amber-300 mb-3 flex items-center justify-center gap-2">
            <span>الرهان: 100 🪙 | الجائزة:</span>
            <span className="text-emerald-400 font-mono text-lg font-black">190 🪙</span>
          </div>

          <button
            onClick={() => onStartMatch("8-ball", false, 100)}
            className="w-full max-w-xs mx-auto py-3 md:py-4 px-8 rounded-2xl font-black text-lg md:text-xl text-white shadow-[0_8px_25px_rgba(34,197,94,0.5)] border-2 border-emerald-300 bg-gradient-to-b from-emerald-400 via-emerald-600 to-emerald-800 hover:from-emerald-300 hover:to-emerald-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>PLAY</span>
            <span>▶️</span>
          </button>
        </div>

        {/* 3 Quick Mode Buttons */}
        <div className="grid grid-cols-3 gap-2.5 md:gap-4 w-full">
          <button
            onClick={() => onOpenModal("tournaments")}
            className="relative flex flex-col items-center justify-center py-3.5 px-2 rounded-2xl font-black text-xs md:text-sm text-white shadow-[0_6px_20px_rgba(220,38,38,0.35)] border border-rose-400/50 bg-gradient-to-b from-rose-500 via-rose-600 to-rose-800 hover:from-rose-400 hover:to-rose-700 active:scale-95 transition-all cursor-pointer"
          >
            <span className="text-xl md:text-2xl mb-1">⚡</span>
            <span>دورة سريعة</span>
          </button>

          <button
            onClick={() => onStartMatch("8-ball", true, 0)}
            className="relative flex flex-col items-center justify-center py-3.5 px-2 rounded-2xl font-black text-xs md:text-sm text-slate-950 shadow-[0_6px_20px_rgba(234,179,8,0.35)] border border-amber-300/60 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 hover:from-amber-200 hover:to-amber-500 active:scale-95 transition-all cursor-pointer"
          >
            <span className="text-xl md:text-2xl mb-1">🎯</span>
            <span>العب Trickshots</span>
          </button>

          <button
            onClick={() => onOpenModal("stake_select")}
            className="relative flex flex-col items-center justify-center py-3.5 px-2 rounded-2xl font-black text-xs md:text-sm text-white shadow-[0_6px_20px_rgba(37,99,235,0.35)] border border-blue-400/50 bg-gradient-to-b from-blue-500 via-blue-600 to-blue-800 hover:from-blue-400 hover:to-blue-700 active:scale-95 transition-all cursor-pointer"
          >
            <span className="text-xl md:text-2xl mb-1">👥</span>
            <span>اختيار الطاولة</span>
          </button>
        </div>

        {/* Friends Quick Challenge List */}
        <div className="w-full bg-slate-950/80 rounded-2xl border border-slate-800 p-3.5 shadow-xl">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="text-xs font-black text-slate-200">مباريات التحدي السريعة:</span>
            <span className="text-[10px] text-emerald-400 font-bold">جاهز للعب 🟢</span>
          </div>

          <div className="space-y-2">
            {[
              { name: "Hamada", avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=HamadaPool", stake: 250 },
              { name: "Mahamed", avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=MohamedPool", stake: 500 },
              { name: "أحمد_البرنس", avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=AhmedEG", stake: 1000 },
            ].map((friend, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-900/90 border border-slate-800/80"
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={friend.avatar}
                    alt={friend.name}
                    loading="lazy"
                    className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 object-cover"
                  />
                  <div>
                    <div className="text-xs font-black text-white">{friend.name}</div>
                    <div className="text-[10px] text-slate-400">رهان {friend.stake} 🪙</div>
                  </div>
                </div>
                <button
                  onClick={() => onStartMatch("8-ball", false, friend.stake)}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-white font-black text-xs cursor-pointer shadow active:scale-95"
                >
                  العب
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <footer className="relative z-10 flex items-center justify-around px-4 py-2 bg-slate-950/95 border-t border-slate-800">
        <button
          onClick={() => onOpenModal("settings")}
          className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-cyan-300 font-bold cursor-pointer"
        >
          <span className="text-xl">⚙️</span>
          <span className="text-[10px]">الإعدادات</span>
        </button>

        <button
          onClick={() => onStartMatch("8-ball", true, 0)}
          className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-amber-300 font-bold cursor-pointer"
        >
          <span className="text-xl">🎯</span>
          <span className="text-[10px]">تدريب</span>
        </button>

        <button
          onClick={() => onOpenModal("tournaments")}
          className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-amber-300 font-bold cursor-pointer"
        >
          <span className="text-xl">🏆</span>
          <span className="text-[10px]">البطولات</span>
        </button>

        <button
          onClick={() => onOpenModal("shop", "cues")}
          className="relative flex flex-col items-center gap-0.5 text-amber-400 font-bold cursor-pointer"
        >
          <span className="text-xl">🛒</span>
          <span className="text-[10px]">المتجر</span>
          <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
        </button>
      </footer>
    </div>
  );
}
