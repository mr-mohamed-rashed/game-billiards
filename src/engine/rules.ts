import {
  Ball,
  BallGroup,
  DEFAULT_TABLE_GEOMETRY,
  GameMode,
  ONE_FIFTEEN_POCKET_1,
  ONE_FIFTEEN_POCKET_15,
  SNOOKER_COLOR_META,
  TableGeometry,
  getBreakLineX,
  getSnookerTargetInfo,
} from "@/types/billiards";
import { findFreeCueBallPos, placeCueBallSafely, respotBall } from "@/engine/physics";
import { playFoulBuzzer } from "@/utils/audio";

export interface ShotOutcomeContext {
  mode: GameMode;
  isPractice: boolean;
  soundEnabled: boolean;
  wasBreakShot?: boolean;
  tableGeom?: TableGeometry;
  balls: Ball[];
  pottedList: { ball: Ball; pocketId: number }[];
  cueScratched: boolean;
  firstHit: Ball | null;
  activeShooter: "human" | "bot";
  targetPocketForThisShot: number | null;
  humanGroup: BallGroup;
  botGroup: BallGroup;
  snookerOnColorAfterRed?: boolean;
  humanScore?: number;
  botScore?: number;
  onSnookerUpdate?: (update: {
    humanScore: number;
    botScore: number;
    onColorAfterRed: boolean;
  }) => void;
  onGameOver: (winner: "human" | "bot", message: string) => void;
  onAssignGroups: (
    humanGrp: BallGroup,
    botGrp: BallGroup,
    announcement: { title: string; human: string; bot: string }
  ) => void;
  onTurnChange: (nextTurn: "human" | "bot") => void;
  onBallInHand: (hoverPos: { x: number; y: number } | null) => void;
  onMessage: (msg: string) => void;
}

