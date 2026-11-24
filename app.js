(function () {
  "use strict";

  const STORAGE_KEY = "ielts_sprint_workbench_v1";

  // ==================== STATE ====================
  let state = loadState();
  let currentDayId = state.days[0]?.id || null;
  let currentCoreFilter = "all";
  let currentInspectedWord = null;
  let clozeMode = false;
  let hideVocabCn = false;
  let currentPracticeFilter = "all";
  let currentSpFilter = "all";
  let activeHighlightContainer = null;
  let savedSelectionRange = null;

  // Speaking Timer
  let timerSeconds = 60;
  let timerInitial = 60;
  let timerInterval = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const days = Array.isArray(parsed.days) && parsed.days.length
          ? parsed.days
          : structuredClone(window.IELTS_INITIAL_DATA.days);
        // Auto-merge any newly added days from data.js without overwriting user progress
        (window.IELTS_INITIAL_DATA.days || []).forEach((initDay) => {
          if (!days.some((d) => d.id === initDay.id)) {
            days.unshift(structuredClone(initDay));
          }
        });
        const speakingTopics = Array.isArray(parsed.speakingTopics)
          ? parsed.speakingTopics
          : structuredClone(window.IELTS_INITIAL_DATA.speakingTopics);
        (window.IELTS_INITIAL_DATA.speakingTopics || []).forEach((initSp) => {
          if (!speakingTopics.some((s) => s.id === initSp.id)) {
            speakingTopics.unshift(structuredClone(initSp));
          }
        });
        return {
          ...parsed, // keep extra module fields (writings, examTracker, etc.)
          examDate: parsed.examDate || window.IELTS_INITIAL_DATA.examDate,
          days,
          vocabBook: Array.isArray(parsed.vocabBook) ? parsed.vocabBook : [],
          practiceRecords: Array.isArray(parsed.practiceRecords) ? parsed.practiceRecords : [],
          speakingTopics,
          passageHighlights: parsed.passageHighlights || {},
          wordNotes: parsed.wordNotes || {},
          dark: Boolean(parsed.dark)
        };
      }
    } catch (e) {
      console.error("Failed to load state:", e);
    }
    return {
      examDate: window.IELTS_INITIAL_DATA.examDate,
      days: structuredClone(window.IELTS_INITIAL_DATA.days),
      vocabBook: [],
      practiceRecords: [],
      speakingTopics: structuredClone(window.IELTS_INITIAL_DATA.speakingTopics),
      passageHighlights: {},
      wordNotes: {},
      dark: false
    };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      document.dispatchEvent(new CustomEvent("ielts:saved"));
    } catch (e) {
      showToast("本地存储空间不足，请先导出备份！");
    }
  }

  // ==================== UTILS ====================
  const $ = (id) => document.getElementById(id);

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showToast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add("hidden"), 2400);
  }

  function speakText(text, rate = 0.92) {
    if (!("speechSynthesis" in window)) {
      showToast("当前浏览器不支持语音朗读");
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-GB";
    utter.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const gbVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en-gb"))
      || voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
    if (gbVoice) utter.voice = gbVoice;
    window.speechSynthesis.speak(utter);
  }

  function todayStr() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function updateCountdown() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(state.examDate + "T00:00:00");
    const diff = Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
    $("daysLeft").textContent = diff;
  }

  function updateBadges() {
    const unmastered = state.vocabBook.filter((v) => !v.mastered).length;
    $("vocabCountBadge").textContent = unmastered > 0 ? `${unmastered}/${state.vocabBook.length}` : state.vocabBook.length;
    $("practiceCountBadge").textContent = state.practiceRecords.length;
    $("speakingCountBadge").textContent = state.speakingTopics.length;
  }

  function getCurrentDay() {
    return state.days.find((d) => d.id === currentDayId) || state.days[0];
  }

  function findWordObjInDay(day, rawText) {
    if (!day || !day.words) return null;
    const clean = rawText.trim().toLowerCase();
    return day.words.find((w) => {
      if (w.word.toLowerCase() === clean) return true;
      if (Array.isArray(w.forms) && w.forms.some((f) => f.toLowerCase() === clean)) return true;
      return false;
    });
  }

  function isWordInVocabBook(word) {
    const clean = word.trim().toLowerCase();
    return state.vocabBook.some((v) => v.word.toLowerCase() === clean);
  }

  // ==================== TABS & THEME ====================
  function initTabs() {
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-tab").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        $("tab-" + btn.dataset.tab).classList.add("active");
        hideHlToolbar();
      });
    });

    if (state.dark) document.body.classList.add("dark");
    $("btnTheme").addEventListener("click", () => {
      state.dark = !state.dark;
      document.body.classList.toggle("dark", state.dark);
      saveState();
    });
  }

  // ==================== TAB 1: DAILY PLAN & STORY ====================
  function renderDaySelect() {
    const sel = $("daySelect");
    sel.innerHTML = state.days
      .map((d) => `<option value="${escapeHtml(d.id)}" ${d.id === currentDayId ? "selected" : ""}>${escapeHtml(d.label)}</option>`)
      .join("");
  }

  function renderDailyTasks() {
    const day = getCurrentDay();
    if (!day) return;
    const list = $("dailyTaskList");
    const tasks = day.tasks || [];
    const doneCount = tasks.filter((t) => t.done).length;
    const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

    $("dayProgressText").textContent = `今日完成 ${doneCount} / ${tasks.length} (${pct}%)`;
    $("dayProgressFill").style.width = `${pct}%`;

    list.innerHTML = tasks
      .map((t) => `
        <div class="task-item ${t.done ? "done" : ""}" data-tid="${escapeHtml(t.id)}">
          <label class="task-left">
            <input type="checkbox" ${t.done ? "checked" : ""} data-toggle-task="${escapeHtml(t.id)}" />
            <span class="task-text">
              ${t.tag ? `<span class="task-tag">${escapeHtml(t.tag)}</span>` : ""}${escapeHtml(t.text)}
            </span>
          </label>
          <button class="btn btn-ghost btn-sm" data-del-task="${escapeHtml(t.id)}" title="删除任务">✕</button>
        </div>
      `)
      .join("");
  }

  function buildPassageHtml(day) {
    const paragraphs = day.passageParagraphs || [];
    if (!clozeMode) {
      // Check if user has saved highlights for this day
      if (state.passageHighlights[day.id]) {
        return state.passageHighlights[day.id];
      }
      return paragraphs
        .map((p) => {
          const html = escapeHtml(p).replace(/\*\*(.+?)\*\*/g, (_, word) => {
            const wObj = findWordObjInDay(day, word);
            const key = wObj ? wObj.word : word;
            const savedClass = isWordInVocabBook(key) ? " saved-word" : "";
            return `<span class="core-word${savedClass}" data-word="${escapeHtml(key)}">${word}</span>`;
          });
          return `<p>${html}</p>`;
        })
        .join("");
    }

    // Cloze mode
    const scope = $("clozeScope").value;
    let idx = 0;
    return paragraphs
      .map((p) => {
        const html = escapeHtml(p).replace(/\*\*(.+?)\*\*/g, (_, word) => {
          const wObj = findWordObjInDay(day, word);
          const shouldBlank =
            scope === "all" || (wObj && wObj.category === "听力拼写");
          if (!shouldBlank) {
            return `<strong>${word}</strong>`;
          }
          idx++;
          const hint = wObj ? `${wObj.cn.split("；")[0].split("，")[0]} (${word[0]}...)` : `${word[0]}...`;
          return `<input type="text" class="cloze-input" data-ans="${escapeHtml(word)}" data-idx="${idx}" placeholder="${escapeHtml(word[0])}${"_".repeat(Math.max(2, word.length - 1))}" title="${escapeHtml(hint)}" /><span class="cloze-hint">[${escapeHtml(wObj ? wObj.cn.split("；")[0].split("，")[0] : "")}]</span>`;
        });
        return `<p>${html}</p>`;
      })
      .join("");
  }

  function renderPassage() {
    const day = getCurrentDay();
    if (!day) return;
    $("passageTitle").textContent = day.title || day.label;
    $("passageContent").innerHTML = buildPassageHtml(day);
    refreshSavedWordHighlights();

    const transEl = $("translationContent");
    const transParas = day.translationParagraphs || [];
    transEl.innerHTML = transParas.length
      ? transParas.map((p) => `<p>${escapeHtml(p)}</p>`).join("")
      : `<p class="muted">本篇暂未录入中文译文。</p>`;
  }

  function refreshSavedWordHighlights() {
    document.querySelectorAll("#passageContent .core-word").forEach((el) => {
      const w = el.dataset.word || el.textContent;
      el.classList.toggle("saved-word", isWordInVocabBook(w));
    });
  }

  function renderCoreWordList() {
    const day = getCurrentDay();
    if (!day) return;
    const words = day.words || [];
    const q = $("coreWordSearch").value.trim().toLowerCase();
    const filtered = words.filter((w) => {
      if (currentCoreFilter !== "all" && w.category !== currentCoreFilter) return false;
      if (q && !w.word.toLowerCase().includes(q) && !w.cn.toLowerCase().includes(q)) return false;
      return true;
    });

    $("coreWordCount").textContent = filtered.length;
    const list = $("coreWordList");
    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state">没有匹配的词汇</div>`;
      return;
    }

    list.innerHTML = filtered
      .map((w) => {
        const saved = isWordInVocabBook(w.word);
        return `
          <div class="core-word-row" data-inspect-word="${escapeHtml(w.word)}">
            <div>
              <strong>${escapeHtml(w.word)}</strong>
              <span class="cat-badge ${escapeHtml(w.category)}">${escapeHtml(w.category.slice(0, 2))}</span>
              <div class="cw-cn">${escapeHtml(w.pos || "")} ${escapeHtml(w.cn)}</div>
            </div>
            <div>
              <button class="btn btn-ghost btn-sm" data-quick-speak="${escapeHtml(w.word)}" title="朗读">🔊</button>
              <button class="btn btn-ghost btn-sm" data-quick-star="${escapeHtml(w.word)}" title="${saved ? "已在生词本" : "收录生词本"}">${saved ? "⭐" : "☆"}</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function inspectWord(wordKey) {
    const day = getCurrentDay();
    const wObj = findWordObjInDay(day, wordKey);
    if (!wObj) return;
    currentInspectedWord = wObj;

    // Highlight active word in passage
    document.querySelectorAll("#passageContent .core-word.active-word").forEach((el) => el.classList.remove("active-word"));
    document.querySelectorAll(`#passageContent .core-word[data-word="${CSS.escape(wObj.word)}"]`).forEach((el) => el.classList.add("active-word"));

    $("inspWord").textContent = wObj.word;
    $("inspPhonetic").textContent = wObj.phonetic || "";
    const catEl = $("inspCat");
    catEl.textContent = wObj.category || "核心词";
    catEl.className = `cat-badge ${wObj.category || ""}`;
    catEl.classList.remove("hidden");

    $("inspMeaning").textContent = `${wObj.pos ? wObj.pos + " " : ""}${wObj.cn}`;
    if (wObj.tip) {
      $("inspTip").textContent = wObj.tip;
      $("inspTip").classList.remove("hidden");
    } else {
      $("inspTip").classList.add("hidden");
    }

    $("btnInspSpeak").disabled = false;
    $("btnInspSave").disabled = false;
    const saved = isWordInVocabBook(wObj.word);
    $("btnInspSave").textContent = saved ? "✅ 已在生词本" : "⭐ 存进生词本";

    $("inspNoteWrap").classList.remove("hidden");
    $("inspNoteInput").value = state.wordNotes[wObj.word.toLowerCase()] || "";
  }

  function addWordToVocabBook(entry) {
    const clean = entry.word.trim();
    if (!clean) return false;
    const existing = state.vocabBook.find((v) => v.word.toLowerCase() === clean.toLowerCase());
    if (existing) {
      if (entry.meaning && !existing.meaning) existing.meaning = entry.meaning;
      if (entry.note) existing.note = entry.note;
      existing.mastered = false;
      saveState();
      renderVocabBook();
      renderCoreWordList();
      refreshSavedWordHighlights();
      updateBadges();
      showToast(`已更新生词本中的「${clean}」`);
      return true;
    }
    state.vocabBook.unshift({
      id: "v-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      word: clean,
      meaning: (entry.meaning || "").trim() || "（待补充翻译）",
      category: entry.category || "雅思哥生词",
      note: (entry.note || "").trim(),
      mastered: false,
      createdAt: todayStr()
    });
    saveState();
    renderVocabBook();
    renderCoreWordList();
    refreshSavedWordHighlights();
    updateBadges();
    showToast(`已收录「${clean}」到我的生词本`);
    return true;
  }

  // ==================== IELTS HIGHLIGHTING ENGINE ====================
  function hideHlToolbar() {
    $("hlToolbar").classList.add("hidden");
    savedSelectionRange = null;
    activeHighlightContainer = null;
  }

  function handleSelectionMouseUp(e) {
    // Ignore clicks on toolbar itself
    if (e.target.closest("#hlToolbar")) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      hideHlToolbar();
      return;
    }

    const range = sel.getRangeAt(0);
    const common = range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;

    const passageEl = common.closest("#passageContent");
    const excerptEl = common.closest(".record-excerpt");

    if ((!passageEl && !excerptEl) || (passageEl && clozeMode)) {
      hideHlToolbar();
      return;
    }

    activeHighlightContainer = passageEl || excerptEl;
    savedSelectionRange = range.cloneRange();

    const rect = range.getBoundingClientRect();
    const toolbar = $("hlToolbar");
    toolbar.classList.remove("hidden");
    const left = Math.max(12, Math.min(window.innerWidth - 260, rect.left + rect.width / 2 - 115 + window.scrollX));
    const top = Math.max(8, rect.top + window.scrollY - 44);
    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
  }

  function applyHighlightColor(color) {
    if (!savedSelectionRange || !activeHighlightContainer) return;

    const range = savedSelectionRange;
    if (color === "clear") {
      // Unwrap any user-hl-* marks intersecting selection
      const marks = Array.from(activeHighlightContainer.querySelectorAll("mark[class^='user-hl-']"));
      marks.forEach((m) => {
        if (range.intersectsNode(m)) {
          const parent = m.parentNode;
          while (m.firstChild) parent.insertBefore(m.firstChild, m);
          parent.removeChild(m);
        }
      });
    } else {
      // Walk all text nodes intersecting range safely
      const root = range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentNode;

      const textNodes = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      let n;
      while ((n = walker.nextNode())) textNodes.push(n);

      textNodes.forEach((textNode) => {
        let start = textNode === range.startContainer ? range.startOffset : 0;
        let end = textNode === range.endContainer ? range.endOffset : textNode.nodeValue.length;
        if (start >= end) return;

        let target = textNode;
        if (end < target.nodeValue.length) target.splitText(end);
        if (start > 0) target = target.splitText(start);

        const mark = document.createElement("mark");
        mark.className = `user-hl-${color}`;
        target.parentNode.insertBefore(mark, target);
        mark.appendChild(target);
      });
    }

    // Persist highlights
    if (activeHighlightContainer.id === "passageContent") {
      const day = getCurrentDay();
      if (day) {
        state.passageHighlights[day.id] = activeHighlightContainer.innerHTML;
        saveState();
      }
    } else if (activeHighlightContainer.dataset.prId) {
      const rec = state.practiceRecords.find((r) => r.id === activeHighlightContainer.dataset.prId);
      if (rec) {
        rec.excerptHtml = activeHighlightContainer.innerHTML;
        saveState();
      }
    }

    window.getSelection().removeAllRanges();
    hideHlToolbar();
  }

  // ==================== TAB 2: VOCAB BOOK ====================
  function renderVocabBook() {
    const q = $("vbSearch").value.trim().toLowerCase();
    const cat = $("vbFilterCat").value;
    const status = $("vbFilterStatus").value;

    const total = state.vocabBook.length;
    const unmasteredCount = state.vocabBook.filter((v) => !v.mastered).length;
    $("vocabStats").textContent = `共 ${total} 词 · 待掌握 ${unmasteredCount} 词`;

    const filtered = state.vocabBook.filter((v) => {
      if (cat !== "all" && v.category !== cat) return false;
      if (status === "unmastered" && v.mastered) return false;
      if (status === "mastered" && !v.mastered) return false;
      if (q && !v.word.toLowerCase().includes(q) && !v.meaning.toLowerCase().includes(q) && !(v.note || "").toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    const container = $("vocabList");
    if (!filtered.length) {
      container.innerHTML = `<div class="empty-state">暂无生词记录。你可以在「每日串文」里点词收藏，或直接在这里添加/批量导入雅思哥里不会的词！</div>`;
      return;
    }

    container.innerHTML = filtered
      .map((v) => `
        <div class="vocab-card ${v.mastered ? "mastered" : ""}" data-vid="${escapeHtml(v.id)}">
          <div class="vocab-card-top">
            <div>
              <span class="vocab-word-title">${escapeHtml(v.word)}</span>
              <span class="cat-badge ${escapeHtml(v.category)}">${escapeHtml(v.category)}</span>
            </div>
            <button class="btn btn-ghost btn-sm" data-vb-speak="${escapeHtml(v.word)}" title="英音朗读">🔊</button>
          </div>
          <div class="${hideVocabCn ? "vocab-meaning-blur" : ""}" onclick="this.classList.toggle('revealed')">
            ${escapeHtml(v.meaning)}
          </div>
          ${v.note ? `<div class="vocab-note-text">📝 ${escapeHtml(v.note)}</div>` : ""}
          <div class="vocab-card-actions">
            <span class="muted">${escapeHtml(v.createdAt || "")}</span>
            <div>
              <button class="btn btn-outline btn-sm" data-vb-toggle="${escapeHtml(v.id)}">${v.mastered ? "标为未掌握" : "✓ 已掌握"}</button>
              <button class="btn btn-ghost btn-sm" data-vb-edit="${escapeHtml(v.id)}">编辑</button>
              <button class="btn btn-danger-ghost btn-sm" data-vb-del="${escapeHtml(v.id)}">删</button>
            </div>
          </div>
        </div>
      `)
      .join("");
  }

  let quizQueue = [];
  let quizIndex = 0;

  function startVocabQuiz() {
    quizQueue = state.vocabBook.filter((v) => !v.mastered);
    if (!quizQueue.length) {
      showToast("生词本里目前没有未掌握的词！先收录几个吧。");
      return;
    }
    quizQueue = [...quizQueue].sort(() => Math.random() - 0.5).slice(0, 15);
    quizIndex = 0;
    $("vocabQuizBox").classList.remove("hidden");
    renderQuizStep();
  }

  function renderQuizStep() {
    const body = $("vocabQuizBody");
    if (quizIndex >= quizQueue.length) {
      body.innerHTML = `<p>🎉 本轮 ${quizQueue.length} 词抽测完成！</p>`;
      return;
    }
    const item = quizQueue[quizIndex];
    body.innerHTML = `
      <div class="muted">进度：${quizIndex + 1} / ${quizQueue.length} · 分类：${escapeHtml(item.category)}</div>
      <div class="quiz-prompt">中文释义：${escapeHtml(item.meaning)} ${item.note ? `<span class="muted">(${escapeHtml(item.note)})</span>` : ""}</div>
      <div class="quiz-row">
        <button class="btn btn-outline btn-sm" id="btnQuizSpeak">🔊 听发音</button>
        <input type="text" id="quizInput" class="text-input" placeholder="输入英文拼写后回车..." autocomplete="off" />
        <button class="btn btn-primary btn-sm" id="btnQuizSubmit">核对</button>
        <button class="btn btn-ghost btn-sm" id="btnQuizSkip">看答案/跳过</button>
      </div>
      <div id="quizFeedback" style="margin-top:8px;font-size:13px;font-weight:600;"></div>
    `;
    speakText(item.word);
    const input = $("quizInput");
    input.focus();

    const check = () => {
      const val = input.value.trim().toLowerCase();
      const ans = item.word.trim().toLowerCase();
      if (val === ans) {
        $("quizFeedback").innerHTML = `<span style="color:var(--success)">✅ 正确！${escapeHtml(item.word)}</span>`;
        setTimeout(() => {
          quizIndex++;
          renderQuizStep();
        }, 700);
      } else {
        $("quizFeedback").innerHTML = `<span style="color:var(--danger)">❌ 不对哦，再听一遍或点看答案</span>`;
      }
    };

    $("btnQuizSpeak").onclick = () => speakText(item.word);
    $("btnQuizSubmit").onclick = check;
    input.onkeydown = (e) => {
      if (e.key === "Enter") check();
    };
    $("btnQuizSkip").onclick = () => {
      $("quizFeedback").innerHTML = `正确答案：<strong>${escapeHtml(item.word)}</strong> <button class="btn btn-sm btn-outline" id="btnQuizNext" style="margin-left:8px;">下一题 →</button>`;
      $("btnQuizNext").onclick = () => {
        quizIndex++;
        renderQuizStep();
      };
    };
  }

  // ==================== TAB 3: PRACTICE LOG ====================
  function renderPracticeRecords() {
    const all = state.practiceRecords;
    const listen = all.filter((r) => r.type === "listening");
    const read = all.filter((r) => r.type === "reading");

    $("statListenCount").textContent = `${listen.length} 篇`;
    $("statReadCount").textContent = `${read.length} 篇`;

    const calcAcc = (arr) => {
      const valid = arr.filter((r) => Number(r.total) > 0 && r.correct !== "" && r.correct !== null);
      if (!valid.length) return "--";
      const avg = valid.reduce((s, r) => s + (Number(r.correct) / Number(r.total)) * 100, 0) / valid.length;
      return `${Math.round(avg)}%`;
    };
    $("statListenAcc").textContent = calcAcc(listen);
    $("statReadAcc").textContent = calcAcc(read);

    const filtered = all.filter((r) => currentPracticeFilter === "all" || r.type === currentPracticeFilter);
    const list = $("practiceRecordsList");
    if (!filtered.length) {
      list.innerHTML = `<div class="card empty-state">还没有精听/精读记录。做完剑10 Test 1 后，在左侧记下你的正确数、同义替换和错因吧！</div>`;
      return;
    }

    list.innerHTML = filtered
      .map((r) => {
        const typeLabel = r.type === "listening" ? "🎧 听力精听" : "📖 阅读精读";
        const pct = r.total > 0 && r.correct !== "" ? Math.round((Number(r.correct) / Number(r.total)) * 100) : null;
        const synLines = (r.synonyms || "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);

        return `
          <div class="record-card">
            <div class="record-top">
              <div>
                <span class="pill-tag">${typeLabel}</span>
                <span class="muted">${escapeHtml(r.date || "")} ${r.minutes ? `· ${escapeHtml(r.minutes)}分钟` : ""}</span>
                <h3 style="margin-top:4px;font-size:16px;">${escapeHtml(r.source)}</h3>
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                ${r.correct !== "" ? `<span class="record-score-badge">${escapeHtml(r.correct)} / ${escapeHtml(r.total)}${pct !== null ? ` (${pct}%)` : ""}</span>` : ""}
                ${r.excerpt ? `<button class="btn btn-outline btn-sm" data-pr-analyze="${escapeHtml(r.id)}">🔬 词频雷达</button>` : ""}
                <button class="btn btn-ghost btn-sm" data-pr-edit="${escapeHtml(r.id)}">编辑</button>
                <button class="btn btn-danger-ghost btn-sm" data-pr-del="${escapeHtml(r.id)}">删</button>
              </div>
            </div>
            ${synLines.length ? `
              <div>
                <span class="field-label">🔁 同义替换积累：</span>
                <div class="synonym-chips">
                  ${synLines.map((line) => `<span class="syn-chip">${escapeHtml(line)}</span>`).join("")}
                </div>
              </div>
            ` : ""}
            ${r.notes ? `
              <div style="margin-top:8px;">
                <span class="field-label">📌 错题复盘 / 漏听词：</span>
                <div class="record-notes">${escapeHtml(r.notes)}</div>
              </div>
            ` : ""}
            ${(r.excerptHtml || r.excerpt) ? `
              <div style="margin-top:10px;">
                <span class="field-label">✨ 原文精读片段（可直接鼠标划词高亮或收生词）：</span>
                <div class="record-excerpt" data-pr-id="${escapeHtml(r.id)}">${r.excerptHtml || escapeHtml(r.excerpt)}</div>
              </div>
            ` : ""}
          </div>
        `;
      })
      .join("");
  }

  function resetPracticeForm() {
    $("prEditId").value = "";
    $("practiceFormTitle").textContent = "🎧 新增精听 / 精读记录";
    $("prSource").value = "";
    $("prCorrect").value = "";
    $("prTotal").value = "20";
    $("prMinutes").value = "";
    $("prSynonyms").value = "";
    $("prNotes").value = "";
    $("prExcerpt").value = "";
    $("prDate").value = todayStr();
    $("btnCancelPracticeEdit").classList.add("hidden");
  }

  // ==================== TAB 4: SPEAKING BANK ====================
  function renderSpeakingList() {
    const q = $("spSearch").value.trim().toLowerCase();
    const filtered = state.speakingTopics.filter((item) => {
      if (currentSpFilter === "万能串题素材") {
        if (item.tag !== "万能串题素材") return false;
      } else if (currentSpFilter !== "all" && item.part !== currentSpFilter) {
        return false;
      }
      if (q && !item.topic.toLowerCase().includes(q) && !item.question.toLowerCase().includes(q) && !(item.draft || "").toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    const list = $("speakingList");
    if (!filtered.length) {
      list.innerHTML = `<div class="card empty-state">没有匹配的口语题。快从雅思哥挑选今天要练的题目填到左侧吧！</div>`;
      return;
    }

    list.innerHTML = filtered
      .map((item) => `
        <div class="record-card">
          <div class="record-top">
            <div>
              <span class="pill-tag">${escapeHtml(item.part)}</span>
              <span class="cat-badge">${escapeHtml(item.tag || "练习")}</span>
              ${item.mastered ? `<span class="cat-badge 口语活词">✅ 已练熟</span>` : ""}
              <h3 style="margin-top:5px;font-size:15.5px;">${escapeHtml(item.topic)} — ${escapeHtml(item.question)}</h3>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0;">
              <button class="btn btn-outline btn-sm" data-sp-speak="${escapeHtml(item.question)}" title="朗读题目">🔊</button>
              <button class="btn btn-outline btn-sm" data-sp-copy="${escapeHtml(item.id)}" title="复制题目和草稿发给AI批改">📋 发AI批改</button>
              <button class="btn btn-ghost btn-sm" data-sp-toggle="${escapeHtml(item.id)}">${item.mastered ? "重练" : "✓ 熟了"}</button>
              <button class="btn btn-ghost btn-sm" data-sp-edit="${escapeHtml(item.id)}">编辑</button>
              <button class="btn btn-danger-ghost btn-sm" data-sp-del="${escapeHtml(item.id)}">删</button>
            </div>
          </div>
          ${item.keywords ? `
            <div class="synonym-chips">
              ${item.keywords.split(/[,，]/).map((k) => k.trim()).filter(Boolean).map((k) => `<span class="syn-chip">🔑 ${escapeHtml(k)}</span>`).join("")}
            </div>
          ` : ""}
          ${item.draft ? `
            <div class="sp-answer-block">
              <div class="field-label">我的口语草稿：</div>
              ${escapeHtml(item.draft)}
            </div>
          ` : `
            <div class="sp-inline-draft">
              <textarea class="textarea-input full-width" rows="2" data-sp-inline-input="${escapeHtml(item.id)}" placeholder="直接在这里打字或语音转文字填入你的回答草稿..."></textarea>
              <div class="sp-inline-actions">
                <button class="btn btn-primary btn-sm" data-sp-inline-save="${escapeHtml(item.id)}">💾 保存草稿</button>
                <button class="btn btn-outline btn-sm" data-sp-inline-ai="${escapeHtml(item.id)}">📋 保存并复制发 AI 批改</button>
              </div>
            </div>
          `}
          ${item.polished ? `
            <div class="sp-answer-block polished">
              <div class="field-label" style="color:var(--success);display:flex;justify-content:space-between;">
                <span>✨ 6.0–6.5 地道升级版（跟读背诵）：</span>
                <button class="btn btn-ghost btn-sm" data-sp-speak="${escapeHtml(item.polished)}">🔊 听升级版</button>
              </div>
              ${escapeHtml(item.polished)}
            </div>
          ` : ""}
        </div>
      `)
      .join("");
  }

  function resetSpeakingForm() {
    $("spEditId").value = "";
    $("spFormTitle").textContent = "➕ 从雅思哥添加今日口语题";
    $("spTopic").value = "";
    $("spQuestion").value = "";
    $("spDraft").value = "";
    $("spPolished").value = "";
    $("spKeywords").value = "";
    $("btnCancelSpEdit").classList.add("hidden");
  }

  function updateTimerDisplay() {
    const m = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
    const s = String(timerSeconds % 60).padStart(2, "0");
    $("timerDisplay").textContent = `${m}:${s}`;
  }

  // ==================== MODALS & IMPORT/EXPORT ====================
  function openModal(id) {
    $(id).classList.remove("hidden");
  }

  function closeAllModals() {
    document.querySelectorAll(".modal-backdrop").forEach((m) => m.classList.add("hidden"));
  }

  // ==================== EVENT BINDING ====================
  function bindEvents() {
    // Selection highlight listener (Desktop mouseup + iPhone touchend)
    document.addEventListener("mouseup", handleSelectionMouseUp);
    document.addEventListener("touchend", (e) => {
      setTimeout(() => handleSelectionMouseUp(e), 80);
    });

    $("hlToolbar").addEventListener("click", (e) => {
      const hlBtn = e.target.closest("[data-hl]");
      if (hlBtn) {
        applyHighlightColor(hlBtn.dataset.hl);
        return;
      }
      if (e.target.closest("#hlSpeakBtn")) {
        const text = savedSelectionRange ? savedSelectionRange.toString().trim() : "";
        if (text) speakText(text);
        return;
      }
      if (e.target.closest("#hlSearchBtn")) {
        const text = savedSelectionRange ? savedSelectionRange.toString().trim() : "";
        hideHlToolbar();
        if (text && window.IELTSApp && window.IELTSApp.openSearch) {
          window.IELTSApp.openSearch(text);
        }
        return;
      }
      if (e.target.closest("#hlAddWordBtn")) {
        const text = savedSelectionRange ? savedSelectionRange.toString().trim() : "";
        if (text) {
          if ($("quickAddDetails")) $("quickAddDetails").open = true;
          $("quickWord").value = text;
          const day = getCurrentDay();
          const matched = findWordObjInDay(day, text);
          if (matched) {
            $("quickMeaning").value = matched.cn;
            $("quickCategory").value = matched.category;
            $("quickNote").value = matched.tip || "";
          } else {
            $("quickMeaning").value = "";
            $("quickMeaning").focus();
          }
          // Switch to daily tab quick box if on daily, or add directly on practice tab
          if ($("tab-daily").classList.contains("active")) {
            $("quickMeaning").focus();
            showToast(`已将「${text}」填入右侧记生词框，填好中文点击记录即可`);
          } else {
            const cn = prompt(`将「${text}」加入生词本，请输入中文翻译（可留空稍后补）：`, "");
            if (cn !== null) {
              addWordToVocabBook({ word: text, meaning: cn, category: "雅思哥生词", note: "来自精听/精读原文高亮" });
            }
          }
        }
        hideHlToolbar();
      }
    });

    // Day selector & tasks
    $("daySelect").addEventListener("change", (e) => {
      currentDayId = e.target.value;
      clozeMode = false;
      $("clozeBar").classList.add("hidden");
      $("btnToggleCloze").classList.remove("active-toggle");
      renderDailyTasks();
      renderPassage();
      renderCoreWordList();
    });

    $("dailyTaskList").addEventListener("change", (e) => {
      const tid = e.target.dataset.toggleTask;
      if (!tid) return;
      const day = getCurrentDay();
      const task = day.tasks.find((t) => t.id === tid);
      if (task) {
        task.done = e.target.checked;
        saveState();
        renderDailyTasks();
      }
    });

    $("dailyTaskList").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-del-task]");
      if (!btn) return;
      const day = getCurrentDay();
      day.tasks = day.tasks.filter((t) => t.id !== btn.dataset.delTask);
      saveState();
      renderDailyTasks();
    });

    const addTask = () => {
      const val = $("newTaskInput").value.trim();
      if (!val) return;
      const day = getCurrentDay();
      day.tasks.push({ id: "t-" + Date.now(), tag: "自添", text: val, done: false });
      $("newTaskInput").value = "";
      saveState();
      renderDailyTasks();
    };
    $("btnAddTask").addEventListener("click", addTask);
    $("newTaskInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addTask();
    });

    // Passage click to inspect core word (and scroll matching item into view in right list)
    $("passageContent").addEventListener("click", (e) => {
      const span = e.target.closest(".core-word");
      if (!span) return;
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) return; // Don't hijack drag selection
      const wKey = span.dataset.word || span.textContent;
      inspectWord(wKey);
      const row = document.querySelector(`#coreWordList .core-word-row[data-inspect-word="${CSS.escape(wKey)}"]`);
      if (row) {
        document.querySelectorAll("#coreWordList .core-word-row.active-row").forEach((r) => r.classList.remove("active-row"));
        row.classList.add("active-row");
        row.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });

    // Cloze mode keyboard flow: Enter / Tab moves to next input; Enter on last checks answers
    $("passageContent").addEventListener("keydown", (e) => {
      const inp = e.target.closest(".cloze-input");
      if (!inp) return;
      if (e.key === "Enter") {
        e.preventDefault();
        const all = Array.from(document.querySelectorAll("#passageContent .cloze-input"));
        const i = all.indexOf(inp);
        if (i >= 0 && i < all.length - 1) {
          all[i + 1].focus();
          all[i + 1].select();
        } else {
          $("btnCheckCloze").click();
        }
      }
    });

    // Passage controls
    $("btnToggleTrans").addEventListener("click", () => {
      $("translationBox").classList.toggle("hidden");
      $("btnToggleTrans").classList.toggle("active-toggle");
    });

    $("btnReadPassage").addEventListener("click", () => {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        showToast("已停止朗读");
        return;
      }
      const day = getCurrentDay();
      const plain = (day.passageParagraphs || []).join(" ").replace(/\*\*/g, "");
      speakText(plain, 0.9);
      showToast("正在英音朗读本篇串文（再点一次停止）");
    });

    $("btnClearPassageHl").addEventListener("click", () => {
      const day = getCurrentDay();
      if (!day) return;
      delete state.passageHighlights[day.id];
      saveState();
      renderPassage();
      showToast("已清除本篇手动高亮");
    });

    $("btnToggleCloze").addEventListener("click", () => {
      clozeMode = !clozeMode;
      $("btnToggleCloze").classList.toggle("active-toggle", clozeMode);
      $("clozeBar").classList.toggle("hidden", !clozeMode);
      $("clozeScore").textContent = "填写后点击核对";
      renderPassage();
    });

    $("clozeScope").addEventListener("change", () => {
      if (clozeMode) renderPassage();
    });

    $("btnCheckCloze").addEventListener("click", () => {
      const inputs = Array.from(document.querySelectorAll("#passageContent .cloze-input"));
      let correct = 0;
      inputs.forEach((inp) => {
        const userVal = inp.value.trim().toLowerCase();
        const ans = inp.dataset.ans.trim().toLowerCase();
        inp.classList.remove("correct", "wrong");
        if (userVal === ans) {
          inp.classList.add("correct");
          correct++;
        } else {
          inp.classList.add("wrong");
        }
      });
      $("clozeScore").textContent = `拼写正确：${correct} / ${inputs.length}`;
    });

    $("btnRevealCloze").addEventListener("click", () => {
      document.querySelectorAll("#passageContent .cloze-input").forEach((inp) => {
        if (inp.value.trim().toLowerCase() !== inp.dataset.ans.trim().toLowerCase()) {
          inp.value = inp.dataset.ans;
          inp.classList.remove("wrong");
          inp.classList.add("correct");
        }
      });
    });

    // Word inspector buttons
    $("btnInspSpeak").addEventListener("click", () => {
      if (currentInspectedWord) speakText(currentInspectedWord.word);
    });

    $("btnInspSave").addEventListener("click", () => {
      if (!currentInspectedWord) return;
      const customNote = $("inspNoteInput").value.trim();
      addWordToVocabBook({
        word: currentInspectedWord.word,
        meaning: `${currentInspectedWord.pos ? currentInspectedWord.pos + " " : ""}${currentInspectedWord.cn}`,
        category: currentInspectedWord.category,
        note: customNote || currentInspectedWord.tip || ""
      });
      $("btnInspSave").textContent = "✅ 已在生词本";
    });

    $("btnSaveInspNote").addEventListener("click", () => {
      if (!currentInspectedWord) return;
      state.wordNotes[currentInspectedWord.word.toLowerCase()] = $("inspNoteInput").value.trim();
      saveState();
      showToast("记忆笔记已保存");
    });

    // Quick add word
    $("btnQuickAddWord").addEventListener("click", () => {
      const w = $("quickWord").value.trim();
      if (!w) {
        showToast("请先输入英文单词");
        return;
      }
      addWordToVocabBook({
        word: w,
        meaning: $("quickMeaning").value.trim(),
        category: $("quickCategory").value,
        note: $("quickNote").value.trim()
      });
      $("quickWord").value = "";
      $("quickMeaning").value = "";
      $("quickNote").value = "";
    });

    // Core word list filter & click
    $("coreFilterPills").addEventListener("click", (e) => {
      const pill = e.target.closest(".pill");
      if (!pill) return;
      $("coreFilterPills").querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentCoreFilter = pill.dataset.cat;
      renderCoreWordList();
    });

    $("coreWordSearch").addEventListener("input", renderCoreWordList);

    $("coreWordList").addEventListener("click", (e) => {
      const speakBtn = e.target.closest("[data-quick-speak]");
      if (speakBtn) {
        e.stopPropagation();
        speakText(speakBtn.dataset.quickSpeak);
        return;
      }
      const starBtn = e.target.closest("[data-quick-star]");
      if (starBtn) {
        e.stopPropagation();
        const day = getCurrentDay();
        const wObj = findWordObjInDay(day, starBtn.dataset.quickStar);
        if (wObj) {
          addWordToVocabBook({
            word: wObj.word,
            meaning: `${wObj.pos ? wObj.pos + " " : ""}${wObj.cn}`,
            category: wObj.category,
            note: wObj.tip || ""
          });
        }
        return;
      }
      const row = e.target.closest("[data-inspect-word]");
      if (row) inspectWord(row.dataset.inspectWord);
    });

    // TAB 2: Vocab Book
    $("btnAddVocab").addEventListener("click", () => {
      const word = $("vbWord").value.trim();
      if (!word) return showToast("请输入英文单词");
      addWordToVocabBook({
        word,
        meaning: $("vbMeaning").value.trim(),
        category: $("vbCategory").value,
        note: $("vbNote").value.trim()
      });
      $("vbWord").value = "";
      $("vbMeaning").value = "";
      $("vbNote").value = "";
    });

    $("vbSearch").addEventListener("input", renderVocabBook);
    $("vbFilterCat").addEventListener("change", renderVocabBook);
    $("vbFilterStatus").addEventListener("change", renderVocabBook);

    $("btnToggleHideCn").addEventListener("click", () => {
      hideVocabCn = !hideVocabCn;
      $("btnToggleHideCn").classList.toggle("active-toggle", hideVocabCn);
      renderVocabBook();
    });

    $("btnStartVocabQuiz").addEventListener("click", startVocabQuiz);
    $("btnCloseQuiz").addEventListener("click", () => $("vocabQuizBox").classList.add("hidden"));

    $("btnCopyUnmastered").addEventListener("click", () => {
      const list = state.vocabBook.filter((v) => !v.mastered);
      if (!list.length) return showToast("当前没有未掌握的生词");
      const text = "这是我最近不会/未掌握的雅思生词，请帮我编进明天的情景串文里复习：\n" +
        list.map((v) => `- ${v.word}: ${v.meaning}${v.note ? ` (${v.note})` : ""}`).join("\n");
      navigator.clipboard.writeText(text).then(
        () => showToast(`已复制 ${list.length} 个未掌握生词，直接粘贴发给我就行！`),
        () => showToast("复制失败，请手动查看生词本")
      );
    });

    $("vocabList").addEventListener("click", (e) => {
      const spk = e.target.closest("[data-vb-speak]");
      if (spk) return speakText(spk.dataset.vbSpeak);

      const tog = e.target.closest("[data-vb-toggle]");
      if (tog) {
        const item = state.vocabBook.find((v) => v.id === tog.dataset.vbToggle);
        if (item) {
          item.mastered = !item.mastered;
          saveState();
          renderVocabBook();
          updateBadges();
        }
        return;
      }

      const edt = e.target.closest("[data-vb-edit]");
      if (edt) {
        const item = state.vocabBook.find((v) => v.id === edt.dataset.vbEdit);
        if (!item) return;
        const newMeaning = prompt(`修改「${item.word}」的中文翻译：`, item.meaning);
        if (newMeaning !== null) {
          item.meaning = newMeaning.trim() || item.meaning;
          const newNote = prompt(`修改「${item.word}」的备注/同义词：`, item.note || "");
          if (newNote !== null) item.note = newNote.trim();
          saveState();
          renderVocabBook();
        }
        return;
      }

      const del = e.target.closest("[data-vb-del]");
      if (del) {
        state.vocabBook = state.vocabBook.filter((v) => v.id !== del.dataset.vbDel);
        saveState();
        renderVocabBook();
        renderCoreWordList();
        refreshSavedWordHighlights();
        updateBadges();
      }
    });

    // Batch import vocab modal
    $("btnOpenBatchVocab").addEventListener("click", () => openModal("modalBatchVocab"));
    $("btnConfirmBatchVocab").addEventListener("click", () => {
      const raw = $("batchVocabText").value.trim();
      if (!raw) return showToast("请先粘贴生词列表");
      const cat = $("batchVocabCat").value;
      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      let count = 0;
      lines.forEach((line) => {
        const parts = line.split(/\s*[-:：\t]\s*/);
        let word = parts[0] || "";
        let meaning = parts[1] || "";
        let note = parts.slice(2).join(" - ");
        if (!meaning && line.includes(" ")) {
          const idx = line.search(/[\u4e00-\u9fa5]/);
          if (idx > 0) {
            word = line.slice(0, idx).trim();
            meaning = line.slice(idx).trim();
          }
        }
        if (word) {
          addWordToVocabBook({ word, meaning, category: cat, note });
          count++;
        }
      });
      $("batchVocabText").value = "";
      closeAllModals();
      showToast(`成功导入 ${count} 个生词！`);
    });

    // TAB 3: Practice Log
    $("prDate").value = todayStr();
    $("btnSavePractice").addEventListener("click", () => {
      const source = $("prSource").value.trim();
      if (!source) return showToast("请填写真题来源（如：剑10 Test 1 Part 1-2）");

      const editId = $("prEditId").value;
      const payload = {
        id: editId || "pr-" + Date.now(),
        type: $("prType").value,
        date: $("prDate").value || todayStr(),
        source,
        correct: $("prCorrect").value,
        total: $("prTotal").value || 20,
        minutes: $("prMinutes").value,
        synonyms: $("prSynonyms").value.trim(),
        notes: $("prNotes").value.trim(),
        excerpt: $("prExcerpt").value.trim()
      };

      if (editId) {
        const idx = state.practiceRecords.findIndex((r) => r.id === editId);
        if (idx >= 0) {
          // Keep highlights if excerpt text unchanged
          if (state.practiceRecords[idx].excerpt === payload.excerpt) {
            payload.excerptHtml = state.practiceRecords[idx].excerptHtml;
          }
          state.practiceRecords[idx] = payload;
        }
      } else {
        state.practiceRecords.unshift(payload);
      }

      saveState();
      resetPracticeForm();
      renderPracticeRecords();
      updateBadges();
      showToast("精听/精读记录已保存！");
    });

    $("btnCancelPracticeEdit").addEventListener("click", resetPracticeForm);

    $("practiceFilterPills").addEventListener("click", (e) => {
      const pill = e.target.closest(".pill");
      if (!pill) return;
      $("practiceFilterPills").querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentPracticeFilter = pill.dataset.type;
      renderPracticeRecords();
    });

    $("practiceRecordsList").addEventListener("click", (e) => {
      const edt = e.target.closest("[data-pr-edit]");
      if (edt) {
        const rec = state.practiceRecords.find((r) => r.id === edt.dataset.prEdit);
        if (!rec) return;
        $("prEditId").value = rec.id;
        $("practiceFormTitle").textContent = "✏️ 编辑精听 / 精读记录";
        $("prType").value = rec.type;
        $("prDate").value = rec.date || todayStr();
        $("prSource").value = rec.source || "";
        $("prCorrect").value = rec.correct ?? "";
        $("prTotal").value = rec.total ?? 20;
        $("prMinutes").value = rec.minutes ?? "";
        $("prSynonyms").value = rec.synonyms || "";
        $("prNotes").value = rec.notes || "";
        $("prExcerpt").value = rec.excerpt || "";
        $("btnCancelPracticeEdit").classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const del = e.target.closest("[data-pr-del]");
      if (del) {
        if (!confirm("确定删除这条精听/精读记录吗？")) return;
        state.practiceRecords = state.practiceRecords.filter((r) => r.id !== del.dataset.prDel);
        saveState();
        renderPracticeRecords();
        updateBadges();
      }
    });

    // TAB 4: Speaking
    document.querySelectorAll(".timer-presets [data-sec]").forEach((btn) => {
      btn.addEventListener("click", () => {
        clearInterval(timerInterval);
        timerInterval = null;
        timerInitial = Number(btn.dataset.sec);
        timerSeconds = timerInitial;
        updateTimerDisplay();
      });
    });

    $("btnTimerStart").addEventListener("click", () => {
      if (timerInterval) return;
      timerInterval = setInterval(() => {
        if (timerSeconds > 0) {
          timerSeconds--;
          updateTimerDisplay();
        } else {
          clearInterval(timerInterval);
          timerInterval = null;
          showToast("⏰ 时间到！");
        }
      }, 1000);
    });

    $("btnTimerPause").addEventListener("click", () => {
      clearInterval(timerInterval);
      timerInterval = null;
    });

    $("btnTimerReset").addEventListener("click", () => {
      clearInterval(timerInterval);
      timerInterval = null;
      timerSeconds = timerInitial;
      updateTimerDisplay();
    });

    $("btnSaveSpeaking").addEventListener("click", () => {
      const topic = $("spTopic").value.trim();
      const question = $("spQuestion").value.trim();
      if (!question) return showToast("请填写口语题目内容");

      const editId = $("spEditId").value;
      const payload = {
        id: editId || "sp-" + Date.now(),
        part: $("spPart").value,
        tag: $("spTag").value,
        topic: topic || "口语话题",
        question,
        draft: $("spDraft").value.trim(),
        polished: $("spPolished").value.trim(),
        keywords: $("spKeywords").value.trim(),
        mastered: false
      };

      if (editId) {
        const idx = state.speakingTopics.findIndex((s) => s.id === editId);
        if (idx >= 0) {
          payload.mastered = state.speakingTopics[idx].mastered;
          state.speakingTopics[idx] = payload;
        }
      } else {
        state.speakingTopics.unshift(payload);
      }
      saveState();
      resetSpeakingForm();
      renderSpeakingList();
      updateBadges();
      showToast("口语题已保存！");
    });

    $("btnCancelSpEdit").addEventListener("click", resetSpeakingForm);

    $("spFilterPart").addEventListener("click", (e) => {
      const pill = e.target.closest(".pill");
      if (!pill) return;
      $("spFilterPart").querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentSpFilter = pill.dataset.part;
      renderSpeakingList();
    });

    $("spSearch").addEventListener("input", renderSpeakingList);

    $("speakingList").addEventListener("click", (e) => {
      const spk = e.target.closest("[data-sp-speak]");
      if (spk) return speakText(spk.dataset.spSpeak);

      const inSave = e.target.closest("[data-sp-inline-save]");
      const inAi = e.target.closest("[data-sp-inline-ai]");
      if (inSave || inAi) {
        const id = (inSave || inAi).dataset.spInlineSave || (inSave || inAi).dataset.spInlineAi;
        const ta = $("speakingList").querySelector(`textarea[data-sp-inline-input="${CSS.escape(id)}"]`);
        const val = ta ? ta.value.trim() : "";
        if (!val) return showToast("请先输入你的口语回答草稿");
        const item = state.speakingTopics.find((s) => s.id === id);
        if (!item) return;
        item.draft = val;
        saveState();
        renderSpeakingList();
        if (inAi) {
          const msg = `请按雅思口语 6.0–6.5 标准帮我批改并升级这道题：\n【${item.part} · ${item.topic}】\n题目：${item.question}\n我的回答：${item.draft}`;
          navigator.clipboard.writeText(msg).then(
            () => showToast("草稿已保存并复制，直接粘贴发给 AI 批改！"),
            () => showToast("草稿已保存！")
          );
        } else {
          showToast("口语草稿已保存！");
        }
        return;
      }

      const cpy = e.target.closest("[data-sp-copy]");
      if (cpy) {
        const item = state.speakingTopics.find((s) => s.id === cpy.dataset.spCopy);
        if (!item) return;
        const msg = `请按雅思口语 6.0–6.5 标准帮我批改并升级这道题：\n【${item.part} · ${item.topic}】\n题目：${item.question}\n我的回答：${item.draft || "（还没写，请先给我一个 6.5 分参考示范和思路）"}`;
        navigator.clipboard.writeText(msg).then(
          () => showToast("已复制题目与回答，直接粘贴发给我批改！"),
          () => showToast("复制失败")
        );
        return;
      }

      const tog = e.target.closest("[data-sp-toggle]");
      if (tog) {
        const item = state.speakingTopics.find((s) => s.id === tog.dataset.spToggle);
        if (item) {
          item.mastered = !item.mastered;
          saveState();
          renderSpeakingList();
        }
        return;
      }

      const edt = e.target.closest("[data-sp-edit]");
      if (edt) {
        const item = state.speakingTopics.find((s) => s.id === edt.dataset.spEdit);
        if (!item) return;
        $("spEditId").value = item.id;
        $("spFormTitle").textContent = "✏️ 编辑口语题与草稿";
        $("spPart").value = item.part;
        $("spTag").value = item.tag || "今日必练";
        $("spTopic").value = item.topic || "";
        $("spQuestion").value = item.question || "";
        $("spDraft").value = item.draft || "";
        $("spPolished").value = item.polished || "";
        $("spKeywords").value = item.keywords || "";
        $("btnCancelSpEdit").classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const del = e.target.closest("[data-sp-del]");
      if (del) {
        if (!confirm("确定删除这道口语题吗？")) return;
        state.speakingTopics = state.speakingTopics.filter((s) => s.id !== del.dataset.spDel);
        saveState();
        renderSpeakingList();
        updateBadges();
      }
    });

    // Modals: Close
    document.querySelectorAll(".modal-close").forEach((b) => b.addEventListener("click", closeAllModals));
    document.querySelectorAll(".modal-backdrop").forEach((bd) => {
      bd.addEventListener("click", (e) => {
        if (e.target === bd) closeAllModals();
      });
    });

    // Import Daily JSON Pack
    $("btnImportDaily").addEventListener("click", () => openModal("modalImportDaily"));
    $("btnConfirmImportDaily").addEventListener("click", () => {
      try {
        const pack = JSON.parse($("importDailyJson").value.trim());
        if (!pack.id || !pack.label) throw new Error("缺少 id 或 label");
        const existingIdx = state.days.findIndex((d) => d.id === pack.id);
        if (existingIdx >= 0) {
          state.days[existingIdx] = pack;
        } else {
          state.days.unshift(pack);
        }
        if (Array.isArray(pack.speakingTopics)) {
          pack.speakingTopics.forEach((st) => {
            if (!state.speakingTopics.some((x) => x.id === st.id)) {
              state.speakingTopics.unshift(st);
            }
          });
        }
        currentDayId = pack.id;
        saveState();
        renderDaySelect();
        renderDailyTasks();
        renderPassage();
        renderCoreWordList();
        renderSpeakingList();
        updateBadges();
        $("importDailyJson").value = "";
        closeAllModals();
        showToast(`成功导入：${pack.label}`);
      } catch (err) {
        showToast("JSON 格式不对：" + err.message);
      }
    });

    // Manual New Day
    $("btnNewDay").addEventListener("click", () => openModal("modalNewDay"));
    $("btnConfirmNewDay").addEventListener("click", () => {
      const label = $("newDayLabel").value.trim();
      if (!label) return showToast("请填写这一天的标题");
      const passage = $("newDayPassage").value.trim();
      const trans = $("newDayTrans").value.trim();
      const id = "day-" + Date.now();
      const newDay = {
        id,
        date: todayStr(),
        label,
        title: label,
        tasks: [
          { id: id + "-t1", tag: "词汇", text: "背诵今日高频词串文", done: false },
          { id: id + "-t2", tag: "听力", text: "剑雅听力真题 + 精听复盘", done: false },
          { id: id + "-t3", tag: "阅读", text: "剑雅阅读真题 + 同义替换", done: false },
          { id: id + "-t4", tag: "口语", text: "雅思哥口语练习", done: false }
        ],
        passageParagraphs: passage ? passage.split(/\n+/).filter(Boolean) : ["（暂未输入正文）"],
        translationParagraphs: trans ? trans.split(/\n+/).filter(Boolean) : [],
        words: []
      };
      state.days.unshift(newDay);
      currentDayId = id;
      saveState();
      renderDaySelect();
      renderDailyTasks();
      renderPassage();
      renderCoreWordList();
      $("newDayLabel").value = "";
      $("newDayPassage").value = "";
      $("newDayTrans").value = "";
      closeAllModals();
      showToast(`已新建：${label}`);
    });

    // Backup & Restore
    $("btnBackup").addEventListener("click", () => openModal("modalBackup"));
    $("btnExportAll").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ielts-sprint-backup-${todayStr()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("备份文件已导出！");
    });

    $("inputRestoreFile").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!Array.isArray(parsed.days)) throw new Error("备份文件格式无效");
          state = parsed;
          currentDayId = state.days[0]?.id || null;
          saveState();
          initRenderAll();
          closeAllModals();
          showToast("备份恢复成功！");
        } catch (err) {
          showToast("恢复失败：" + err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  function initRenderAll() {
    updateCountdown();
    updateBadges();
    renderDaySelect();
    renderDailyTasks();
    renderPassage();
    renderCoreWordList();
    renderVocabBook();
    renderPracticeRecords();
    renderSpeakingList();
    updateTimerDisplay();
  }

  function goTab(name) {
    const btn = document.querySelector(`.nav-tab[data-tab="${name}"]`);
    if (btn) btn.click();
  }

  function selectDay(dayId) {
    if (!state.days.some((d) => d.id === dayId)) return;
    currentDayId = dayId;
    renderDaySelect();
    renderDailyTasks();
    renderPassage();
    renderCoreWordList();
  }

  function applyCloudState(incoming) {
    if (!incoming || typeof incoming !== "object") return false;
    const prevDark = state.dark;
    const days = Array.isArray(incoming.days) && incoming.days.length
      ? structuredClone(incoming.days)
      : structuredClone(window.IELTS_INITIAL_DATA.days);
    (window.IELTS_INITIAL_DATA.days || []).forEach((initDay) => {
      if (!days.some((d) => d.id === initDay.id)) {
        days.unshift(structuredClone(initDay));
      }
    });
    const speakingTopics = Array.isArray(incoming.speakingTopics)
      ? structuredClone(incoming.speakingTopics)
      : structuredClone(window.IELTS_INITIAL_DATA.speakingTopics);
    (window.IELTS_INITIAL_DATA.speakingTopics || []).forEach((initSp) => {
      if (!speakingTopics.some((s) => s.id === initSp.id)) {
        speakingTopics.unshift(structuredClone(initSp));
      }
    });
    state = {
      ...incoming,
      examDate: incoming.examDate || window.IELTS_INITIAL_DATA.examDate,
      days,
      vocabBook: Array.isArray(incoming.vocabBook) ? incoming.vocabBook : [],
      practiceRecords: Array.isArray(incoming.practiceRecords) ? incoming.practiceRecords : [],
      speakingTopics,
      passageHighlights: incoming.passageHighlights || {},
      wordNotes: incoming.wordNotes || {},
      dark: prevDark
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
    if (!state.days.some((d) => d.id === currentDayId)) {
      currentDayId = state.days[0]?.id || null;
    }
    initRenderAll();
    return true;
  }

  // Public API for modules.js (dashboard / writing / global search / cloud sync)
  window.IELTSApp = {
    get state() { return state; },
    save: saveState,
    applyCloudState,
    toast: showToast,
    speak: speakText,
    escapeHtml,
    todayStr,
    addWord: addWordToVocabBook,
    refresh: initRenderAll,
    goTab,
    selectDay,
    openModal,
    closeAllModals,
    getCurrentDayId: () => currentDayId
  };

  // Boot
  initTabs();
  bindEvents();
  // Open the day that matches today's date if present
  const todays = state.days.find((d) => d.date === todayStr());
  if (todays) currentDayId = todays.id;
  initRenderAll();
})();
