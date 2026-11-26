"use client";

import { useState } from "react";
import { ALL_CUES, ALL_TABLES, CueItem, TableItem } from "@/config/shopData";

interface ShopModalProps {
  coins: number;
  shopTab: "cues" | "tables";
  setShopTab: (tab: "cues" | "tables") => void;
  cueCategoryFilter: "all" | "classic" | "legendary";
  setCueCategoryFilter: (filter: "all" | "classic" | "legendary") => void;
  selectedCue: string;
  selectedTable: string;
  unlockedCues: string[];
  unlockedTables: string[];
  activeCue: CueItem;
  onEquipCue: (cueId: string) => void;
  onBuyCue: (cue: CueItem) => void;
  onEquipTable: (tableId: string) => void;
  onBuyTable: (tbl: TableItem) => void;
  onClose: () => void;
}

export function ShopModal({
  coins,
  shopTab,
  setShopTab,
  cueCategoryFilter,
  setCueCategoryFilter,
  selectedCue,
  selectedTable,
  unlockedCues,
  unlockedTables,
  activeCue,
  onEquipCue,
  onBuyCue,
  onEquipTable,
  onBuyTable,
  onClose,
}: ShopModalProps) {
  const [previewCue, setPreviewCue] = useState<CueItem | null>(null);
  const [previewTable, setPreviewTable] = useState<TableItem | null>(null);
  const [previewTableAngle, setPreviewTableAngle] = useState<"side" | "top">("side");

  return (
    <div className="w-full h-full flex items-center justify-center bg-black/85 p-2 sm:p-5 overflow-hidden">
      <div className="bg-[#0b121e] border-2 border-amber-500/50 rounded-3xl w-full max-w-4xl max-h-full flex flex-col shadow-2xl relative overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛒</span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-amber-300">متجر كيو ماستر</h3>
              <p className="text-[11px] text-slate-400">اختر وجهز أفضل العصي والطاولات الحصرية</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1 rounded-xl border border-amber-500/40 text-amber-400 font-black text-xs sm:text-sm">
              <span>🪙</span>
              <span>{coins.toLocaleString()}</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-black cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Shop Section Tabs */}
        <div className="flex items-center gap-2 px-4 sm:px-6 pt-2.5 pb-2 border-b border-slate-800/80 bg-slate-900/50">
          <button
            onClick={() => setShopTab("cues")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              shopTab === "cues"
                ? "bg-amber-400 text-slate-950 shadow-md"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <span>🎱</span>
            <span>عصيان البلياردو ({ALL_CUES.length})</span>
          </button>
          <button
            onClick={() => setShopTab("tables")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              shopTab === "tables"
                ? "bg-amber-400 text-slate-950 shadow-md"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <span>🟩</span>
            <span>طاولات اللعب ({ALL_TABLES.length})</span>
          </button>
        </div>

        {/* TAB CONTENT */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          {shopTab === "cues" ? (
            <>
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <button
                  onClick={() => setCueCategoryFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    cueCategoryFilter === "all" ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  الكل (20)
                </button>
                <button
                  onClick={() => setCueCategoryFilter("classic")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    cueCategoryFilter === "classic" ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  🌟 الكلاسيكية (10)
                </button>
                <button
                  onClick={() => setCueCategoryFilter("legendary")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    cueCategoryFilter === "legendary" ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  ⚡ الأسطورية (10)
                </button>
              </div>

              <div className="w-full bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/40 border-2 border-amber-400/60 rounded-2xl p-3 sm:p-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black">
                      المجهزة حالياً ⚡
                    </span>
                    <h4 className="text-xs sm:text-sm font-black text-amber-300">{activeCue.nameAr}</h4>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                    {activeCue.specialPerkAr}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewCue(activeCue)}
                  className="group relative w-full h-12 bg-slate-950/90 hover:bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-slate-800 hover:border-amber-400/60 cursor-zoom-in transition-colors"
                  title="اضغط لتكبير صورة العصا"
                >
                  <img src={activeCue.image} alt={activeCue.nameAr} className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] opacity-60 group-hover:opacity-100">🔍</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {ALL_CUES.filter((c) => cueCategoryFilter === "all" || c.category === cueCategoryFilter).map((cue) => {
                  const isEquipped = selectedCue === cue.id;
                  const isUnlocked = unlockedCues.includes(cue.id);

                  return (
                    <div
                      key={cue.id}
                      className={`relative flex flex-col justify-between p-3.5 rounded-2xl border transition-all ${
                        isEquipped
                          ? "bg-amber-500/10 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.25)]"
                          : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setPreviewCue(cue)}
                        className="group relative w-full h-12 bg-slate-900/90 hover:bg-slate-800/90 rounded-xl overflow-hidden flex items-center justify-center px-2 py-1 border border-slate-800 hover:border-amber-400/60 mb-2.5 cursor-zoom-in transition-colors"
                        title="اضغط لعرض صورة العصا بحجم كبير"
                      >
                        <img
                          src={cue.image}
                          alt={cue.nameAr}
                          loading="lazy"
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] opacity-0 group-hover:opacity-90 transition-opacity">🔍</span>
                      </button>

                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="text-xs sm:text-sm font-black text-white">{cue.nameAr}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{cue.nameEn}</div>
                        </div>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            cue.category === "legendary"
                              ? "bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-500/50"
                              : "bg-amber-950 text-amber-300 border border-amber-500/50"
                          }`}
                        >
                          {cue.category === "legendary" ? "⚡ أسطورية" : "🌟 احترافية"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 my-1.5 text-[10px]">
                        <div>
                          <div className="flex justify-between text-slate-400 mb-0.5">
                            <span>💥 القوة:</span>
                            <span className="font-bold text-amber-400">{cue.stats.force}/10</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full" style={{ width: `${(cue.stats.force / 10) * 100}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-slate-400 mb-0.5">
                            <span>🎯 التوجيه:</span>
                            <span className="font-bold text-cyan-400">{cue.stats.aim}/10</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: `${(cue.stats.aim / 10) * 100}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-slate-400 mb-0.5">
                            <span>🌀 الدوران:</span>
                            <span className="font-bold text-purple-400">{cue.stats.spin}/10</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-400 rounded-full" style={{ width: `${(cue.stats.spin / 10) * 100}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-slate-400 mb-0.5">
                            <span>⏱️ الوقت:</span>
                            <span className="font-bold text-emerald-400">{cue.stats.time}ث</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full" style={{ width: `${(cue.stats.time / 50) * 100}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] text-amber-200/90 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 mb-2.5">
                        {cue.specialPerkAr}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="text-xs font-black text-amber-400">
                          {cue.price === 0 ? "مجانية" : `${cue.price.toLocaleString()} 🪙`}
                        </div>
                        <button
                          onClick={() => (isUnlocked ? onEquipCue(cue.id) : onBuyCue(cue))}
                          className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow ${
                            isEquipped
                              ? "bg-emerald-500 text-slate-950 font-bold"
                              : isUnlocked
                              ? "bg-amber-400 hover:bg-amber-300 text-slate-950"
                              : coins >= cue.price
                              ? "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white"
                              : "bg-slate-800 text-slate-500 cursor-not-allowed"
                          }`}
                        >
                          {isEquipped ? "✅ مجهزة حالياً" : isUnlocked ? "تجهيز العصا" : "شراء 🪙"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {ALL_TABLES.map((table) => {
                const isEquipped = selectedTable === table.id;
                const isUnlocked = unlockedTables.includes(table.id);

                return (
                  <div
                    key={table.id}
                    className={`relative flex flex-col justify-between p-3.5 rounded-2xl border transition-all ${
                      isEquipped
                        ? "bg-amber-500/10 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.25)]"
                        : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewTableAngle(table.sideImage ? "side" : "top");
                        setPreviewTable(table);
                      }}
                      className="group w-full h-28 rounded-xl overflow-hidden border border-slate-800 hover:border-amber-400/70 relative bg-slate-900 mb-2.5 cursor-zoom-in transition-colors block"
                      title="اضغط لمعاينة شكل الطاولة بالكامل"
                    >
                      {table.image ? (
                        <img src={table.image} alt={table.nameAr} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#15803d]">
                          <span className="text-white font-black text-sm drop-shadow">طاولة البطولة الخضراء</span>
                        </div>
                      )}
                      <div
                        className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-black border"
                        style={{ backgroundColor: "rgba(0,0,0,0.75)", color: table.cushionGlow, borderColor: table.cushionGlow }}
                      >
                        {table.cushionGlow}
                      </div>
                      <span className="absolute top-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full border border-white/20 opacity-80 group-hover:opacity-100">
                        🔍 معاينة
                      </span>
                    </button>

                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs sm:text-sm font-black text-white">{table.nameAr}</h4>
                      <span className="text-xs font-black text-amber-400">
                        {table.price === 0 ? "مجانية" : `${table.price.toLocaleString()} 🪙`}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 mb-2">{table.descriptionAr}</p>

                    <div className="grid grid-cols-3 gap-1.5 text-[9px] text-slate-300 bg-slate-900/80 px-2 py-1.5 rounded-lg border border-slate-800 mb-2.5 text-center">
                      <div>
                        <span className="text-slate-400 block">المستوى</span>
                        <span className="font-bold text-cyan-300">{table.tierLabelAr}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">الارتداد والجوخ</span>
                        <span className="font-bold text-amber-300">
                          {Math.round(table.cushionRestitution * 100)}% • {table.tier === "pro" ? "5 أطوال" : table.tier === "intermediate" ? "4.5 أطوال" : "4 أطوال"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">استجابة الإسبين</span>
                        <span className="font-bold text-emerald-300">{Math.round(table.spinGrip * 100)}%</span>
                      </div>
                    </div>

                    <button
                      onClick={() => (isUnlocked ? onEquipTable(table.id) : onBuyTable(table))}
                      className={`w-full py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow ${
                        isEquipped
                          ? "bg-emerald-500 text-slate-950 font-bold"
                          : isUnlocked
                          ? "bg-amber-400 hover:bg-amber-300 text-slate-950"
                          : coins >= table.price
                          ? "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed"
                      }`}
                    >
                      {isEquipped ? "✅ الطاولة المجهزة حالياً" : isUnlocked ? "تجهيز هذه الطاولة" : `شراء الطاولة 🪙 ${table.price.toLocaleString()}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cue Image Lightbox Popup */}
      {previewCue && (
        <div
          onClick={() => setPreviewCue(null)}
          className="fixed inset-0 z-[90] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0b121e] border-2 border-amber-400/70 rounded-3xl w-full max-w-xl p-5 shadow-2xl space-y-4"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-base sm:text-lg font-black text-amber-300">{previewCue.nameAr}</h4>
                <p className="text-xs text-slate-400 font-mono">{previewCue.nameEn}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCue(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div
              className="w-full h-40 sm:h-52 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-slate-700 flex items-center justify-center p-4 overflow-hidden"
              style={{ boxShadow: `inset 0 0 40px ${previewCue.glowColor}25` }}
            >
              <img
                src={previewCue.image}
                alt={previewCue.nameAr}
                className="w-full h-full object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.85)]"
              />
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{previewCue.descriptionAr}</p>

            <div className="text-xs text-amber-200 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/30 font-bold">
              ✨ {previewCue.specialPerkAr}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-black text-amber-400">
                {previewCue.price === 0 ? "مجانية" : `${previewCue.price.toLocaleString()} 🪙`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewCue(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black cursor-pointer"
                >
                  إغلاق
                </button>
                {(() => {
                  const isEq = selectedCue === previewCue.id;
                  const isUnl = unlockedCues.includes(previewCue.id);
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (isUnl) onEquipCue(previewCue.id);
                        else onBuyCue(previewCue);
                        setPreviewCue(null);
                      }}
                      disabled={!isUnl && coins < previewCue.price}
                      className={`px-5 py-2 rounded-xl text-xs font-black cursor-pointer ${
                        isEq
                          ? "bg-emerald-500 text-slate-950"
                          : isUnl
                          ? "bg-amber-400 hover:bg-amber-300 text-slate-950"
                          : coins >= previewCue.price
                          ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed"
                      }`}
                    >
                      {isEq ? "✅ مجهزة حالياً" : isUnl ? "تجهيز العصا" : "شراء 🪙"}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Table Image Lightbox Popup */}
      {previewTable && (
        <div
          onClick={() => setPreviewTable(null)}
          className="fixed inset-0 z-[90] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0b121e] border-2 border-amber-400/70 rounded-3xl w-full max-w-2xl p-4 sm:p-5 shadow-2xl space-y-3.5"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-base sm:text-lg font-black text-amber-300">{previewTable.nameAr}</h4>
                <p className="text-xs text-slate-400 font-mono">{previewTable.nameEn}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTable(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            {previewTable.sideImage && (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTableAngle("side")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                    previewTableAngle === "side"
                      ? "bg-amber-400 text-slate-950 shadow"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  🎥 منظور جانبي مجسّم (3D)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTableAngle("top")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                    previewTableAngle === "top"
                      ? "bg-amber-400 text-slate-950 shadow"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  🎱 منظور اللعب العلوي
                </button>
              </div>
            )}

            <div
              className="w-full h-56 sm:h-72 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center p-2 overflow-hidden relative"
              style={{ boxShadow: `inset 0 0 45px ${previewTable.cushionGlow}25` }}
            >
              <img
                src={
                  previewTableAngle === "side" && previewTable.sideImage
                    ? previewTable.sideImage
                    : previewTable.image || previewTable.sideImage
                }
                alt={previewTable.nameAr}
                className="w-full h-full object-contain rounded-xl drop-shadow-[0_10px_25px_rgba(0,0,0,0.85)]"
              />
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{previewTable.descriptionAr}</p>

            <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-200 bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-800 text-center">
              <div>
                <span className="text-slate-400 block">المستوى</span>
                <span className="font-black text-cyan-300">{previewTable.tierLabelAr}</span>
              </div>
              <div>
                <span className="text-slate-400 block">الارتداد والجوخ</span>
                <span className="font-black text-amber-300">
                  {Math.round(previewTable.cushionRestitution * 100)}% •{" "}
                  {previewTable.tier === "pro" ? "5 أطوال" : previewTable.tier === "intermediate" ? "4.5 أطوال" : "4 أطوال"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">استجابة الإسبين</span>
                <span className="font-black text-emerald-300">{Math.round(previewTable.spinGrip * 100)}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-black text-amber-400">
                {previewTable.price === 0 ? "مجانية" : `${previewTable.price.toLocaleString()} 🪙`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTable(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black cursor-pointer"
                >
                  إغلاق
                </button>
                {(() => {
                  const isEq = selectedTable === previewTable.id;
                  const isUnl = unlockedTables.includes(previewTable.id);
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (isUnl) onEquipTable(previewTable.id);
                        else onBuyTable(previewTable);
                        setPreviewTable(null);
                      }}
                      disabled={!isUnl && coins < previewTable.price}
                      className={`px-5 py-2 rounded-xl text-xs font-black cursor-pointer ${
                        isEq
                          ? "bg-emerald-500 text-slate-950"
                          : isUnl
                          ? "bg-amber-400 hover:bg-amber-300 text-slate-950"
                          : coins >= previewTable.price
                          ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed"
                      }`}
                    >
                      {isEq ? "✅ الطاولة المجهزة حالياً" : isUnl ? "تجهيز الطاولة" : "شراء 🪙"}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
