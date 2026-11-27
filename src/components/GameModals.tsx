"use client";

import { CueItem, TableItem } from "@/config/shopData";
import { ActiveModalType, GameMode } from "@/types/billiards";

interface GameModalsProps {
  activeModal: ActiveModalType;
  gameOver: string | null;
  username: string;
  coins: number;
  soundEnabled: boolean;
  aimAssistLong: boolean;
  slowMoEnabled?: boolean;
  currentTable: TableItem;
  activeCue: CueItem;
  mode: GameMode;
  isPractice: boolean;
  stake: number;
  onToggleSound: () => void;
  onToggleAimAssist: () => void;
  onToggleSlowMo?: () => void;
  onOpenShop: () => void;
  onCloseModal: () => void;
  onStartMatch: (mode: GameMode, practice: boolean, stake: number) => void;
  onRestartMatch: () => void;
  onExitToMenu: () => void;
}

export function GameModals({
  activeModal,
  gameOver,
  username,
  coins,
  soundEnabled,
  aimAssistLong,
  slowMoEnabled = true,
  currentTable,
  activeCue,
  mode,
  isPractice,
  stake,
  onToggleSound,
  onToggleAimAssist,
  onToggleSlowMo,
  onOpenShop,
  onCloseModal,
  onStartMatch,
  onRestartMatch,
  onExitToMenu,
}: GameModalsProps) {
  return (
    <>
      {activeModal === "settings" && (
        <div className="w-full h-full flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="bg-[#0b121e] border border-slate-700 rounded-3xl p-6 w-full max-w-sm relative shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">⚙️ الإعدادات (Settings)</h3>
              <button onClick={onCloseModal} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="space-y-4 text-xs font-bold">
              <div className="flex items-center justify-between">
                <span>المؤثرات الصوتية:</span>
                <button
                  onClick={onToggleSound}
                  className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer ${soundEnabled ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"}`}
                >
                  {soundEnabled ? "مفعل 🔊" : "مكتوم 🔇"}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span>خط التوجيه المساعد:</span>
                <button
                  onClick={onToggleAimAssist}
                  className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer ${aimAssistLong ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"}`}
                >
                  {aimAssistLong ? "متقدم (طويل)" : "قياسي"}
                </button>
              </div>

              {onToggleSlowMo && (
                <div className="flex items-center justify-between">
                  <span>التصوير البطيء (Slow Motion):</span>
                  <button
                    onClick={onToggleSlowMo}
                    className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer ${slowMoEnabled ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-400"}`}
                  >
                    {slowMoEnabled ? "مفعل 🎬" : "مغلق"}
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span>الطاولة الحالية:</span>
                <span className="text-amber-400 font-bold">{currentTable.nameAr}</span>
              </div>

              <div className="flex items-center justify-between">
                <span>العصا الحالية:</span>
                <span className="text-cyan-400 font-bold">{activeCue.nameAr}</span>
              </div>
            </div>

            <button
              onClick={onOpenShop}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer shadow"
            >
              فتح المتجر لتعديل العصا والطاولة 🛒
            </button>
          </div>
        </div>
      )}

      {activeModal === "tournaments" && (
        <div className="w-full h-full flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="bg-[#0b121e] border border-amber-500/40 rounded-3xl p-6 w-full max-w-md relative shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-amber-300 flex items-center gap-2">
                <span>🏆</span> بطولات كيو ماستر الكبرى
              </h3>
              <button onClick={onCloseModal} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              {[
                { name: "بطولة القاهرة المفتوحة", entry: 500, prize: 950, players: "8 لاعبين", icon: "🇪🇬" },
                { name: "كأس دبي للمحترفين", entry: 2500, prize: 4750, players: "16 لاعب", icon: "🇦🇪" },
                { name: "ماسترز لندن العالمية", entry: 10000, prize: 19000, players: "32 لاعب", icon: "🇬🇧" },
              ].map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{t.icon}</span>
                    <div>
                      <div className="text-xs font-black text-white">{t.name}</div>
                      <div className="text-[10px] text-slate-400">الجائزة: {t.prize.toLocaleString()} 🪙 | {t.players}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onCloseModal();
                      onStartMatch(mode, false, t.entry);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer shadow"
                  >
                    دخول {t.entry} 🪙
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeModal === "leaderboard" && (
        <div className="w-full h-full flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="bg-[#0b121e] border border-slate-700 rounded-3xl p-6 w-full max-w-sm relative shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>🏆</span> قائمة المتصدرين
              </h3>
              <button onClick={onCloseModal} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="space-y-2">
              {[
                { rank: "🥇 1", name: "الكابتن_ماجد", coins: "2,450,000", flag: "🇪🇬" },
                { rank: "🥈 2", name: "البرنس_السعودي", coins: "1,890,000", flag: "🇸🇦" },
                { rank: "🥉 3", name: "صقر_الخليج", coins: "1,220,000", flag: "🇦🇪" },
                { rank: "4", name: username, coins: coins.toLocaleString(), flag: "⭐" },
              ].map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-400">{p.rank}</span>
                    <span className="font-black text-white">{p.name}</span>
                    <span>{p.flag}</span>
                  </div>
                  <span className="font-mono text-amber-300 font-bold">{p.coins} 🪙</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="w-full h-full flex items-center justify-center bg-black/85 p-4">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 w-full max-w-md text-center shadow-2xl space-y-4">
            <div className="text-4xl">{gameOver.includes("مبروك") || gameOver.includes("فزت") ? "🏆" : "❌"}</div>
            <h3 className="text-xl font-black text-amber-300">نهاية المباراة!</h3>
            <p className="text-sm font-bold text-slate-200 leading-relaxed">{gameOver}</p>
            {!isPractice && stake > 0 && (
              <div className="text-xs font-bold text-amber-400">
                الرصيد الحالي: {coins.toLocaleString()} 🪙
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={onRestartMatch}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs cursor-pointer shadow-lg active:scale-95"
              >
                مباراة جديدة 🔄
              </button>
              <button
                onClick={onExitToMenu}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-xs cursor-pointer active:scale-95"
              >
                القائمة الرئيسية 🏠
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
