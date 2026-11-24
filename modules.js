/* =========================================================
 * IELTS Sprint · 扩展模块
 * 1) 🏠 冲刺总览 Dashboard   2) ✍️ 写作批改   3) 🔍 全局查词
 * 依赖 app.js 暴露的 window.IELTSApp
 * ========================================================= */
(function () {
  "use strict";
  const App = window.IELTSApp;
  if (!App) return;
  const $ = (id) => document.getElementById(id);
  const esc = App.escapeHtml;
  const S = () => App.state;
  const SF_SPEAK = `<svg class="sf-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
  const SF_COPY = `<svg class="sf-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

  // ==================== 常量 ====================
  const START = "2026-11-23";
  const TOTAL_DAYS = 58;
  const PHASES = [
    {
      name: "阶段一 · 夯实基础", from: "2026-11-23", to: "2026-12-10", range: "Day 1–18",
      focus: [
        "听力：剑10–13 Part 1 & 2，冲 18–21 题",
        "阅读：Passage 1 & 2 准确率 + 同义替换",
        "口语：Part 1 高频题逐题过",
        "写作：每周 1 大 1 小保手感"
      ]
    },
    {
      name: "阶段二 · 整套限时", from: "2026-12-11", to: "2027-01-03", range: "Day 19–42",
      focus: [
        "听力：剑14–16 整套限时，攻 Part 3/4",
        "阅读：严格 60 分钟/套",
        "口语：搭 6–8 个 Part 2 万能串题素材 + Part 3",
        "写作：每周 1 大 1 小，盯 TR/CC"
      ]
    },
    {
      name: "阶段三 · 全真模考", from: "2027-01-04", to: "2027-01-19", range: "Day 43–58",
      focus: [
        "模考：剑17–19 全真机考连考",
        "口语：紧盯雅思哥 1–4 月换题季新题",
        "复盘：错题本 + 生词本全面回炉",
        "状态：考前 2 天减量、调作息"
      ]
    }
  ];
  const BASE = { L: 4.5, R: 5.0, S: 5.0, W: 6.0 };
  const TARGET = { L: 5.5, R: 6.0, S: 6.0, W: 6.0 };
  const LISTEN_TABLE = [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [0, 0]];
  const READ_TABLE = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [0, 0]];
  const COACH_TIPS = [
    "听力 Part 1 先看题干预测词性：数字、日期、拼写名词最常考。",
    "阅读先读题再定位：专有名词、数字、大写词是最快的定位锚点。",
    "同义替换是阅读的命门：每做一篇至少记 5 组替换。",
    "口语 Part 1 公式：直接回答 + 1 个原因 + 1 个小例子，20–30 秒刚好。",
    "听力拼写错 = 白听。机考打字前在脑中默念一遍字母。",
    "写作别追求生僻词，准确 + 清晰的段落逻辑才是 6.0 的保障。",
    "TFNG：NOT GIVEN 是“文中没提”，FALSE 是“文中说反了”。",
    "每天的生词当天就加进生词本，第二天抽测才能真正记住。",
    "Part 2 卡壳时用万能素材：人物 / 地点 / 经历都能套同一个故事。",
    "机考听力有 2 分钟检查时间，用来核对拼写和单复数。"
  ];

  // ==================== 工具 ====================
  const parseDate = (s) => new Date(s + "T00:00:00");
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return fmt(d); };
  const diffDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
  const today = () => App.todayStr();
  const dayIndex = (date = today()) => diffDays(START, date) + 1;
  const mmdd = (s) => s.slice(5).replace("-", "/");

  function rawToBand(correct, total, type) {
    const c = Number(correct), t = Number(total) || 40;
    if (!t || isNaN(c)) return null;
    const scaled = Math.round((c / t) * 40);
    const table = type === "reading" ? READ_TABLE : LISTEN_TABLE;
    for (const [min, band] of table) if (scaled >= min) return band;
    return 0;
  }

  function roundBand(x) {
    // 雅思四舍五入规则：.25 → .5，.75 → 下一整数
    const f = Math.floor(x);
    const r = x - f;
    if (r < 0.25) return f;
    if (r < 0.75) return f + 0.5;
    return f + 1;
  }

  function copyText(text) {
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); App.toast("已复制，直接粘贴发给 AI 教练"); }
      catch (e) { App.toast("复制失败，请手动选择复制"); }
      ta.remove();
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => App.toast("已复制，直接粘贴发给 AI 教练"), fallback);
    } else fallback();
  }

  function ensureFields() {
    const s = S();
    if (!Array.isArray(s.writings)) s.writings = [];
    if (!s.examTracker || typeof s.examTracker !== "object") s.examTracker = { lastCheck: "", booked: false, bookedInfo: "", log: [] };
    if (!Array.isArray(s.examTracker.log)) s.examTracker.log = [];
    if (!s.checkins || typeof s.checkins !== "object") s.checkins = {};
  }

  // ==================== 顺序进度与活跃度计算（进度不可跳过） ====================
  function getOrderedDays() {
    return [...(S().days || [])].sort((a, b) => {
      const na = parseInt(String(a.id || "").replace(/\D+/g, ""), 10) || 0;
      const nb = parseInt(String(b.id || "").replace(/\D+/g, ""), 10) || 0;
      if (na !== nb) return na - nb;
      return String(a.date || "").localeCompare(String(b.date || ""));
    });
  }

  function isDayCompleted(day) {
    return !!(day && Array.isArray(day.tasks) && day.tasks.length > 0 && day.tasks.every((t) => t.done));
  }

  function getDayCompletedDate(day) {
    if (!isDayCompleted(day)) return null;
    if (day.completedAt) return day.completedAt;
    const dates = day.tasks.map((t) => t.doneAt).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : day.date || today();
  }

  function getSprintProgress() {
    const ordered = getOrderedDays();
    const completedByDate = {};
    let completedCount = 0;
    let activeDay = null;
    let activeSeq = 1;

    ordered.forEach((d, idx) => {
      const seq = idx + 1;
      if (isDayCompleted(d)) {
        completedCount++;
        const cd = getDayCompletedDate(d);
        if (cd) {
          if (!completedByDate[cd]) completedByDate[cd] = [];
          completedByDate[cd].push({ seq, day: d });
        }
      } else if (!activeDay) {
        activeDay = d;
        activeSeq = seq;
      }
    });

    const allLoadedDone = !activeDay && ordered.length > 0;
    if (!activeDay && ordered.length) {
      activeDay = ordered[ordered.length - 1];
      activeSeq = ordered.length;
    }

    return { ordered, completedCount, completedByDate, activeDay, activeSeq, allLoadedDone };
  }

  function activityFor(date, progCache) {
    const s = S();
    const prog = progCache || getSprintProgress();
    let score = 0;
    const detail = [];

    const completedList = prog.completedByDate[date] || [];
    if (completedList.length) {
      score += 4;
      detail.push(`完成 ${completedList.map((x) => `Day ${x.seq}`).join("、")}`);
    }

    let taskDoneOnDate = 0;
    (s.days || []).forEach((d) => {
      (d.tasks || []).forEach((t) => {
        if (!t.done) return;
        const stamp = t.doneAt || d.date;
        if (stamp === date) taskDoneOnDate++;
      });
    });
    if (taskDoneOnDate) {
      score += taskDoneOnDate;
      detail.push(`完成任务 ${taskDoneOnDate} 项`);
    }

    const pr = s.practiceRecords.filter((r) => r.date === date).length;
    if (pr) { score += pr; detail.push(`精听精读 ${pr}`); }
    const wr = s.writings.filter((w) => w.date === date).length;
    if (wr) { score += wr; detail.push(`写作 ${wr}`); }
    const vb = s.vocabBook.filter((v) => v.createdAt === date).length;
    if (vb) { score += 1; detail.push(`生词 +${vb}`); }
    if (s.checkins[date]) { score += 1; detail.push("已打卡"); }
    const level = score === 0 ? 0 : score <= 1 ? 1 : score <= 3 ? 2 : score <= 5 ? 3 : 4;
    return { score, level, detail, completedList };
  }

  function streak() {
    const prog = getSprintProgress();
    let n = 0;
    let d = today();
    if (activityFor(d, prog).score === 0) d = addDays(d, -1); // 今天还没开始不算断
    while (diffDays(START, d) >= 0 && activityFor(d, prog).score > 0) { n++; d = addDays(d, -1); }
    return n;
  }

  function estimateBand(type) {
    const recs = S().practiceRecords
      .filter((r) => r.type === type && r.correct !== "" && r.correct != null && Number(r.total) > 0)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 3);
    if (!recs.length) return null;
    const avg = recs.reduce((s, r) => s + rawToBand(r.correct, r.total, type), 0) / recs.length;
    return roundBand(avg);
  }

  function writingAvg() {
    const ws = S().writings.filter((w) => w.overall).slice(0, 3);
    if (!ws.length) return null;
    return roundBand(ws.reduce((s, w) => s + Number(w.overall), 0) / ws.length);
  }

  function weekRange(date = today()) {
    const d = parseDate(date);
    const wd = (d.getDay() + 6) % 7; // Monday = 0
    const mon = addDays(date, -wd);
    return [mon, addDays(mon, 6)];
  }

  // ==================== 今日汇报（复制给 AI） ====================
  function buildReport() {
    const s = S();
    const t = today();
    const prog = getSprintProgress();
    const day = prog.activeDay || s.days.find((d) => d.id === App.getCurrentDayId());
    const n = prog.activeSeq;
    const lines = [`【Day ${n} 学习汇报 · ${t}】`, ""];
    if (day) {
      const tasks = day.tasks || [];
      lines.push(`✅ 当前进度 Day ${n} 任务 ${tasks.filter((x) => x.done).length}/${tasks.length}`);
      tasks.forEach((x) => lines.push(`  ${x.done ? "☑" : "☐"} [${x.tag}] ${x.text}`));
      lines.push("");
    }
    const prs = s.practiceRecords.filter((r) => r.date === t);
    lines.push("🎧📖 今日精听 / 精读");
    if (prs.length) {
      prs.forEach((r) => {
        lines.push(`  - ${r.type === "reading" ? "阅读" : "听力"} ${r.source}：${r.correct || "?"}/${r.total}${r.minutes ? `，用时 ${r.minutes} 分钟` : ""}`);
        if (r.notes) lines.push(`    错因：${r.notes.replace(/\n/g, "；")}`);
        if (r.synonyms) lines.push(`    同义替换：${r.synonyms.replace(/\n/g, "；")}`);
      });
    } else lines.push("  （今天还没录入）");
    lines.push("");
    const sps = s.speakingTopics.filter((x) => x.tag === "今日必练" && !x.mastered);
    lines.push("🗣️ 口语作答（请帮我批改升级）");
    if (sps.length) {
      sps.forEach((x, i) => {
        lines.push(`  Q${i + 1} [${x.part}] ${x.question}`);
        lines.push(`  我的回答：${x.draft || "（未填写）"}`);
      });
    } else lines.push("  （今天没有标记为“今日必练”的题）");
    lines.push("");
    const ws = s.writings.filter((w) => w.date === t);
    if (ws.length) {
      lines.push("✍️ 今日写作（请按四项标准批改）");
      ws.forEach((w) => {
        lines.push(`  ${w.task}｜题目：${w.prompt}`);
        lines.push(`  正文（${countWords(w.essay)} 词）：\n${w.essay}`);
      });
      lines.push("");
    }
    const un = s.vocabBook.filter((v) => !v.mastered);
    const stats = s.wordStats || {};
    const weakEntries = Object.entries(stats)
      .filter(([, st]) => st && (st.status === "weak" || (st.weakMarks || 0) > 0))
      .sort((a, b) => (b[1].weakMarks || 0) - (a[1].weakMarks || 0));
    lines.push(`生词本未掌握 ${un.length} 词（请编进明天的串文并抽测）`);
    if (un.length) {
      lines.push("  " + un.slice(0, 80).map((v) => {
        const st = stats[v.word.toLowerCase()];
        return st && st.weakMarks ? `${v.word}(不熟×${st.weakMarks})` : v.word;
      }).join(", "));
    }
    if (weakEntries.length) {
      lines.push(`重点标注不熟词 ${weakEntries.length} 个（优先次日复现 & 周度长文大串烧）：`);
      lines.push("  " + weakEntries.slice(0, 40).map(([w, st]) => `${w}×${st.weakMarks || 1}`).join(", "));
    }
    const et = s.examTracker;
    lines.push("");
    lines.push(`🎫 考位：${et.booked ? "已报名 " + (et.bookedInfo || "") : et.lastCheck ? "最近刷官网 " + et.lastCheck : "还没刷过官网"}`);
    return lines.join("\n");
  }

  // ==================== 1) 冲刺总览 ====================
  function renderDashboard() {
    ensureFields();
    const root = $("dashboardRoot");
    if (!root) return;
    const s = S();
    const t = today();
    const examDate = s.examDate || "2027-01-20";
    const prog = getSprintProgress();
    const daysLeft = Math.max(0, diffDays(t, examDate));
    const phaseIdx = PHASES.findIndex((p) => t >= p.from && t <= p.to);
    const phase = PHASES[phaseIdx >= 0 ? phaseIdx : t < START ? 0 : 2];

    // 当前顺序进度（严格按 Day 1 → Day 2 → ... 推进，未完成不跳过）
    const dayObj = prog.activeDay;
    const tasks = dayObj ? dayObj.tasks || [] : [];
    const doneCount = tasks.filter((x) => x.done).length;
    const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
    const C = 2 * Math.PI * 52;

    // 统计
    const vocabTotal = s.vocabBook.length;
    const vocabMastered = s.vocabBook.filter((v) => v.mastered).length;
    const coreWords = s.days.reduce((sum, d) => sum + (d.words ? d.words.length : 0), 0);
    const [wkMon, wkSun] = weekRange(t);
    const wkW = s.writings.filter((w) => w.date >= wkMon && w.date <= wkSun);
    const wkT1 = wkW.filter((w) => w.task === "Task 1").length;
    const wkT2 = wkW.filter((w) => w.task === "Task 2").length;

    const estL = estimateBand("listening");
    const estR = estimateBand("reading");
    const estW = writingAvg();
    const spDone = s.speakingTopics.filter((x) => x.polished).length;

    // 考位提醒
    const et = s.examTracker;
    const sinceCheck = et.lastCheck ? diffDays(et.lastCheck, t) : null;
    const examWarn = !et.booked && (sinceCheck === null || sinceCheck >= 2);

    const tip = COACH_TIPS[(Math.max(prog.activeSeq, 1) - 1) % COACH_TIPS.length];

    const skill = (key, label, est, extra) => {
      const base = BASE[key], target = TARGET[key];
      const cur = est != null ? est : base;
      const p = Math.max(0, Math.min(100, ((cur - 4) / (7 - 4)) * 100));
      const tp = ((target - 4) / 3) * 100;
      const reached = cur >= target;
      return `
        <div class="skill-card ${reached ? "reached" : ""}">
          <div class="skill-top">
            <span class="skill-name">${label}</span>
            <span class="skill-est">${cur.toFixed(1)}<small>${est != null ? "近期模考估分" : "当前基准 Band"}</small></span>
          </div>
          <div class="skill-bar">
            <div class="skill-fill" style="width:${p}%"></div>
            <div class="skill-target" style="left:${tp}%" title="目标 Band ${target.toFixed(1)}"></div>
          </div>
          <div class="skill-foot"><span>起点 ${base.toFixed(1)}</span><span>${extra}</span><span>目标 <b>${target.toFixed(1)}</b></span></div>
        </div>`;
    };

    // 真实 7 列周历（周一至周日 · 进度按天顺延、不可跳过）
    const calStartD = parseDate(START);
    const startOffset = (calStartD.getDay() + 6) % 7; // Mon=0..Sun=6
    const gridStart = addDays(START, -startOffset);
    const calEndD = parseDate(examDate);
    const endOffset = 6 - ((calEndD.getDay() + 6) % 7);
    const gridEnd = addDays(examDate, endOffset);
    const totalGridDays = diffDays(gridStart, gridEnd) + 1;

    let calCells = "";
    for (let i = 0; i < totalGridDays; i++) {
      const d = addDays(gridStart, i);
      const inRange = d >= START && d <= examDate;
      if (!inRange) {
        calCells += `<div class="cal-cell is-pad" aria-hidden="true"></div>`;
        continue;
      }
      const isExam = d === examDate;
      const isToday = d === t;
      const isPast = d < t;
      const isFuture = d > t;
      const a = activityFor(d, prog);
      const dayNum = parseInt(d.slice(8), 10);
      const monthNum = parseInt(d.slice(5, 7), 10);
      const showMonth = dayNum === 1 || d === START;

      const comp = a.completedList || [];
      let badgeHtml = "";
      let linkDayId = "";
      let tipLines = [`${monthNum}月${dayNum}日 (${d})`];

      if (isExam) {
        badgeHtml = `<span class="cal-tag is-exam">考</span>`;
        tipLines.push("目标机考日 · Band 6.0");
      } else if (comp.length) {
        const tagTxt = comp.length === 1 ? `D${comp[0].seq}` : `D${comp[0].seq}-${comp[comp.length - 1].seq}`;
        badgeHtml = `<span class="cal-tag is-done">${tagTxt}</span>`;
        linkDayId = comp[comp.length - 1].day.id;
      } else if (isToday && !prog.allLoadedDone && prog.activeDay) {
        badgeHtml = `<span class="cal-tag is-active">D${prog.activeSeq}</span>`;
        linkDayId = prog.activeDay.id;
        tipLines.push(`今日接续进度：Day ${prog.activeSeq}（不可跳过）`);
      } else if (isPast && a.score === 0) {
        tipLines.push("未打卡（进度不跳过，自动顺延）");
      }

      if (a.detail.length) tipLines.push(a.detail.join(" · "));

      const cls = [
        "cal-cell",
        `lv${a.level}`,
        isToday ? "is-today" : "",
        isExam ? "is-exam-day" : "",
        isPast && a.score === 0 ? "is-missed" : "",
        isFuture && !isExam ? "is-future" : "",
        comp.length ? "is-completed" : "",
        linkDayId ? "is-clickable" : ""
      ].filter(Boolean).join(" ");

      calCells += `
        <div class="${cls}" ${linkDayId ? `data-cal-day="${esc(linkDayId)}"` : ""} title="${esc(tipLines.join("\n"))}">
          ${showMonth ? `<span class="cal-month">${monthNum}月</span>` : ""}
          <span class="cal-num">${dayNum}</span>
          ${badgeHtml}
        </div>`;
    }

    const heroKicker = t < START
      ? `闭关即将开始 · ${t}`
      : prog.allLoadedDone
      ? `已完成 ${prog.completedCount} / ${TOTAL_DAYS} 天 · ${t}`
      : `当前进度 Day ${prog.activeSeq} / ${TOTAL_DAYS} · 已完成 ${prog.completedCount} 天 · ${t}`;

    root.innerHTML = `
      <div class="dash-grid">
        <div class="card dash-hero">
          <div class="hero-left">
            <div class="hero-kicker">${heroKicker}</div>
            <h2 class="hero-title">${phase.name} <span class="hero-range">${phase.range}</span></h2>
            <ul class="hero-focus">${phase.focus.map((f) => `<li><span class="focus-dot"></span>${esc(f)}</li>`).join("")}</ul>
            <div class="hero-actions">
              <button class="btn btn-primary" data-dash="go-daily">${prog.allLoadedDone ? `回顾 Day ${prog.activeSeq} →` : `继续 Day ${prog.activeSeq} 计划 →`}</button>
              <button class="btn btn-outline" data-dash="report">生成今日汇报</button>
              <button class="btn btn-outline ${s.checkins[t] ? "active-toggle" : ""}" data-dash="checkin">${s.checkins[t] ? "✓ 今日已打卡" : "今日打卡"}</button>
            </div>
          </div>
          <div class="hero-right">
            <div class="ring-wrap" title="当前顺延计划完成度">
              <svg viewBox="0 0 120 120" class="ring">
                <circle cx="60" cy="60" r="52" class="ring-bg"></circle>
                <circle cx="60" cy="60" r="52" class="ring-fg" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - pct / 100)}"></circle>
              </svg>
              <div class="ring-text"><strong>${pct}%</strong><span>Day ${prog.activeSeq} · ${doneCount}/${tasks.length}</span></div>
            </div>
            <div class="hero-mini">
              <div><strong>${daysLeft}</strong><span>天后考试</span></div>
              <div><strong>${prog.completedCount}</strong><span>已完成天</span></div>
            </div>
          </div>
        </div>

        <div class="card dash-tip">
          <div class="tip-head">
            <svg class="sf-icon-title" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"></path></svg>
            <span>教练今日提醒</span>
          </div>
          <p>${esc(tip)}</p>
          ${examWarn ? `<div class="exam-alert">${sinceCheck === null ? "尚未查询考位" : `已 ${sinceCheck} 天未查考位`} · 建议前往官网查看开封 / 郑州 1 月机考。</div>` : ""}
        </div>
      </div>

      <div class="skill-grid">
        ${skill("L", "Listening · 听力", estL, `${s.practiceRecords.filter((r) => r.type === "listening").length} 次精听`)}
        ${skill("R", "Reading · 阅读", estR, `${s.practiceRecords.filter((r) => r.type === "reading").length} 次精读`)}
        ${skill("S", "Speaking · 口语", null, `${spDone}/${s.speakingTopics.length} 题已升级`)}
        ${skill("W", "Writing · 写作", estW, `${s.writings.length} 篇`)}
      </div>

      <div class="dash-grid two">
        <div class="card">
          <div class="card-head-row cal-card-head">
            <div class="cal-title-group">
              <h3 class="card-section-title">备考日历</h3>
              <span class="cal-prog-pill">已完成 ${prog.completedCount} / ${TOTAL_DAYS}</span>
            </div>
            <div class="heat-legend">少 <i class="lv0"></i><i class="lv1"></i><i class="lv2"></i><i class="lv3"></i><i class="lv4"></i> 多</div>
          </div>
          <div class="phase-strip">
            ${PHASES.map((p, i) => `<div class="phase-seg ph${i} ${i === phaseIdx ? "current" : ""}" style="flex:${diffDays(p.from, p.to) + 1}"><b>${p.name.split(" · ")[0]}</b><span>${mmdd(p.from)}–${mmdd(p.to)}</span></div>`).join("")}
          </div>
          <div class="cal-weekdays"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
          <div class="cal-grid">${calCells}</div>
          <p class="muted heat-note">进度按天顺延、不可跳过：若前一天未完成，今天仍从 <b>Day ${prog.activeSeq}</b> 接续；全部勾选后将在当天日历点亮 <b>D${prog.activeSeq}</b> 完成徽章。</p>
        </div>

        <div class="card">
          <h3 class="card-section-title">听力 / 阅读正确率走势</h3>
          ${trendChart()}
        </div>
      </div>

      <div class="dash-grid three">
        <div class="card stat-card">
          <h3 class="card-section-title">词汇积累</h3>
          <div class="big-stats">
            <div><strong>${coreWords}</strong><span>串文高频词</span></div>
            <div><strong>${vocabTotal}</strong><span>生词本</span></div>
            <div><strong>${vocabMastered}</strong><span>已掌握</span></div>
          </div>
          <div class="mini-bar"><div style="width:${vocabTotal ? (vocabMastered / vocabTotal) * 100 : 0}%"></div></div>
          <button class="btn btn-sm btn-outline full-width" data-dash="go-vocab">去生词本抽测 →</button>
        </div>

        <div class="card stat-card">
          <h3 class="card-section-title">本周写作配额 <small class="muted">${mmdd(wkMon)}–${mmdd(wkSun)}</small></h3>
          <div class="quota-row ${wkT1 >= 1 ? "ok" : ""}"><span>小作文 Task 1</span><b>${wkT1} / 1</b></div>
          <div class="quota-row ${wkT2 >= 1 ? "ok" : ""}"><span>大作文 Task 2</span><b>${wkT2} / 1</b></div>
          <button class="btn btn-sm btn-outline full-width" data-dash="go-writing">去写作批改 →</button>
        </div>

        <div class="card stat-card">
          <h3 class="card-section-title">考位追踪</h3>
          ${et.booked
            ? `<div class="booked-box">✓ 已报名<br><b>${esc(et.bookedInfo || "")}</b></div>
               <button class="btn btn-sm btn-ghost full-width" data-dash="unbook">修改报名信息</button>`
            : `<p class="muted">目标：开封 1 月机考（备选郑州）。每 1–2 天刷一次。</p>
               <div class="check-status ${examWarn ? "warn" : "ok"}">${et.lastCheck ? `上次刷：${et.lastCheck}（${sinceCheck === 0 ? "今天" : sinceCheck + " 天前"}）` : "尚未查询官网考位"}</div>
               <div class="btn-row">
                 <a class="btn btn-sm btn-primary" href="https://ielts.neea.cn/" target="_blank" rel="noopener">雅思官网 ↗</a>
                 <button class="btn btn-sm btn-outline" data-dash="checked">刚刷过</button>
                 <button class="btn btn-sm btn-outline" data-dash="book">已报上</button>
               </div>`}
        </div>
      </div>
    `;
  }

  function trendChart() {
    const recs = S().practiceRecords
      .filter((r) => r.correct !== "" && r.correct != null && Number(r.total) > 0)
      .map((r) => ({ ...r, acc: Math.min(100, (Number(r.correct) / Number(r.total)) * 100) }))
      .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
    if (!recs.length) {
      return `
        <div class="empty-chart apple-ghost-chart">
          <svg viewBox="0 0 420 120" class="ghost-wave-svg" aria-hidden="true">
            <defs>
              <linearGradient id="gwGrad" x1="0" y1="0" x2="420" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#0071e3" stop-opacity="0.08"/>
                <stop offset="50%" stop-color="#0071e3" stop-opacity="0.38"/>
                <stop offset="100%" stop-color="#6366f1" stop-opacity="0.1"/>
              </linearGradient>
            </defs>
            <line x1="20" x2="400" y1="30" y2="30" class="grid-line" stroke-dasharray="3 4"/>
            <line x1="20" x2="400" y1="60" y2="60" class="grid-line" stroke-dasharray="3 4"/>
            <line x1="20" x2="400" y1="90" y2="90" class="grid-line" stroke-dasharray="3 4"/>
            <path d="M 24 86 C 95 82, 130 48, 205 54 C 275 60, 320 26, 396 22" fill="none" stroke="url(#gwGrad)" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="205" cy="54" r="3.5" fill="#0071e3" opacity="0.45"/>
            <circle cx="396" cy="22" r="4" fill="#6366f1" opacity="0.6"/>
          </svg>
          <p class="ghost-chart-title">暂无精听 / 精读曲线数据</p>
          <span class="muted">在「精听 &amp; 精读记录」录入对题数后，将自动绘制正确率走势并折算 Band 分数</span>
        </div>`;
    }
    const W = 520, H = 220, pl = 34, pr = 12, pt = 14, pb = 26;
    const iw = W - pl - pr, ih = H - pt - pb;
    const x = (i) => pl + (recs.length === 1 ? iw / 2 : (i / (recs.length - 1)) * iw);
    const y = (v) => pt + ih - (v / 100) * ih;
    const series = (type) => recs.map((r, i) => ({ r, i })).filter((p) => p.r.type === type);
    const path = (pts) => pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.r.acc).toFixed(1)}`).join(" ");
    const L = series("listening"), R = series("reading");
    const target = 57.5; // ≈ 23/40 → 6.0
    let grid = "";
    [0, 25, 50, 75, 100].forEach((v) => {
      grid += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="grid-line"/><text x="${pl - 6}" y="${y(v) + 4}" class="axis-text" text-anchor="end">${v}</text>`;
    });
    const dots = (pts, cls) => pts.map((p) => `<circle cx="${x(p.i)}" cy="${y(p.r.acc)}" r="4" class="${cls}"><title>${p.r.date} ${p.r.source}\n${p.r.correct}/${p.r.total}（≈ ${rawToBand(p.r.correct, p.r.total, p.r.type)} 分）</title></circle>`).join("");
    const labels = recs.map((r, i) => (recs.length <= 8 || i % Math.ceil(recs.length / 8) === 0 ? `<text x="${x(i)}" y="${H - 6}" class="axis-text" text-anchor="middle">${mmdd(r.date)}</text>` : "")).join("");
    const last = (pts) => (pts.length ? pts[pts.length - 1].r : null);
    const lr = last(L), rr = last(R);
    return `
      <svg viewBox="0 0 ${W} ${H}" class="trend-svg">
        ${grid}
        <line x1="${pl}" x2="${W - pr}" y1="${y(target)}" y2="${y(target)}" class="target-line"/>
        <text x="${W - pr}" y="${y(target) - 5}" class="target-text" text-anchor="end">6.0 分线 ≈ 58%</text>
        ${L.length > 1 ? `<path d="${path(L)}" class="line-l"/>` : ""}
        ${R.length > 1 ? `<path d="${path(R)}" class="line-r"/>` : ""}
        ${dots(L, "dot-l")}${dots(R, "dot-r")}
        ${labels}
      </svg>
      <div class="trend-legend">
        <span><i class="lg-l"></i>听力${lr ? ` · 最近 ${lr.correct}/${lr.total} ≈ <b>${rawToBand(lr.correct, lr.total, "listening")}</b>` : ""}</span>
        <span><i class="lg-r"></i>阅读${rr ? ` · 最近 ${rr.correct}/${rr.total} ≈ <b>${rawToBand(rr.correct, rr.total, "reading")}</b>` : ""}</span>
      </div>
      <p class="muted">分数按剑桥官方 40 题换算表估算（非 40 题的部分练习按比例折算）。</p>`;
  }

  function bindDashboard() {
    $("dashboardRoot").addEventListener("click", (e) => {
      const calCell = e.target.closest("[data-cal-day]");
      if (calCell) {
        App.selectDay(calCell.dataset.calDay);
        App.goTab("daily");
        return;
      }
      const b = e.target.closest("[data-dash]");
      if (!b) return;
      const s = S();
      const act = b.dataset.dash;
      if (act === "go-daily") {
        const prog = getSprintProgress();
        if (prog.activeDay) App.selectDay(prog.activeDay.id);
        App.goTab("daily");
      } else if (act === "go-vocab") App.goTab("vocab");
      else if (act === "go-writing") App.goTab("writing");
      else if (act === "report") openReport();
      else if (act === "checkin") {
        const t = today();
        if (s.checkins[t]) delete s.checkins[t]; else s.checkins[t] = true;
        App.save();
        if (s.checkins[t]) App.toast("打卡成功，继续稳步推进");
      } else if (act === "checked") {
        s.examTracker.lastCheck = today();
        s.examTracker.log.unshift(today());
        App.save();
        App.toast("已记录，后天记得再刷一次");
      } else if (act === "book") {
        const info = prompt("恭喜！填写报名信息（如：2027-01-16 开封 机考）", "");
        if (info === null) return;
        s.examTracker.booked = true;
        s.examTracker.bookedInfo = info.trim();
        const m = info.match(/20\d\d-\d{2}-\d{2}/);
        if (m) s.examDate = m[0];
        App.save();
        App.refresh();
        App.toast("考位已锁定，倒计时已同步");
      } else if (act === "unbook") {
        const info = prompt("修改报名信息（清空则恢复为“未报名”）", s.examTracker.bookedInfo || "");
        if (info === null) return;
        s.examTracker.booked = Boolean(info.trim());
        s.examTracker.bookedInfo = info.trim();
        const m = info.match(/20\d\d-\d{2}-\d{2}/);
        if (m) s.examDate = m[0];
        App.save();
        App.refresh();
      }
    });
  }

  function openReport() {
    const text = buildReport();
    let modal = $("modalReport");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal-backdrop hidden";
      modal.id = "modalReport";
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header"><h3>今日学习汇报</h3><button class="cloud-close-btn" data-close aria-label="关闭"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div>
          <div class="modal-body">
            <p class="muted">自动汇总了今天的任务、精听精读、口语草稿、写作和未掌握生词。复制后直接发给 AI 教练即可批改 + 生成明天的计划。</p>
            <textarea id="reportText" class="textarea-input full-width code-area" rows="16"></textarea>
          </div>
          <div class="modal-footer"><button class="btn btn-ghost" data-close>关闭</button><button class="btn btn-primary" id="btnCopyReport">${SF_COPY} <span>复制汇报</span></button></div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", (e) => {
        if (e.target === modal || e.target.closest("[data-close]")) modal.classList.add("hidden");
      });
      modal.querySelector("#btnCopyReport").addEventListener("click", () => copyText($("reportText").value));
    }
    $("reportText").value = text;
    modal.classList.remove("hidden");
  }

  // ==================== 2) 写作批改 ====================
  let writingFilter = "all";
  let writingTimer = null;
  let writingTimerLeft = 0;

  function countWords(text) {
    const m = String(text || "").trim().match(/[A-Za-z]+(?:['’-][A-Za-z]+)*|\d+(?:[.,]\d+)*%?/g);
    return m ? m.length : 0;
  }

  const BAND_OPTS = ["", "4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0"];
  const CRITERIA = [
    ["tr", "TR / TA", "任务回应"],
    ["cc", "CC", "连贯衔接"],
    ["lr", "LR", "词汇丰富"],
    ["gra", "GRA", "语法准确"]
  ];

  function renderWritingShell() {
    const root = $("writingRoot");
    root.innerHTML = `
      <div class="writing-layout">
        <div class="card writing-editor">
          <div class="card-head-row">
            <h2 class="card-section-title" id="wrFormTitle">新写一篇（仿机考打字）</h2>
            <div class="wr-timer">
              <span id="wrTimerDisplay">--:--</span>
              <button class="btn btn-sm btn-outline" data-wr-timer="1200">20 分</button>
              <button class="btn btn-sm btn-outline" data-wr-timer="2400">40 分</button>
              <button class="btn btn-sm btn-ghost" data-wr-timer="0">停</button>
            </div>
          </div>
          <input type="hidden" id="wrEditId" />
          <div class="form-row-3">
            <div>
              <label class="field-label">类型</label>
              <select id="wrTask" class="select-input full-width">
                <option value="Task 2">大作文 Task 2（≥250 词 · 40 分钟）</option>
                <option value="Task 1">小作文 Task 1（≥150 词 · 20 分钟）</option>
              </select>
            </div>
            <div>
              <label class="field-label">日期</label>
              <input type="date" id="wrDate" class="text-input full-width" />
            </div>
            <div>
              <label class="field-label">来源</label>
              <input type="text" id="wrSource" class="text-input full-width" placeholder="如：剑10 Test 1" />
            </div>
          </div>
          <label class="field-label">题目</label>
          <textarea id="wrPrompt" class="textarea-input full-width" rows="2" placeholder="粘贴作文题目..."></textarea>
          <div class="essay-head">
            <label class="field-label">正文</label>
            <span class="word-count" id="wrWordCount">0 词</span>
          </div>
          <textarea id="wrEssay" class="textarea-input full-width essay-area" rows="14" spellcheck="false" placeholder="在这里打字（机考没有拼写检查，这里也关掉了）..."></textarea>
          <details class="score-details" id="wrScoreBox">
            <summary>批改结果（AI 批改后填这里）</summary>
            <div class="criteria-grid">
              ${CRITERIA.map(([k, a, b]) => `
                <div><label class="field-label">${a} <small>${b}</small></label>
                <select id="wr_${k}" class="select-input full-width">${BAND_OPTS.map((o) => `<option value="${o}">${o || "—"}</option>`).join("")}</select></div>`).join("")}
              <div class="overall-box"><span>总分</span><strong id="wrOverall">—</strong></div>
            </div>
            <label class="field-label">批改意见 / 升级版</label>
            <textarea id="wrFeedback" class="textarea-input full-width" rows="5" placeholder="把 AI 的批改意见、高分改写句粘贴到这里..."></textarea>
          </details>
          <div class="form-actions">
            <button class="btn btn-primary" id="btnSaveWriting">保存作文</button>
            <button class="btn btn-outline" id="btnCopyWriting">${SF_COPY} <span>复制给 AI 批改</span></button>
            <button class="btn btn-ghost hidden" id="btnCancelWriting">取消编辑</button>
          </div>
        </div>

        <div class="writing-side">
          <div class="card">
            <div class="summary-stats wr-stats" id="wrStats"></div>
            <div class="filter-pills" id="wrFilter">
              <button class="pill active" data-f="all">全部</button>
              <button class="pill" data-f="Task 2">大作文</button>
              <button class="pill" data-f="Task 1">小作文</button>
            </div>
          </div>
          <div class="records-stack" id="wrList"></div>
        </div>
      </div>`;
    $("wrDate").value = today();
  }

  function calcOverall() {
    const vals = CRITERIA.map(([k]) => parseFloat($("wr_" + k).value)).filter((v) => !isNaN(v));
    if (vals.length < 4) return "";
    return roundBand(vals.reduce((a, b) => a + b, 0) / 4).toFixed(1);
  }

  function resetWritingForm() {
    $("wrEditId").value = "";
    $("wrTask").value = "Task 2";
    $("wrDate").value = today();
    ["wrSource", "wrPrompt", "wrEssay", "wrFeedback"].forEach((id) => ($(id).value = ""));
    CRITERIA.forEach(([k]) => ($("wr_" + k).value = ""));
    $("wrOverall").textContent = "—";
    $("wrFormTitle").textContent = "新写一篇（仿机考打字）";
    $("btnCancelWriting").classList.add("hidden");
    $("wrScoreBox").open = false;
    updateWordCount();
  }

  function updateWordCount() {
    const n = countWords($("wrEssay").value);
    const min = $("wrTask").value === "Task 1" ? 150 : 250;
    const el = $("wrWordCount");
    el.textContent = `${n} / ${min} 词`;
    el.classList.toggle("ok", n >= min);
  }

  function renderWritingList() {
    ensureFields();
    const s = S();
    const list = s.writings.filter((w) => writingFilter === "all" || w.task === writingFilter);
    const scored = s.writings.filter((w) => w.overall);
    const avg = scored.length ? (scored.reduce((a, w) => a + Number(w.overall), 0) / scored.length).toFixed(1) : "--";
    const best = scored.length ? Math.max(...scored.map((w) => Number(w.overall))).toFixed(1) : "--";
    $("wrStats").innerHTML = `
      <div class="stat-box"><span class="stat-label">大作文</span><strong>${s.writings.filter((w) => w.task === "Task 2").length} 篇</strong></div>
      <div class="stat-box"><span class="stat-label">小作文</span><strong>${s.writings.filter((w) => w.task === "Task 1").length} 篇</strong></div>
      <div class="stat-box"><span class="stat-label">平均分</span><strong>${avg}</strong></div>
      <div class="stat-box"><span class="stat-label">最高分</span><strong>${best}</strong></div>`;
    const badge = $("writingCountBadge");
    if (badge) badge.textContent = s.writings.length;
    if (!list.length) {
      $("wrList").innerHTML = `<div class="card empty-state">还没有作文。每周至少 1 大 1 小，写完点「复制给 AI 批改」发给教练。</div>`;
      return;
    }
    $("wrList").innerHTML = list.map((w) => `
      <div class="card record-card wr-card">
        <div class="wr-card-head">
          <span class="pill-tag ${w.task === "Task 1" ? "t1" : "t2"}">${w.task === "Task 1" ? "小作文" : "大作文"}</span>
          <span class="muted">${esc(w.date)}${w.source ? " · " + esc(w.source) : ""} · ${countWords(w.essay)} 词</span>
          <span class="wr-score ${w.overall ? "" : "pending"}">${w.overall ? w.overall : "待批改"}</span>
        </div>
        <p class="wr-prompt">${esc(w.prompt || "（无题目）")}</p>
        ${w.overall ? `<div class="wr-crit">${CRITERIA.map(([k, a]) => `<span>${a} <b>${w[k] || "—"}</b></span>`).join("")}</div>` : ""}
        <details><summary>展开正文${w.feedback ? " & 批改" : ""}</summary>
          <div class="wr-essay">${esc(w.essay).replace(/\n/g, "<br>")}</div>
          ${w.feedback ? `<div class="wr-feedback"><b>批改意见：</b><br>${esc(w.feedback).replace(/\n/g, "<br>")}</div>` : ""}
        </details>
        <div class="record-actions">
          <button class="btn btn-sm btn-ghost" data-wr-edit="${w.id}">编辑 / 填分</button>
          <button class="btn btn-sm btn-ghost" data-wr-copy="${w.id}">${SF_COPY} <span>复制给 AI</span></button>
          <button class="btn btn-sm btn-danger-ghost" data-wr-del="${w.id}">删除</button>
        </div>
      </div>`).join("");
  }

  function writingToAiText(w) {
    return `请按雅思官方四项标准（TR/TA、CC、LR、GRA）批改我的${w.task === "Task 1" ? "小作文 Task 1" : "大作文 Task 2"}，给出各项分数、主要扣分点、逐句修改和一段 Band 6.5–7 的升级版：\n\n【题目】${w.prompt}\n\n【正文】（${countWords(w.essay)} 词）\n${w.essay}`;
  }

  function bindWriting() {
    $("wrEssay").addEventListener("input", updateWordCount);
    $("wrTask").addEventListener("change", updateWordCount);
    CRITERIA.forEach(([k]) => $("wr_" + k).addEventListener("change", () => ($("wrOverall").textContent = calcOverall() || "—")));

    // 自动草稿：防止误关页面丢稿
    const DRAFT_KEY = "ielts_sprint_writing_draft";
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (d && d.essay) { $("wrPrompt").value = d.prompt || ""; $("wrEssay").value = d.essay; $("wrTask").value = d.task || "Task 2"; updateWordCount(); }
    } catch (e) { /* ignore */ }
    const saveDraft = () => {
      if ($("wrEditId").value) return;
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ prompt: $("wrPrompt").value, essay: $("wrEssay").value, task: $("wrTask").value }));
    };
    ["wrPrompt", "wrEssay"].forEach((id) => $(id).addEventListener("input", saveDraft));

    $("btnSaveWriting").addEventListener("click", () => {
      const essay = $("wrEssay").value.trim();
      if (!essay) return App.toast("正文还是空的哦");
      const s = S();
      const id = $("wrEditId").value;
      const payload = {
        id: id || "wr-" + Date.now(),
        task: $("wrTask").value,
        date: $("wrDate").value || today(),
        source: $("wrSource").value.trim(),
        prompt: $("wrPrompt").value.trim(),
        essay,
        feedback: $("wrFeedback").value.trim(),
        overall: calcOverall()
      };
      CRITERIA.forEach(([k]) => (payload[k] = $("wr_" + k).value));
      if (id) {
        const i = s.writings.findIndex((w) => w.id === id);
        if (i >= 0) s.writings[i] = payload;
      } else s.writings.unshift(payload);
      s.writings.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      localStorage.removeItem(DRAFT_KEY);
      App.save();
      resetWritingForm();
      App.toast(id ? "作文已更新" : "作文已保存！记得复制给 AI 批改");
    });

    $("btnCopyWriting").addEventListener("click", () => {
      const essay = $("wrEssay").value.trim();
      if (!essay) return App.toast("正文还是空的哦");
      copyText(writingToAiText({ task: $("wrTask").value, prompt: $("wrPrompt").value.trim(), essay }));
    });
    $("btnCancelWriting").addEventListener("click", resetWritingForm);

    $("wrFilter").addEventListener("click", (e) => {
      const p = e.target.closest(".pill");
      if (!p) return;
      $("wrFilter").querySelectorAll(".pill").forEach((x) => x.classList.remove("active"));
      p.classList.add("active");
      writingFilter = p.dataset.f;
      renderWritingList();
    });

    $("wrList").addEventListener("click", (e) => {
      const s = S();
      const ed = e.target.closest("[data-wr-edit]");
      const cp = e.target.closest("[data-wr-copy]");
      const dl = e.target.closest("[data-wr-del]");
      if (ed) {
        const w = s.writings.find((x) => x.id === ed.dataset.wrEdit);
        if (!w) return;
        $("wrEditId").value = w.id;
        $("wrTask").value = w.task;
        $("wrDate").value = w.date;
        $("wrSource").value = w.source || "";
        $("wrPrompt").value = w.prompt || "";
        $("wrEssay").value = w.essay || "";
        $("wrFeedback").value = w.feedback || "";
        CRITERIA.forEach(([k]) => ($("wr_" + k).value = w[k] || ""));
        $("wrOverall").textContent = calcOverall() || "—";
        $("wrFormTitle").textContent = "编辑作文 / 填写批改分数";
        $("btnCancelWriting").classList.remove("hidden");
        $("wrScoreBox").open = true;
        updateWordCount();
        $("writingRoot").scrollIntoView({ behavior: "smooth" });
      } else if (cp) {
        const w = s.writings.find((x) => x.id === cp.dataset.wrCopy);
        if (w) copyText(writingToAiText(w));
      } else if (dl) {
        if (!confirm("确定删除这篇作文？")) return;
        s.writings = s.writings.filter((x) => x.id !== dl.dataset.wrDel);
        App.save();
      }
    });

    document.querySelectorAll("[data-wr-timer]").forEach((b) =>
      b.addEventListener("click", () => {
        clearInterval(writingTimer);
        writingTimerLeft = Number(b.dataset.wrTimer);
        const disp = $("wrTimerDisplay");
        const draw = () => {
          const m = Math.floor(writingTimerLeft / 60), sec = writingTimerLeft % 60;
          disp.textContent = `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
          disp.classList.toggle("urgent", writingTimerLeft > 0 && writingTimerLeft <= 300);
        };
        if (!writingTimerLeft) { disp.textContent = "--:--"; disp.classList.remove("urgent"); return; }
        draw();
        writingTimer = setInterval(() => {
          writingTimerLeft--;
          draw();
          if (writingTimerLeft <= 0) { clearInterval(writingTimer); App.toast("⏰ 时间到！停笔检查"); }
        }, 1000);
      })
    );
  }

  // ==================== 3) 全局查词 ====================
  function formatSynonymsInline(w) {
    if (!w || !Array.isArray(w.synonyms) || !w.synonyms.length) return "";
    return w.synonyms
      .map((s) => (typeof s === "string" ? s : `${s.en}${s.cn ? "（" + s.cn + "）" : ""}`))
      .join(" · ");
  }

  function searchAll(q) {
    const s = S();
    const query = q.trim().toLowerCase();
    const core = [];
    s.days.forEach((d) => (d.words || []).forEach((w) => {
      const synText = formatSynonymsInline(w);
      const antText = Array.isArray(w.antonyms)
        ? w.antonyms.map((a) => (typeof a === "string" ? a : `${a.en} ${a.cn || ""}`)).join(" ")
        : "";
      const hay = [w.word, ...(w.forms || []), w.cn, w.enDef || "", ...(w.senses || []), synText, antText, ...(w.collocations || []), w.tip].join(" ").toLowerCase();
      if (!query || hay.includes(query)) core.push({ ...w, day: d, synText });
    }));
    const vocab = s.vocabBook.filter((v) => !query || [v.word, v.meaning, v.note].join(" ").toLowerCase().includes(query));
    const syn = [];
    s.practiceRecords.forEach((r) => (r.synonyms || "").split(/\n+/).forEach((line) => {
      const l = line.trim();
      if (l && (!query || l.toLowerCase().includes(query))) syn.push({ line: l, rec: r });
    }));
    return { core, vocab, syn };
  }

  function hl(text, q) {
    const t = esc(text || "");
    if (!q) return t;
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return t.replace(new RegExp(`(${esc(safe)})`, "ig"), "<mark>$1</mark>");
  }

  let srLiveTimer = null;
  let srLiveQueryId = 0;

  function renderOccPillsHtml(word, forms) {
    if (!App || typeof App.findWordOccurrences !== "function") return "";
    const occ = App.findWordOccurrences(word, forms || []);
    if (!occ.totalSources) return "";
    const pills = [
      ...occ.practices.map((p) => `<span class="sr-occ-pill is-pr">真题：${esc(p.source)} (${esc(p.typeLabel)})</span>`),
      ...occ.days.map((d) => `<span class="sr-occ-pill">${esc(d.shortLabel)}</span>`)
    ];
    return `<div class="sr-occ-row">${pills.join("")}</div>`;
  }

  function renderSearch() {
    const q = $("globalSearchInput").value.trim();
    const { core, vocab, syn } = searchAll(q);
    const isEn = /^[a-z][a-z\s'-]*$/i.test(q);
    const box = $("globalSearchResults");
    const lim = q ? 40 : 12;
    let html = "";
    if (q) {
      html += `<div class="search-online">
        <span class="muted">在线词典：</span>
        <a href="https://dictionary.cambridge.org/zhs/词典/英语-汉语-简体/${encodeURIComponent(q)}" target="_blank" rel="noopener">剑桥词典 ↗</a>
        <a href="https://www.youdao.com/result?word=${encodeURIComponent(q)}&lang=en" target="_blank" rel="noopener">有道 ↗</a>
        ${isEn ? `<button class="btn btn-sm btn-ghost" data-s-speak="${esc(q)}">${SF_SPEAK} <span>朗读</span></button>` : ""}
        ${isEn && !s_inVocab(q) ? `<button class="btn btn-sm btn-outline" data-s-add="${esc(q)}">+ 一键自动收录</button>` : ""}
      </div>`;
      if (isEn && q.length >= 2 && !core.some((w) => w.word.toLowerCase() === q.toLowerCase())) {
        html += `<div id="srLiveOnlineSlot"></div>`;
      }
    }
    html += `<div class="search-group"><div class="sg-title">串文高频词 <span>${core.length}</span></div>`;
    html += core.length ? core.slice(0, lim).map((w) => `
      <div class="sr-item">
        <div class="sr-main">
          <b class="sr-word">${hl(w.word, q)}</b><span class="phonetic">${esc(w.phonetic || "")}</span><span class="muted">${esc(w.pos || "")}</span>
          <span class="cat-chip">${esc(w.category || "")}</span>
        </div>
        <div class="sr-cn">${hl(w.cn, q)}</div>
        ${w.synText ? `<div class="sr-tip"><b>高频同义替换：</b>${hl(w.synText, q)}</div>` : ""}
        ${w.tip ? `<div class="sr-tip">${hl(w.tip, q)}</div>` : ""}
        ${renderOccPillsHtml(w.word, w.forms)}
        <div class="sr-actions">
          <button class="btn btn-sm btn-ghost" data-s-speak="${esc(w.word)}" title="朗读">${SF_SPEAK}</button>
          <button class="btn btn-sm btn-ghost" data-s-goday="${esc(w.day.id)}">${esc((w.day.label || "").split(" · ")[0])} →</button>
          ${s_inVocab(w.word) ? `<span class="muted">✓ 已在生词本</span>` : `<button class="btn btn-sm btn-ghost" data-s-addcore="${esc(w.word)}" data-cn="${esc(w.cn)}" data-cat="${esc(w.category || "")}">存生词本</button>`}
        </div>
      </div>`).join("") : `<div class="sr-empty">站内暂无匹配，上方将自动联网查词</div>`;
    html += `</div>`;

    html += `<div class="search-group"><div class="sg-title">我的生词本 <span>${vocab.length}</span></div>`;
    html += vocab.length ? vocab.slice(0, lim).map((v) => `
      <div class="sr-item">
        <div class="sr-main"><b class="sr-word">${hl(v.word, q)}</b>${v.phonetic ? `<span class="phonetic">${esc(v.phonetic)}</span>` : ""}<span class="cat-chip">${esc(v.category)}</span>${v.mastered ? `<span class="ok-chip">已掌握</span>` : ""}</div>
        <div class="sr-cn">${hl(v.meaning, q)}</div>
        ${v.note ? `<div class="sr-tip">${hl(v.note, q)}</div>` : ""}
        ${renderOccPillsHtml(v.word)}
        <div class="sr-actions"><button class="btn btn-sm btn-ghost" data-s-speak="${esc(v.word)}" title="朗读">${SF_SPEAK}</button></div>
      </div>`).join("") : `<div class="sr-empty">${q ? "生词本里没有" : "生词本还是空的"}</div>`;
    html += `</div>`;

    html += `<div class="search-group"><div class="sg-title">同义替换库（来自精听精读记录） <span>${syn.length}</span></div>`;
    html += syn.length ? syn.slice(0, lim * 2).map((x) => `
      <div class="sr-item syn"><span>${hl(x.line, q)}</span><span class="muted">${esc(x.rec.source)}</span></div>`).join("") : `<div class="sr-empty">在精听精读记录里填“同义替换”，这里会自动汇总成你的专属替换库</div>`;
    html += `</div>`;
    box.innerHTML = html;

    // Live debounced online dictionary lookup for unknown English words
    clearTimeout(srLiveTimer);
    const slot = $("srLiveOnlineSlot");
    if (slot && isEn && q.length >= 2 && App && typeof App.lookupWordOnline === "function") {
      const myReq = ++srLiveQueryId;
      slot.innerHTML = `<div class="sr-online-card"><span class="muted">正在联网查词「${esc(q)}」的音标、中文释义与同义词…</span></div>`;
      srLiveTimer = setTimeout(async () => {
        const res = await App.lookupWordOnline(q);
        if (myReq !== srLiveQueryId) return;
        const curSlot = $("srLiveOnlineSlot");
        if (!curSlot) return;
        if (!res) {
          curSlot.innerHTML = "";
          return;
        }
        const synLine = Array.isArray(res.synonyms) && res.synonyms.length
          ? `<div class="sr-tip"><b>高频同义词：</b>${esc(res.synonyms.join(" / "))}</div>` : "";
        const occHtml = renderOccPillsHtml(res.word);
        curSlot.innerHTML = `
          <div class="sr-online-card">
            <div class="sr-online-head">
              <div><b class="sr-word">${esc(res.word)}</b> <span class="phonetic">${esc(res.phonetic || "")}</span> <span class="muted">${esc(res.pos || "")}</span></div>
              <div style="display:flex;gap:6px;align-items:center;">
                <button class="btn btn-sm btn-ghost" data-s-speak="${esc(res.word)}" title="朗读">${SF_SPEAK}</button>
                ${s_inVocab(res.word) ? `<span class="muted">✓ 已在生词本</span>` : `<button class="btn btn-sm btn-primary" data-s-add="${esc(res.word)}">+ 存入生词本</button>`}
              </div>
            </div>
            <div class="sr-cn">${esc(res.cn || "")}</div>
            ${res.enDef && res.enDef !== res.cn ? `<div class="muted" style="font-size:11.5px;margin-top:2px;">${esc(res.enDef)}</div>` : ""}
            ${synLine}
            ${occHtml}
          </div>`;
      }, 280);
    }
  }

  function s_inVocab(word) {
    const w = word.trim().toLowerCase();
    return S().vocabBook.some((v) => v.word.toLowerCase() === w);
  }

  function openSearch(prefill) {
    App.openModal("modalSearch");
    const inp = $("globalSearchInput");
    if (typeof prefill === "string") inp.value = prefill;
    renderSearch();
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  }
  App.openSearch = openSearch;

  function bindSearch() {
    $("btnGlobalSearch").addEventListener("click", () => openSearch());
    $("globalSearchInput").addEventListener("input", renderSearch);
    document.addEventListener("keydown", (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        openSearch();
      } else if (e.key === "Escape") {
        App.closeAllModals();
        const r = $("modalReport");
        if (r) r.classList.add("hidden");
      }
    });
    $("globalSearchResults").addEventListener("click", (e) => {
      const sp = e.target.closest("[data-s-speak]");
      const gd = e.target.closest("[data-s-goday]");
      const ad = e.target.closest("[data-s-add]");
      const ac = e.target.closest("[data-s-addcore]");
      if (sp) App.speak(sp.dataset.sSpeak);
      else if (gd) { App.closeAllModals(); App.selectDay(gd.dataset.sGoday); App.goTab("daily"); }
      else if (ad) {
        App.addWord({ word: ad.dataset.sAdd, meaning: "", category: "雅思哥生词", autoEnrich: true });
        renderSearch();
      } else if (ac) {
        App.addWord({ word: ac.dataset.sAddcore, meaning: ac.dataset.cn, category: ac.dataset.cat || "雅思哥生词", autoEnrich: true });
        renderSearch();
      }
    });
  }

  // ==================== 4) 云端同步 + 4 设备在线控制 + 私人密码锁 ====================
  const SB_URL = "https://istontudjeojsheagpdl.supabase.co";
  const SB_KEY = "sb_publishable_LImM964KweOMgvVRnepJiw_SJVgc-BP";
  const LEGACY_AUTH_KEY = "ielts_sprint_auth_token_v2";
  const CLOUD_SESSION_KEY = "bandup_cloud_session_v1";
  const DEVICE_ID_KEY = "bandup_device_id_v1";
  const MAX_ONLINE_DEVICES = 4;

  const cloudState = {
    status: "idle",
    devices: [],
    lastCloudUpdatedAt: null,
    applyingCloud: false,
    pushing: false,
    pushTimer: null,
    pendingAuth: null
  };

  let fallbackDeviceId = null;
  function getDeviceId() {
    try {
      let id = localStorage.getItem(DEVICE_ID_KEY);
      if (id && id.length >= 8) return id;
      id = "dev_" + (window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : (Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 12)));
      localStorage.setItem(DEVICE_ID_KEY, id);
      return id;
    } catch (e) {
      if (!fallbackDeviceId) {
        fallbackDeviceId = "dev_mem_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
      }
      return fallbackDeviceId;
    }
  }

  function detectDeviceName() {
    const ua = navigator.userAgent || "";
    const plat = navigator.platform || "";
    const isIpad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    let os = "Desktop";
    if (/iPhone/i.test(ua)) os = "iPhone";
    else if (isIpad) os = "iPad";
    else if (/Android/i.test(ua)) os = "Android";
    else if (/Mac/i.test(plat) || /Macintosh/i.test(ua)) os = "Mac";
    else if (/Win/i.test(plat) || /Windows/i.test(ua)) os = "Windows";
    else if (/Linux/i.test(ua)) os = "Linux";

    let browser = "Browser";
    if (/MicroMessenger/i.test(ua)) browser = "微信";
    else if (/Edg\//i.test(ua) || /EdgiOS/i.test(ua)) browser = "Edge";
    else if (/CriOS/i.test(ua) || (/Chrome\//i.test(ua) && !/Edg\//i.test(ua))) browser = "Chrome";
    else if (/FxiOS/i.test(ua) || /Firefox\//i.test(ua)) browser = "Firefox";
    else if (/Safari\//i.test(ua)) browser = "Safari";

    return `${os} · ${browser}`;
  }

  function deviceIconSvg(name = "") {
    if (/iPhone|Android/i.test(name)) {
      return `<svg class="sf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.8"></rect><line x1="10.5" y1="18.2" x2="13.5" y2="18.2"></line></svg>`;
    }
    if (/iPad/i.test(name)) {
      return `<svg class="sf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2.5"></rect><line x1="10.5" y1="17.8" x2="13.5" y2="17.8"></line></svg>`;
    }
    return `<svg class="sf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12.5" rx="2"></rect><path d="M2 19.5h20"></path></svg>`;
  }

  function fmtRelativeTime(iso) {
    if (!iso) return "刚刚";
    const ts = new Date(iso).getTime();
    if (isNaN(ts)) return "刚刚";
    const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (sec < 45) return "刚刚活跃";
    if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} 小时前`;
    const d = new Date(ts);
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function fmtClockNow() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  }

  async function sbRpc(fn, body) {
    const res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(body || {})
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { /* ignore */ }
    if (!res.ok) {
      throw new Error((data && data.message) || `HTTP ${res.status}`);
    }
    return data;
  }

  function getCloudSession() {
    try {
      const sRaw = sessionStorage.getItem(CLOUD_SESSION_KEY);
      if (sRaw) {
        const sObj = JSON.parse(sRaw);
        if (sObj && sObj.token && sObj.deviceId) return sObj;
      }
      const lRaw = localStorage.getItem(CLOUD_SESSION_KEY);
      if (lRaw) {
        const lObj = JSON.parse(lRaw);
        if (lObj && lObj.token && lObj.deviceId && (!lObj.expires || lObj.expires > Date.now())) {
          return lObj;
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveCloudSession(token, deviceId, remember) {
    const payload = { token, deviceId, expires: Date.now() + 7 * 86400000 };
    try {
      localStorage.removeItem(LEGACY_AUTH_KEY);
      sessionStorage.removeItem(LEGACY_AUTH_KEY);
      sessionStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(payload));
      if (remember) {
        localStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(payload));
      } else {
        localStorage.removeItem(CLOUD_SESSION_KEY);
      }
    } catch (e) { /* ignore */ }
  }

  function clearCloudSession() {
    try {
      sessionStorage.removeItem(CLOUD_SESSION_KEY);
      localStorage.removeItem(CLOUD_SESSION_KEY);
      sessionStorage.removeItem(LEGACY_AUTH_KEY);
      localStorage.removeItem(LEGACY_AUTH_KEY);
    } catch (e) { /* ignore */ }
  }

  function isMeaningfulCloudState(st) {
    return !!(st && typeof st === "object" && Array.isArray(st.days) && st.days.length > 0);
  }

  function isUserTypingInApp() {
    const el = document.activeElement;
    if (!el || el.closest("#authGate")) return false;
    const tag = (el.tagName || "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  function setCloudUiStatus(status, subText) {
    cloudState.status = status;
    const dotTop = $("cloudSyncDot");
    const dotModal = $("cloudModalDot");
    [dotTop, dotModal].forEach((dot) => {
      if (!dot) return;
      dot.classList.remove("is-synced", "is-syncing", "is-offline");
      if (status === "synced") dot.classList.add("is-synced");
      else if (status === "syncing") dot.classList.add("is-syncing");
      else if (status === "offline") dot.classList.add("is-offline");
    });

    const titleEl = $("cloudStatusTitle");
    const subEl = $("cloudStatusText");
    if (titleEl) {
      titleEl.textContent =
        status === "syncing"
          ? "正在与云端同步..."
          : status === "offline"
          ? "云端暂未连上（本地仍已保存）"
          : "云端实时同步中";
    }
    if (subEl && subText) subEl.textContent = subText;

    const count = cloudState.devices.length;
    const badge = $("cloudDeviceBadge");
    if (badge) {
      if (count > 0) {
        badge.textContent = `${count}/${MAX_ONLINE_DEVICES}`;
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    }
    const cntEl = $("cloudDeviceCount");
    if (cntEl) cntEl.textContent = `${count} / ${MAX_ONLINE_DEVICES}`;
  }

  function renderOnlineDevices() {
    const listEl = $("cloudDeviceList");
    if (!listEl) return;
    const myId = getDeviceId();
    const devs = Array.isArray(cloudState.devices) ? [...cloudState.devices] : [];
    devs.sort((a, b) => {
      if (a.device_id === myId) return -1;
      if (b.device_id === myId) return 1;
      return new Date(b.last_seen || 0) - new Date(a.last_seen || 0);
    });

    if (!devs.length) {
      listEl.innerHTML = `<div class="device-empty">暂无在线设备记录，点右上角「刷新」重新获取。</div>`;
      return;
    }

    listEl.innerHTML = devs
      .map((d) => {
        const isSelf = d.device_id === myId;
        const name = d.device_name || "未知设备";
        return `
          <div class="device-row ${isSelf ? "is-self" : ""}">
            <div class="device-icon">${deviceIconSvg(name)}</div>
            <div class="device-meta">
              <div class="device-name-line">
                <strong class="device-name">${esc(name)}</strong>
                ${isSelf ? `<span class="device-self-badge">当前设备</span>` : `<span class="device-online-pill">在线</span>`}
              </div>
              <div class="device-time">${esc(fmtRelativeTime(d.last_seen))}</div>
            </div>
            <div class="device-act">
              ${
                isSelf
                  ? `<span class="device-self-note">本机</span>`
                  : `<button class="btn btn-sm btn-danger-ghost" data-kick-device="${esc(d.device_id)}">移除下线</button>`
              }
            </div>
          </div>`;
      })
      .join("");
  }

  function handleSessionKicked(msg) {
    clearTimeout(cloudState.pushTimer);
    cloudState.pushTimer = null;
    cloudState.devices = [];
    clearCloudSession();
    setCloudUiStatus("offline", "当前设备登录状态已失效");
    App.closeAllModals();
    lockGate();
    App.toast(msg || "此设备已被移出在线列表，请重新登录");
  }

  async function cloudPull({ silent = true, forceApply = false } = {}) {
    const sess = getCloudSession();
    if (!sess) return false;
    setCloudUiStatus("syncing");
    try {
      const res = await sbRpc("bandup_pull", {
        p_device_id: sess.deviceId,
        p_token: sess.token
      });
      if (!res || !res.ok) {
        if (res && res.error === "SESSION_EXPIRED") {
          handleSessionKicked();
          return false;
        }
        setCloudUiStatus("offline", "云端返回异常，稍后自动重试");
        return false;
      }
      cloudState.devices = Array.isArray(res.devices) ? res.devices : [];
      renderOnlineDevices();

      const hasCloudData = isMeaningfulCloudState(res.state);
      const isNewer = res.updated_at && res.updated_at !== cloudState.lastCloudUpdatedAt;
      const busyEditing = !forceApply && (cloudState.pushing || cloudState.pushTimer || isUserTypingInApp());

      if (hasCloudData && (forceApply || isNewer) && !busyEditing) {
        cloudState.applyingCloud = true;
        try {
          App.applyCloudState(res.state);
          renderAll();
        } finally {
          cloudState.applyingCloud = false;
        }
        cloudState.lastCloudUpdatedAt = res.updated_at || null;
      } else if (!hasCloudData) {
        // Cloud has not been initialized yet; seed it with local state
        cloudPush(true);
        return true;
      }

      setCloudUiStatus("synced", `已同步 · ${fmtClockNow()}`);
      if (!silent) App.toast("已从云端拉取最新学习进度");
      return true;
    } catch (e) {
      setCloudUiStatus("offline", "网络波动，待恢复后自动同步");
      if (!silent) App.toast("拉取失败，请检查网络连接");
      return false;
    }
  }

  async function cloudPush(immediate = false, { notify = false } = {}) {
    const sess = getCloudSession();
    if (!sess || cloudState.applyingCloud) return false;

    if (!immediate) {
      clearTimeout(cloudState.pushTimer);
      cloudState.pushTimer = setTimeout(() => {
        cloudState.pushTimer = null;
        cloudPush(true);
      }, 1200);
      return true;
    }

    clearTimeout(cloudState.pushTimer);
    cloudState.pushTimer = null;
    cloudState.pushing = true;
    setCloudUiStatus("syncing", "正在上传最新改动...");
    try {
      const payload = structuredClone(App.state);
      delete payload.dark; // Keep light/dark theme per device
      const res = await sbRpc("bandup_push", {
        p_device_id: sess.deviceId,
        p_token: sess.token,
        p_state: payload
      });
      if (!res || !res.ok) {
        if (res && res.error === "SESSION_EXPIRED") {
          handleSessionKicked();
          return false;
        }
        setCloudUiStatus("offline", "上传未成功，稍后自动重试");
        return false;
      }
      cloudState.lastCloudUpdatedAt = res.updated_at || cloudState.lastCloudUpdatedAt;
      if (Array.isArray(res.devices)) {
        cloudState.devices = res.devices;
        renderOnlineDevices();
      }
      setCloudUiStatus("synced", `已同步 · ${fmtClockNow()}`);
      if (notify) App.toast("已上传当前进度到云端");
      return true;
    } catch (e) {
      setCloudUiStatus("offline", "离线模式：已保存本地，连网后请点上传");
      if (notify) App.toast("上传失败，请检查网络");
      return false;
    } finally {
      cloudState.pushing = false;
    }
  }

  async function cloudKick(targetDeviceId) {
    const sess = getCloudSession();
    if (!sess || !targetDeviceId) return;
    try {
      const res = await sbRpc("bandup_kick", {
        p_device_id: sess.deviceId,
        p_token: sess.token,
        p_target_device_id: targetDeviceId
      });
      if (!res || !res.ok) {
        if (res && res.error === "SESSION_EXPIRED") {
          handleSessionKicked();
          return;
        }
        App.toast("移除失败，请重试");
        return;
      }
      cloudState.devices = Array.isArray(res.devices) ? res.devices : [];
      renderOnlineDevices();
      setCloudUiStatus("synced", `已同步 · ${fmtClockNow()}`);
      App.toast("已将该设备移出在线列表");
    } catch (e) {
      App.toast("网络异常，移除设备失败");
    }
  }

  async function cloudLogout() {
    const sess = getCloudSession();
    clearTimeout(cloudState.pushTimer);
    cloudState.pushTimer = null;
    clearCloudSession();
    cloudState.devices = [];
    setCloudUiStatus("idle");
    if (!sess) return;
    try {
      await sbRpc("bandup_logout", {
        p_device_id: sess.deviceId,
        p_token: sess.token
      });
    } catch (e) { /* best-effort */ }
  }

  async function sha256Hex(str) {
    if (window.crypto && window.crypto.subtle) {
      const buf = new TextEncoder().encode(str);
      const digest = await window.crypto.subtle.digest("SHA-256", buf);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    // Pure JS SHA-256 fallback for non-secure file:// contexts if subtle is unavailable
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let result = "";
    const words = [];
    const asciiBitLength = str.length * 8;
    let hash = [];
    const k = [];
    let primeCounter = 0;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    str += "\x80";
    while ((str.length % 64) - 56) str += "\x00";
    for (let i = 0; i < str.length; i++) {
      const j = str.charCodeAt(i);
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;
    for (let j = 0; j < words.length; ) {
      const w = words.slice(j, (j += 16));
      const oldHash = hash.slice(0);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = hash[0], e = hash[4];
        const temp1 =
          hash[7] +
          (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
          ((e & hash[5]) ^ (~e & hash[6])) +
          k[i] +
          (w[i] =
            i < 16
              ? w[i]
              : (w[i - 16] +
                  (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                  w[i - 7] +
                  (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
                0);
        const temp2 =
          (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
          ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
        hash.pop();
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (let i = 0; i < 8; i++) {
      for (let j = 3; j + 1; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? 0 : "") + b.toString(16);
      }
    }
    return result;
  }

  function isUnlocked() {
    return !!getCloudSession();
  }

  function unlockGate(instant = false) {
    const gate = $("authGate");
    if (!gate) return;
    if (instant) {
      gate.classList.add("hidden");
      document.body.classList.remove("auth-locked");
      return;
    }
    gate.classList.add("unlocking");
    document.body.classList.remove("auth-locked");
    document.body.classList.add("auth-revealing");
    setTimeout(() => {
      gate.classList.add("hidden");
      gate.classList.remove("unlocking");
      document.body.classList.remove("auth-revealing");
    }, 560);
  }

  const APPLE_ARROW_SVG = `<svg class="apple-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;
  const APPLE_CHECK_SVG = `<svg class="apple-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

  function lockGate() {
    const gate = $("authGate");
    if (!gate) return;
    clearCloudSession();
    cloudState.pendingAuth = null;
    if ($("authPass")) $("authPass").value = "";
    if ($("authError")) $("authError").classList.add("hidden");
    if ($("authMaxDevicesBox")) $("authMaxDevicesBox").classList.add("hidden");
    const submitBtn = gate.querySelector(".auth-submit");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("is-verifying", "is-success");
      submitBtn.innerHTML = APPLE_ARROW_SVG;
    }
    const card = gate.querySelector(".auth-card");
    if (card) card.classList.remove("is-verified", "shake");
    gate.classList.remove("hidden", "unlocking");
    gate.classList.add("locking");
    document.body.classList.add("auth-locked");
    setTimeout(() => gate.classList.remove("locking"), 560);
    setTimeout(() => { if ($("authUser")) $("authUser").focus(); }, 120);
  }

  function showMaxDevicesBox(devices) {
    const box = $("authMaxDevicesBox");
    const list = $("authMaxDevicesList");
    if (!box || !list) return;
    const arr = Array.isArray(devices) ? devices : [];
    list.innerHTML = arr
      .map(
        (d) => `
        <div class="auth-max-item">
          <span class="auth-max-name">${esc(d.device_name || "未知设备")}</span>
          <span class="auth-max-time">${esc(fmtRelativeTime(d.last_seen))}</span>
        </div>`
      )
      .join("");
    box.classList.remove("hidden");
  }

  function initAuthGate() {
    const gate = $("authGate");
    const form = $("authForm");
    if (!gate || !form) return;

    // Clear legacy local-only token so every device registers with cloud sync cleanly
    try {
      localStorage.removeItem(LEGACY_AUTH_KEY);
      sessionStorage.removeItem(LEGACY_AUTH_KEY);
    } catch (e) { /* ignore */ }

    if (isUnlocked()) {
      unlockGate(true);
      setTimeout(() => cloudPull({ silent: true }), 120);
    } else {
      document.body.classList.add("auth-locked");
      setTimeout(() => { if ($("authUser")) $("authUser").focus(); }, 50);
    }

    async function performCloudLogin({ hash, remember, kickOldest = false }) {
      const submitBtn = form.querySelector(".auth-submit");
      const kickBtn = $("btnKickOldestLogin");
      const card = gate.querySelector(".auth-card");
      const errEl = $("authError");
      const maxBox = $("authMaxDevicesBox");

      errEl.classList.add("hidden");
      if (!kickOldest && maxBox) maxBox.classList.add("hidden");
      if (card) card.classList.remove("shake");

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add("is-verifying");
        submitBtn.innerHTML = `<span class="auth-spinner"></span>`;
      }
      if (kickBtn) kickBtn.disabled = true;

      const deviceId = getDeviceId();
      const deviceName = detectDeviceName();

      try {
        const [res] = await Promise.all([
          sbRpc("bandup_login", {
            p_pass_hash: hash,
            p_device_id: deviceId,
            p_device_name: deviceName,
            p_kick_oldest: kickOldest
          }),
          new Promise((r) => setTimeout(r, 420))
        ]);

        if (res && res.ok && res.token) {
          cloudState.pendingAuth = null;
          if (maxBox) maxBox.classList.add("hidden");
          saveCloudSession(res.token, deviceId, remember);
          cloudState.devices = Array.isArray(res.devices) ? res.devices : [];
          renderOnlineDevices();

          if (isMeaningfulCloudState(res.state)) {
            cloudState.applyingCloud = true;
            try {
              App.applyCloudState(res.state);
              renderAll();
            } finally {
              cloudState.applyingCloud = false;
            }
            cloudState.lastCloudUpdatedAt = res.updated_at || null;
            setCloudUiStatus("synced", `已从云端同步 · ${fmtClockNow()}`);
          } else {
            cloudPush(true);
          }

          if (card) card.classList.add("is-verified");
          if (submitBtn) {
            submitBtn.classList.remove("is-verifying");
            submitBtn.classList.add("is-success");
            submitBtn.innerHTML = APPLE_CHECK_SVG;
          }

          setTimeout(() => {
            unlockGate(false);
            App.toast(
              kickOldest
                ? `Welcome back, Kai · 已替换最早设备 (${cloudState.devices.length}/${MAX_ONLINE_DEVICES})`
                : `Welcome back, Kai · 云端已同步 (${cloudState.devices.length}/${MAX_ONLINE_DEVICES})`
            );
          }, 420);
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove("is-verifying");
          submitBtn.innerHTML = APPLE_ARROW_SVG;
        }
        if (kickBtn) kickBtn.disabled = false;

        if (res && res.error === "MAX_DEVICES") {
          cloudState.pendingAuth = { hash, remember };
          showMaxDevicesBox(res.devices);
          if (card) {
            void card.offsetWidth;
            card.classList.add("shake");
          }
          return;
        }

        errEl.textContent = "Incorrect account ID or password.";
        errEl.classList.remove("hidden");
        if (card) {
          void card.offsetWidth;
          card.classList.add("shake");
        }
        $("authPass").value = "";
        $("authPass").focus();
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove("is-verifying");
          submitBtn.innerHTML = APPLE_ARROW_SVG;
        }
        if (kickBtn) kickBtn.disabled = false;
        errEl.textContent = "无法连接云端服务器，请检查网络后重试。";
        errEl.classList.remove("hidden");
      }
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector(".auth-submit");
      if (submitBtn && submitBtn.disabled) return;

      const user = ($("authUser").value || "").trim();
      const pass = ($("authPass").value || "").trim();
      const remember = $("authRemember").checked;
      const hash = await sha256Hex(`ielts_sprint_v1:${user}:${pass}`);
      performCloudLogin({ hash, remember, kickOldest: false });
    });

    const btnKickOldest = $("btnKickOldestLogin");
    if (btnKickOldest) {
      btnKickOldest.addEventListener("click", () => {
        if (!cloudState.pendingAuth) return;
        performCloudLogin({
          hash: cloudState.pendingAuth.hash,
          remember: cloudState.pendingAuth.remember,
          kickOldest: true
        });
      });
    }

    const btnLock = $("btnLockApp");
    if (btnLock) {
      btnLock.addEventListener("click", async () => {
        await cloudLogout();
        lockGate();
        App.toast("BandUp 已锁定并释放设备名额");
      });
    }

    // Bind Cloud Modal Controls
    const btnBackup = $("btnBackup");
    if (btnBackup) {
      btnBackup.addEventListener("click", () => {
        renderOnlineDevices();
        setCloudUiStatus(cloudState.status);
        cloudPull({ silent: true });
      });
    }
    const btnPull = $("btnCloudPull");
    if (btnPull) {
      btnPull.addEventListener("click", () => cloudPull({ silent: false, forceApply: true }));
    }
    const btnPush = $("btnCloudPush");
    if (btnPush) {
      btnPush.addEventListener("click", () => cloudPush(true, { notify: true }));
    }
    const btnRefresh = $("btnRefreshDevices");
    if (btnRefresh) {
      btnRefresh.addEventListener("click", () => cloudPull({ silent: false }));
    }
    const devList = $("cloudDeviceList");
    if (devList) {
      devList.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-kick-device]");
        if (!btn) return;
        if (!confirm("确定让这台设备立即下线？下线后该设备需要重新输入账号密码登录。")) return;
        cloudKick(btn.dataset.kickDevice);
      });
    }

    // Auto-pull when returning to the tab & periodic background sync (45s)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && isUnlocked()) {
        cloudPull({ silent: true });
      }
    });
    setInterval(() => {
      if (document.visibilityState === "visible" && isUnlocked()) {
        cloudPull({ silent: true });
      }
    }, 45000);

    // Interactive Zero-Lag Core + Tapered Comet-Tail Aurora on Lock Screen
    let targetX = -400, targetY = -400;
    let tx1 = -400, ty1 = -400;
    let tx2 = -400, ty2 = -400;
    let trailActive = false;
    let trailRaf = null;

    function stepTrail() {
      if (gate.classList.contains("hidden")) {
        trailRaf = null;
        return;
      }
      tx1 += (targetX - tx1) * 0.24;
      ty1 += (targetY - ty1) * 0.24;
      tx2 += (targetX - tx2) * 0.13;
      ty2 += (targetY - ty2) * 0.13;

      gate.style.setProperty("--tx1", `${tx1.toFixed(1)}px`);
      gate.style.setProperty("--ty1", `${ty1.toFixed(1)}px`);
      gate.style.setProperty("--tx2", `${tx2.toFixed(1)}px`);
      gate.style.setProperty("--ty2", `${ty2.toFixed(1)}px`);

      const dist = Math.hypot(targetX - tx2, targetY - ty2);
      if (dist > 0.5) {
        trailRaf = requestAnimationFrame(stepTrail);
      } else {
        trailRaf = null;
      }
    }

    gate.addEventListener("mousemove", (e) => {
      const rect = gate.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;
      // Primary core glow updates instantaneously (zero lag even on fast cursor flicks)
      gate.style.setProperty("--mx", `${targetX.toFixed(1)}px`);
      gate.style.setProperty("--my", `${targetY.toFixed(1)}px`);
      if (!trailActive) {
        trailActive = true;
        tx1 = tx2 = targetX;
        ty1 = ty2 = targetY;
      }
      if (!trailRaf) trailRaf = requestAnimationFrame(stepTrail);

      const card = $("authCard");
      if (card) {
        const cr = card.getBoundingClientRect();
        card.style.setProperty("--cx", `${e.clientX - cr.left}px`);
        card.style.setProperty("--cy", `${e.clientY - cr.top}px`);
      }
    });

    // Global Card Cursor Spotlight inside Workbench (Linear / Vercel style hover feedback)
    document.addEventListener("mousemove", (e) => {
      const card = e.target.closest(".card, .skill-card, .record-card");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--cx", `${e.clientX - r.left}px`);
      card.style.setProperty("--cy", `${e.clientY - r.top}px`);
    });
  }

  // ==================== 5) 剑桥真题原文 · 熟词/生词智能雷达 ====================
  const BASIC_STOPWORDS = new Set(
    ("a,about,above,across,after,again,against,ago,all,almost,alone,along,already,also,although,always,am,among,an,and,another,any,anyone,anything,appear,area,around,as,ask,at,away,back,bad,be,became,because,become,bed,been,before,began,begin,behind,being,believe,below,best,better,between,big,bird,black,blue,boat,body,book,both,box,boy,bring,brought,build,built,bus,but,buy,by,call,called,came,can,cannot,car,care,carry,case,cat,change,check,child,children,city,class,clear,close,cold,color,come,coming,common,company,complete,could,country,course,cover,cut,dark,data,day,days,decide,deep,did,different,do,does,dog,doing,done,door,down,draw,drive,dry,during,each,early,earth,east,easy,eat,eight,either,else,end,enough,even,ever,every,everyone,everything,example,eye,eyes,face,fact,fall,family,far,farm,fast,father,feel,feet,few,field,find,fine,fire,first,fish,five,floor,follow,food,foot,for,form,found,four,free,friend,friends,from,front,full,fun,game,gave,get,getting,girl,give,given,glass,go,going,gold,gone,good,got,government,great,green,ground,group,grow,had,hair,half,hand,hands,happen,happened,happy,hard,has,have,having,he,head,hear,heard,heart,heavy,help,her,here,high,him,himself,his,hold,home,horse,hot,hour,hours,house,how,however,hundred,idea,if,important,in,information,inside,instead,into,is,island,it,its,itself,job,just,keep,kept,kind,king,knew,know,known,land,language,large,last,late,later,laugh,law,lay,lead,learn,least,leave,left,less,let,letter,level,life,light,like,likely,line,list,listen,little,live,lived,living,local,long,longer,look,looked,looking,lost,lot,love,low,machine,made,main,make,making,man,many,map,mark,matter,may,maybe,me,mean,means,men,might,mile,miles,million,mind,minute,minutes,miss,Modern,money,month,months,moon,more,morning,most,mother,mountain,move,moved,much,music,must,my,myself,name,national,natural,near,nearly,need,needed,needs,never,new,news,next,nice,night,nine,no,none,nor,north,not,note,nothing,notice,now,number,numbers,of,off,often,oh,oil,ok,old,on,once,one,ones,only,open,opened,or,order,other,others,our,out,outside,over,own,page,paper,part,parts,pass,passed,past,pay,people,per,perhaps,period,person,picture,piece,place,places,plan,plane,plant,plants,play,played,please,point,points,poor,possible,power,present,president,press,pretty,price,probably,problem,problems,program,public,pull,put,question,questions,quickly,quite,rain,ran,reach,read,reading,ready,real,really,reason,red,remember,rest,result,results,return,rich,ride,right,Direct,river,road,rock,room,round,rule,run,running,said,same,sat,saw,say,saying,says,school,science,sea,second,section,see,seem,seemed,seems,seen,self,send,sense,sent,service,set,seven,several,shall,shape,she,ship,short,should,show,showed,shown,shows,side,simple,since,sing,single,sister,sit,six,size,sleep,slow,small,snow,so,social,some,someone,something,sometimes,son,song,soon,sound,south,space,speak,special,stand,star,start,started,state,states,stay,step,steps,still,stood,stop,story,street,strong,student,students,study,such,suddenly,summer,sun,sure,surface,system,table,take,taken,taking,talk,tall,teach,team,tell,ten,test,than,that,the,their,them,themselves,then,there,therefore,these,they,thing,things,think,thinking,third,this,those,though,thought,thousand,three,through,thus,time,times,to,today,together,told,too,took,top,total,toward,towards,town,trade,train,tree,trees,tried,true,try,trying,turn,turned,two,type,under,understand,unit,until,up,upon,us,use,used,using,usually,value,various,very,view,voice,wait,walk,walked,wall,want,wanted,wants,war,warm,was,watch,water,way,ways,we,week,weeks,weight,well,went,were,west,what,whatever,when,where,whether,which,while,white,who,whole,whom,whose,why,wide,wife,will,wind,window,winter,wish,with,within,without,woman,women,wonder,wood,word,words,work,worked,working,works,world,would,write,written,wrong,wrote,year,years,yes,yet,you,young,your").toLowerCase().split(",")
  );

  let azCurrentListTab = "new";
  let azLastResult = { coreList: [], vocabList: [], newList: [] };
  let azSelectedToken = "";

  function buildWordIndex() {
    const s = S();
    const coreMap = new Map();
    const vocabMap = new Map();

    const addVariants = (map, wordStr, obj) => {
      const w = wordStr.trim().toLowerCase();
      if (!w) return;
      map.set(w, obj);
      // Common inflection variants
      map.set(w + "s", obj);
      map.set(w + "es", obj);
      map.set(w + "d", obj);
      map.set(w + "ed", obj);
      map.set(w + "ing", obj);
      map.set(w + "ly", obj);
      if (w.endsWith("e")) {
        map.set(w.slice(0, -1) + "ing", obj);
        map.set(w.slice(0, -1) + "ed", obj);
      }
      if (w.endsWith("y") && w.length > 2) {
        map.set(w.slice(0, -1) + "ies", obj);
        map.set(w.slice(0, -1) + "ied", obj);
      }
    };

    (s.days || []).forEach((d) => {
      (d.words || []).forEach((wObj) => {
        const item = { ...wObj, dayId: d.id, dayLabel: (d.label || "").split(" · ")[0] || d.id };
        addVariants(coreMap, wObj.word, item);
        (wObj.forms || []).forEach((f) => addVariants(coreMap, f, item));
      });
    });

    (s.vocabBook || []).forEach((vObj) => {
      addVariants(vocabMap, vObj.word, vObj);
    });

    return { coreMap, vocabMap };
  }

  function guessBaseWord(rawLower, coreMap, vocabMap) {
    if (vocabMap.has(rawLower)) return { type: "vocab", data: vocabMap.get(rawLower) };
    if (coreMap.has(rawLower)) return { type: "core", data: coreMap.get(rawLower) };
    return null;
  }

  function runPassageAnalyzer() {
    const raw = ($("azRawText").value || "").trim();
    if (!raw) {
      App.toast("请先粘贴剑桥雅思阅读或听力原文");
      return;
    }

    const { coreMap, vocabMap } = buildWordIndex();
    const matchedCore = new Map();
    const matchedVocab = new Map();
    const newWords = new Map();

    // Split into paragraphs and tokenize words while keeping punctuation
    const paragraphs = raw.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    const htmlParagraphs = paragraphs.map((para) => {
      const tokens = para.split(/([A-Za-z]+(?:['’-][A-Za-z]+)*)/g);
      return (
        "<p>" +
        tokens
          .map((tok) => {
            if (!/^[A-Za-z]/.test(tok)) return esc(tok);
            const low = tok.toLowerCase();
            const match = guessBaseWord(low, coreMap, vocabMap);
            if (match && match.type === "vocab") {
              const v = match.data;
              matchedVocab.set(v.word.toLowerCase(), v);
              return `<span class="az-tok az-tok-vocab" data-az-word="${esc(v.word)}" title="生词本：${esc(v.meaning)}">${esc(tok)}</span>`;
            }
            if (match && match.type === "core") {
              const c = match.data;
              matchedCore.set(c.word.toLowerCase(), c);
              return `<span class="az-tok az-tok-core" data-az-word="${esc(c.word)}" title="${esc(c.dayLabel)} 高频词：${esc(c.cn)}">${esc(tok)}</span>`;
            }
            // Check if candidate for unrecorded medium/advanced word
            const cleanWord = low.replace(/['’-].*$/, "");
            if (cleanWord.length >= 4 && !BASIC_STOPWORDS.has(low) && !BASIC_STOPWORDS.has(cleanWord)) {
              newWords.set(low, (newWords.get(low) || 0) + 1);
              return `<span class="az-tok az-tok-new" data-az-word="${esc(low)}">${esc(tok)}</span>`;
            }
            return `<span class="az-tok" data-az-word="${esc(low)}">${esc(tok)}</span>`;
          })
          .join("") +
        "</p>"
      );
    });

    $("azArticleView").innerHTML = htmlParagraphs.join("");

    azLastResult = {
      coreList: Array.from(matchedCore.values()),
      vocabList: Array.from(matchedVocab.values()),
      newList: Array.from(newWords.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([w, count]) => ({ word: w, count }))
    };

    $("azCountCore").textContent = azLastResult.coreList.length;
    $("azCountVocab").textContent = azLastResult.vocabList.length;
    $("azCountNew").textContent = azLastResult.newList.length;
    $("azTabNewCnt").textContent = azLastResult.newList.length;
    $("azTabMatchCnt").textContent = azLastResult.coreList.length + azLastResult.vocabList.length;

    renderAzSideList();
  }

  function renderAzSideList() {
    const box = $("azWordList");
    if (!box) return;
    if (azCurrentListTab === "new") {
      if (!azLastResult.newList.length) {
        box.innerHTML = `<div class="sr-empty">文中没有筛出未记录的新词，或请先点击上方「开始扫描匹配」。</div>`;
        return;
      }
      box.innerHTML = azLastResult.newList
        .map(
          (item) => `
          <button class="az-chip az-chip-new" data-az-pick="${esc(item.word)}">
            <span>${esc(item.word)}</span>
            ${item.count > 1 ? `<small>×${item.count}</small>` : ""}
          </button>`
        )
        .join("");
    } else {
      const allMatched = [
        ...azLastResult.vocabList.map((v) => ({ kind: "vocab", word: v.word, cn: v.meaning, tag: "生词本" })),
        ...azLastResult.coreList.map((c) => ({ kind: "core", word: c.word, cn: c.cn, tag: c.dayLabel }))
      ];
      if (!allMatched.length) {
        box.innerHTML = `<div class="sr-empty">本篇暂未匹配到之前背过的串文词或生词本词汇。</div>`;
        return;
      }
      box.innerHTML = allMatched
        .map(
          (m) => `
          <div class="az-match-row ${m.kind === "vocab" ? "is-vocab" : "is-core"}" data-az-pick="${esc(m.word)}">
            <div><b>${esc(m.word)}</b> <span class="cat-chip">${esc(m.tag)}</span></div>
            <div class="muted">${esc(m.cn)}</div>
          </div>`
        )
        .join("");
    }
  }

  let azLiveLookup = null;
  let azLookupSeq = 0;

  function inspectAzWord(rawWord) {
    const clean = (rawWord || "").trim();
    if (!clean) return;
    azSelectedToken = clean;
    azLiveLookup = null;
    const low = clean.toLowerCase();
    const { coreMap, vocabMap } = buildWordIndex();
    const match = guessBaseWord(low, coreMap, vocabMap);

    $("azInspWord").textContent = match ? match.data.word : clean;
    $("btnAzSpeak").disabled = false;
    $("btnAzAddVocab").disabled = false;

    const dictLinks = `
      <div class="az-dict-links">
        <span>外部词典：</span>
        <a href="https://dictionary.cambridge.org/zhs/词典/英语-汉语-简体/${encodeURIComponent(clean)}" target="_blank" rel="noopener">剑桥词典 ↗</a>
        <a href="https://www.youdao.com/result?word=${encodeURIComponent(clean)}&lang=en" target="_blank" rel="noopener">有道词典 ↗</a>
      </div>`;
    const occHtml = renderOccPillsHtml(match ? match.data.word : clean, match && match.data.forms ? match.data.forms : []);

    if (match && match.type === "vocab") {
      const v = match.data;
      $("azInspPhonetic").textContent = v.phonetic || "";
      $("azInspStatus").innerHTML = `<span class="az-badge az-b-vocab"><i class="az-dot is-vocab"></i> 已在我的生词本 (${esc(v.category)})</span>`;
      $("azInspDict").innerHTML = `<div class="az-meaning-box"><b>释义：</b>${esc(v.meaning)}${v.note ? `<br><small class="muted">备注：${esc(v.note)}</small>` : ""}</div>${occHtml}${dictLinks}`;
      $("azAddMeaning").value = v.meaning === "（待补充翻译）" ? "" : v.meaning;
      $("btnAzAddVocab").textContent = "更新生词本释义";
    } else if (match && match.type === "core") {
      const c = match.data;
      $("azInspPhonetic").textContent = c.phonetic || "";
      $("azInspStatus").innerHTML = `<span class="az-badge az-b-core"><i class="az-dot is-core"></i> 已背串文词 (${esc(c.dayLabel)} · ${esc(c.category)})</span>`;
      const synStr = formatSynonymsInline(c);
      $("azInspDict").innerHTML = `<div class="az-meaning-box"><b>${esc(c.pos || "")} ${esc(c.cn)}</b>${synStr ? `<br><small><b>同义替换：</b>${esc(synStr)}</small>` : ""}${c.tip ? `<br><small class="muted">${esc(c.tip)}</small>` : ""}</div>${occHtml}${dictLinks}`;
      $("azAddMeaning").value = `${c.pos ? c.pos + " " : ""}${c.cn}`;
      $("btnAzAddVocab").textContent = "同时存入我的生词本";
    } else {
      $("azInspPhonetic").textContent = "";
      $("azInspStatus").innerHTML = `<span class="az-badge az-b-new"><i class="az-dot is-new"></i> 未记录新词（自动查词中…）</span>`;
      $("azInspDict").innerHTML = `<div class="az-live-box" id="azLiveBox"><span class="muted">正在自动拉取音标、中文释义与高频同义词…</span></div>${occHtml}${dictLinks}`;
      $("azAddMeaning").value = "";
      $("btnAzAddVocab").textContent = "加入我的生词本";

      if (App && typeof App.lookupWordOnline === "function") {
        const mySeq = ++azLookupSeq;
        App.lookupWordOnline(clean).then((res) => {
          if (mySeq !== azLookupSeq || azSelectedToken !== clean) return;
          const liveBox = $("azLiveBox");
          if (!res) {
            $("azInspStatus").innerHTML = `<span class="az-badge az-b-new"><i class="az-dot is-new"></i> 未记录新词（可手动输入释义）</span>`;
            if (liveBox) liveBox.innerHTML = `<span class="muted">暂未查到该词条，可直接点下方剑桥/有道速查。</span>`;
            return;
          }
          azLiveLookup = res;
          $("azInspPhonetic").textContent = res.phonetic || "";
          $("azInspStatus").innerHTML = `<span class="az-badge az-b-new"><i class="az-dot is-new"></i> 未记录新词（已自动补全，一键入库）</span>`;
          if (!$("azAddMeaning").value.trim()) {
            $("azAddMeaning").value = `${res.pos ? res.pos + " " : ""}${res.cn || ""}`.trim();
          }
          if (liveBox) {
            liveBox.innerHTML = `
              <div><b>${esc(res.pos || "")} ${esc(res.cn || "")}</b></div>
              ${res.enDef && res.enDef !== res.cn ? `<div class="muted" style="font-size:11.5px;margin-top:2px;">${esc(res.enDef)}</div>` : ""}
              ${res.synonyms && res.synonyms.length ? `<div style="margin-top:4px;font-size:11.5px;"><b>高频同义词：</b>${esc(res.synonyms.join(" / "))}</div>` : ""}
              ${res.example ? `<div class="muted" style="margin-top:3px;font-size:11px;">例句：${esc(res.example)}</div>` : ""}
            `;
          }
        });
      }
    }
  }

  function openPassageAnalyzer(title = "", text = "") {
    App.openModal("modalAnalyzer");
    if (title) $("azTitleInput").value = title;
    if (text) {
      $("azRawText").value = text;
      runPassageAnalyzer();
    }
  }

  function bindAnalyzer() {
    const btnOpen = $("btnOpenAnalyzer");
    if (btnOpen) {
      btnOpen.addEventListener("click", () => {
        const src = ($("prSource") && $("prSource").value.trim()) || "";
        const exc = ($("prExcerpt") && $("prExcerpt").value.trim()) || "";
        openPassageAnalyzer(src, exc);
      });
    }
    const btnTop = $("btnTopAnalyzer");
    if (btnTop) {
      btnTop.addEventListener("click", () => openPassageAnalyzer("", ""));
    }

    $("btnRunAnalyzer").addEventListener("click", runPassageAnalyzer);

    $("btnSaveAzToPractice").addEventListener("click", () => {
      const raw = ($("azRawText").value || "").trim();
      if (!raw) return App.toast("请先粘贴原文");
      const title = ($("azTitleInput").value || "").trim() || `剑雅真题精读 (${today()})`;
      const s = S();
      s.practiceRecords.unshift({
        id: "pr-" + Date.now(),
        type: "reading",
        date: today(),
        source: title,
        correct: "",
        total: 13,
        minutes: "",
        synonyms: "",
        notes: `词频雷达扫描：匹配已背高频词 ${azLastResult.coreList.length} 个，生词本词汇 ${azLastResult.vocabList.length} 个，筛出未记录新词 ${azLastResult.newList.length} 个。`,
        excerpt: raw
      });
      App.save();
      App.refresh();
      if (!(App.autoCheckTaskByTag && App.autoCheckTaskByTag("阅读", "真题雷达已入库"))) {
        App.toast("已存入「精听 & 精读记录」");
      }
    });

    $("azArticleView").addEventListener("click", (e) => {
      const tok = e.target.closest("[data-az-word]");
      if (!tok) return;
      $("azArticleView").querySelectorAll(".az-tok.active").forEach((el) => el.classList.remove("active"));
      tok.classList.add("active");
      inspectAzWord(tok.dataset.azWord);
    });

    $("azListTabs").addEventListener("click", (e) => {
      const p = e.target.closest("[data-az-tab]");
      if (!p) return;
      $("azListTabs").querySelectorAll(".pill").forEach((x) => x.classList.remove("active"));
      p.classList.add("active");
      azCurrentListTab = p.dataset.azTab;
      renderAzSideList();
    });

    $("azWordList").addEventListener("click", (e) => {
      const item = e.target.closest("[data-az-pick]");
      if (!item) return;
      inspectAzWord(item.dataset.azPick);
    });

    $("btnAzSpeak").addEventListener("click", () => {
      if (azSelectedToken) App.speak(azSelectedToken);
    });

    $("btnAzAddVocab").addEventListener("click", () => {
      if (!azSelectedToken) return;
      const meaning = ($("azAddMeaning").value || "").trim();
      const cat = $("azAddCat").value;
      const src = ($("azTitleInput").value || "").trim();
      const live = azLiveLookup && azLiveLookup.word && azLiveLookup.word.toLowerCase() === azSelectedToken.toLowerCase() ? azLiveLookup : null;
      const noteParts = [];
      if (live && live.synonyms && live.synonyms.length) noteParts.push(`同义替换：${live.synonyms.join(" / ")}`);
      if (src) noteParts.push(`来自真题：${src}`);
      App.addWord({
        word: azSelectedToken,
        phonetic: live ? live.phonetic : "",
        meaning,
        category: cat,
        synonyms: live ? live.synonyms : [],
        enDef: live ? live.enDef : "",
        example: live ? live.example : "",
        note: noteParts.join(" · "),
        autoEnrich: !meaning
      });
      runPassageAnalyzer();
      inspectAzWord(azSelectedToken);
    });

    // Listen to "🔬 词频雷达" button inside existing practice records list
    const prList = $("practiceRecordsList");
    if (prList) {
      prList.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-pr-analyze]");
        if (!btn) return;
        const rec = S().practiceRecords.find((r) => r.id === btn.dataset.prAnalyze);
        if (rec) openPassageAnalyzer(rec.source, rec.excerpt);
      });
    }
  }

  // ==================== VISUAL PLAYBOOK GUIDE + LIVE DAILY CHECKLIST ====================
  let openFlashcardsFn = null;

  function renderGuideChecklist() {
    const prog = getSprintProgress();
    const day = prog.activeDay || S().days[0];
    const tasks = (day && Array.isArray(day.tasks)) ? day.tasks : [];
    const done = tasks.filter((t) => t.done).length;
    const total = tasks.length;
    const allDone = total > 0 && done === total;

    // 1) Update topbar live pill next to Guide
    const topBtn = $("btnOpenChecklist");
    const topCount = $("topbarChecklistCount");
    if (topCount) topCount.textContent = `${done}/${total}`;
    if (topBtn) topBtn.classList.toggle("is-all-done", allDone);

    // 2) Update right-hand checklist card inside Guide modal
    const labelEl = $("gcDayLabel");
    const ratioEl = $("gcRatio");
    const fillEl = $("gcBarFill");
    const listEl = $("guideChecklistItems");
    if (!listEl) return;

    if (labelEl) labelEl.textContent = `DAY ${prog.activeSeq || 1} · ${allDone ? "今日全部完成" : "进行中"}`;
    if (ratioEl) ratioEl.textContent = `${done} / ${total}`;
    if (fillEl) fillEl.style.width = `${total ? Math.round((done / total) * 100) : 0}%`;

    if (!tasks.length) {
      listEl.innerHTML = `<div class="muted" style="font-size:12px;">今日暂无任务</div>`;
      return;
    }

    function getTaskJumpMeta(t) {
      const tag = String(t.tag || "");
      const txt = String(t.text || "");
      if (tag === "词汇" || txt.includes("串文") || txt.includes("拼写")) return { attr: `data-cl-jump="daily"`, label: "去串文 →" };
      if (tag === "听力" || txt.includes("听力") || txt.includes("精听")) return { attr: `data-cl-jump="practice"`, label: "精听记录 →" };
      if (tag === "阅读" || txt.includes("阅读") || txt.includes("精读")) return { attr: `data-cl-action="analyzer"`, label: "真题雷达 →" };
      if (tag === "口语" || txt.includes("口语")) return { attr: `data-cl-jump="speaking"`, label: "口语库 →" };
      if (tag === "写作" || txt.includes("写作") || txt.includes("作文")) return { attr: `data-cl-jump="writing"`, label: "写作批改 →" };
      return { attr: `data-cl-jump="daily"`, label: "去完成 →" };
    }

    listEl.innerHTML = tasks.map((t) => {
      const jmp = getTaskJumpMeta(t);
      return `
      <div class="gc-item-row ${t.done ? "is-done" : ""}" data-gc-day="${esc(day.id)}" data-gc-task="${esc(t.id)}">
        <label class="gc-item-check">
          <input type="checkbox" ${t.done ? "checked" : ""} />
          <div class="gc-item-body">
            <span class="gc-item-tag">${esc(t.tag || "任务")}${t.done ? " · 已完成" : ""}</span>
            <span class="gc-item-text">${esc(t.text)}</span>
          </div>
        </label>
        <button type="button" class="gc-jump-btn" ${jmp.attr}>${jmp.label}</button>
      </div>
    `;
    }).join("");
  }

  function bindGuide() {
    const btnOpen = $("btnOpenGuide");
    const btnChecklist = $("btnOpenChecklist");
    const modal = $("modalGuide");
    const modalCl = $("modalChecklist");
    const seg = $("guideSegTabs");
    if (!btnOpen || !modal) return;

    function switchGuidePanel(panelKey) {
      modal.querySelectorAll(".guide-seg-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.guideTab === panelKey);
      });
      modal.querySelectorAll(".guide-panel").forEach((p) => {
        p.classList.toggle("active", p.dataset.guidePanel === panelKey);
      });
      const body = $("guideBody");
      if (body) body.scrollTop = 0;
    }

    btnOpen.addEventListener("click", () => {
      modal.classList.remove("hidden");
    });

    if (btnChecklist && modalCl) {
      btnChecklist.addEventListener("click", () => {
        renderGuideChecklist();
        modalCl.classList.remove("hidden");
      });
    }

    if (seg) {
      seg.addEventListener("click", (e) => {
        const btn = e.target.closest(".guide-seg-btn");
        if (!btn) return;
        switchGuidePanel(btn.dataset.guideTab);
      });
    }

    if (modalCl) {
      const gcList = $("guideChecklistItems");
      if (gcList) {
        gcList.addEventListener("change", (e) => {
          const row = e.target.closest("[data-gc-task]");
          if (!row || !App || typeof App.toggleTaskDone !== "function") return;
          App.toggleTaskDone(row.dataset.gcDay, row.dataset.gcTask);
          renderGuideChecklist();
        });
      }

      const addQuickTask = () => {
        const inp = $("clQuickTaskInput");
        const txt = (inp && inp.value || "").trim();
        if (!txt) return;
        const prog = getSprintProgress();
        const day = prog.activeDay || S().days[0];
        if (!day) return;
        if (!Array.isArray(day.tasks)) day.tasks = [];
        day.tasks.push({ id: "t-" + Date.now(), tag: "自定", text: txt, done: false });
        delete day.completedAt;
        inp.value = "";
        App.save();
        App.refresh();
        renderGuideChecklist();
        App.toast("已添加到今日完成清单");
      };
      if ($("btnClQuickAdd")) $("btnClQuickAdd").addEventListener("click", addQuickTask);
      if ($("clQuickTaskInput")) {
        $("clQuickTaskInput").addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); addQuickTask(); }
        });
      }

      modalCl.addEventListener("click", (e) => {
        const jmp = e.target.closest("[data-cl-jump]");
        if (jmp) {
          modalCl.classList.add("hidden");
          if (App && typeof App.goTab === "function") App.goTab(jmp.dataset.clJump);
          return;
        }
        const act = e.target.closest("[data-cl-action]");
        if (act) {
          modalCl.classList.add("hidden");
          if (act.dataset.clAction === "analyzer") openPassageAnalyzer("", "");
          return;
        }
        if (e.target.closest("#btnClSwitchGuide")) {
          modalCl.classList.add("hidden");
          modal.classList.remove("hidden");
          return;
        }
        if (e.target.closest("#btnClOpenReport")) {
          modalCl.classList.add("hidden");
          openReport();
        }
      });
    }

    modal.addEventListener("click", (e) => {
      const actionBtn = e.target.closest("[data-guide-action]");
      if (actionBtn) {
        const act = actionBtn.dataset.guideAction;
        modal.classList.add("hidden");
        if (act === "flashcards" && openFlashcardsFn) openFlashcardsFn("today");
        else if (act === "flashcards-weak" && openFlashcardsFn) openFlashcardsFn("weak");
        else if (act === "analyzer") openPassageAnalyzer("", "");
        else if (act === "search") openSearch();
        else if (act === "report") openReport();
        else if (act === "cloud" && $("btnBackup")) $("btnBackup").click();
        return;
      }
      const jump = e.target.closest("[data-guide-jump]");
      if (!jump) return;
      const targetTab = jump.dataset.guideJump;
      modal.classList.add("hidden");
      if (targetTab && App && typeof App.goTab === "function") {
        App.goTab(targetTab);
      }
    });
  }

  // ==================== DYNAMIC FLASHCARDS (不背单词 2-ROUND ENGINE) ====================
  function bindFlashcards() {
    const modal = $("modalFlashcard");
    const stage = $("fcStage");
    if (!modal || !stage) return;

    const FALLBACK_DISTRACTORS = [
      "adj. 强制性的，必修的",
      "n. 押金，保证金，订金",
      "v. 集中注意力；聚集分布",
      "adj. 临时的，暂时的，短期的",
      "n. 宣传册，小册子",
      "adj. 负担得起的，实惠的",
      "v. 适应，习惯；调整校准",
      "n. 居民，住户",
      "adj. 不堪重负的，不知所措的",
      "n. 截止日期，最后期限",
      "v. 确认，核实；证实",
      "n. 设施，配套设备"
    ];

    const fc = {
      scope: "today", // today | weak | all
      mode: "visual", // visual | audio
      pool: [],
      queue: [],
      cursor: 0,
      answered: false,
      rightCount: 0,
      weakWords: new Map(), // lower -> item
      currentChoices: [],
      correctIdx: -1,
      requeuedOnce: new Set()
    };

    function shortMeaning(item) {
      const raw = String(item.meaning || item.cn || "").trim();
      const cleaned = raw.replace(/^([a-z]+\.\s*(\[[^\]]+\]\s*)?)+/i, "").trim();
      const pos = item.pos ? `${item.pos.split("/")[0].trim()} ` : "";
      const out = (pos + (cleaned || raw)).trim();
      return out.length > 34 ? out.slice(0, 33) + "…" : out;
    }

    function collectPool(scope) {
      const s = S();
      const curDayId = App.getCurrentDayId ? App.getCurrentDayId() : (s.days[0] && s.days[0].id);
      const curDay = s.days.find((d) => d.id === curDayId) || s.days[0];
      const map = new Map();

      const addCore = (w) => {
        if (!w || !w.word) return;
        const k = w.word.toLowerCase();
        if (map.has(k)) return;
        const syns = Array.isArray(w.synonyms)
          ? w.synonyms.map((x) => (typeof x === "string" ? x : `${x.en}${x.cn ? "(" + x.cn + ")" : ""}`))
          : [];
        map.set(k, {
          word: w.word,
          forms: w.forms || [],
          phonetic: w.phonetic || "",
          pos: w.pos || "",
          cn: w.cn || "",
          meaning: `${w.pos ? w.pos + " " : ""}${w.cn || ""}`.trim(),
          category: w.category || "核心词",
          synonyms: syns,
          example: w.example || "",
          exampleCn: w.exampleCn || "",
          tip: w.tip || ""
        });
      };

      const addVocab = (v) => {
        if (!v || !v.word || !v.meaning || v.meaning === "（待补充翻译）" || v.meaning === "正在自动查词…") return;
        const k = v.word.toLowerCase();
        if (map.has(k)) return;
        map.set(k, {
          word: v.word,
          forms: [],
          phonetic: v.phonetic || "",
          pos: "",
          cn: v.meaning,
          meaning: v.meaning,
          category: v.category || "生词本",
          synonyms: Array.isArray(v.synonyms) ? v.synonyms : [],
          example: v.example || "",
          exampleCn: "",
          tip: v.note || ""
        });
      };

      if (scope === "today") {
        if (curDay && Array.isArray(curDay.words)) curDay.words.forEach(addCore);
      } else if (scope === "weak") {
        const stats = s.wordStats || {};
        (s.vocabBook || []).filter((v) => !v.mastered).forEach(addVocab);
        (s.days || []).forEach((d) => (d.words || []).forEach((w) => {
          const st = stats[w.word.toLowerCase()];
          if (st && st.status === "weak") addCore(w);
        }));
      } else {
        (s.days || []).forEach((d) => (d.words || []).forEach(addCore));
        (s.vocabBook || []).forEach(addVocab);
      }

      return Array.from(map.values());
    }

    function collectDistractorBank() {
      const s = S();
      const bank = [];
      (s.days || []).forEach((d) => (d.words || []).forEach((w) => {
        if (w.cn) bank.push(shortMeaning(w));
      }));
      (s.vocabBook || []).forEach((v) => {
        if (v.meaning && v.meaning !== "（待补充翻译）") bank.push(shortMeaning(v));
      });
      FALLBACK_DISTRACTORS.forEach((x) => bank.push(x));
      return Array.from(new Set(bank.filter(Boolean)));
    }

    function shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function syncTopControls() {
      modal.querySelectorAll("[data-fc-scope]").forEach((b) => {
        b.classList.toggle("active", b.dataset.fcScope === fc.scope);
      });
      modal.querySelectorAll("[data-fc-mode]").forEach((b) => {
        b.classList.toggle("active", b.dataset.fcMode === fc.mode);
      });
    }

    function updateProgressBar() {
      const total = fc.queue.length || 1;
      const done = Math.min(fc.cursor, total);
      const pct = Math.round((done / total) * 100);
      $("fcProgressFill").style.width = `${pct}%`;
      $("fcProgressText").textContent = `${Math.min(fc.cursor + (fc.cursor < fc.queue.length ? 1 : 0), fc.queue.length)} / ${fc.queue.length}`;
      $("fcStatPill").textContent = `正确 ${fc.rightCount} · 不熟 ${fc.weakWords.size}`;
    }

    function startSession(scope, mode, customItems) {
      fc.scope = scope || fc.scope;
      fc.mode = mode || fc.mode;
      fc.pool = Array.isArray(customItems) ? customItems : collectPool(fc.scope);
      fc.queue = shuffle(fc.pool);
      fc.cursor = 0;
      fc.answered = false;
      fc.rightCount = 0;
      fc.weakWords = new Map();
      fc.requeuedOnce = new Set();
      syncTopControls();
      renderCurrentCard();
    }

    function renderSummary() {
      $("fcProgressFill").style.width = "100%";
      $("fcProgressText").textContent = `${fc.queue.length} / ${fc.queue.length}`;
      $("fcStatPill").textContent = `正确 ${fc.rightCount} · 不熟 ${fc.weakWords.size}`;
      if (fc.pool.length > 0 && App && typeof App.autoCheckTaskByTag === "function") {
        App.autoCheckTaskByTag("词汇", "已完成一轮动态闪卡验收");
      }

      const totalAttempts = fc.rightCount + fc.weakWords.size;
      const acc = totalAttempts ? Math.round((fc.rightCount / Math.max(fc.pool.length, 1)) * 100) : 100;
      const weakArr = Array.from(fc.weakWords.values());
      const isRound1 = fc.mode === "visual";

      stage.innerHTML = `
        <div class="fc-summary-card">
          <span class="guide-eyebrow">${isRound1 ? "ROUND 1 COMPLETE · 看词选义完成" : "ROUND 2 COMPLETE · 听音盲选完成"}</span>
          <div class="fc-summary-score">${Math.min(100, acc)}%</div>
          <p class="muted" style="margin:0;font-size:13px;">
            本轮共验收 <b>${fc.pool.length}</b> 词 · 一次过关 <b>${Math.max(0, fc.pool.length - weakArr.length)}</b> 词 · 标为不熟 <b>${weakArr.length}</b> 词
          </p>
          ${weakArr.length ? `
            <div style="font-size:12px;color:var(--text-muted);">以下不熟词已自动同步到生词本，将在明日串文中复现：</div>
            <div class="fc-weak-chips">${weakArr.map((w) => `<span class="fc-weak-chip">${esc(w.word)}</span>`).join("")}</div>
          ` : `<div style="font-size:13px;color:#0d9488;font-weight:600;">本轮全部掌握，记忆非常扎实！</div>`}
          <div class="fc-summary-btns">
            ${isRound1 ? `<button class="btn btn-primary" id="btnFcNextRound">进入第 2 轮 · 听音盲选 →</button>` : `<button class="btn btn-primary" id="btnFcRestartAll">再来一轮综合巩固</button>`}
            ${weakArr.length ? `<button class="btn btn-outline" id="btnFcDrillWeak">仅重刷这 ${weakArr.length} 个不熟词</button>` : ""}
            ${weakArr.length ? `<button class="btn btn-outline" id="btnFcCopyWeak">复制不熟词发 AI</button>` : ""}
          </div>
        </div>
      `;
    }

    function renderCurrentCard() {
      if (!fc.queue.length) {
        $("fcProgressFill").style.width = "0%";
        $("fcProgressText").textContent = "0 / 0";
        stage.innerHTML = `<div class="fc-summary-card">
          <p class="muted" style="margin:0;">当前范围下还没有可刷的词（切换上方「今日核心词」即可立即开始）。</p>
          <button class="btn btn-primary btn-sm" id="btnFcFallbackToday">刷今日核心词</button>
        </div>`;
        return;
      }
      if (fc.cursor >= fc.queue.length) {
        renderSummary();
        return;
      }

      fc.answered = false;
      updateProgressBar();
      const item = fc.queue[fc.cursor];
      const info = App.getWordEncounterStats ? App.getWordEncounterStats(item.word, item.forms || []) : { totalSeen: 1, weakMarks: 0, status: "learning" };
      const encText = (info.totalSeen > 1 ? `复现第 ${info.totalSeen} 次` : "第 1 次见") + (info.weakMarks > 0 ? ` · 不熟 ×${info.weakMarks}` : "");

      const correctText = shortMeaning(item);
      const bank = collectDistractorBank().filter((t) => t !== correctText && !t.includes(item.cn));
      const distractors = shuffle(bank).slice(0, 3);
      while (distractors.length < 3) distractors.push(FALLBACK_DISTRACTORS[distractors.length % FALLBACK_DISTRACTORS.length]);
      const options = shuffle([correctText, ...distractors]);
      fc.currentChoices = options;
      fc.correctIdx = options.indexOf(correctText);

      const isAudio = fc.mode === "audio";
      stage.innerHTML = `
        <div class="fc-card-shell">
          <div class="fc-prompt-box">
            <div class="fc-prompt-meta">
              <span class="cat-badge ${esc(item.category)}">${esc(item.category)}</span>
              <span class="encounter-pill ${info.status === "weak" ? "is-weak" : info.totalSeen > 1 ? "is-repeat" : ""}">${esc(encText)}</span>
            </div>
            ${isAudio ? `
              <button type="button" class="fc-audio-orb" id="btnFcPlayAudio" title="重听英音 (Space)" aria-label="播放英音">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
              </button>
              <div class="fc-audio-caption" id="fcAudioReveal">盲听英音，选出最准确的中文意思（按 Space 重播）</div>
            ` : `
              <div class="fc-word-big">${esc(item.word)}</div>
              ${item.phonetic ? `<div class="fc-phonetic-big">${esc(item.phonetic)}</div>` : ""}
              <button type="button" class="fc-replay-btn" id="btnFcPlayAudio">
                ${SF_SPEAK} <span>英音朗读</span>
              </button>
            `}
          </div>

          <div class="fc-choices" id="fcChoices">
            ${options.map((opt, idx) => `
              <button type="button" class="fc-choice" data-fc-idx="${idx}">
                <span class="fc-choice-key">${idx + 1}</span>
                <span>${esc(opt)}</span>
              </button>
            `).join("")}
          </div>

          <div class="fc-action-strip" id="fcPreActions">
            <button type="button" class="btn btn-outline btn-sm" id="btnFcMarkWeak">不熟 · 直接看答案并安排复现 (W)</button>
            <span class="muted" style="font-size:12px;">${isAudio ? "第 2 轮：纯听音辨义" : "第 1 轮：看词辨义"}</span>
          </div>

          <div id="fcFeedbackSlot"></div>
        </div>
      `;

      // Auto-play British pronunciation on every new card
      setTimeout(() => App.speak(item.word, isAudio ? 0.88 : 0.94), 80);
    }

    function handleAnswer(chosenIdx, forcedWeak = false) {
      if (fc.answered || fc.cursor >= fc.queue.length) return;
      fc.answered = true;
      const item = fc.queue[fc.cursor];
      const isRight = !forcedWeak && chosenIdx === fc.correctIdx;

      const btns = Array.from(stage.querySelectorAll(".fc-choice"));
      btns.forEach((b, i) => {
        b.disabled = true;
        if (i === fc.correctIdx) b.classList.add("is-correct");
        else if (i === chosenIdx && !isRight) b.classList.add("is-wrong");
      });

      const pre = $("fcPreActions");
      if (pre) pre.classList.add("hidden");

      // Reveal word spelling in audio mode
      const audioReveal = $("fcAudioReveal");
      if (audioReveal) {
        audioReveal.innerHTML = `<b style="font-size:20px;color:var(--text);font-family:Arial,sans-serif;">${esc(item.word)}</b> ${item.phonetic ? `<span class="phonetic">${esc(item.phonetic)}</span>` : ""}`;
      }

      if (isRight) {
        fc.rightCount++;
        if (fc.mode === "audio" && !fc.weakWords.has(item.word.toLowerCase()) && App.markWordMastered) {
          App.markWordMastered(item, { fromQuiz: true, silent: true });
        }
      } else {
        const key = item.word.toLowerCase();
        fc.weakWords.set(key, item);
        if (App.markWordWeak) App.markWordWeak(item, { fromQuiz: true, silent: true });
        // Re-queue 3–4 cards later in this session once for active reinforcement
        if (!fc.requeuedOnce.has(key)) {
          fc.requeuedOnce.add(key);
          const insertAt = Math.min(fc.queue.length, fc.cursor + 4);
          fc.queue.splice(insertAt, 0, item);
        }
      }

      updateProgressBar();

      const occHtml = renderOccPillsHtml(item.word, item.forms);
      const synLine = Array.isArray(item.synonyms) && item.synonyms.length
        ? `<div class="fc-fb-syn"><b>高频同义替换：</b>${esc(item.synonyms.slice(0, 4).join(" · "))}</div>`
        : "";
      const exLine = item.example
        ? `<div class="fc-fb-syn"><b>语境例句：</b>${esc(item.example)}${item.exampleCn ? `（${esc(item.exampleCn)}）` : ""}</div>`
        : "";

      const fb = $("fcFeedbackSlot");
      if (fb) {
        fb.innerHTML = `
          <div class="fc-feedback-box ${isRight ? "is-ok" : "is-bad"}">
            <div class="fc-fb-head">
              <strong style="color:${isRight ? "#0d9488" : "#c93b2e"}">${isRight ? "答对了" : forcedWeak ? "已标为不熟 · 稍后重测 & 明日复现" : "记混了 · 已自动标为不熟并安排重测"}</strong>
              <div style="display:flex;gap:6px;">
                ${isRight ? `<button type="button" class="btn btn-ghost btn-sm" id="btnFcLateWeak">其实不熟</button>` : ""}
                <button type="button" class="btn btn-primary btn-sm" id="btnFcNextCard">下一张 (Enter) →</button>
              </div>
            </div>
            <div><b>${esc(item.word)}</b>：${esc(item.meaning || item.cn)}</div>
            ${synLine}
            ${exLine}
            ${occHtml}
          </div>
        `;
      }
    }

    function openFlashcards(defaultScope) {
      modal.classList.remove("hidden");
      const weakCount = collectPool("weak").length;
      const scope = defaultScope === "weak" && weakCount === 0 ? "today" : (defaultScope || "today");
      startSession(scope, "visual");
    }
    openFlashcardsFn = openFlashcards;

    const btnDaily = $("btnOpenFlashcards");
    if (btnDaily) btnDaily.addEventListener("click", () => openFlashcards("today"));
    const btnVocab = $("btnOpenFlashcardsVocab");
    if (btnVocab) btnVocab.addEventListener("click", () => openFlashcards("weak"));

    $("fcScopePills").addEventListener("click", (e) => {
      const b = e.target.closest("[data-fc-scope]");
      if (!b) return;
      startSession(b.dataset.fcScope, fc.mode);
    });

    $("fcModePills").addEventListener("click", (e) => {
      const b = e.target.closest("[data-fc-mode]");
      if (!b) return;
      startSession(fc.scope, b.dataset.fcMode);
    });

    stage.addEventListener("click", (e) => {
      const playBtn = e.target.closest("#btnFcPlayAudio");
      if (playBtn && fc.queue[fc.cursor]) {
        App.speak(fc.queue[fc.cursor].word, fc.mode === "audio" ? 0.88 : 0.94);
        return;
      }
      const choiceBtn = e.target.closest("[data-fc-idx]");
      if (choiceBtn) {
        handleAnswer(Number(choiceBtn.dataset.fcIdx), false);
        return;
      }
      if (e.target.closest("#btnFcMarkWeak")) {
        handleAnswer(-1, true);
        return;
      }
      if (e.target.closest("#btnFcLateWeak") && fc.queue[fc.cursor]) {
        const it = fc.queue[fc.cursor];
        fc.weakWords.set(it.word.toLowerCase(), it);
        if (App.markWordWeak) App.markWordWeak(it, { fromQuiz: true, silent: false });
        updateProgressBar();
        return;
      }
      if (e.target.closest("#btnFcNextCard")) {
        fc.cursor++;
        renderCurrentCard();
        return;
      }
      if (e.target.closest("#btnFcNextRound")) {
        startSession(fc.scope, "audio", fc.pool);
        return;
      }
      if (e.target.closest("#btnFcRestartAll")) {
        startSession(fc.scope, "visual", fc.pool);
        return;
      }
      if (e.target.closest("#btnFcDrillWeak")) {
        const weakArr = Array.from(fc.weakWords.values());
        startSession("weak", fc.mode, weakArr);
        return;
      }
      if (e.target.closest("#btnFcCopyWeak")) {
        const weakArr = Array.from(fc.weakWords.values());
        const txt = "这是我动态闪卡中标记为「不熟」的词，请编进明天的情景串文里复现：\n" +
          weakArr.map((w) => `- ${w.word}: ${w.meaning || w.cn}`).join("\n");
        navigator.clipboard.writeText(txt).then(
          () => App.toast(`已复制 ${weakArr.length} 个不熟词，直接发给 AI 即可！`),
          () => App.toast("复制失败，请手动查看生词本")
        );
        return;
      }
      if (e.target.closest("#btnFcFallbackToday")) {
        startSession("today", "visual");
      }
    });

    document.addEventListener("keydown", (e) => {
      if (modal.classList.contains("hidden")) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (["1", "2", "3", "4"].includes(e.key) && !fc.answered) {
        e.preventDefault();
        handleAnswer(Number(e.key) - 1, false);
      } else if (e.key === " " && fc.queue[fc.cursor]) {
        e.preventDefault();
        App.speak(fc.queue[fc.cursor].word, fc.mode === "audio" ? 0.88 : 0.94);
      } else if ((e.key === "w" || e.key === "W") && !fc.answered) {
        e.preventDefault();
        handleAnswer(-1, true);
      } else if (e.key === "Enter" && fc.answered) {
        e.preventDefault();
        fc.cursor++;
        renderCurrentCard();
      }
    });
  }

  // ==================== 启动 ====================
  function syncEmptyTabBadges() {
    document.querySelectorAll(".nav-tab .tab-count").forEach((el) => {
      const txt = (el.textContent || "").trim();
      el.classList.toggle("is-zero", txt === "" || txt === "0");
    });
  }

  function renderAll() {
    ensureFields();
    renderDashboard();
    renderWritingList();
    renderGuideChecklist();
    syncEmptyTabBadges();
  }

  initAuthGate();
  ensureFields();
  renderWritingShell();
  bindDashboard();
  bindWriting();
  bindSearch();
  bindAnalyzer();
  bindGuide();
  bindFlashcards();
  renderAll();

  let pending = false;
  document.addEventListener("ielts:saved", () => {
    if (!cloudState.applyingCloud) {
      cloudPush(false);
    }
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; renderAll(); });
  });
  // 跨天自动刷新（比如开着页面过了零点）
  let lastDay = today();
  setInterval(() => { if (today() !== lastDay) { lastDay = today(); renderAll(); } }, 60000);
})();
