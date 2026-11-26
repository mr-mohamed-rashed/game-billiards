import { Ball, BallGroup, GameMode } from "@/types/billiards";
import { findFreeCueBallPos, placeCueBallSafely } from "@/engine/physics";
import { playFoulBuzzer } from "@/utils/audio";

export interface ShotOutcomeContext {
  mode: GameMode;
  isPractice: boolean;
  soundEnabled: boolean;
  balls: Ball[];
  pottedList: { ball: Ball; pocketId: number }[];
  cueScratched: boolean;
  firstHit: Ball | null;
  activeShooter: "human" | "bot";
  targetPocketForThisShot: number | null;
  humanGroup: BallGroup;
  botGroup: BallGroup;
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

  if (mode === "8-ball") {
    const shooterGroup = activeShooter === "human" ? humanGroup : botGroup;
    const remainingTargetBalls = balls.filter(
      (b) =>
        !b.isPotted &&
        b.number !== 8 &&
        (shooterGroup === "solids" ? b.type === "solid" : b.type === "stripe")
    );

    // 1. Check 8-Ball Potting
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
      if (remainingTargetBalls.length > 0 || shooterGroup === "unassigned") {
        onGameOver(
          activeShooter === "human" ? "bot" : "human",
          activeShooter === "human"
            ? "❌ خسرت المباراة! أسقطت الكرة 8 قبل تصفية كراتك."
            : "🎉 مبروك الفوز! الخصم أسقط الكرة 8 قبل تصفية كراته."
        );
        return;
      }
      if (targetPocketForThisShot !== null && black8Entry.pocketId !== targetPocketForThisShot) {
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
      if (!isPractice) {
        const nextTurn = activeShooter === "human" ? "bot" : "human";
        if (nextTurn === "human") {
          const freePos = findFreeCueBallPos(balls);
          onTurnChange("human");
          onBallInHand(freePos);
          onMessage(`✋ فاول على الخصم (${foulReason}): اسحب الكرة البيضاء وضعها!`);
        } else {
          // Ensure cue ball is safely placed on table immediately before Bot shoots
          placeCueBallSafely(balls);
          onBallInHand(null);
          onTurnChange("bot");
          onMessage(`⚠️ فاول عليك (${foulReason}): دور الخصم.`);
        }
      } else {
        const freePos = findFreeCueBallPos(balls);
        onBallInHand(freePos);
        onMessage(`✋ فاول (${foulReason}): ضع الكرة البيضاء!`);
      }
      return;
    }

    // 3. Open Pockets for regular balls
    let updatedHumanGroup = humanGroup;
    let updatedBotGroup = botGroup;
    const legalPottedBalls = pottedList.map((entry) => entry.ball);

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
      if (nextT === "human") {
        onMessage(
          remainingHumanAfter.length === 0 && updatedHumanGroup !== "unassigned"
            ? "🏆 دورك على الكرة 8! اضغط على الجيب الهدف أولاً."
            : "دورك الآن!"
        );
      } else {
        onMessage("دور الخصم الآن...");
      }
    }
  } else {
    // Snooker mode
    if (cueScratched) {
      placeCueBallSafely(balls);
      if (!isPractice) {
        onTurnChange(activeShooter === "human" ? "bot" : "human");
      }
    } else if (pottedList.length === 0 && !isPractice) {
      onTurnChange(activeShooter === "human" ? "bot" : "human");
    }
  }
}
