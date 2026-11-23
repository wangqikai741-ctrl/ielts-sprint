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

  // ==================== 常量 ====================
  const START = "2026-11-23";
  const TOTAL_DAYS = 58;
  const PHASES = [
    {
      name: "阶段一 · 夯实基础", from: "2026-11-23", to: "2026-12-10", range: "Day 1–18",
      focus: [
        "🎧 听力：剑10–13 Part 1 & 2，冲 18–21 题",
        "📖 阅读：Passage 1 & 2 准确率 + 同义替换",
        "🗣️ 口语：Part 1 高频题逐题过",
        "✍️ 写作：每周 1 大 1 小保手感"
      ]
    },
    {
      name: "阶段二 · 整套限时", from: "2026-12-11", to: "2027-01-03", range: "Day 19–42",
      focus: [
        "🎧 剑14–16 整套限时，攻 Part 3/4",
        "📖 阅读严格 60 分钟/套",
        "🗣️ 搭 6–8 个 Part 2 万能串题素材 + Part 3 拓展",
        "✍️ 写作每周 1 大 1 小，盯 TR/CC"
      ]
    },
    {
      name: "阶段三 · 全真模考", from: "2027-01-04", to: "2027-01-19", range: "Day 43–58",
      focus: [
        "📝 剑17–19 全真机考连考",
        "🗣️ 紧盯雅思哥 1–4 月换题季新题",
        "🧠 错题本 + 生词本全面回炉",
        "😴 考前 2 天减量、调作息"
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

  // ==================== 活跃度计算 ====================
  function activityFor(date) {
    const s = S();
    let score = 0;
    const detail = [];
    const day = s.days.find((d) => d.date === date);
    if (day && day.tasks) {
      const done = day.tasks.filter((t) => t.done).length;
      if (done) { score += done; detail.push(`任务 ${done}/${day.tasks.length}`); }
    }
    const pr = s.practiceRecords.filter((r) => r.date === date).length;
    if (pr) { score += pr; detail.push(`精听精读 ${pr}`); }
    const wr = s.writings.filter((w) => w.date === date).length;
    if (wr) { score += wr; detail.push(`写作 ${wr}`); }
    const vb = s.vocabBook.filter((v) => v.createdAt === date).length;
    if (vb) { score += 1; detail.push(`生词 +${vb}`); }
    if (s.checkins[date]) { score += 1; detail.push("已打卡"); }
    const level = score === 0 ? 0 : score <= 1 ? 1 : score <= 3 ? 2 : score <= 5 ? 3 : 4;
    return { score, level, detail };
  }

  function streak() {
    let n = 0;
    let d = today();
    if (activityFor(d).score === 0) d = addDays(d, -1); // 今天还没开始不算断
    while (diffDays(START, d) >= 0 && activityFor(d).score > 0) { n++; d = addDays(d, -1); }
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
    const n = dayIndex(t);
    const day = s.days.find((d) => d.date === t) || s.days.find((d) => d.id === App.getCurrentDayId());
    const lines = [`【Day ${n} 学习汇报 · ${t}】`, ""];
    if (day) {
      const tasks = day.tasks || [];
      lines.push(`✅ 今日任务 ${tasks.filter((x) => x.done).length}/${tasks.length}`);
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
    lines.push(`🗂️ 生词本未掌握 ${un.length} 词（请编进明天的串文并抽测）`);
    if (un.length) lines.push("  " + un.slice(0, 80).map((v) => v.word).join(", "));
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
    const n = Math.min(Math.max(dayIndex(t), 0), TOTAL_DAYS + 1);
    const daysLeft = Math.max(0, diffDays(t, s.examDate || "2027-01-20"));
    const phaseIdx = PHASES.findIndex((p) => t >= p.from && t <= p.to);
    const phase = PHASES[phaseIdx >= 0 ? phaseIdx : t < START ? 0 : 2];

    // 今日任务
    const dayObj = s.days.find((d) => d.date === t);
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

    const tip = COACH_TIPS[(Math.max(n, 1) - 1) % COACH_TIPS.length];

    const skill = (key, label, est, extra) => {
      const base = BASE[key], target = TARGET[key];
      const cur = est != null ? est : base;
      const p = Math.max(0, Math.min(100, ((cur - 4) / (7 - 4)) * 100));
      const tp = ((target - 4) / 3) * 100;
      const reached = est != null && est >= target;
      return `
        <div class="skill-card ${reached ? "reached" : ""}">
          <div class="skill-top">
            <span class="skill-name">${label}</span>
            <span class="skill-est">${est != null ? est.toFixed(1) : "—"}<small>${est != null ? "当前估分" : "暂无数据"}</small></span>
          </div>
          <div class="skill-bar">
            <div class="skill-fill" style="width:${p}%"></div>
            <div class="skill-target" style="left:${tp}%" title="目标 ${target}"></div>
          </div>
          <div class="skill-foot"><span>起点 ${base.toFixed(1)}</span><span>${extra}</span><span>目标 <b>${target.toFixed(1)}</b></span></div>
        </div>`;
    };

    // 热力图
    let heat = "";
    for (let i = 0; i < TOTAL_DAYS; i++) {
      const d = addDays(START, i);
      const a = activityFor(d);
      const ph = PHASES.findIndex((p) => d >= p.from && d <= p.to);
      const cls = [`lv${a.level}`, d === t ? "is-today" : "", d > t ? "future" : "", `ph${ph}`].join(" ");
      heat += `<div class="heat-cell ${cls}" title="Day ${i + 1} · ${d}${a.detail.length ? "\n" + a.detail.join(" · ") : ""}"><span>${i + 1}</span></div>`;
    }
    heat += `<div class="heat-cell exam-cell" title="2027-01-20 考试日">🎯</div>`;

    root.innerHTML = `
      <div class="dash-grid">
        <div class="card dash-hero">
          <div class="hero-left">
            <div class="hero-kicker">${t < START ? "闭关即将开始" : n > TOTAL_DAYS ? "考试日" : `Day ${n} / ${TOTAL_DAYS}`} · ${t}</div>
            <h2 class="hero-title">${phase.name} <span class="hero-range">${phase.range}</span></h2>
            <ul class="hero-focus">${phase.focus.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
            <div class="hero-actions">
              <button class="btn btn-primary" data-dash="go-daily">📖 开始今日计划</button>
              <button class="btn btn-outline" data-dash="report">📋 一键生成今日汇报</button>
              <button class="btn btn-outline ${s.checkins[t] ? "active-toggle" : ""}" data-dash="checkin">${s.checkins[t] ? "✅ 今日已打卡" : "☑️ 今日打卡"}</button>
            </div>
          </div>
          <div class="hero-right">
            <div class="ring-wrap" title="今日任务完成度">
              <svg viewBox="0 0 120 120" class="ring">
                <circle cx="60" cy="60" r="52" class="ring-bg"></circle>
                <circle cx="60" cy="60" r="52" class="ring-fg" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - pct / 100)}"></circle>
              </svg>
              <div class="ring-text"><strong>${pct}%</strong><span>今日 ${doneCount}/${tasks.length}</span></div>
            </div>
            <div class="hero-mini">
              <div><strong>${daysLeft}</strong><span>天后考试</span></div>
              <div><strong>${streak()}</strong><span>连续打卡</span></div>
            </div>
          </div>
        </div>

        <div class="card dash-tip">
          <div class="tip-head">💡 教练今日提醒</div>
          <p>${esc(tip)}</p>
          ${examWarn ? `<div class="exam-alert">🎫 ${sinceCheck === null ? "你还没刷过考位！" : `已经 ${sinceCheck} 天没刷考位了！`}去官网看看开封 / 郑州 1 月机考。</div>` : ""}
        </div>
      </div>

      <div class="skill-grid">
        ${skill("L", "🎧 听力", estL, `${s.practiceRecords.filter((r) => r.type === "listening").length} 次精听`)}
        ${skill("R", "📖 阅读", estR, `${s.practiceRecords.filter((r) => r.type === "reading").length} 次精读`)}
        ${skill("S", "🗣️ 口语", null, `${spDone}/${s.speakingTopics.length} 题已升级`)}
        ${skill("W", "✍️ 写作", estW, `${s.writings.length} 篇`)}
      </div>

      <div class="dash-grid two">
        <div class="card">
          <div class="card-head-row">
            <h3 class="card-section-title">📅 58 天闭关打卡图</h3>
            <div class="heat-legend">少 <i class="lv0"></i><i class="lv1"></i><i class="lv2"></i><i class="lv3"></i><i class="lv4"></i> 多</div>
          </div>
          <div class="phase-strip">
            ${PHASES.map((p, i) => `<div class="phase-seg ph${i} ${i === phaseIdx ? "current" : ""}" style="flex:${diffDays(p.from, p.to) + 1}"><b>${p.name.split(" · ")[0]}</b><span>${mmdd(p.from)}–${mmdd(p.to)}</span></div>`).join("")}
          </div>
          <div class="heatmap">${heat}</div>
          <p class="muted heat-note">完成任务、录精听精读、写作文、加生词、点打卡都会点亮格子。鼠标悬停可看当天明细。</p>
        </div>

        <div class="card">
          <h3 class="card-section-title">📈 听力 / 阅读正确率走势</h3>
          ${trendChart()}
        </div>
      </div>

      <div class="dash-grid three">
        <div class="card stat-card">
          <h3 class="card-section-title">🗂️ 词汇</h3>
          <div class="big-stats">
            <div><strong>${coreWords}</strong><span>串文高频词</span></div>
            <div><strong>${vocabTotal}</strong><span>生词本</span></div>
            <div><strong>${vocabMastered}</strong><span>已掌握</span></div>
          </div>
          <div class="mini-bar"><div style="width:${vocabTotal ? (vocabMastered / vocabTotal) * 100 : 0}%"></div></div>
          <button class="btn btn-sm btn-outline full-width" data-dash="go-vocab">去生词本抽测 →</button>
        </div>

        <div class="card stat-card">
          <h3 class="card-section-title">✍️ 本周写作配额 <small class="muted">${mmdd(wkMon)}–${mmdd(wkSun)}</small></h3>
          <div class="quota-row ${wkT1 >= 1 ? "ok" : ""}"><span>小作文 Task 1</span><b>${wkT1} / 1</b></div>
          <div class="quota-row ${wkT2 >= 1 ? "ok" : ""}"><span>大作文 Task 2</span><b>${wkT2} / 1</b></div>
          <button class="btn btn-sm btn-outline full-width" data-dash="go-writing">去写作批改 →</button>
        </div>

        <div class="card stat-card">
          <h3 class="card-section-title">🎫 考位追踪</h3>
          ${et.booked
            ? `<div class="booked-box">✅ 已报名<br><b>${esc(et.bookedInfo || "")}</b></div>
               <button class="btn btn-sm btn-ghost full-width" data-dash="unbook">修改报名信息</button>`
            : `<p class="muted">目标：开封 1 月机考（备选郑州）。每 1–2 天刷一次。</p>
               <div class="check-status ${examWarn ? "warn" : "ok"}">${et.lastCheck ? `上次刷：${et.lastCheck}（${sinceCheck === 0 ? "今天" : sinceCheck + " 天前"}）` : "还没刷过"}</div>
               <div class="btn-row">
                 <a class="btn btn-sm btn-primary" href="https://ielts.neea.cn/" target="_blank" rel="noopener">打开雅思官网 ↗</a>
                 <button class="btn btn-sm btn-outline" data-dash="checked">我刚刷过</button>
                 <button class="btn btn-sm btn-outline" data-dash="book">已报上 🎉</button>
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
      return `<div class="empty-chart"><div>📊</div><p>还没有精听 / 精读记录。<br>在「🎧 精听 &amp; 精读记录」录入对题数后，这里会自动画出走势，并换算成雅思分数。</p></div>`;
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
      const b = e.target.closest("[data-dash]");
      if (!b) return;
      const s = S();
      const act = b.dataset.dash;
      if (act === "go-daily") {
        const d = s.days.find((x) => x.date === today());
        if (d) App.selectDay(d.id);
        App.goTab("daily");
      } else if (act === "go-vocab") App.goTab("vocab");
      else if (act === "go-writing") App.goTab("writing");
      else if (act === "report") openReport();
      else if (act === "checkin") {
        const t = today();
        if (s.checkins[t]) delete s.checkins[t]; else s.checkins[t] = true;
        App.save();
        if (s.checkins[t]) App.toast("打卡成功！今天也是认真备考的一天 💪");
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
        App.toast("考位已锁定 🎉 倒计时已同步");
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
          <div class="modal-header"><h3>📋 今日学习汇报</h3><button class="btn btn-ghost btn-sm" data-close>✕</button></div>
          <div class="modal-body">
            <p class="muted">自动汇总了今天的任务、精听精读、口语草稿、写作和未掌握生词。复制后直接发给 AI 教练即可批改 + 生成明天的计划。</p>
            <textarea id="reportText" class="textarea-input full-width code-area" rows="16"></textarea>
          </div>
          <div class="modal-footer"><button class="btn btn-ghost" data-close>关闭</button><button class="btn btn-primary" id="btnCopyReport">📋 复制汇报</button></div>
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
            <h2 class="card-section-title" id="wrFormTitle">✍️ 新写一篇（仿机考打字）</h2>
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
            <summary>📝 批改结果（AI 批改后填这里）</summary>
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
            <button class="btn btn-outline" id="btnCopyWriting">📋 复制给 AI 批改</button>
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
    $("wrFormTitle").textContent = "✍️ 新写一篇（仿机考打字）";
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
      $("wrList").innerHTML = `<div class="card empty-state">还没有作文。每周至少 1 大 1 小，写完点「📋 复制给 AI 批改」发给教练。</div>`;
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
          <button class="btn btn-sm btn-ghost" data-wr-edit="${w.id}">✏️ 编辑 / 填分</button>
          <button class="btn btn-sm btn-ghost" data-wr-copy="${w.id}">📋 复制给 AI</button>
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
        $("wrFormTitle").textContent = "✏️ 编辑作文 / 填写批改分数";
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
  function searchAll(q) {
    const s = S();
    const query = q.trim().toLowerCase();
    const core = [];
    s.days.forEach((d) => (d.words || []).forEach((w) => {
      const hay = [w.word, ...(w.forms || []), w.cn, w.tip].join(" ").toLowerCase();
      if (!query || hay.includes(query)) core.push({ ...w, day: d });
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
        ${isEn ? `<button class="btn btn-sm btn-ghost" data-s-speak="${esc(q)}">🔊 读一下</button>` : ""}
        ${isEn && !s_inVocab(q) ? `<button class="btn btn-sm btn-outline" data-s-add="${esc(q)}">➕ 加入生词本</button>` : ""}
      </div>`;
    }
    html += `<div class="search-group"><div class="sg-title">📖 串文高频词 <span>${core.length}</span></div>`;
    html += core.length ? core.slice(0, lim).map((w) => `
      <div class="sr-item">
        <div class="sr-main">
          <b class="sr-word">${hl(w.word, q)}</b><span class="phonetic">${esc(w.phonetic || "")}</span><span class="muted">${esc(w.pos || "")}</span>
          <span class="cat-chip">${esc(w.category || "")}</span>
        </div>
        <div class="sr-cn">${hl(w.cn, q)}</div>
        ${w.tip ? `<div class="sr-tip">💡 ${hl(w.tip, q)}</div>` : ""}
        <div class="sr-actions">
          <button class="btn btn-sm btn-ghost" data-s-speak="${esc(w.word)}">🔊</button>
          <button class="btn btn-sm btn-ghost" data-s-goday="${esc(w.day.id)}">📍 ${esc((w.day.label || "").split(" · ")[0])}</button>
          ${s_inVocab(w.word) ? `<span class="muted">✓ 已在生词本</span>` : `<button class="btn btn-sm btn-ghost" data-s-addcore="${esc(w.word)}" data-cn="${esc(w.cn)}" data-cat="${esc(w.category || "")}">⭐ 存生词本</button>`}
        </div>
      </div>`).join("") : `<div class="sr-empty">没有匹配</div>`;
    html += `</div>`;

    html += `<div class="search-group"><div class="sg-title">🗂️ 我的生词本 <span>${vocab.length}</span></div>`;
    html += vocab.length ? vocab.slice(0, lim).map((v) => `
      <div class="sr-item">
        <div class="sr-main"><b class="sr-word">${hl(v.word, q)}</b><span class="cat-chip">${esc(v.category)}</span>${v.mastered ? `<span class="ok-chip">已掌握</span>` : ""}</div>
        <div class="sr-cn">${hl(v.meaning, q)}</div>
        ${v.note ? `<div class="sr-tip">📝 ${hl(v.note, q)}</div>` : ""}
        <div class="sr-actions"><button class="btn btn-sm btn-ghost" data-s-speak="${esc(v.word)}">🔊</button></div>
      </div>`).join("") : `<div class="sr-empty">${q ? "生词本里没有" : "生词本还是空的"}</div>`;
    html += `</div>`;

    html += `<div class="search-group"><div class="sg-title">🔁 同义替换库（来自精听精读记录） <span>${syn.length}</span></div>`;
    html += syn.length ? syn.slice(0, lim * 2).map((x) => `
      <div class="sr-item syn"><span>${hl(x.line, q)}</span><span class="muted">${esc(x.rec.source)}</span></div>`).join("") : `<div class="sr-empty">在精听精读记录里填“同义替换”，这里会自动汇总成你的专属替换库</div>`;
    html += `</div>`;
    box.innerHTML = html;
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
        const meaning = prompt(`给「${ad.dataset.sAdd}」写个中文释义（可先查右边的在线词典）`, "");
        if (meaning === null) return;
        App.addWord({ word: ad.dataset.sAdd, meaning, category: "雅思哥生词" });
        renderSearch();
      } else if (ac) {
        App.addWord({ word: ac.dataset.sAddcore, meaning: ac.dataset.cn, category: ac.dataset.cat || "雅思哥生词" });
        renderSearch();
      }
    });
  }

  // ==================== 4) 私人密码锁 (SHA-256) ====================
  const AUTH_STORAGE_KEY = "ielts_sprint_auth_token_v1";
  const EXPECTED_HASH = "39d411484740fb251bdbcce20f2c1eac54bba96f00c26ad63df072a4a4f96f48";

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
    try {
      const sessionToken = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (sessionToken === EXPECTED_HASH) return true;
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.hash === EXPECTED_HASH && parsed.expires > Date.now()) {
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
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

  function lockGate() {
    const gate = $("authGate");
    if (!gate) return;
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) { /* ignore */ }
    if ($("authPass")) $("authPass").value = "";
    if ($("authError")) $("authError").classList.add("hidden");
    const submitBtn = gate.querySelector(".auth-submit");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("is-verifying", "is-success");
      submitBtn.innerHTML = "🔓 解锁进入工作台";
    }
    const card = gate.querySelector(".auth-card");
    if (card) card.classList.remove("is-verified", "shake");
    gate.classList.remove("hidden", "unlocking");
    document.body.classList.add("auth-locked");
    setTimeout(() => { if ($("authUser")) $("authUser").focus(); }, 50);
  }

  function initAuthGate() {
    const gate = $("authGate");
    const form = $("authForm");
    if (!gate || !form) return;

    if (isUnlocked()) {
      unlockGate(true);
    } else {
      document.body.classList.add("auth-locked");
      setTimeout(() => { if ($("authUser")) $("authUser").focus(); }, 50);
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector(".auth-submit");
      const card = gate.querySelector(".auth-card");
      if (submitBtn && submitBtn.disabled) return;

      const user = ($("authUser").value || "").trim().toLowerCase();
      const pass = ($("authPass").value || "").trim();
      const remember = $("authRemember").checked;
      const errEl = $("authError");
      errEl.classList.add("hidden");
      if (card) card.classList.remove("shake");

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add("is-verifying");
        submitBtn.innerHTML = `<span class="auth-spinner"></span> 正在校验身份与同步数据...`;
      }

      const [hash] = await Promise.all([
        sha256Hex(`ielts_sprint_v1:${user}:${pass}`),
        new Promise((r) => setTimeout(r, 480))
      ]);

      if (hash === EXPECTED_HASH) {
        try {
          sessionStorage.setItem(AUTH_STORAGE_KEY, EXPECTED_HASH);
          if (remember) {
            localStorage.setItem(
              AUTH_STORAGE_KEY,
              JSON.stringify({ hash: EXPECTED_HASH, expires: Date.now() + 7 * 86400000 })
            );
          } else {
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        } catch (err) { /* ignore */ }

        if (card) card.classList.add("is-verified");
        if (submitBtn) {
          submitBtn.classList.remove("is-verifying");
          submitBtn.classList.add("is-success");
          submitBtn.innerHTML = `✅ 验证通过 · 欢迎回来，Kai`;
        }

        setTimeout(() => {
          unlockGate(false);
          App.toast("欢迎回来，Kai！今日冲刺继续 💪");
        }, 460);
      } else {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove("is-verifying");
          submitBtn.innerHTML = "🔓 解锁进入工作台";
        }
        errEl.classList.remove("hidden");
        if (card) {
          void card.offsetWidth; // trigger reflow
          card.classList.add("shake");
        }
        $("authPass").value = "";
        $("authPass").focus();
      }
    });

    const btnLock = $("btnLockApp");
    if (btnLock) {
      btnLock.addEventListener("click", () => {
        lockGate();
        App.toast("工作台已锁定 🔒");
      });
    }
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
        box.innerHTML = `<div class="sr-empty">太强了！文中没有筛出未记录的陌生难词，或请先点击上方「🚀 开始扫描匹配」。</div>`;
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

  function inspectAzWord(rawWord) {
    const clean = (rawWord || "").trim();
    if (!clean) return;
    azSelectedToken = clean;
    const low = clean.toLowerCase();
    const { coreMap, vocabMap } = buildWordIndex();
    const match = guessBaseWord(low, coreMap, vocabMap);

    $("azInspWord").textContent = match ? match.data.word : clean;
    $("btnAzSpeak").disabled = false;
    $("btnAzAddVocab").disabled = false;

    const dictLinks = `
      <div class="az-dict-links">
        <span>速查释义：</span>
        <a href="https://dictionary.cambridge.org/zhs/词典/英语-汉语-简体/${encodeURIComponent(clean)}" target="_blank" rel="noopener">剑桥词典 ↗</a>
        <a href="https://www.youdao.com/result?word=${encodeURIComponent(clean)}&lang=en" target="_blank" rel="noopener">有道词典 ↗</a>
      </div>`;

    if (match && match.type === "vocab") {
      const v = match.data;
      $("azInspPhonetic").textContent = "";
      $("azInspStatus").innerHTML = `<span class="az-badge az-b-vocab">🟠 已在我的生词本 (${esc(v.category)})</span>`;
      $("azInspDict").innerHTML = `<div class="az-meaning-box"><b>释义：</b>${esc(v.meaning)}${v.note ? `<br><small class="muted">备注：${esc(v.note)}</small>` : ""}</div>${dictLinks}`;
      $("azAddMeaning").value = v.meaning === "（待补充翻译）" ? "" : v.meaning;
      $("btnAzAddVocab").textContent = "🔄 更新生词本释义";
    } else if (match && match.type === "core") {
      const c = match.data;
      $("azInspPhonetic").textContent = c.phonetic || "";
      $("azInspStatus").innerHTML = `<span class="az-badge az-b-core">🟢 已背串文词 (${esc(c.dayLabel)} · ${esc(c.category)})</span>`;
      $("azInspDict").innerHTML = `<div class="az-meaning-box"><b>${esc(c.pos || "")} ${esc(c.cn)}</b>${c.tip ? `<br><small class="muted">💡 ${esc(c.tip)}</small>` : ""}</div>${dictLinks}`;
      $("azAddMeaning").value = `${c.pos ? c.pos + " " : ""}${c.cn}`;
      $("btnAzAddVocab").textContent = "⭐ 同时存入我的生词本";
    } else {
      $("azInspPhonetic").textContent = "";
      $("azInspStatus").innerHTML = `<span class="az-badge az-b-new">🔵 未记录新词（生词本中尚未收录）</span>`;
      $("azInspDict").innerHTML = dictLinks;
      $("azAddMeaning").value = "";
      $("btnAzAddVocab").textContent = "➕ 加入我的生词本";
      $("azAddMeaning").focus();
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
      App.toast("已存入「🎧 精听 & 精读记录」！");
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
      const meaning = ($("azAddMeaning").value || "").trim() || "（待补充翻译）";
      const cat = $("azAddCat").value;
      const src = ($("azTitleInput").value || "").trim();
      App.addWord({
        word: azSelectedToken,
        meaning,
        category: cat,
        note: src ? `来自真题：${src}` : ""
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

  // ==================== 启动 ====================
  function renderAll() {
    ensureFields();
    renderDashboard();
    renderWritingList();
  }

  initAuthGate();
  ensureFields();
  renderWritingShell();
  bindDashboard();
  bindWriting();
  bindSearch();
  bindAnalyzer();
  renderAll();

  let pending = false;
  document.addEventListener("ielts:saved", () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; renderAll(); });
  });
  // 跨天自动刷新（比如开着页面过了零点）
  let lastDay = today();
  setInterval(() => { if (today() !== lastDay) { lastDay = today(); renderAll(); } }, 60000);
})();
