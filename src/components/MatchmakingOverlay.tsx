"use client";

import { useEffect, useRef, useState } from "react";
import { GameMode } from "@/types/billiards";
import { playBallClack, playSuccessChime } from "@/utils/audio";

export interface MatchedOpponentInfo {
  name: string;
  flag: string;
  avatar: string;
  wins: number;
}

const MATCHMAKING_OPPONENTS: MatchedOpponentInfo[] = [
  {
    name: "Shadow_Striker_Q8",
    flag: "🇰🇼",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=ShadowKW",
    wins: 62,
  },
  {
    name: "سلطان_الرياض_VIP",
    flag: "🇸🇦",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=SultanKSA",
    wins: 112,
  },
  {
    name: "صقر_دبي_99",
    flag: "🇦🇪",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=SaqrUAE",
    wins: 140,
  },
  {
    name: "أحمد_البرنس",
    flag: "🇪🇬",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=AhmedEG",
    wins: 84,
  },
  {
    name: "Capo_Alexandria",
    flag: "🇪🇬",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=CapoAlex",
    wins: 45,
  },
  {
    name: "نور_الهدى_العربي",
    flag: "🇲🇦",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=NourMA",
    wins: 38,
  },
  {
    name: "جوكر_القاهرة",
    flag: "🇪🇬",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=JokerCairo",
    wins: 53,
  },
  {
    name: "اسد_الأطلس_Pro",
    flag: "🇲🇦",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=AtlasLion",
    wins: 125,
  },
];

interface MatchmakingOverlayProps {
  username: string;
  avatar: string;
  mode: GameMode;
  stake: number;
  prize: number;
  soundEnabled: boolean;
  onCancel: () => void;
  onMatched: (opponent: MatchedOpponentInfo) => void;
}

export function MatchmakingOverlay({
  username,
  avatar,
  mode,
  stake,
  prize,
  soundEnabled,
  onCancel,
  onMatched,
}: MatchmakingOverlayProps) {
  const [matchedOpponent, setMatchedOpponent] = useState<MatchedOpponentInfo | null>(null);
  const [countdown, setCountdown] = useState<number>(2);
  const onMatchedRef = useRef(onMatched);
  const soundEnabledRef = useRef(soundEnabled);
  onMatchedRef.current = onMatched;
  soundEnabledRef.current = soundEnabled;

  useEffect(() => {
    let cancelled = false;
    let countdownTimer: ReturnType<typeof setInterval> | null = null;

    const searchTimer = setTimeout(() => {
      if (cancelled) return;
      const picked =
        MATCHMAKING_OPPONENTS[Math.floor(Math.random() * MATCHMAKING_OPPONENTS.length)];
      setMatchedOpponent(picked);
      setCountdown(2);
      if (soundEnabledRef.current) playSuccessChime();

      let rem = 2;
      countdownTimer = setInterval(() => {
        if (cancelled) return;
        rem -= 1;
        if (rem > 0) {
          setCountdown(rem);
          if (soundEnabledRef.current) playBallClack(3);
        } else {
          if (countdownTimer) clearInterval(countdownTimer);
          onMatchedRef.current(picked);
        }
      }, 900);
    }, 2200);

    return () => {
      cancelled = true;
      clearTimeout(searchTimer);
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, []);

  const isSnooker = mode === "snooker";

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-[#050a14]/95 backdrop-blur-md flex flex-col items-center justify-center p-4"
    >
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center space-y-6">
        {!matchedOpponent ? (
          <>
            <div className="relative w-28 h-28 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-400 animate-spin" />
              <div className="absolute w-20 h-20 rounded-full border-2 border-emerald-400/40 animate-ping" />
              <span className="text-4xl animate-bounce">{isSnooker ? "🔴" : "🎱"}</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-black text-white">
                جاري البحث عن منافس متكافئ...
              </h2>
              <p className="text-xs font-bold text-slate-400">
                {isSnooker ? "سنوكر إنجليزي 🔴" : "بلياردو 8-Ball 🎱"} • الرهان:{" "}
                <span className="text-amber-400">{stake.toLocaleString()} 🪙</span> • الجائزة:{" "}
                <span className="text-emerald-400">{prize.toLocaleString()} 🪙</span>
              </p>
            </div>

            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black cursor-pointer active:scale-95"
            >
              إلغاء البحث ✕
            </button>
          </>
        ) : (
          <>
            <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-4 py-1.5 rounded-full shadow">
              تم العثور على منافس! 🎯
            </span>

            <div className="flex items-center justify-center gap-6 sm:gap-12 w-full py-2">
              {/* Matched Opponent */}
              <div className="flex flex-col items-center space-y-2">
                <img
                  src={matchedOpponent.avatar}
                  alt={matchedOpponent.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.45)] bg-slate-800 object-cover"
                />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-black text-white">
                    {matchedOpponent.name}
                  </span>
                  <span className="text-sm">{matchedOpponent.flag}</span>
                </div>
                <span className="text-[11px] font-bold text-slate-400">
                  فوز: {matchedOpponent.wins}
                </span>
              </div>

              {/* VS Badge */}
              <div className="flex flex-col items-center">
                <span className="text-3xl sm:text-4xl font-black text-rose-500 drop-shadow-[0_0_12px_rgba(244,63,94,0.65)]">
                  VS
                </span>
                <span className="text-lg font-black text-amber-400 mt-1">{countdown}</span>
              </div>

              {/* Human Player */}
              <div className="flex flex-col items-center space-y-2">
                <img
                  src={avatar}
                  alt={username}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.45)] bg-slate-800 object-cover"
                />
                <span className="text-xs sm:text-sm font-black text-white">{username}</span>
                <span className="text-[11px] font-bold text-slate-400">فوز: 4</span>
              </div>
            </div>

            <p className="text-xs font-bold text-slate-400">
              تم تجهيز الخصم — تبدأ المواجهة خلال ثوانٍ معدودة...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