export function resolveShotOutcome(ctx: ShotOutcomeContext) {
  const {
    mode,
    isPractice,
    soundEnabled,
    wasBreakShot = false,
    tableGeom = DEFAULT_TABLE_GEOMETRY,
    balls,
    pottedList,
    cueScratched,
    firstHit,
    activeShooter,
    targetPocketForThisShot,
    humanGroup,
    botGroup,
    onGameOver,
    onAssignGroups,
    onTurnChange,
    onBallInHand,
    onMessage,
  } = ctx;

  if (mode === "8-ball" || mode === "one-fifteen") {
    const isOneFifteen = mode === "one-fifteen";
    const baulkLineMaxX = isOneFifteen ? getBreakLineX("one-fifteen", tableGeom) : undefined;
    const shooterGroup = activeShooter === "human" ? humanGroup : botGroup;
    const remainingTargetBalls = balls.filter(
      (b) =>
        !b.isPotted &&
        b.number !== 8 &&
        (shooterGroup === "solids" ? b.type === "solid" : b.type === "stripe")
    );

    // 1. Check 8-Ball Potting (Break win if potted cleanly on the first break shot!)
    const black8Entry = pottedList.find((item) => item.ball.number === 8);
    if (black8Entry) {
      if (cueScratched) {
        onGameOver(
          activeShooter === "human" ? "bot" : "human",
          activeShooter === "human"
            ? "❌ خسرت المباراة! أسقطت الكرة البيضاء مع الكرة السوداء رقم 8."
            : "🎉 مبروك الفوز! الخصم أسقط الكرة البيضاء مع الكرة السوداء 8."
        );
        return;
      }
      if (wasBreakShot) {
        onGameOver(
          activeShooter,
          activeShooter === "human"
            ? "🏆 ضربة كسرة أسطورية! أسقطت الكرة السوداء 8 من الكسرة الأولى — مبروك الفوز!"
            : "🤖 الخصم أسقط الكرة السوداء 8 من الكسرة الأولى وفاز بالمباراة!"
        );
        return;
      }
      if (remainingTargetBalls.length > 0 || shooterGroup === "unassigned") {
        onGameOver(
          activeShooter === "human" ? "bot" : "human",
          activeShooter === "human"
            ? "❌ خسرت المباراة! أسقطت الكرة 8 قبل تصفية كراتك."
            : "🎉 مبروك الفوز! الخصم أسقط الكرة 8 قبل تصفية كراته."
        );
        return;
      }
      if (
        (isOneFifteen && targetPocketForThisShot === null) ||
        (targetPocketForThisShot !== null && black8Entry.pocketId !== targetPocketForThisShot)
      ) {
        onGameOver(
          activeShooter === "human" ? "bot" : "human",
          activeShooter === "human"
            ? "❌ خسرت المباراة! الكرة السوداء 8 سقطت في جيب غير الجيب المحدد."
            : "🎉 مبروك الفوز! الخصم أسقط الكرة 8 في جيب غير المحدد."
        );
        return;
      }
      onGameOver(
        activeShooter,
        activeShooter === "human"
          ? "🏆 مبروك الفوز الساحق! أحرزت الكرة السوداء 8 في الجيب المحدد!"
          : "خسرت المباراة! الخصم أحرز الكرة السوداء رقم 8."
      );
      return;
    }

    // 2. Check Foul Rules
    let foulOccurred = false;
    let foulReason = "";

    if (cueScratched) {
      foulOccurred = true;
      foulReason = "سقوط الكرة البيضاء (Scratch)";
    } else if (!firstHit) {
      foulOccurred = true;
      foulReason = "الكرة البيضاء لم تلمس أي كرة";
    } else if (shooterGroup === "unassigned" && firstHit.number === 8) {
      foulOccurred = true;
      foulReason = "لا يجوز لمس الكرة 8 أولاً";
    } else if (shooterGroup !== "unassigned") {
      const expectedType = shooterGroup === "solids" ? "solid" : "stripe";
      const shooterBallsPottedThisShot = pottedList.filter(
        (item) => item.ball.type === expectedType
      ).length;
      const hadGroupBallsBeforeShot = remainingTargetBalls.length + shooterBallsPottedThisShot > 0;

      if (hadGroupBallsBeforeShot) {
        if (firstHit.type !== expectedType) {
          foulOccurred = true;
          foulReason =
            firstHit.number === 8
              ? "لمست الكرة 8 قبل تصفية كراتك"
              : shooterGroup === "solids"
              ? "لمست كرة ألوان وصنفك سادة"
              : "لمست كرة سادة وصنفك ألوان";
        }
      } else if (firstHit.number !== 8) {
        foulOccurred = true;
        foulReason = "أنهيت كراتك، يجب لمس الكرة 8 أولاً";
      }
    }

    if (foulOccurred) {
      if (soundEnabled) playFoulBuzzer();
      if (isOneFifteen) {
        for (const entry of pottedList) {
          if (entry.ball.number !== 8) respotBall(entry.ball, balls, tableGeom);
        }
      }
      if (!isPractice) {
        const nextTurn = activeShooter === "human" ? "bot" : "human";
        if (nextTurn === "human") {
          const freePos = findFreeCueBallPos(balls, tableGeom, baulkLineMaxX);
          onTurnChange("human");
          onBallInHand(freePos);
          onMessage(
            isOneFifteen
              ? `✋ فاول على الخصم (${foulReason}): ضع الكرة البيضاء خلف خط البداية!`
              : `✋ فاول على الخصم (${foulReason}): اسحب الكرة البيضاء وضعها!`
          );
        } else {
          // Ensure cue ball is safely placed on table immediately before Bot shoots
          placeCueBallSafely(balls, tableGeom, baulkLineMaxX);
          onBallInHand(null);
          onTurnChange("bot");
          onMessage(`⚠️ فاول عليك (${foulReason}): دور الخصم.`);
        }
      } else {
        const freePos = findFreeCueBallPos(balls, tableGeom, baulkLineMaxX);
        onBallInHand(freePos);
        onMessage(
          isOneFifteen
            ? `✋ فاول (${foulReason}): ضع الكرة البيضاء خلف خط البداية!`
            : `✋ فاول (${foulReason}): ضع الكرة البيضاء!`
        );
      }
      return;
    }

    // 3. Open Pockets / Called Pocket & Special 1 & 15 Pocket Checks
    let updatedHumanGroup = humanGroup;
    let updatedBotGroup = botGroup;

    const isEntryPocketLegal = (entry: { ball: Ball; pocketId: number }): boolean => {
      if (isOneFifteen) {
        if (entry.ball.number === 1) {
          if (entry.pocketId !== ONE_FIFTEEN_POCKET_1) return false;
          return wasBreakShot || targetPocketForThisShot === ONE_FIFTEEN_POCKET_1;
        }
        if (entry.ball.number === 15) {
          if (entry.pocketId !== ONE_FIFTEEN_POCKET_15) return false;
          return wasBreakShot || targetPocketForThisShot === ONE_FIFTEEN_POCKET_15;
        }
        if (wasBreakShot) return true;
        return targetPocketForThisShot !== null && entry.pocketId === targetPocketForThisShot;
      }
      return targetPocketForThisShot === null || entry.pocketId === targetPocketForThisShot;
    };

    const validPocketEntries = pottedList.filter(isEntryPocketLegal);
    const invalidPocketEntries = pottedList.filter((entry) => !isEntryPocketLegal(entry));

    // In 1 & 15, any uncalled or wrong-pocket potted ball returns to the table!
    if (isOneFifteen && invalidPocketEntries.length > 0) {
      for (const bad of invalidPocketEntries) {
        respotBall(bad.ball, balls, tableGeom);
      }
    }

    const legalPottedBalls = validPocketEntries.map((entry) => entry.ball);
    const pottedInWrongPocket =
      pottedList.length > 0 && invalidPocketEntries.length > 0 && validPocketEntries.length === 0;

    if (humanGroup === "unassigned" && legalPottedBalls.length > 0) {
      const firstLegal = legalPottedBalls.find((b) => b.type === "solid" || b.type === "stripe");
      if (firstLegal) {
        const isSolid = firstLegal.type === "solid";
        if (activeShooter === "human") {
          updatedHumanGroup = isSolid ? "solids" : "stripes";
          updatedBotGroup = isSolid ? "stripes" : "solids";
          onAssignGroups(updatedHumanGroup, updatedBotGroup, {
            title: "🎉 تم تعيين الصنف!",
            human: isSolid ? "سادة 🟡 (1-7)" : "ألوان 🔵 (9-15)",
            bot: isSolid ? "ألوان 🔵 (9-15)" : "سادة 🟡 (1-7)",
          });
        } else {
          updatedBotGroup = isSolid ? "solids" : "stripes";
          updatedHumanGroup = isSolid ? "stripes" : "solids";
          onAssignGroups(updatedHumanGroup, updatedBotGroup, {
            title: "🤖 الخصم عيّن الأصناف!",
            human: isSolid ? "ألوان 🔵 (9-15)" : "سادة 🟡 (1-7)",
            bot: isSolid ? "سادة 🟡 (1-7)" : "ألوان 🔵 (9-15)",
          });
        }
      }
    }

    const currentShooterGroup = activeShooter === "human" ? updatedHumanGroup : updatedBotGroup;
    const pottedOwnBall = legalPottedBalls.some((b) =>
      currentShooterGroup === "unassigned"
        ? b.type === "solid" || b.type === "stripe"
        : currentShooterGroup === "solids"
        ? b.type === "solid"
        : b.type === "stripe"
    );

    const remainingHumanAfter = balls.filter(
      (b) =>
        !b.isPotted &&
        b.number !== 8 &&
        updatedHumanGroup !== "unassigned" &&
        (updatedHumanGroup === "solids" ? b.type === "solid" : b.type === "stripe")
    );

    if (pottedOwnBall) {
      if (
        activeShooter === "human" &&
        remainingHumanAfter.length === 0 &&
        updatedHumanGroup !== "unassigned"
      ) {
        onMessage("🏆 أنهيت كراتك! حدد الجيب بالضغط عليه لإسقاط الكرة 8!");
      } else if (activeShooter === "bot") {
        const remainingBotAfter = balls.filter(
          (b) =>
            !b.isPotted &&
            b.number !== 8 &&
            (updatedBotGroup === "solids" ? b.type === "solid" : b.type === "stripe")
        );
        onMessage(
          remainingBotAfter.length === 0
            ? "⚠️ الخصم أنهى كراته ويلعب على الكرة 8!"
            : "🤖 ضربة ناجحة للخصم، دوره مستمر..."
        );
      } else {
        onMessage("🔥 ضربة ناجحة! دورك مستمر.");
      }
    } else if (!isPractice) {
      const nextT = activeShooter === "human" ? "bot" : "human";
      onTurnChange(nextT);
      if (pottedInWrongPocket) {
        if (isOneFifteen) {
          onMessage(
            nextT === "human"
              ? "🎯 الخصم أخطأ الجيب! خرجت الكرة ودورك الآن."
              : "🎯 لم تحدد الجيب الصحيح! خرجت الكرة وانتقل الدور للخصم."
          );
        } else {
          onMessage(
            nextT === "human"
              ? "🎯 الخصم أخطأ الجيب المحدد! دورك الآن."
              : "🎯 الكرة سقطت في جيب غير الجيب المحدد! دور الخصم."
          );
        }
      } else if (nextT === "human") {
        onMessage(
          remainingHumanAfter.length === 0 && updatedHumanGroup !== "unassigned"
            ? "🏆 دورك على الكرة 8! اضغط على الجيب الهدف أولاً."
            : "دورك الآن!"
        );
      } else {
        onMessage("دور الخصم الآن...");
      }
    } else if (pottedInWrongPocket) {
      onMessage(
        isOneFifteen
          ? "🎯 لم تحدد الجيب الصحيح! خرجت الكرة للطاولة."
          : "🎯 الكرة سقطت في جيب غير الجيب المحدد!"
      );
    }
  } else {
    // Snooker mode
    const prevHumanScore = ctx.humanScore ?? 0;
    const prevBotScore = ctx.botScore ?? 0;
    const prevOnColorAfterRed = ctx.snookerOnColorAfterRed ?? false;
    const baulkMaxX = getBreakLineX("snooker", tableGeom);

    const pottedReds = pottedList.filter((item) => item.ball.type === "red");
    const pottedColors = pottedList.filter((item) => item.ball.type === "color");
    const redsRemainingAfter = balls.filter((b) => !b.isPotted && b.type === "red").length;
    const redsBeforeShot = redsRemainingAfter + pottedReds.length;

    const colorsBeforeShot = [
      ...balls.filter((b) => !b.isPotted && b.type === "color"),
      ...pottedColors.map((p) => p.ball),
    ];
    const lowestColorValBeforeShot =
      colorsBeforeShot.length > 0
        ? Math.min(...colorsBeforeShot.map((c) => c.value || 7))
        : 7;

    const wasOnColorFreeChoice = prevOnColorAfterRed;
    const wasOnRed = !wasOnColorFreeChoice && redsBeforeShot > 0;
    const wasOnClearance = !wasOnColorFreeChoice && redsBeforeShot === 0;
    const expectedClearanceVal = wasOnClearance ? lowestColorValBeforeShot : null;

    let foulOccurred = false;
    let foulReason = "";

    if (cueScratched) {
      foulOccurred = true;
      foulReason = "سقوط الكرة البيضاء (Scratch)";
    } else if (!firstHit) {
      foulOccurred = true;
      foulReason = "الكرة البيضاء لم تلمس أي كرة";
    } else if (wasOnRed) {
      if (firstHit.type !== "red") {
        foulOccurred = true;
        const hitName = SNOOKER_COLOR_META[firstHit.value || 0]?.nameAr || "ملونة";
        foulReason = `لمست الكرة ${hitName} بدلاً من كرة حمراء`;
      } else if (pottedColors.length > 0) {
        foulOccurred = true;
        foulReason = "سقوط كرة ملونة أثناء اللعب على الأحمر";
      }
    } else if (wasOnColorFreeChoice) {
      if (firstHit.type !== "color") {
        foulOccurred = true;
        foulReason = "يجب لمس كرة ملونة";
      } else if (pottedReds.length > 0) {
        foulOccurred = true;
        foulReason = "سقوط كرة حمراء أثناء اللعب على الملون";
      } else if (pottedColors.length > 1) {
        foulOccurred = true;
        foulReason = "سقوط أكثر من كرة ملونة في ضربة واحدة";
      } else if (pottedColors.length === 1 && pottedColors[0].ball.id !== firstHit.id) {
        foulOccurred = true;
        foulReason = "سقوط كرة ملونة مختلفة عن الكرة المستهدفة";
      }
    } else if (wasOnClearance && expectedClearanceVal !== null) {
      const targetName = SNOOKER_COLOR_META[expectedClearanceVal]?.nameAr || "";
      if (firstHit.type !== "color" || (firstHit.value || 0) !== expectedClearanceVal) {
        foulOccurred = true;
        foulReason = `يجب لمس الكرة ${targetName} (${expectedClearanceVal}) أولاً`;
      } else if (
        pottedReds.length > 0 ||
        pottedColors.some((p) => p.ball.value !== expectedClearanceVal)
      ) {
        foulOccurred = true;
        foulReason = `سقوط كرة خاطئة في مرحلة التصفية (المطلوب: ${targetName})`;
      } else if (pottedColors.length > 1) {
        foulOccurred = true;
        foulReason = "سقوط أكثر من كرة في ضربة واحدة";
      }
    }

    const updateSnooker = (
      nextHumanScore: number,
      nextBotScore: number,
      nextOnColorAfterRed: boolean
    ) => {
      ctx.onSnookerUpdate?.({
        humanScore: nextHumanScore,
        botScore: nextBotScore,
        onColorAfterRed: nextOnColorAfterRed,
      });
    };

    const formatNextTargetHint = (nextOnColor: boolean): string => {
      const info = getSnookerTargetInfo(balls, nextOnColor);
      if (info.phase === "red") return "الهدف: كرة حمراء (1)";
      if (info.phase === "color") return "الهدف: أي كرة ملونة";
      const meta = SNOOKER_COLOR_META[info.expectedValue];
      return `التصفية: ${meta?.nameAr || ""} (${info.expectedValue})`;
    };

    if (foulOccurred) {
      if (soundEnabled) playFoulBuzzer();

      // Re-spot all colored balls potted on a foul; red balls always remain in pockets
      for (const entry of pottedColors) {
        respotBall(entry.ball, balls, tableGeom);
      }

      const penalty = Math.min(
        7,
        Math.max(
          4,
          expectedClearanceVal || 0,
          firstHit?.value || 0,
          ...pottedList.map((p) => p.ball.value || 0)
        )
      );

      let nextHumanScore = prevHumanScore;
      let nextBotScore = prevBotScore;
      if (!isPractice) {
        if (activeShooter === "human") nextBotScore += penalty;
        else nextHumanScore += penalty;
      }

      updateSnooker(nextHumanScore, nextBotScore, false);
      const hint = formatNextTargetHint(false);

      if (!isPractice) {
        const nextTurn = activeShooter === "human" ? "bot" : "human";
        if (cueScratched) {
          if (nextTurn === "human") {
            const freePos = findFreeCueBallPos(balls, tableGeom, baulkMaxX);
            onTurnChange("human");
            onBallInHand(freePos);
            onMessage(
              `✋ فاول على الخصم (+${penalty} لك • ${foulReason}): ضع الكرة البيضاء خلف الخط! (${hint})`
            );
          } else {
            placeCueBallSafely(balls, tableGeom, baulkMaxX);
            onBallInHand(null);
            onTurnChange("bot");
            onMessage(`⚠️ فاول عليك (+${penalty} للخصم • ${foulReason})! دور الخصم (${hint}).`);
          }
        } else {
          onBallInHand(null);
          onTurnChange(nextTurn);
          onMessage(
            nextTurn === "human"
              ? `✋ فاول على الخصم (+${penalty} لك • ${foulReason})! دورك: ${hint}`
              : `⚠️ فاول عليك (+${penalty} للخصم • ${foulReason})! دور الخصم.`
          );
        }
      } else {
        if (cueScratched) {
          const freePos = findFreeCueBallPos(balls, tableGeom, baulkMaxX);
          onBallInHand(freePos);
          onMessage(`✋ فاول (${foulReason}): ضع الكرة البيضاء خلف الخط! (${hint})`);
        } else {
          onMessage(`⚠️ فاول (${foulReason}) • ${hint}`);
        }
      }
      return;
    }

    if (wasOnRed) {
      if (pottedReds.length > 0) {
        const pts = pottedReds.length;
        const nextHumanScore = activeShooter === "human" ? prevHumanScore + pts : prevHumanScore;
        const nextBotScore = activeShooter === "bot" ? prevBotScore + pts : prevBotScore;
        updateSnooker(nextHumanScore, nextBotScore, true);
        onMessage(
          activeShooter === "human"
            ? `🔴 أحسنت (+${pts})! اختر أي كرة ملونة الآن!`
            : `🤖 الخصم أدخل كرة حمراء (+${pts}) ويختار كرة ملونة...`
        );
      } else {
        updateSnooker(prevHumanScore, prevBotScore, false);
        if (!isPractice) {
          const nextTurn = activeShooter === "human" ? "bot" : "human";
          onTurnChange(nextTurn);
          onMessage(nextTurn === "human" ? "دورك الآن! الهدف: كرة حمراء (1)" : "دور الخصم الآن...");
        } else {
          onMessage("لم تسقط كرة! الهدف: كرة حمراء (1)");
        }
      }
      return;
    }

    if (wasOnColorFreeChoice) {
      if (pottedColors.length === 1) {
        const pottedBall = pottedColors[0].ball;
        const pts = pottedBall.value || 2;
        const colorName = SNOOKER_COLOR_META[pts]?.nameAr || "الملونة";
        // Re-spot colored ball immediately to its spot
        respotBall(pottedBall, balls, tableGeom);

        const nextHumanScore = activeShooter === "human" ? prevHumanScore + pts : prevHumanScore;
        const nextBotScore = activeShooter === "bot" ? prevBotScore + pts : prevBotScore;
        updateSnooker(nextHumanScore, nextBotScore, false);

        if (redsRemainingAfter > 0) {
          onMessage(
            activeShooter === "human"
              ? `🎨 +${pts} نقطة (${colorName})! أُعيدت لمكانها، العب كرة حمراء.`
              : `🤖 الخصم أحرز ${colorName} (+${pts}) وأُعيدت لمكانها...`
          );
        } else {
          const nextHint = formatNextTargetHint(false);
          onMessage(
            activeShooter === "human"
              ? `🏁 انتهت الكرات الحمراء! (+${pts} ${colorName}) بدأت التصفية: ${nextHint}`
              : `🏁 انتهت الكرات الحمراء! الخصم يبدأ التصفية (${nextHint})...`
          );
        }
      } else {
        updateSnooker(prevHumanScore, prevBotScore, false);
        const nextHint = formatNextTargetHint(false);
        if (!isPractice) {
          const nextTurn = activeShooter === "human" ? "bot" : "human";
          onTurnChange(nextTurn);
          onMessage(
            nextTurn === "human" ? `دورك الآن! ${nextHint}` : `دور الخصم الآن (${nextHint})...`
          );
        } else {
          onMessage(`لم تسقط الكرة! ${nextHint}`);
        }
      }
      return;
    }

    // Clearance phase: Yellow -> Green -> Brown -> Blue -> Pink -> Black (no re-spot!)
    if (wasOnClearance) {
      if (pottedColors.length === 1) {
        const pottedBall = pottedColors[0].ball;
        const pts = pottedBall.value || 2;
        const colorName = SNOOKER_COLOR_META[pts]?.nameAr || "الملونة";
        const nextHumanScore = activeShooter === "human" ? prevHumanScore + pts : prevHumanScore;
        const nextBotScore = activeShooter === "bot" ? prevBotScore + pts : prevBotScore;

        const remainingColorsAfter = balls.filter((b) => !b.isPotted && b.type === "color");
        if (remainingColorsAfter.length === 0) {
          if (!isPractice && nextHumanScore === nextBotScore) {
            respotBall(pottedBall, balls, tableGeom);
            updateSnooker(nextHumanScore, nextBotScore, false);
            const nextTurn = activeShooter === "human" ? "bot" : "human";
            onTurnChange(nextTurn);
            onMessage(`⚖️ تعادل ${nextHumanScore}-${nextBotScore}! أُعيدت السوداء (7) لكسر التعادل!`);
            return;
          }

          updateSnooker(nextHumanScore, nextBotScore, false);
          if (isPractice) {
            onGameOver(
              "human",
              `🏆 مبروك! أنهيت طاولة السنوكر بالكامل بمجموع ${nextHumanScore} نقطة!`
            );
          } else if (nextHumanScore > nextBotScore) {
            onGameOver(
              "human",
              `🏆 مبروك الفوز في السنوكر! النتيجة: ${nextHumanScore} مقابل ${nextBotScore}`
            );
          } else {
            onGameOver(
              "bot",
              `❌ خسرت مباراة السنوكر! النتيجة: ${nextHumanScore} مقابل ${nextBotScore}`
            );
          }
          return;
        }

        updateSnooker(nextHumanScore, nextBotScore, false);
        const nextHint = formatNextTargetHint(false);
        onMessage(
          activeShooter === "human"
            ? `✨ +${pts} نقطة (${colorName})! ${nextHint}`
            : `🤖 الخصم أحرز ${colorName} (+${pts})! ${nextHint}`
        );
      } else {
        updateSnooker(prevHumanScore, prevBotScore, false);
        const nextHint = formatNextTargetHint(false);
        if (!isPractice) {
          const nextTurn = activeShooter === "human" ? "bot" : "human";
          onTurnChange(nextTurn);
          onMessage(
            nextTurn === "human" ? `دورك الآن! ${nextHint}` : `دور الخصم الآن (${nextHint})...`
          );
        } else {
          onMessage(`لم تسقط الكرة! ${nextHint}`);
        }
      }
    }
  }
}
