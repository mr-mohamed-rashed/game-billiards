import {
  Ball,
  BallGroup,
  CORNER_POCKET_IDS,
  DEFAULT_TABLE_GEOMETRY,
  GameMode,
  ONE_FIFTEEN_POCKET_1,
  ONE_FIFTEEN_POCKET_15,
  SNOOKER_COLOR_META,
  TableGeometry,
  getBreakLineX,
  getOppositePocket,
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
  mustShootForwardFromBaulk?: boolean;
  oneFifteenUncalledCount?: 0 | 1;
  oneFifteenHumanEightPocket?: number | null;
  oneFifteenBotEightPocket?: number | null;
  onOneFifteenEightPocketChange?: (target: "human" | "bot", pocketId: number) => void;
  onPromptOneFifteenTablePocketPick?: (target: "human" | "bot") => void;
  onOneFifteenUncalledCountChange?: (next: 0 | 1) => void;
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
    mustShootForwardFromBaulk = false,
    oneFifteenUncalledCount = 0,
    oneFifteenHumanEightPocket,
    oneFifteenBotEightPocket,
    onOneFifteenEightPocketChange,
    onPromptOneFifteenTablePocketPick,
    onOneFifteenUncalledCountChange,
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
      if (isOneFifteen) {
        const designatedPocket =
          activeShooter === "human" ? oneFifteenHumanEightPocket : oneFifteenBotEightPocket;
        if (designatedPocket !== null && designatedPocket !== undefined) {
          if (black8Entry.pocketId !== designatedPocket) {
            onGameOver(
              activeShooter === "human" ? "bot" : "human",
              activeShooter === "human"
                ? `❌ خسرت المباراة! الكرة 8 سقطت في (${tableGeom.pockets[black8Entry.pocketId]?.name || "جيب آخر"}) بدلاً من جيبك المخصص (${tableGeom.pockets[designatedPocket]?.name || "المحدد"}).`
                : `🎉 مبروك الفوز! الخصم أسقط الكرة 8 في جيب غير جيبه المخصص (${tableGeom.pockets[designatedPocket]?.name || "المحدد"}).`
            );
            return;
          }
        } else if (
          targetPocketForThisShot !== null &&
          black8Entry.pocketId !== targetPocketForThisShot
        ) {
          onGameOver(
            activeShooter === "human" ? "bot" : "human",
            activeShooter === "human"
              ? "❌ خسرت المباراة! الكرة السوداء 8 سقطت في جيب غير الجيب المحدد."
              : "🎉 مبروك الفوز! الخصم أسقط الكرة 8 في جيب غير المحدد."
          );
          return;
        }
      } else if (
        targetPocketForThisShot !== null &&
        black8Entry.pocketId !== targetPocketForThisShot
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
          ? "🏆 مبروك الفوز الساحق! أحرزت الكرة السوداء 8 في الجيب المخصص بنجاح!"
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
    } else if (
      isOneFifteen &&
      mustShootForwardFromBaulk &&
      baulkLineMaxX !== undefined &&
      firstHit.x < baulkLineMaxX &&
      (balls[0]?.railBounces || 0) === 0
    ) {
      foulOccurred = true;
      foulReason = "ممنوع ضرب كرة خلف خط البداية مباشرة (العب للأمام)";
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
        onOneFifteenUncalledCountChange?.(0);
        for (const entry of pottedList) {
          const isOpponentBall =
            shooterGroup !== "unassigned" &&
            entry.ball.type !== (shooterGroup === "solids" ? "solid" : "stripe");
          if (entry.ball.number !== 8 && !isOpponentBall) respotBall(entry.ball, balls, tableGeom);
        }
      }
      if (!isPractice) {
        const nextTurn = activeShooter === "human" ? "bot" : "human";
        if (cueScratched) {
          if (nextTurn === "human") {
            const freePos = findFreeCueBallPos(balls, tableGeom, baulkLineMaxX);
            onTurnChange("human");
            onBallInHand(freePos);
            onMessage(
              isOneFifteen
                ? `✋ فاول على الخصم (${foulReason}): ضع الكرة البيضاء خلف خط البداية!`
                : `✋ فاول على الخصم (${foulReason}): اسحب الكرة البيضاء في أي مكان!`
            );
          } else {
            // Ensure cue ball is safely placed on table immediately before Bot shoots
            placeCueBallSafely(balls, tableGeom, baulkLineMaxX);
            onBallInHand(null);
            onTurnChange("bot");
            onMessage(`⚠️ فاول عليك (${foulReason}): دور الخصم.`);
          }
        } else {
          // Non-scratch foul (e.g. hitting opponent's ball first): turn passes WITHOUT moving the cue ball
          onBallInHand(null);
          onTurnChange(nextTurn);
          onMessage(
            nextTurn === "human"
              ? `✋ فاول على الخصم (${foulReason}): دورك الآن من مكان الكرة!`
              : `⚠️ فاول عليك (${foulReason}): انتقل المضرب للخصم (بدون تحريك الجيست).`
          );
        }
      } else {
        if (cueScratched) {
          const freePos = findFreeCueBallPos(balls, tableGeom, baulkLineMaxX);
          onBallInHand(freePos);
          onMessage(
            isOneFifteen
              ? `✋ فاول (${foulReason}): ضع الكرة البيضاء خلف خط البداية!`
              : `✋ فاول (${foulReason}): ضع الكرة البيضاء!`
          );
        } else {
          onBallInHand(null);
          onMessage(`⚠️ فاول (${foulReason})!`);
        }
      }
      return;
    }

    // 3. 1 & 15 Uncalled Safety Rule (2-shot visit when pocket is NOT called on non-break shot)
    if (isOneFifteen && !wasBreakShot && targetPocketForThisShot === null) {
      if (pottedList.length > 0) {
        for (const entry of pottedList) {
          const isOpponentBall =
            shooterGroup !== "unassigned" &&
            entry.ball.type !== (shooterGroup === "solids" ? "solid" : "stripe");
          if (entry.ball.number !== 8 && !isOpponentBall) respotBall(entry.ball, balls, tableGeom);
        }
        onOneFifteenUncalledCountChange?.(0);
        if (!isPractice) {
          const nextT = activeShooter === "human" ? "bot" : "human";
          onTurnChange(nextT);
          onMessage(
            nextT === "human"
              ? "🎯 الخصم أسقط كرة بدون تحديد جيب! عادت لنقطة المثلث وانتقل المضرب لك."
              : "🎯 نزلت كرة بدون تحديد جيب! عادت لنقطة المثلث وانتقل المضرب للخصم."
          );
        } else {
          onMessage("🎯 نزلت كرة بدون تحديد جيب! عادت لنقطة المثلث.");
        }
        return;
      }

      if (oneFifteenUncalledCount === 0) {
        onOneFifteenUncalledCountChange?.(1);
        onMessage(
          activeShooter === "human"
            ? "🟡 الضربة الأولى (بدون تحديد جيب): لك ضربة ثانية — حدد جيب أو العب بحرية!"
            : "🤖 الخصم لعب ضربة أمان أولى وله ضربة ثانية..."
        );
        return;
      }

      onOneFifteenUncalledCountChange?.(0);
      if (!isPractice) {
        const nextT = activeShooter === "human" ? "bot" : "human";
        onTurnChange(nextT);
        onMessage(
          nextT === "human"
            ? "انتهت ضربتا الخصم — دورك الآن!"
            : "انتهت الضربتان بدون تحديد جيب — دور الخصم."
        );
      } else {
        onMessage("انتهت الضربتان — يمكنك التصويب من جديد.");
      }
      return;
    }

    if (isOneFifteen) {
      onOneFifteenUncalledCountChange?.(0);
    }

    // 4. Open Pockets / Called Pocket & Special 1 & 15 Pocket Checks
    let updatedHumanGroup = humanGroup;
    let updatedBotGroup = botGroup;

    // First: If groups are unassigned and any object ball (solid or stripe) was potted:
    // Breaker or shooter immediately claims that type and continues playing!
    if (humanGroup === "unassigned" && pottedList.length > 0) {
      const firstObjectEntry = pottedList.find(
        (e) => e.ball.type === "solid" || e.ball.type === "stripe"
      );
      if (firstObjectEntry) {
        const isSolid = firstObjectEntry.ball.type === "solid";
        if (activeShooter === "human") {
          updatedHumanGroup = isSolid ? "solids" : "stripes";
          updatedBotGroup = isSolid ? "stripes" : "solids";
          onAssignGroups(updatedHumanGroup, updatedBotGroup, {
            title: wasBreakShot ? "🎉 تم تعيين الصنف من الكسرة!" : "🎉 تم تعيين الصنف!",
            human: isSolid ? "سادة 🟡 (1-7)" : "ألوان 🔵 (9-15)",
            bot: isSolid ? "ألوان 🔵 (9-15)" : "سادة 🟡 (1-7)",
          });
        } else {
          updatedBotGroup = isSolid ? "solids" : "stripes";
          updatedHumanGroup = isSolid ? "stripes" : "solids";
          onAssignGroups(updatedHumanGroup, updatedBotGroup, {
            title: wasBreakShot ? "🤖 الخصم عيّن الأصناف من الكسرة!" : "🤖 الخصم عيّن الأصناف!",
            human: isSolid ? "ألوان 🔵 (9-15)" : "سادة 🟡 (1-7)",
            bot: isSolid ? "سادة 🟡 (1-7)" : "ألوان 🔵 (9-15)",
          });
        }
      }
    }

    const currentShooterGroup = activeShooter === "human" ? updatedHumanGroup : updatedBotGroup;

    const isOpponentBall = (ball: Ball): boolean => {
      if (currentShooterGroup === "unassigned") return false;
      const ownType = currentShooterGroup === "solids" ? "solid" : "stripe";
      return ball.type !== ownType && ball.number !== 8;
    };

    const isEntryPocketLegal = (entry: { ball: Ball; pocketId: number }): boolean => {
      // On the break shot, any potted ball is 100% legal and stays down!
      if (wasBreakShot) return true;

      // Opponent's ball dropped accidentally or intentionally NEVER comes out:
      // "لو اللاعب نزل كره غصب عنه للخصم مش بتطلع ده غلطه وبيتحمله"
      if (isOpponentBall(entry.ball)) return true;

      if (isOneFifteen) {
        if (entry.ball.number === 1) return entry.pocketId === ONE_FIFTEEN_POCKET_1;
        if (entry.ball.number === 15) return entry.pocketId === ONE_FIFTEEN_POCKET_15;
        return targetPocketForThisShot !== null && entry.pocketId === targetPocketForThisShot;
      }
      return targetPocketForThisShot === null || entry.pocketId === targetPocketForThisShot;
    };

    const validPocketEntries = pottedList.filter(isEntryPocketLegal);
    const invalidPocketEntries = pottedList.filter((entry) => !isEntryPocketLegal(entry));

    // In 1 & 15, shooter's uncalled or wrong-pocket potted ball returns to table,
    // but if opponent's ball fell, it stays in the pocket ("هو الخصم نزلها متطلعش")!
    if (isOneFifteen && invalidPocketEntries.length > 0) {
      for (const bad of invalidPocketEntries) {
        if (!isOpponentBall(bad.ball)) {
          respotBall(bad.ball, balls, tableGeom);
        }
      }
    }

    const CORNER_POCKETS = new Set([0, 2, 3, 5]);
    const cornerCalled1Or15 =
      isOneFifteen &&
      !wasBreakShot &&
      targetPocketForThisShot !== null &&
      CORNER_POCKETS.has(targetPocketForThisShot) &&
      invalidPocketEntries.some(
        (entry) =>
          (entry.ball.number === 1 || entry.ball.number === 15) &&
          entry.pocketId === targetPocketForThisShot
      );

    const legalPottedBalls = validPocketEntries.map((entry) => entry.ball);
    const pottedInWrongPocket =
      pottedList.length > 0 &&
      invalidPocketEntries.length > 0 &&
      validPocketEntries.length === 0 &&
      !cornerCalled1Or15;

    const ownType = currentShooterGroup === "solids" ? "solid" : "stripe";
    const pottedOwnBall = validPocketEntries.some((entry) =>
      currentShooterGroup === "unassigned"
        ? entry.ball.type === "solid" || entry.ball.type === "stripe"
        : entry.ball.type === ownType
    );

    const remainingHumanAfter = balls.filter(
      (b) =>
        !b.isPotted &&
        b.number !== 8 &&
        updatedHumanGroup !== "unassigned" &&
        (updatedHumanGroup === "solids" ? b.type === "solid" : b.type === "stripe")
    );

    if (isOneFifteen && updatedHumanGroup !== "unassigned") {
      const humanBallType = updatedHumanGroup === "solids" ? "solid" : "stripe";
      const botBallType = updatedBotGroup === "solids" ? "solid" : "stripe";
      const specialHumanNumber = updatedHumanGroup === "solids" ? 1 : 15;
      const specialBotNumber = updatedBotGroup === "solids" ? 1 : 15;

      const remainingHuman = balls.filter(
        (b) => !b.isPotted && b.number !== 8 && b.type === humanBallType
      );
      const remainingBot = balls.filter(
        (b) => !b.isPotted && b.number !== 8 && b.type === botBallType
      );

      // Special 1 & 15 Rule:
      // If opponent sinks defending player's other ball, leaving ONLY 1 (or 15):
      // The defending player pre-picks their 8-ball pocket directly on the table!
      if (activeShooter === "bot") {
        const pottedHumanBallsThisShot = pottedList.filter((e) => e.ball.type === humanBallType);
        if (
          pottedHumanBallsThisShot.length > 0 &&
          remainingHuman.length === 1 &&
          remainingHuman[0].number === specialHumanNumber &&
          (oneFifteenHumanEightPocket === null || oneFifteenHumanEightPocket === undefined)
        ) {
          onPromptOneFifteenTablePocketPick?.("human");
          onMessage(
            `🎯 الخصم أسقط كرتك! انقر مباشرة على أي جيب على الطاولة لتحديد مكان الكرة 8 قبل إسقاط الكرة ${specialHumanNumber}.`
          );
        }
      } else if (activeShooter === "human") {
        const pottedBotBallsThisShot = pottedList.filter((e) => e.ball.type === botBallType);
        if (
          pottedBotBallsThisShot.length > 0 &&
          remainingBot.length === 1 &&
          remainingBot[0].number === specialBotNumber &&
          (oneFifteenBotEightPocket === null || oneFifteenBotEightPocket === undefined)
        ) {
          const forbidden = oneFifteenHumanEightPocket ?? null;
          const openPockets = [0, 1, 2, 3, 4, 5].filter((id) => id !== forbidden);
          const chosen = openPockets[Math.floor(Math.random() * openPockets.length)] ?? 2;
          onOneFifteenEightPocketChange?.("bot", chosen);
          onMessage(
            `🤖 أسقطت كرة الخصم! الخصم حدد مسبقاً جيب الكرة 8: (${tableGeom.pockets[chosen]?.name}) وسيلعب على ${specialBotNumber}.`
          );
        }
      }

      // Check Human reaching 8-ball (all regular balls cleared)
      if (
        remainingHuman.length === 0 &&
        (oneFifteenHumanEightPocket === null || oneFifteenHumanEightPocket === undefined)
      ) {
        // "الكره السوده بتنزل ورا اخر كره اى مكان لو نزلتها فى الميديل يبقى وراها"
        const lastEntry =
          validPocketEntries.filter((e) => e.ball.type === humanBallType).pop() ||
          pottedList.filter((e) => e.ball.type === humanBallType).pop();
        const rawPocket = lastEntry?.pocketId ?? 2;

        if (
          oneFifteenBotEightPocket !== null &&
          oneFifteenBotEightPocket !== undefined &&
          rawPocket === oneFifteenBotEightPocket
        ) {
          const oppPocket = getOppositePocket(rawPocket);
          onOneFifteenEightPocketChange?.("human", oppPocket);
          onMessage(
            `🎯 الخصم سبقك لنفس الجيب! وفقاً لقواعد 1 و 15 جيبك أصبح الجيب المعاكس: (${tableGeom.pockets[oppPocket]?.name}).`
          );
        } else {
          onOneFifteenEightPocketChange?.("human", rawPocket);
          onMessage(
            `🎱 أنهيت كراتك! جيب الكرة 8 المخصص لك هو مكان آخر كرة: (${tableGeom.pockets[rawPocket]?.name}).`
          );
        }
      }

      // Check Bot reaching 8-ball (all regular balls cleared)
      if (
        remainingBot.length === 0 &&
        (oneFifteenBotEightPocket === null || oneFifteenBotEightPocket === undefined)
      ) {
        const lastEntry =
          validPocketEntries.filter((e) => e.ball.type === botBallType).pop() ||
          pottedList.filter((e) => e.ball.type === botBallType).pop();
        const rawPocket = lastEntry?.pocketId ?? 5;

        if (
          oneFifteenHumanEightPocket !== null &&
          oneFifteenHumanEightPocket !== undefined &&
          rawPocket === oneFifteenHumanEightPocket
        ) {
          const oppPocket = getOppositePocket(rawPocket);
          onOneFifteenEightPocketChange?.("bot", oppPocket);
          onMessage(
            `🤖 الخصم أنهى في نفس جيبك، فأصبح جيبه المعاكس: (${tableGeom.pockets[oppPocket]?.name}).`
          );
        } else {
          onOneFifteenEightPocketChange?.("bot", rawPocket);
          onMessage(
            `🤖 الخصم أنهى كراته وجيب كرته 8 هو مكان آخر كرة: (${tableGeom.pockets[rawPocket]?.name}).`
          );
        }
      }
    }

    const pottedOpponentBalls = pottedList.filter((e) => isOpponentBall(e.ball));
    const pottedOnlyOpponent = pottedOpponentBalls.length > 0 && !pottedOwnBall;

    if (pottedOwnBall || cornerCalled1Or15) {
      if (wasBreakShot) {
        onMessage(
          activeShooter === "human"
            ? "🔥 ضربة كسرة ممتازة! أحرزت كرة وتم تحديد صنفك، دورك مستمر."
            : "🤖 الخصم أحرز كرة من الكسرة وتم تحديد صنفه، دوره مستمر..."
        );
      } else if (cornerCalled1Or15 && !pottedOwnBall) {
        onMessage(
          activeShooter === "human"
            ? "🟡 نزلت 1 أو 15 في الركن المحدد: خرجت لنقطة المثلث والمضرب معاك!"
            : "🤖 الخصم أنزل 1 أو 15 في الركن المحدد؛ خرجت للمثلث ويكمل دوره..."
        );
      } else if (
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
      if (pottedOnlyOpponent) {
        onMessage(
          nextT === "human"
            ? "🎉 الخصم أسقط إحدى كراتك! بقيت في الجيب ودورك الآن."
            : "⚠️ أسقطت كرة للخصم! بقيت في الجيب ودور الخصم الآن."
        );
      } else if (pottedInWrongPocket) {
        if (isOneFifteen) {
          onMessage(
            nextT === "human"
              ? "🎯 الخصم أخطأ الجيب! خرجت كرته ودورك الآن."
              : "🎯 لم تحدد الجيب الصحيح لكرتك! خرجت الكرة وانتقل الدور للخصم."
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
          ? "🎯 لم تحدد الجيب الصحيح لكرتك! خرجت الكرة للطاولة."
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
