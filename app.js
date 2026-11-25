(function () {
  "use strict";

  const STORAGE_KEY = "ielts_sprint_workbench_v1";

  const SF = {
    speaker: `<svg class="sf-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    star: `<svg class="sf-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    starFill: `<svg class="sf-icon-sm" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    copy: `<svg class="sf-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    spark: `<svg class="sf-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"></path></svg>`
  };

  // ==================== STATE ====================
  let state = loadState();
  let currentDayId = state.days[0]?.id || null;
  let currentCoreFilter = "all";
  let currentInspectedWord = null;
  let clozeMode = false;
  let transMode = false;
  let hideVocabCn = false;
  let currentPracticeFilter = "all";
  let currentSpFilter = "all";
  let activeHighlightContainer = null;
  let savedSelectionRange = null;

  // Speaking Timer
  let timerSeconds = 60;
  let timerInitial = 60;
  let timerInterval = null;

  function mergeInitialDays(days) {
    (window.IELTS_INITIAL_DATA.days || []).forEach((initDay) => {
      const existing = days.find((d) => d.id === initDay.id);
      if (!existing) {
        days.unshift(structuredClone(initDay));
        return;
      }
      // Enrich dictionary fields on existing days without touching user task progress or highlights
      if (Array.isArray(initDay.words) && initDay.words.length) {
        const initMap = new Map(initDay.words.map((w) => [String(w.word || "").toLowerCase(), w]));
        if (!Array.isArray(existing.words) || !existing.words.length) {
          existing.words = structuredClone(initDay.words);
        } else {
          existing.words = existing.words.map((w) => {
            const richer = initMap.get(String(w.word || "").toLowerCase());
            return richer ? { ...w, ...structuredClone(richer) } : w;
          });
        }
      }
    });
    return days;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const days = Array.isArray(parsed.days) && parsed.days.length
          ? parsed.days
          : structuredClone(window.IELTS_INITIAL_DATA.days);
        mergeInitialDays(days);
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
          wordStats: parsed.wordStats && typeof parsed.wordStats === "object" ? parsed.wordStats : {},
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
      wordStats: {},
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

  let activeDictAudio = null;
  let activeAudioTimer = null;
  const dictAudioCache = new Map();

  function getYoudaoUkUrl(clean) {
    return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(clean)}&type=1`;
  }

  function isShortSpeakable(clean) {
    if (!clean || clean.length > 48) return false;
    return clean.split(/\s+/).length <= 3 && /^[a-zA-Z0-9\s'-]+$/.test(clean);
  }

  function preloadWordAudio(text) {
    const clean = String(text || "").trim();
    if (!isShortSpeakable(clean)) return;
    const key = clean.toLowerCase();
    if (dictAudioCache.has(key)) return;
    if (dictAudioCache.size > 120) {
      const oldest = dictAudioCache.keys().next().value;
      dictAudioCache.delete(oldest);
    }
    const audio = new Audio(getYoudaoUkUrl(clean));
    audio.preload = "auto";
    try { audio.load(); } catch (e) { /* ignore */ }
    dictAudioCache.set(key, audio);
  }

  function pickBestUkVoice(voices) {
    if (!Array.isArray(voices) || !voices.length) return null;
    const isGb = (v) => v.lang && v.lang.toLowerCase().replace("_", "-").startsWith("en-gb");
    const gbVoices = voices.filter(isGb);
    const badNames = /albert|bad news|bahh|bells|boing|bubbles|cellos|fred|good news|jester|organ|ralph|trinoids|whisper|zarvox|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley/i;
    const cleanGb = gbVoices.filter((v) => !badNames.test(v.name || ""));

    const preferred = [
      /google uk english female/i,
      /\bserena\b/i,
      /\bmartha\b/i,
      /\bkate\b/i,
      /\bstephanie\b/i,
      /\blibby\b/i,
      /\bsonia\b/i,
      /siri.*(british|uk|en-gb)/i,
      /google uk english male/i,
      /\barthur\b/i,
      /\boliver\b/i
    ];
    for (const pat of preferred) {
      const hit = cleanGb.find((v) => pat.test(v.name || ""));
      if (hit) return hit;
    }
    const nonDaniel = cleanGb.find((v) => !/\bdaniel\b/i.test(v.name || ""));
    if (nonDaniel) return nonDaniel;
    if (cleanGb[0]) return cleanGb[0];
    return voices.find((v) => /google us english|samantha|ava|allison/i.test(v.name || ""))
      || voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
  }

  function speakViaWebSpeech(text, rate = 0.98) {
    if (!("speechSynthesis" in window)) {
      showToast("当前浏览器不支持语音朗读");
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-GB";
    utter.rate = rate;
    utter.pitch = 1.02;
    const gbVoice = pickBestUkVoice(window.speechSynthesis.getVoices());
    if (gbVoice) utter.voice = gbVoice;
    window.speechSynthesis.speak(utter);
  }

  function speakText(text, rate = 0.98) {
    const clean = String(text || "").trim();
    if (!clean) return;
    if (activeAudioTimer) {
      clearTimeout(activeAudioTimer);
      activeAudioTimer = null;
    }
    if (activeDictAudio) {
      try { activeDictAudio.pause(); activeDictAudio.currentTime = 0; } catch (e) { /* ignore */ }
      activeDictAudio = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();

    // Use preloaded/cached studio British RP human pronunciation for single words & short phrases
    if (isShortSpeakable(clean)) {
      const key = clean.toLowerCase();
      let audio = dictAudioCache.get(key);
      if (!audio) {
        audio = new Audio(getYoudaoUkUrl(clean));
        audio.preload = "auto";
        dictAudioCache.set(key, audio);
      } else {
        try { audio.currentTime = 0; } catch (e) { /* ignore */ }
      }
      activeDictAudio = audio;
      let settled = false;
      const fallback = () => {
        if (settled) return;
        settled = true;
        if (activeAudioTimer) { clearTimeout(activeAudioTimer); activeAudioTimer = null; }
        if (activeDictAudio === audio) {
          try { audio.pause(); } catch (e) { /* ignore */ }
          activeDictAudio = null;
        }
        speakViaWebSpeech(clean, rate);
      };
      audio.onplaying = () => {
        settled = true;
        if (activeAudioTimer) { clearTimeout(activeAudioTimer); activeAudioTimer = null; }
      };
      audio.onerror = fallback;

      // If network audio isn't buffered yet, cap wait at 700ms so clicking never feels laggy
      if (audio.readyState < 3) {
        activeAudioTimer = setTimeout(fallback, 700);
      }
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(fallback);
      }
      return;
    }

    speakViaWebSpeech(clean, rate);
  }

  if ("speechSynthesis" in window && typeof window.speechSynthesis.getVoices === "function") {
    window.speechSynthesis.getVoices();
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

  // ==================== AUTO-DICTIONARY & CROSS-REFERENCE ENGINE ====================
  const DICT_CACHE_KEY = "bandup_dict_cache_v1";
  let dictCache = null;
  function getDictCache() {
    if (dictCache) return dictCache;
    try {
      dictCache = JSON.parse(localStorage.getItem(DICT_CACHE_KEY) || "{}") || {};
    } catch (e) {
      dictCache = {};
    }
    return dictCache;
  }
  function saveDictCache(key, val) {
    const cache = getDictCache();
    cache[key] = val;
    const keys = Object.keys(cache);
    if (keys.length > 320) {
      keys.slice(0, keys.length - 300).forEach((k) => delete cache[k]);
    }
    try {
      localStorage.setItem(DICT_CACHE_KEY, JSON.stringify(cache));
    } catch (e) { /* ignore quota */ }
  }

  function findCoreWordAcrossDays(rawTerm) {
    const low = String(rawTerm || "").trim().toLowerCase();
    if (!low) return null;
    for (const d of state.days || []) {
      for (const w of d.words || []) {
        if (w.word.toLowerCase() === low) return { ...w, dayId: d.id, dayLabel: d.label };
        if (Array.isArray(w.forms) && w.forms.some((f) => String(f).toLowerCase() === low)) {
          return { ...w, dayId: d.id, dayLabel: d.label };
        }
      }
    }
    return null;
  }

  function fetchWithTimeout(url, ms = 5500) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .finally(() => clearTimeout(timer));
  }

  function mapPosShort(pos) {
    const p = String(pos || "").toLowerCase();
    if (p === "noun") return "n.";
    if (p === "verb") return "v.";
    if (p === "adjective") return "adj.";
    if (p === "adverb") return "adv.";
    if (p === "preposition") return "prep.";
    if (p === "conjunction") return "conj.";
    return p ? p + "." : "";
  }

  function mapGooglePosToShort(rawPos) {
    const p = String(rawPos || "").trim().toLowerCase();
    if (p === "noun" || p === "名词") return "n.";
    if (p === "verb" || p === "动词") return "v.";
    if (p === "adjective" || p === "形容词") return "adj.";
    if (p === "adverb" || p === "副词") return "adv.";
    if (p === "preposition" || p === "介词") return "prep.";
    if (p === "conjunction" || p === "连词") return "conj.";
    if (p === "pronoun" || p === "代词") return "pron.";
    if (p === "interjection" || p === "感叹词") return "interj.";
    return mapPosShort(p);
  }

  function hasChineseChars(str) {
    return /[\u4e00-\u9fff]/.test(String(str || ""));
  }

  async function fetchGoogleZhDict(enc, cleanLower) {
    const gData = await fetchWithTimeout(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&dt=bd&q=${enc}`,
      5000
    );
    if (!Array.isArray(gData)) return null;
    let primaryCn = "";
    if (Array.isArray(gData[0])) {
      primaryCn = gData[0]
        .map((seg) => (Array.isArray(seg) && seg[0] ? String(seg[0]) : ""))
        .join("")
        .trim()
        .replace(/[。.!！]+$/, "");
      if (primaryCn.toLowerCase() === cleanLower) primaryCn = "";
    }
    const senses = [];
    let firstPos = "";
    let firstDictCn = "";
    if (Array.isArray(gData[1])) {
      gData[1].forEach((entry) => {
        if (!Array.isArray(entry)) return;
        const p = mapGooglePosToShort(entry[0]);
        const terms = Array.isArray(entry[1])
          ? entry[1].map((t) => String(t || "").trim()).filter((t) => t && hasChineseChars(t)).slice(0, 5)
          : [];
        if (terms.length) {
          if (!firstPos && p) firstPos = p;
          if (!firstDictCn) firstDictCn = terms.slice(0, 4).join("，");
          senses.push(`${p ? p + " " : ""}${terms.join("，")}`);
        }
      });
    }
    let cn = "";
    if (firstDictCn) {
      cn = primaryCn && hasChineseChars(primaryCn) && !firstDictCn.includes(primaryCn)
        ? `${primaryCn}；${firstDictCn}`
        : firstDictCn;
    } else if (hasChineseChars(primaryCn)) {
      cn = primaryCn;
    }
    if (!cn && !senses.length) return null;
    return { cn, pos: firstPos, senses };
  }

  async function lookupWordOnline(rawTerm) {
    const clean = String(rawTerm || "").trim().replace(/\s+/g, " ");
    if (!clean) return null;
    const key = clean.toLowerCase();

    // 1) Local curated IELTS core word hit (0ms)
    const coreHit = findCoreWordAcrossDays(key);
    if (coreHit) {
      const synList = Array.isArray(coreHit.synonyms)
        ? coreHit.synonyms.map((s) => (typeof s === "string" ? s : s.en)).filter(Boolean)
        : [];
      const synNote = Array.isArray(coreHit.synonyms) && coreHit.synonyms.length
        ? "同义替换：" + coreHit.synonyms.map((s) => (typeof s === "string" ? s : `${s.en}${s.cn ? "(" + s.cn + ")" : ""}`)).join(" / ")
        : "";
      return {
        word: coreHit.word,
        phonetic: coreHit.phonetic || "",
        pos: coreHit.pos || "",
        cn: coreHit.cn || "",
        enDef: coreHit.enDef || "",
        senses: Array.isArray(coreHit.senses) ? coreHit.senses : [],
        synonyms: synList,
        example: coreHit.example || "",
        exampleCn: coreHit.exampleCn || "",
        noteText: [synNote, coreHit.tip || ""].filter(Boolean).join(" · "),
        source: "ielts-core"
      };
    }

    // 2) LocalStorage cache hit (only trust cached results that actually contain Chinese meaning!)
    const cached = getDictCache()[key];
    if (cached && hasChineseChars(cached.cn)) return cached;

    const isSingleWord = /^[a-z][a-z'-]*$/i.test(clean);
    const enc = encodeURIComponent(clean);

    // 3) Parallel Google Bilingual Dict + Free Dictionary API + Datamuse Synonyms
    const [gZh, dictData, dmSyn] = await Promise.all([
      fetchGoogleZhDict(enc, key),
      isSingleWord ? fetchWithTimeout(`https://api.dictionaryapi.dev/api/v2/entries/en/${enc}`, 5500) : Promise.resolve(null),
      isSingleWord ? fetchWithTimeout(`https://api.datamuse.com/words?rel_syn=${enc}&max=6`, 4500) : Promise.resolve(null)
    ]);

    let phonetic = "";
    let pos = (gZh && gZh.pos) || "";
    let enDef = "";
    let example = "";
    const synSet = new Set();

    if (Array.isArray(dictData) && dictData[0]) {
      const entry = dictData[0];
      const phObj = (entry.phonetics || []).find((p) => p.text && (p.audio || "").includes("-uk"))
        || (entry.phonetics || []).find((p) => p.text);
      phonetic = (phObj && phObj.text) || entry.phonetic || "";
      const meanings = Array.isArray(entry.meanings) ? entry.meanings : [];
      if (meanings[0]) {
        if (!pos) pos = mapPosShort(meanings[0].partOfSpeech);
        const defObj = (meanings[0].definitions || [])[0];
        if (defObj) {
          enDef = defObj.definition || "";
          example = defObj.example || "";
        }
      }
      meanings.forEach((m) => {
        (m.synonyms || []).forEach((s) => { if (s && s.toLowerCase() !== key) synSet.add(s); });
        (m.definitions || []).forEach((d) => {
          if (!example && d.example) example = d.example;
          (d.synonyms || []).forEach((s) => { if (s && s.toLowerCase() !== key) synSet.add(s); });
        });
      });
    }

    if (Array.isArray(dmSyn)) {
      dmSyn.forEach((item) => {
        if (item && item.word && item.word.toLowerCase() !== key) synSet.add(item.word);
      });
    }

    let cn = (gZh && gZh.cn) || "";
    const senses = (gZh && Array.isArray(gZh.senses)) ? gZh.senses : [];

    // Secondary Chinese fallback via MyMemory if Google Translate didn't return Chinese
    if (!hasChineseChars(cn)) {
      const transData = await fetchWithTimeout(`https://api.mymemory.translated.net/get?q=${enc}&langpair=en|zh-CN`, 5000);
      if (transData && transData.responseData && transData.responseData.translatedText) {
        const rawCn = String(transData.responseData.translatedText).trim();
        if (rawCn && rawCn.toLowerCase() !== key && hasChineseChars(rawCn) && !/MYMEMORY WARNING/i.test(rawCn)) {
          cn = rawCn.replace(/[。.!！]+$/, "");
        }
      }
    }

    // Fallback Datamuse meaning-like words if direct synonyms are sparse
    if (isSingleWord && synSet.size < 3) {
      const dmMl = await fetchWithTimeout(`https://api.datamuse.com/words?ml=${enc}&max=5`, 3500);
      if (Array.isArray(dmMl)) {
        dmMl.forEach((item) => {
          if (item && item.word && item.word.toLowerCase() !== key && /^[a-z\s-]+$/i.test(item.word)) {
            synSet.add(item.word);
          }
        });
      }
    }

    const synonyms = Array.from(synSet).slice(0, 5);
    if (!cn && !enDef && !synonyms.length) return null;

    const noteParts = [];
    if (synonyms.length) noteParts.push(`同义替换：${synonyms.join(" / ")}`);
    if (example) noteParts.push(`例句：${example}`);

    const result = {
      word: clean,
      phonetic,
      pos,
      cn: cn || "",
      enDef,
      senses,
      synonyms,
      example,
      noteText: noteParts.join(" · "),
      source: "online"
    };
    if (hasChineseChars(result.cn)) {
      saveDictCache(key, result);
    }
    return result;
  }

  function buildWordMatchRegex(rawWord, extraForms = []) {
    const variants = new Set();
    const addForms = (w) => {
      const t = String(w || "").trim().toLowerCase();
      if (!t || t.length < 2) return;
      variants.add(t);
      if (/^[a-z]+$/.test(t)) {
        if (t.endsWith("y") && t.length > 3) {
          variants.add(t.slice(0, -1) + "ies");
          variants.add(t.slice(0, -1) + "ied");
        } else if (t.endsWith("ies") && t.length > 4) {
          variants.add(t.slice(0, -3) + "y");
        }
        variants.add(t + "s");
        variants.add(t + "es");
        variants.add(t + "ed");
        variants.add(t + "ing");
        if (t.endsWith("e") && t.length > 3) {
          variants.add(t + "d");
          variants.add(t.slice(0, -1) + "ing");
        }
        if (t.endsWith("s") && t.length > 4) variants.add(t.slice(0, -1));
        if (t.endsWith("ed") && t.length > 5) {
          variants.add(t.slice(0, -2));
          variants.add(t.slice(0, -1));
        }
        if (t.endsWith("ing") && t.length > 6) {
          variants.add(t.slice(0, -3));
          variants.add(t.slice(0, -3) + "e");
        }
      }
    };
    addForms(rawWord);
    (extraForms || []).forEach(addForms);
    const list = Array.from(variants)
      .sort((a, b) => b.length - a.length)
      .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!list.length) return null;
    return new RegExp(`\\b(${list.join("|")})\\b`, "gi");
  }

  function extractSnippetWithMark(rawText, regex) {
    const clean = String(rawText || "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
    if (!clean || !regex) return "";
    const sentences = clean.split(/(?<=[.!?。！？])\s+/);
    let picked = "";
    for (const sent of sentences) {
      regex.lastIndex = 0;
      if (regex.test(sent)) {
        picked = sent;
        break;
      }
    }
    if (!picked) {
      regex.lastIndex = 0;
      const m = regex.exec(clean);
      if (!m) return "";
      const start = Math.max(0, m.index - 65);
      const end = Math.min(clean.length, m.index + m[0].length + 95);
      picked = (start > 0 ? "…" : "") + clean.slice(start, end) + (end < clean.length ? "…" : "");
    }
    if (picked.length > 210) picked = picked.slice(0, 206) + "…";
    regex.lastIndex = 0;
    return escapeHtml(picked).replace(regex, "<mark>$1</mark>");
  }

  function findWordOccurrences(rawWord, extraForms = []) {
    const regex = buildWordMatchRegex(rawWord, extraForms);
    if (!regex) return { totalSources: 0, days: [], practices: [] };

    const daysHits = [];
    (state.days || []).forEach((d) => {
      const fullText = (d.passageParagraphs || []).join(" ").replace(/\*\*/g, "");
      regex.lastIndex = 0;
      const matches = fullText.match(regex);
      const inWordList = (d.words || []).some((w) => w.word.toLowerCase() === String(rawWord || "").trim().toLowerCase());
      if ((matches && matches.length) || inWordList) {
        daysHits.push({
          kind: "day",
          dayId: d.id,
          label: d.label || d.id,
          shortLabel: (d.label || d.id).split(" · ")[0],
          count: matches ? matches.length : 1,
          snippetHtml: extractSnippetWithMark(fullText, regex)
        });
      }
    });

    const practiceHits = [];
    (state.practiceRecords || []).forEach((r) => {
      const excerpt = String(r.excerpt || "");
      const synRaw = String(r.synonyms || "");
      const notesRaw = String(r.notes || "");
      regex.lastIndex = 0;
      const exMatches = excerpt.match(regex) || [];
      const synLines = synRaw
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => {
          regex.lastIndex = 0;
          return l && regex.test(l);
        });
      regex.lastIndex = 0;
      const noteHit = regex.test(notesRaw);
      if (exMatches.length || synLines.length || noteHit) {
        practiceHits.push({
          kind: "practice",
          recId: r.id,
          type: r.type || "reading",
          typeLabel: r.type === "listening" ? "听力" : "阅读",
          source: r.source || "剑桥真题",
          date: r.date || "",
          count: exMatches.length || synLines.length || 1,
          snippetHtml: exMatches.length ? extractSnippetWithMark(excerpt, regex) : (synLines[0] ? escapeHtml(synLines[0]).replace(regex, "<mark>$1</mark>") : ""),
          synLines
        });
      }
    });

    return {
      totalSources: daysHits.length + practiceHits.length,
      days: daysHits,
      practices: practiceHits
    };
  }

  function getWordEncounterStats(rawWord, extraForms = []) {
    const key = String(rawWord || "").trim().toLowerCase();
    const occ = findWordOccurrences(rawWord, extraForms);
    const stat = (state.wordStats && state.wordStats[key]) || { status: "learning", weakMarks: 0, quizRight: 0, quizWrong: 0, lastReviewed: "" };
    const totalSeen = Math.max(1, occ.days.length + occ.practices.length);
    return {
      ...stat,
      dayCount: occ.days.length,
      practiceCount: occ.practices.length,
      totalSeen,
      occ
    };
  }

  function ensureWordStat(rawWord) {
    if (!state.wordStats || typeof state.wordStats !== "object") state.wordStats = {};
    const key = String(rawWord || "").trim().toLowerCase();
    if (!state.wordStats[key]) {
      state.wordStats[key] = { status: "learning", weakMarks: 0, quizRight: 0, quizWrong: 0, lastReviewed: "" };
    }
    return state.wordStats[key];
  }

  function markWordWeak(wordInput, opts = {}) {
    const isObj = wordInput && typeof wordInput === "object";
    const word = String(isObj ? wordInput.word : wordInput || "").trim();
    if (!word) return;
    const st = ensureWordStat(word);
    const today = todayStr();

    // Clicking "标为不熟" again on the inspector card cleanly undoes the mark (no double-counting!)
    if (!opts.fromQuiz && st.status === "weak") {
      st.status = "learning";
      if (st.weakMarkedDate === today || (!st.weakMarkedDate && st.lastReviewed === today)) {
        st.weakMarks = 0;
      } else {
        st.weakMarks = Math.max(0, (st.weakMarks || 1) - 1);
      }
      delete st.weakMarkedDate;
      // Remove auto-added vocab entry if it was only created by this weak click
      state.vocabBook = state.vocabBook.filter(
        (v) => !(v.word.toLowerCase() === word.toLowerCase() && v.autoFromWeak)
      );
      saveState();
      renderVocabBook();
      renderCoreWordList();
      refreshSavedWordHighlights();
      updateBadges();
      if (currentInspectedWord && currentInspectedWord.word.toLowerCase() === word.toLowerCase()) {
        updateInspectorMasteryUI(currentInspectedWord);
      }
      if (!opts.silent) showToast(`已取消「${word}」的不熟标记`);
      return;
    }

    st.status = "weak";
    // Same-day dedupe: never inflate weakMarks to x2/x3 on repeated clicks in the same day
    if (opts.fromQuiz) {
      st.quizWrong = (st.quizWrong || 0) + 1;
      if (st.weakMarkedDate !== today || !st.weakMarks) {
        st.weakMarks = (st.weakMarks || 0) + 1;
      }
    } else if (st.weakMarkedDate !== today || !st.weakMarks) {
      st.weakMarks = (st.weakMarks || 0) + 1;
    }
    st.weakMarkedDate = today;
    st.lastReviewed = today;

    // Auto-sync into vocabBook as unmastered so it flows into tomorrow's AI review story
    const core = isObj && wordInput.cn ? wordInput : findCoreWordAcrossDays(word);
    const existingVb = state.vocabBook.find((v) => v.word.toLowerCase() === word.toLowerCase());
    if (existingVb) {
      existingVb.mastered = false;
    } else if (core) {
      const synList = Array.isArray(core.synonyms)
        ? core.synonyms.map((s) => (typeof s === "string" ? s : s.en)).filter(Boolean)
        : [];
      const synNote = Array.isArray(core.synonyms) && core.synonyms.length
        ? "同义替换：" + core.synonyms.map((s) => (typeof s === "string" ? s : `${s.en}${s.cn ? "(" + s.cn + ")" : ""}`)).join(" / ")
        : "";
      state.vocabBook.unshift({
        id: "v-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        word: core.word,
        phonetic: core.phonetic || "",
        meaning: `${core.pos ? core.pos + " " : ""}${core.cn}`,
        category: core.category || "听力拼写",
        synonyms: synList,
        enDef: core.enDef || "",
        example: core.example || "",
        note: [synNote, core.tip || ""].filter(Boolean).join(" · "),
        mastered: false,
        autoFromWeak: true,
        createdAt: today
      });
    } else if (isObj) {
      state.vocabBook.unshift({
        id: "v-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        word,
        phonetic: wordInput.phonetic || "",
        meaning: wordInput.meaning || wordInput.cn || "（待补充翻译）",
        category: wordInput.category || "拓展生词",
        synonyms: Array.isArray(wordInput.synonyms) ? wordInput.synonyms : [],
        enDef: wordInput.enDef || "",
        example: wordInput.example || "",
        note: wordInput.note || "",
        mastered: false,
        autoFromWeak: true,
        createdAt: today
      });
    }

    saveState();
    renderVocabBook();
    renderCoreWordList();
    refreshSavedWordHighlights();
    updateBadges();
    if (currentInspectedWord && currentInspectedWord.word.toLowerCase() === word.toLowerCase()) {
      updateInspectorMasteryUI(currentInspectedWord);
    }
    if (!opts.silent) showToast(`已标为不熟（再次点击可撤销）· 将加入明日复现队列`);
  }

  function markWordMastered(wordInput, opts = {}) {
    const isObj = wordInput && typeof wordInput === "object";
    const word = String(isObj ? wordInput.word : wordInput || "").trim();
    if (!word) return;
    const st = ensureWordStat(word);
    const today = todayStr();

    // Clicking "已背熟" again on the inspector card cleanly toggles it off
    if (!opts.fromQuiz && st.status === "mastered") {
      st.status = "learning";
      if (st.weakMarkedDate === today || (!st.weakMarkedDate && st.lastReviewed === today)) {
        st.weakMarks = 0;
        delete st.weakMarkedDate;
      }
      saveState();
      renderVocabBook();
      renderCoreWordList();
      refreshSavedWordHighlights();
      updateBadges();
      if (currentInspectedWord && currentInspectedWord.word.toLowerCase() === word.toLowerCase()) {
        updateInspectorMasteryUI(currentInspectedWord);
      }
      if (!opts.silent) showToast(`已取消「${word}」的已背熟标记`);
      return;
    }

    st.status = "mastered";
    if (opts.fromQuiz) st.quizRight = (st.quizRight || 0) + 1;
    // Clear same-day accidental weak mark when switching back to mastered
    if (st.weakMarkedDate === today || (!st.weakMarkedDate && st.lastReviewed === today)) {
      st.weakMarks = 0;
      delete st.weakMarkedDate;
    }
    st.lastReviewed = today;

    const existingVb = state.vocabBook.find((v) => v.word.toLowerCase() === word.toLowerCase());
    if (existingVb) {
      if (existingVb.autoFromWeak && existingVb.createdAt === today) {
        state.vocabBook = state.vocabBook.filter((v) => v.id !== existingVb.id);
      } else {
        existingVb.mastered = true;
      }
    }

    saveState();
    renderVocabBook();
    renderCoreWordList();
    refreshSavedWordHighlights();
    updateBadges();
    if (currentInspectedWord && currentInspectedWord.word.toLowerCase() === word.toLowerCase()) {
      updateInspectorMasteryUI(currentInspectedWord);
    }
    if (!opts.silent) showToast(`已标为「已背熟」：${word}`);
  }

  function updateInspectorMasteryUI(wObj) {
    if (!wObj) return;
    const info = getWordEncounterStats(wObj.word, wObj.forms || []);
    const encEl = $("inspEncBadge");
    if (encEl) {
      const parts = [];
      parts.push(info.totalSeen > 1 ? `复现第 ${info.totalSeen} 次` : "第 1 次见");
      if (info.status === "weak" && info.weakMarks > 0) parts.push(`不熟 ×${info.weakMarks}`);
      else if (info.status === "mastered") parts.push("已背熟");
      else if (info.weakMarks > 0) parts.push(`曾标不熟 ×${info.weakMarks}`);
      encEl.textContent = parts.join(" · ");
      encEl.className = "encounter-pill" + (info.status === "weak" ? " is-weak" : info.totalSeen > 1 ? " is-repeat" : "");
      encEl.classList.remove("hidden");
    }
    const bar = $("inspMasteryBar");
    if (bar) bar.classList.remove("hidden");
    const weakBtn = $("btnInspWeak");
    const masterBtn = $("btnInspMaster");
    if (weakBtn) {
      weakBtn.classList.toggle("active", info.status === "weak");
      $("inspWeakLabel").textContent = info.status === "weak"
        ? "已标不熟 · 再点取消"
        : (info.weakMarks > 0 ? `不熟 ×${info.weakMarks} · 明日复现` : "标为不熟 · 明日复现");
    }
    if (masterBtn) {
      masterBtn.classList.toggle("active", info.status === "mastered");
      $("inspMasterLabel").textContent = info.status === "mastered" ? "已背熟" : "标为已背熟";
    }
    if ($("btnInspSave")) {
      $("btnInspSave").textContent = isWordInVocabBook(wObj.word) ? "✓ 已在生词本" : "存进生词本";
    }
  }

  async function enrichVocabById(vocabId, silent = false) {
    const item = state.vocabBook.find((v) => v.id === vocabId);
    if (!item) return null;
    const res = await lookupWordOnline(item.word);
    if (!res) {
      if (!silent) showToast(`未能在线查到「${item.word}」，可点击编辑手动补充`);
      return null;
    }
    const needMeaning = !item.meaning || item.meaning === "（待补充翻译）" || item.meaning === "正在自动查词…";
    if (needMeaning && res.cn) {
      item.meaning = `${res.pos ? res.pos + " " : ""}${res.cn}`;
    }
    if (res.phonetic && !item.phonetic) item.phonetic = res.phonetic;
    if (res.enDef && !item.enDef) item.enDef = res.enDef;
    if (res.example && !item.example) item.example = res.example;
    if (Array.isArray(res.synonyms) && res.synonyms.length && (!Array.isArray(item.synonyms) || !item.synonyms.length)) {
      item.synonyms = res.synonyms;
    }
    if (!item.note && res.noteText) {
      item.note = res.noteText;
    } else if (item.note && res.synonyms && res.synonyms.length && !item.note.includes("同义")) {
      item.note = `同义替换：${res.synonyms.join(" / ")} · ${item.note}`;
    }
    saveState();
    renderVocabBook();
    renderCoreWordList();
    if (!silent) showToast(`已自动补全「${item.word}」的释义与同义词`);
    return item;
  }

  // ==================== TABS, SMART SCROLL & THEME ====================
  function smartScrollToEl(el, extraGap = 14) {
    if (!el) return;
    const topbar = document.querySelector(".topbar");
    const navTabs = document.querySelector(".nav-tabs");
    let stickyOffset = extraGap;
    if (topbar) stickyOffset += topbar.getBoundingClientRect().height;
    if (navTabs && window.innerWidth > 980) {
      const navStyle = window.getComputedStyle(navTabs);
      if (navStyle.position === "sticky" || navStyle.position === "fixed") {
        stickyOffset += navTabs.getBoundingClientRect().height;
      }
    }
    const targetTop = Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - stickyOffset));
    window.scrollTo({ top: targetTop, behavior: "smooth" });
  }

  function closeMobileInspectorSheet() {
    const card = $("wordInspector");
    if (card) card.classList.remove("mobile-insp-sheet");
  }

  function initTabs() {
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const wasActive = btn.classList.contains("active");
        document.querySelectorAll(".nav-tab").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        $("tab-" + btn.dataset.tab).classList.add("active");
        hideHlToolbar();
        closeMobileInspectorSheet();
        if (!wasActive) {
          window.scrollTo({ top: 0, behavior: "instant" });
        }
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

  function syncInlineTranslations() {
    const container = $("passageContent");
    if (!container) return;
    container.querySelectorAll(".para-trans-inline").forEach((el) => el.remove());
    if (!transMode) return;
    const day = getCurrentDay();
    const transParas = (day && day.translationParagraphs) || [];
    if (!transParas.length) return;
    const paras = Array.from(container.querySelectorAll("p"));
    paras.forEach((pEl, idx) => {
      const cn = transParas[idx];
      if (!cn) return;
      const div = document.createElement("div");
      div.className = "para-trans-inline";
      div.textContent = cn;
      pEl.insertAdjacentElement("afterend", div);
    });
  }

  function serializeCleanPassageHtml(container) {
    const clone = container.cloneNode(true);
    clone.querySelectorAll(".para-trans-inline").forEach((el) => el.remove());
    clone.querySelectorAll(".user-saved-word").forEach((el) => {
      const parent = el.parentNode;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });
    clone.querySelectorAll(".core-word.active-word").forEach((el) => el.classList.remove("active-word"));
    return clone.innerHTML;
  }

  function renderPassage() {
    const day = getCurrentDay();
    if (!day) return;
    $("passageTitle").textContent = day.title || day.label;
    $("passageContent").innerHTML = buildPassageHtml(day);
    refreshSavedWordHighlights();
    syncInlineTranslations();

    const transEl = $("translationContent");
    const transParas = day.translationParagraphs || [];
    transEl.innerHTML = transParas.length
      ? transParas.map((p) => `<p>${escapeHtml(p)}</p>`).join("")
      : `<p class="muted">本篇暂未录入中文译文。</p>`;
    if ($("translationBox")) {
      $("translationBox").classList.toggle("hidden", !(transMode && !transParas.length));
    }

    // Pre-populate right-hand word inspector with the first core word of the day (zero scroll, zero audio)
    if (Array.isArray(day.words) && day.words.length) {
      const stillInDay = currentInspectedWord && day.words.some((w) => w.word.toLowerCase() === currentInspectedWord.word.toLowerCase());
      if (!stillInDay) {
        const firstSpan = document.querySelector("#passageContent .core-word");
        const firstKey = (firstSpan && firstSpan.dataset.word) || day.words[0].word;
        inspectWord(firstKey);
      } else {
        document.querySelectorAll(`#passageContent .core-word[data-word="${CSS.escape(currentInspectedWord.word)}"]`).forEach((el) => el.classList.add("active-word"));
      }
    }
  }

  function refreshSavedWordHighlights() {
    document.querySelectorAll("#passageContent .core-word").forEach((el) => {
      const w = el.dataset.word || el.textContent;
      el.classList.toggle("saved-word", isWordInVocabBook(w));
    });

    const container = $("passageContent");
    if (!container) return;

    // 1) Unwrap previous transient .user-saved-word spans cleanly
    container.querySelectorAll(".user-saved-word").forEach((span) => {
      const parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
    });
    container.normalize();

    if (clozeMode) return;

    // 2) Collect non-core English words that are unmastered in vocabBook or marked weak
    const day = getCurrentDay();
    const coreSet = new Set(((day && day.words) || []).map((w) => String(w.word || "").toLowerCase()));
    const userWords = new Set();
    (state.vocabBook || []).forEach((v) => {
      if (v.mastered) return;
      const w = String(v.word || "").trim().toLowerCase();
      if (w.length >= 2 && /^[a-z][a-z'-]*$/.test(w) && !coreSet.has(w)) userWords.add(w);
    });
    Object.entries(state.wordStats || {}).forEach(([w, st]) => {
      if (!st || st.status !== "weak") return;
      const k = String(w || "").trim().toLowerCase();
      if (k.length >= 2 && /^[a-z][a-z'-]*$/.test(k) && !coreSet.has(k)) userWords.add(k);
    });
    if (!userWords.size) return;

    const escapedList = Array.from(userWords)
      .sort((a, b) => b.length - a.length)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp(`\\b(${escapedList.join("|")})\\b`, "gi");

    // 3) Decorate matching plain words inside passage paragraphs with an amber dashed underline
    const paras = container.querySelectorAll("p");
    paras.forEach((pEl) => {
      const textNodes = [];
      const walker = document.createTreeWalker(pEl, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          if (node.parentElement && node.parentElement.closest(".core-word, .user-saved-word, .cloze-hint, .para-trans-inline")) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      let n;
      while ((n = walker.nextNode())) textNodes.push(n);

      textNodes.forEach((textNode) => {
        const text = textNode.nodeValue;
        pattern.lastIndex = 0;
        if (!pattern.test(text)) return;
        pattern.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let lastIdx = 0;
        let m;
        while ((m = pattern.exec(text)) !== null) {
          if (m.index > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)));
          const span = document.createElement("span");
          span.className = "user-saved-word";
          span.dataset.userWord = m[0].toLowerCase();
          span.title = "已标注拓展生词 · 点击查看中文释义与发音";
          span.textContent = m[0];
          frag.appendChild(span);
          lastIdx = m.index + m[0].length;
        }
        if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
        textNode.parentNode.replaceChild(frag, textNode);
      });
    });

    if (currentInspectedWord) {
      const activeKey = String(currentInspectedWord.word || "").toLowerCase();
      container.querySelectorAll(`.user-saved-word[data-user-word="${CSS.escape(activeKey)}"]`).forEach((el) => {
        el.classList.add("active-word");
      });
    }
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
        const st = (state.wordStats && state.wordStats[w.word.toLowerCase()]) || null;
        const dot = st && st.status === "weak"
          ? `<span class="cw-status-dot is-weak" title="已标不熟 ×${st.weakMarks || 1}"></span>`
          : st && st.status === "mastered"
            ? `<span class="cw-status-dot is-master" title="已背熟"></span>`
            : "";
        return `
          <div class="core-word-row" data-inspect-word="${escapeHtml(w.word)}">
            <div>
              <strong>${escapeHtml(w.word)}</strong>${dot}
              <span class="cat-badge ${escapeHtml(w.category)}">${escapeHtml(w.category.slice(0, 2))}</span>
              <div class="cw-cn">${escapeHtml(w.pos || "")} ${escapeHtml(w.cn)}</div>
            </div>
            <div style="display:inline-flex;align-items:center;gap:2px;">
              <button class="btn btn-ghost btn-sm" data-quick-speak="${escapeHtml(w.word)}" title="朗读">${SF.speaker}</button>
              <button class="btn btn-ghost btn-sm ${saved ? "is-starred" : ""}" data-quick-star="${escapeHtml(w.word)}" title="${saved ? "已在生词本" : "收录生词本"}">${saved ? SF.starFill : SF.star}</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  let inspLookupSeq = 0;

  function revealWordInspector() {
    const inspCard = $("wordInspector");
    const paneRight = $("paneRight") || document.querySelector(".pane-right");
    if (window.innerWidth <= 980) {
      if (inspCard) {
        inspCard.classList.add("mobile-insp-sheet");
        inspCard.scrollTop = 0;
      }
    } else {
      if (paneRight) paneRight.scrollTop = 0;
      if (inspCard) {
        inspCard.classList.remove("insp-flash");
        void inspCard.offsetWidth;
        inspCard.classList.add("insp-flash");
      }
    }
  }

  function inspectWord(wordKey) {
    const day = getCurrentDay();
    const wObj = findWordObjInDay(day, wordKey);
    if (!wObj) return;
    inspLookupSeq++;
    renderInspectorWordObj(wObj);
  }

  async function inspectAnyWord(rawTerm) {
    const clean = String(rawTerm || "").trim().replace(/\s+/g, " ");
    if (!clean) return;
    const day = getCurrentDay();
    const localHit = findWordObjInDay(day, clean) || findCoreWordAcrossDays(clean);
    if (localHit) {
      inspLookupSeq++;
      renderInspectorWordObj(localHit);
      revealWordInspector();
      return;
    }

    const reqId = ++inspLookupSeq;
    // Show immediate loading card right inside #wordInspector (zero popup, zero redirect)
    renderInspectorWordObj({
      word: clean,
      phonetic: "",
      pos: "",
      cn: "正在联网查询中文释义、音标与同义词…",
      category: "划词查义",
      enDef: "",
      senses: [],
      synonyms: [],
      collocations: [],
      example: "",
      tip: ""
    });
    revealWordInspector();

    const res = await lookupWordOnline(clean);
    if (reqId !== inspLookupSeq) return;
    if (!res) {
      renderInspectorWordObj({
        word: clean,
        phonetic: "",
        pos: "",
        cn: "暂未查到该词释义，可点顶部搜索栏查看剑桥/有道词典。",
        category: "划词查义"
      });
      return;
    }
    renderInspectorWordObj({
      word: res.word || clean,
      phonetic: res.phonetic || "",
      pos: res.pos || "",
      cn: res.cn || res.enDef || "（暂无中文释义）",
      category: "拓展生词",
      enDef: res.enDef || "",
      senses: Array.isArray(res.senses) ? res.senses : [],
      synonyms: Array.isArray(res.synonyms) ? res.synonyms : [],
      collocations: [],
      example: res.example || "",
      exampleCn: res.exampleCn || "",
      tip: ""
    });
    revealWordInspector();
  }

  function renderInspectorWordObj(wObj) {
    if (!wObj) return;
    currentInspectedWord = wObj;
    // Preload studio British RP audio immediately while Kai reads the meaning so clicking "英音" is 0ms instant
    preloadWordAudio(wObj.word);

    // Highlight active word in passage
    document.querySelectorAll("#passageContent .core-word.active-word").forEach((el) => el.classList.remove("active-word"));
    document.querySelectorAll(`#passageContent .core-word[data-word="${CSS.escape(wObj.word)}"]`).forEach((el) => el.classList.add("active-word"));

    $("inspWord").textContent = wObj.word;
    $("inspPhonetic").textContent = wObj.phonetic || "";
    const catEl = $("inspCat");
    catEl.textContent = wObj.category || "核心词";
    catEl.className = `cat-badge ${wObj.category || ""}`;
    catEl.classList.remove("hidden");
    updateInspectorMasteryUI(wObj);

    const posPrefix = wObj.pos && !(wObj.cn || "").startsWith(wObj.pos) ? `${wObj.pos} ` : "";
    $("inspMeaning").textContent = `${posPrefix}${wObj.cn || ""}`;

    // English definition
    const enDefEl = $("inspEnDef");
    if (enDefEl) {
      if (wObj.enDef) {
        enDefEl.textContent = wObj.enDef;
        enDefEl.classList.remove("hidden");
      } else {
        enDefEl.classList.add("hidden");
      }
    }

    // Detailed multi-sense breakdown
    const sensesEl = $("inspSenses");
    if (sensesEl) {
      if (Array.isArray(wObj.senses) && wObj.senses.length) {
        sensesEl.innerHTML = wObj.senses
          .map((s, idx) => `<li><span class="insp-sense-num">${idx + 1}.</span><span>${escapeHtml(s)}</span></li>`)
          .join("");
        sensesEl.classList.remove("hidden");
      } else {
        sensesEl.classList.add("hidden");
      }
    }

    // Standardized IELTS Synonyms & Antonyms
    const synBox = $("inspSynBox");
    const synList = $("inspSynList");
    const antRow = $("inspAntRow");
    if (synBox && synList) {
      const syns = Array.isArray(wObj.synonyms) ? wObj.synonyms : [];
      const ants = Array.isArray(wObj.antonyms) ? wObj.antonyms : [];
      if (syns.length || ants.length) {
        synList.innerHTML = syns
          .map((s) => {
            const en = typeof s === "string" ? s : s.en;
            const cn = typeof s === "string" ? "" : (s.cn || "");
            return `<button type="button" class="insp-syn-chip" data-speak-phrase="${escapeHtml(en)}" title="点击朗读 ${escapeHtml(en)}"><span class="insp-syn-en">${escapeHtml(en)}</span>${cn ? `<span class="insp-syn-cn">${escapeHtml(cn)}</span>` : ""}</button>`;
          })
          .join("");
        if (antRow) {
          if (ants.length) {
            antRow.innerHTML = `<span class="insp-ant-label">反义对照：</span>` + ants
              .map((a) => {
                const en = typeof a === "string" ? a : a.en;
                const cn = typeof a === "string" ? "" : (a.cn || "");
                return `<button type="button" class="insp-ant-chip" data-speak-phrase="${escapeHtml(en)}"><span>${escapeHtml(en)}</span>${cn ? `<span class="insp-syn-cn">${escapeHtml(cn)}</span>` : ""}</button>`;
              })
              .join("");
            antRow.classList.remove("hidden");
          } else {
            antRow.classList.add("hidden");
          }
        }
        synBox.classList.remove("hidden");
      } else {
        synBox.classList.add("hidden");
      }
    }

    // Standard Collocations
    const colBox = $("inspCollocBox");
    const colList = $("inspCollocList");
    if (colBox && colList) {
      const cols = Array.isArray(wObj.collocations) ? wObj.collocations : [];
      if (cols.length) {
        colList.innerHTML = cols.map((c) => `<span class="insp-colloc-pill">${escapeHtml(c)}</span>`).join("");
        colBox.classList.remove("hidden");
      } else {
        colBox.classList.add("hidden");
      }
    }

    // Example Sentence
    const exBox = $("inspExampleBox");
    if (exBox) {
      if (wObj.example) {
        $("inspExampleEn").textContent = wObj.example;
        $("inspExampleCn").textContent = wObj.exampleCn || "";
        exBox.classList.remove("hidden");
      } else {
        exBox.classList.add("hidden");
      }
    }

    if (wObj.tip) {
      $("inspTip").textContent = wObj.tip;
      $("inspTip").classList.remove("hidden");
    } else {
      $("inspTip").classList.add("hidden");
    }

    // Cross-reference occurrences across all Days & saved Cambridge Listening/Reading records
    const occBox = $("inspOccBox");
    const occList = $("inspOccList");
    const occCount = $("inspOccCount");
    if (occBox && occList) {
      const occ = findWordOccurrences(wObj.word, wObj.forms || []);
      const rows = [];
      occ.practices.forEach((p) => {
        rows.push(`
          <div class="occ-item">
            <div class="occ-item-head">
              <button type="button" class="occ-badge is-practice" data-occ-practice="${escapeHtml(p.recId)}">${escapeHtml(p.source)} · ${escapeHtml(p.typeLabel)}</button>
              <span class="occ-meta">出现 ${p.count} 次</span>
            </div>
            ${p.snippetHtml ? `<div class="occ-snippet">${p.snippetHtml}</div>` : ""}
          </div>
        `);
      });
      occ.days.forEach((d) => {
        rows.push(`
          <div class="occ-item">
            <div class="occ-item-head">
              <button type="button" class="occ-badge is-day" data-occ-day="${escapeHtml(d.dayId)}">${escapeHtml(d.label)}</button>
              <span class="occ-meta">串文 · ${d.count} 次</span>
            </div>
          </div>
        `);
      });
      if (!occ.practices.length) {
        rows.push(`<div class="occ-empty-hint">在顶部「真题雷达」或「精听精读」存入剑桥原文后，这里会自动关联剑雅具体书目、题号与原句。</div>`);
      }
      if (occCount) occCount.textContent = occ.practices.length ? `串文 ${occ.days.length} · 真题 ${occ.practices.length}` : `串文 ${occ.days.length} 处`;
      occList.innerHTML = rows.join("");
      occBox.classList.remove("hidden");
    }

    $("btnInspSpeak").disabled = false;
    $("btnInspSave").disabled = false;
    const saved = isWordInVocabBook(wObj.word);
    $("btnInspSave").textContent = saved ? "✓ 已在生词本" : "存进生词本";

    $("inspNoteWrap").classList.remove("hidden");
    $("inspNoteInput").value = state.wordNotes[wObj.word.toLowerCase()] || "";
  }

  function addWordToVocabBook(entry) {
    const clean = entry.word.trim();
    if (!clean) return false;
    const rawMeaning = (entry.meaning || "").trim();
    const autoEnrichNeeded = entry.autoEnrich !== false && (!rawMeaning || rawMeaning === "（待补充翻译）");
    const existing = state.vocabBook.find((v) => v.word.toLowerCase() === clean.toLowerCase());
    if (existing) {
      if (rawMeaning && (!existing.meaning || existing.meaning === "（待补充翻译）" || existing.meaning === "正在自动查词…")) {
        existing.meaning = rawMeaning;
      }
      if (entry.phonetic && !existing.phonetic) existing.phonetic = entry.phonetic;
      if (Array.isArray(entry.synonyms) && entry.synonyms.length) existing.synonyms = entry.synonyms;
      if (entry.enDef && !existing.enDef) existing.enDef = entry.enDef;
      if (entry.example && !existing.example) existing.example = entry.example;
      if (entry.note) existing.note = entry.note;
      existing.mastered = false;
      saveState();
      renderVocabBook();
      renderCoreWordList();
      refreshSavedWordHighlights();
      updateBadges();
      showToast(`已更新生词本中的「${clean}」`);
      if (autoEnrichNeeded || !existing.meaning || existing.meaning === "（待补充翻译）") {
        enrichVocabById(existing.id, true);
      }
      return existing.id;
    }
    const newId = "v-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    state.vocabBook.unshift({
      id: newId,
      word: clean,
      phonetic: (entry.phonetic || "").trim(),
      meaning: rawMeaning || (autoEnrichNeeded ? "正在自动查词…" : "（待补充翻译）"),
      category: entry.category || "雅思哥生词",
      synonyms: Array.isArray(entry.synonyms) ? entry.synonyms : [],
      enDef: (entry.enDef || "").trim(),
      example: (entry.example || "").trim(),
      note: (entry.note || "").trim(),
      mastered: false,
      createdAt: todayStr()
    });
    saveState();
    renderVocabBook();
    renderCoreWordList();
    refreshSavedWordHighlights();
    updateBadges();
    showToast(autoEnrichNeeded ? `已收录「${clean}」，正在自动补全释义与同义词…` : `已收录「${clean}」到我的生词本`);
    if (autoEnrichNeeded) {
      enrichVocabById(newId, false);
    }
    return newId;
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
    const tw = toolbar.offsetWidth || 240;
    const left = Math.max(12, Math.min(window.innerWidth - tw - 12, rect.left + rect.width / 2 - tw / 2 + window.scrollX));
    const top = Math.max(8, rect.top + window.scrollY - 46);
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
          if (node.parentElement && node.parentElement.closest(".para-trans-inline")) return NodeFilter.FILTER_REJECT;
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

    // Persist highlights (strip transient inline translations before saving)
    if (activeHighlightContainer.id === "passageContent") {
      const day = getCurrentDay();
      if (day) {
        state.passageHighlights[day.id] = serializeCleanPassageHtml(activeHighlightContainer);
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
      .map((v) => {
        const occ = findWordOccurrences(v.word);
        const occBadges = [
          ...occ.practices.map((p) => `<span class="occ-badge is-practice" data-occ-practice="${escapeHtml(p.recId)}">${escapeHtml(p.source)} · ${escapeHtml(p.typeLabel)}</span>`),
          ...occ.days.map((d) => `<span class="occ-badge is-day" data-occ-day="${escapeHtml(d.dayId)}">${escapeHtml(d.shortLabel)}</span>`)
        ].join("");
        const occSnippets = [
          ...occ.practices.filter((p) => p.snippetHtml).map((p) => `<div class="occ-snippet"><b>${escapeHtml(p.source)}：</b>${p.snippetHtml}</div>`),
          ...occ.days.filter((d) => d.snippetHtml).slice(0, 1).map((d) => `<div class="occ-snippet"><b>${escapeHtml(d.shortLabel)}：</b>${d.snippetHtml}</div>`)
        ].join("");
        const synChips = Array.isArray(v.synonyms) && v.synonyms.length
          ? `<div class="vb-syn-row">${v.synonyms.map((s) => `<button type="button" class="vb-syn-pill" data-vb-speak="${escapeHtml(s)}" title="点击朗读">${escapeHtml(s)}</button>`).join("")}</div>`
          : "";
        const needsEnrich = !v.phonetic || !Array.isArray(v.synonyms) || !v.synonyms.length || v.meaning === "（待补充翻译）";
        return `
        <div class="vocab-card ${v.mastered ? "mastered" : ""}" data-vid="${escapeHtml(v.id)}">
          <div class="vocab-card-top">
            <div>
              <span class="vocab-word-title">${escapeHtml(v.word)}</span>
              ${v.phonetic ? `<span class="vb-phonetic">${escapeHtml(v.phonetic)}</span>` : ""}
              <span class="cat-badge ${escapeHtml(v.category)}">${escapeHtml(v.category)}</span>
            </div>
            <button class="btn btn-ghost btn-sm" data-vb-speak="${escapeHtml(v.word)}" title="英音朗读">${SF.speaker}</button>
          </div>
          <div class="${hideVocabCn ? "vocab-meaning-blur" : ""}" onclick="this.classList.toggle('revealed')">
            ${escapeHtml(v.meaning)}
          </div>
          ${synChips}
          ${v.note ? `<div class="vocab-note-text">${escapeHtml(v.note)}</div>` : ""}
          ${occBadges ? `<div class="vb-occ-bar">${occBadges}</div>` : ""}
          ${occSnippets ? `<details class="vb-occ-details"><summary>查看原句出处 (${occ.practices.length + occ.days.length})</summary>${occSnippets}</details>` : ""}
          <div class="vocab-card-actions">
            <span class="muted">${escapeHtml(v.createdAt || "")}</span>
            <div>
              ${needsEnrich ? `<button class="btn btn-ghost btn-sm" data-vb-enrich="${escapeHtml(v.id)}">自动补全</button>` : ""}
              <button class="btn btn-outline btn-sm" data-vb-toggle="${escapeHtml(v.id)}">${v.mastered ? "标为未掌握" : "✓ 已掌握"}</button>
              <button class="btn btn-ghost btn-sm" data-vb-edit="${escapeHtml(v.id)}">编辑</button>
              <button class="btn btn-danger-ghost btn-sm" data-vb-del="${escapeHtml(v.id)}">删</button>
            </div>
          </div>
        </div>
      `;
      })
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
      body.innerHTML = `<p>✓ 本轮 ${quizQueue.length} 词抽测完成</p>`;
      return;
    }
    const item = quizQueue[quizIndex];
    body.innerHTML = `
      <div class="muted">进度：${quizIndex + 1} / ${quizQueue.length} · 分类：${escapeHtml(item.category)}</div>
      <div class="quiz-prompt">中文释义：${escapeHtml(item.meaning)} ${item.note ? `<span class="muted">(${escapeHtml(item.note)})</span>` : ""}</div>
      <div class="quiz-row">
        <button class="btn btn-outline btn-sm" id="btnQuizSpeak">${SF.speaker} <span>听发音</span></button>
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
        $("quizFeedback").innerHTML = `<span style="color:var(--success)">✓ 正确 · ${escapeHtml(item.word)}</span>`;
        setTimeout(() => {
          quizIndex++;
          renderQuizStep();
        }, 700);
      } else {
        $("quizFeedback").innerHTML = `<span style="color:var(--danger)">拼写有误，再听一遍或查看答案</span>`;
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
        const typeLabel = r.type === "listening" ? "听力精听" : "阅读精读";
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
                ${r.excerpt ? `<button class="btn btn-outline btn-sm" data-pr-analyze="${escapeHtml(r.id)}">${SF.spark} <span>词频雷达</span></button>` : ""}
                <button class="btn btn-ghost btn-sm" data-pr-edit="${escapeHtml(r.id)}">编辑</button>
                <button class="btn btn-danger-ghost btn-sm" data-pr-del="${escapeHtml(r.id)}">删</button>
              </div>
            </div>
            ${synLines.length ? `
              <div>
                <span class="field-label">同义替换积累：</span>
                <div class="synonym-chips">
                  ${synLines.map((line) => `<span class="syn-chip">${escapeHtml(line)}</span>`).join("")}
                </div>
              </div>
            ` : ""}
            ${r.notes ? `
              <div style="margin-top:8px;">
                <span class="field-label">错题复盘 / 漏听词：</span>
                <div class="record-notes">${escapeHtml(r.notes)}</div>
              </div>
            ` : ""}
            ${(r.excerptHtml || r.excerpt) ? `
              <div style="margin-top:10px;">
                <span class="field-label">原文精读片段（选中英文可黄 / 红高亮或收录生词）：</span>
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
    $("practiceFormTitle").textContent = "新增精听 / 精读记录";
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
              ${item.mastered ? `<span class="cat-badge 口语活词">✓ 已练熟</span>` : ""}
              <h3 style="margin-top:5px;font-size:15.5px;">${escapeHtml(item.topic)} — ${escapeHtml(item.question)}</h3>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0;">
              <button class="btn btn-outline btn-sm" data-sp-speak="${escapeHtml(item.question)}" title="朗读题目">${SF.speaker}</button>
              <button class="btn btn-outline btn-sm" data-sp-copy="${escapeHtml(item.id)}" title="复制题目和草稿发给AI批改">${SF.copy} <span>发 AI 批改</span></button>
              <button class="btn btn-ghost btn-sm" data-sp-toggle="${escapeHtml(item.id)}">${item.mastered ? "重练" : "✓ 熟了"}</button>
              <button class="btn btn-ghost btn-sm" data-sp-edit="${escapeHtml(item.id)}">编辑</button>
              <button class="btn btn-danger-ghost btn-sm" data-sp-del="${escapeHtml(item.id)}">删</button>
            </div>
          </div>
          ${item.keywords ? `
            <div class="synonym-chips">
              ${item.keywords.split(/[,，]/).map((k) => k.trim()).filter(Boolean).map((k) => `<span class="syn-chip">${escapeHtml(k)}</span>`).join("")}
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
                <button class="btn btn-primary btn-sm" data-sp-inline-save="${escapeHtml(item.id)}">保存草稿</button>
                <button class="btn btn-outline btn-sm" data-sp-inline-ai="${escapeHtml(item.id)}">${SF.copy} <span>保存并复制发 AI 批改</span></button>
              </div>
            </div>
          `}
          ${item.polished ? `
            <div class="sp-answer-block polished">
              <div class="field-label" style="color:var(--success);display:flex;justify-content:space-between;align-items:center;">
                <span>6.0–6.5 地道升级版（跟读背诵）：</span>
                <button class="btn btn-ghost btn-sm" data-sp-speak="${escapeHtml(item.polished)}">${SF.speaker} <span>听升级版</span></button>
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
    $("spFormTitle").textContent = "从雅思哥添加今日口语题";
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
        const inPassage = activeHighlightContainer && activeHighlightContainer.id === "passageContent";
        hideHlToolbar();
        if (text) {
          if (inPassage) {
            inspectAnyWord(text);
          } else if (window.IELTSApp && window.IELTSApp.openSearch) {
            window.IELTSApp.openSearch(text);
          }
        }
        return;
      }
      if (e.target.closest("#hlAddWordBtn")) {
        const text = savedSelectionRange ? savedSelectionRange.toString().trim() : "";
        if (text) {
          const day = getCurrentDay();
          const matched = findWordObjInDay(day, text) || findCoreWordAcrossDays(text);
          if (matched) {
            const synList = Array.isArray(matched.synonyms)
              ? matched.synonyms.map((s) => (typeof s === "string" ? s : s.en)).filter(Boolean)
              : [];
            const synNote = Array.isArray(matched.synonyms) && matched.synonyms.length
              ? "同义替换：" + matched.synonyms.map((s) => (typeof s === "string" ? s : `${s.en}${s.cn ? "(" + s.cn + ")" : ""}`)).join(" / ")
              : "";
            addWordToVocabBook({
              word: matched.word,
              phonetic: matched.phonetic || "",
              meaning: `${matched.pos ? matched.pos + " " : ""}${matched.cn}`,
              category: matched.category || "听力拼写",
              synonyms: synList,
              enDef: matched.enDef || "",
              example: matched.example || "",
              note: [synNote, matched.tip || ""].filter(Boolean).join(" · "),
              autoEnrich: false
            });
          } else {
            const fromPr = activeHighlightContainer && activeHighlightContainer.dataset.prId
              ? state.practiceRecords.find((r) => r.id === activeHighlightContainer.dataset.prId)
              : null;
            addWordToVocabBook({
              word: text,
              meaning: "",
              category: fromPr ? (fromPr.type === "listening" ? "听力拼写" : "阅读同义") : "雅思哥生词",
              note: fromPr ? `来自真题：${fromPr.source}` : (day ? `来自串文：${(day.label || "").split(" · ")[0]}` : ""),
              autoEnrich: true
            });
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

    function syncDayCompletion(day) {
      if (!day || !Array.isArray(day.tasks)) return;
      const allDone = day.tasks.length > 0 && day.tasks.every((t) => t.done);
      if (allDone) {
        if (!day.completedAt) day.completedAt = todayStr();
      } else {
        delete day.completedAt;
      }
    }

    $("dailyTaskList").addEventListener("change", (e) => {
      const tid = e.target.dataset.toggleTask;
      if (!tid) return;
      const day = getCurrentDay();
      const task = day.tasks.find((t) => t.id === tid);
      if (task) {
        task.done = e.target.checked;
        if (task.done) task.doneAt = todayStr();
        else delete task.doneAt;
        syncDayCompletion(day);
        saveState();
        renderDailyTasks();
      }
    });

    $("dailyTaskList").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-del-task]");
      if (!btn) return;
      const day = getCurrentDay();
      day.tasks = day.tasks.filter((t) => t.id !== btn.dataset.delTask);
      syncDayCompletion(day);
      saveState();
      renderDailyTasks();
    });

    const addTask = () => {
      const val = $("newTaskInput").value.trim();
      if (!val) return;
      const day = getCurrentDay();
      day.tasks.push({ id: "t-" + Date.now(), tag: "自添", text: val, done: false });
      $("newTaskInput").value = "";
      syncDayCompletion(day);
      saveState();
      renderDailyTasks();
    };
    $("btnAddTask").addEventListener("click", addTask);
    $("newTaskInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addTask();
    });

    // Passage click to inspect core word OR user-marked plain word directly in right sticky panel
    $("passageContent").addEventListener("click", (e) => {
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) return; // Don't hijack drag selection

      const userSpan = e.target.closest(".user-saved-word");
      if (userSpan) {
        const wKey = userSpan.dataset.userWord || userSpan.textContent;
        document.querySelectorAll("#passageContent .active-word").forEach((el) => el.classList.remove("active-word"));
        userSpan.classList.add("active-word");
        inspectAnyWord(wKey);
        return;
      }

      const span = e.target.closest(".core-word");
      if (!span) return;
      const wKey = span.dataset.word || span.textContent;
      inspectWord(wKey);

      const row = document.querySelector(`#coreWordList .core-word-row[data-inspect-word="${CSS.escape(wKey)}"]`);
      document.querySelectorAll("#coreWordList .core-word-row.active-row").forEach((r) => r.classList.remove("active-row"));
      if (row) row.classList.add("active-row");

      const inspCard = $("wordInspector");
      const paneRight = $("paneRight") || document.querySelector(".pane-right");
      if (window.innerWidth <= 980) {
        if (inspCard) {
          inspCard.classList.add("mobile-insp-sheet");
          inspCard.scrollTop = 0;
        }
      } else {
        if (paneRight) paneRight.scrollTop = 0;
        if (inspCard) {
          inspCard.classList.remove("insp-flash");
          void inspCard.offsetWidth;
          inspCard.classList.add("insp-flash");
        }
      }
    });

    if ($("btnCloseMobileInsp")) {
      $("btnCloseMobileInsp").addEventListener("click", (e) => {
        e.stopPropagation();
        closeMobileInspectorSheet();
      });
    }
    document.addEventListener("click", (e) => {
      const inspCard = $("wordInspector");
      if (!inspCard || !inspCard.classList.contains("mobile-insp-sheet")) return;
      if (e.target.closest("#wordInspector") || e.target.closest("#hlToolbar") || e.target.closest(".core-word") || e.target.closest(".user-saved-word") || e.target.closest("[data-inspect-word]")) return;
      closeMobileInspectorSheet();
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

    // Passage controls: Inline paragraph-by-paragraph bilingual translation & Core Word Drawer shortcut
    $("btnToggleTrans").addEventListener("click", () => {
      transMode = !transMode;
      $("btnToggleTrans").classList.toggle("active-toggle", transMode);
      syncInlineTranslations();
      const day = getCurrentDay();
      const hasParas = day && Array.isArray(day.translationParagraphs) && day.translationParagraphs.length > 0;
      if ($("translationBox")) {
        $("translationBox").classList.toggle("hidden", !(transMode && !hasParas));
      }
      showToast(transMode ? "已开启逐段双语对照译文" : "已收起双语译文");
    });

    if ($("btnJumpCoreList")) {
      $("btnJumpCoreList").addEventListener("click", () => {
        const drawer = $("coreWordDrawer");
        if (!drawer) return;
        drawer.open = true;
        smartScrollToEl(drawer, 14);
      });
    }

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
      if (inputs.length > 0 && correct / inputs.length >= 0.8) {
        autoCheckTaskByTag("词汇", `拼写挖空达标 ${correct}/${inputs.length}`);
      }
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

    if ($("btnInspWeak")) {
      $("btnInspWeak").addEventListener("click", () => {
        if (currentInspectedWord) markWordWeak(currentInspectedWord);
      });
    }
    if ($("btnInspMaster")) {
      $("btnInspMaster").addEventListener("click", () => {
        if (currentInspectedWord) markWordMastered(currentInspectedWord);
      });
    }

    $("btnInspSave").addEventListener("click", () => {
      if (!currentInspectedWord) return;
      const customNote = $("inspNoteInput").value.trim();
      const synList = Array.isArray(currentInspectedWord.synonyms)
        ? currentInspectedWord.synonyms.map((s) => (typeof s === "string" ? s : s.en)).filter(Boolean)
        : [];
      const synSummary = Array.isArray(currentInspectedWord.synonyms) && currentInspectedWord.synonyms.length
        ? "同义替换：" + currentInspectedWord.synonyms.map((s) => (typeof s === "string" ? s : `${s.en}${s.cn ? "(" + s.cn + ")" : ""}`)).join(" / ")
        : "";
      const autoNote = [synSummary, currentInspectedWord.tip || ""].filter(Boolean).join(" · ");
      addWordToVocabBook({
        word: currentInspectedWord.word,
        phonetic: currentInspectedWord.phonetic || "",
        meaning: `${currentInspectedWord.pos ? currentInspectedWord.pos + " " : ""}${currentInspectedWord.cn}`,
        category: currentInspectedWord.category,
        synonyms: synList,
        enDef: currentInspectedWord.enDef || "",
        example: currentInspectedWord.example || "",
        note: customNote || autoNote,
        autoEnrich: false
      });
      $("btnInspSave").textContent = "✓ 已在生词本";
    });

    const occBoxEl = $("inspOccBox");
    if (occBoxEl) {
      occBoxEl.addEventListener("click", (e) => {
        const dayBtn = e.target.closest("[data-occ-day]");
        if (dayBtn) {
          selectDay(dayBtn.dataset.occDay);
          goTab("daily");
          return;
        }
        const prBtn = e.target.closest("[data-occ-practice]");
        if (prBtn) {
          goTab("practice");
          setTimeout(() => {
            const target = document.querySelector(`[data-pr-id="${CSS.escape(prBtn.dataset.occPractice)}"]`);
            if (target) smartScrollToEl(target.closest(".card") || target, 16);
          }, 80);
        }
      });
    }

    const synBoxEl = $("inspSynBox");
    if (synBoxEl) {
      synBoxEl.addEventListener("click", (e) => {
        const chip = e.target.closest("[data-speak-phrase]");
        if (!chip) return;
        const phrase = (chip.dataset.speakPhrase || "").split("/")[0].trim();
        if (phrase) speakText(phrase);
      });
    }

    const exSpeakBtn = $("btnInspExSpeak");
    if (exSpeakBtn) {
      exSpeakBtn.addEventListener("click", () => {
        if (currentInspectedWord && currentInspectedWord.example) {
          speakText(currentInspectedWord.example, 0.92);
        }
      });
    }

    $("btnSaveInspNote").addEventListener("click", () => {
      if (!currentInspectedWord) return;
      state.wordNotes[currentInspectedWord.word.toLowerCase()] = $("inspNoteInput").value.trim();
      saveState();
      showToast("记忆笔记已保存");
    });

    // Quick add word + 1-click Auto-Lookup
    async function fillQuickLookup() {
      const w = $("quickWord").value.trim();
      if (!w) return showToast("请先输入英文单词");
      const btn = $("btnQuickLookup");
      if (btn) { btn.disabled = true; btn.textContent = "查词中…"; }
      const res = await lookupWordOnline(w);
      if (btn) { btn.disabled = false; btn.textContent = "自动查词"; }
      if (!res) return showToast(`未能在线查到「${w}」，可手动填写`);
      $("quickMeaning").value = `${res.pos ? res.pos + " " : ""}${res.cn || ""}`.trim();
      if (!$("quickNote").value.trim() && res.noteText) $("quickNote").value = res.noteText;
      showToast(`已查到「${w}」的释义与同义词`);
    }
    if ($("btnQuickLookup")) $("btnQuickLookup").addEventListener("click", fillQuickLookup);
    $("quickWord").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); $("btnQuickAddWord").click(); }
    });

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
        note: $("quickNote").value.trim(),
        autoEnrich: true
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
      if (row) {
        document.querySelectorAll("#coreWordList .core-word-row.active-row").forEach((r) => r.classList.remove("active-row"));
        row.classList.add("active-row");
        inspectWord(row.dataset.inspectWord);
        const inspCard = $("wordInspector");
        if (window.innerWidth <= 980) {
          if (inspCard) {
            inspCard.classList.add("mobile-insp-sheet");
            inspCard.scrollTop = 0;
          }
        } else {
          const paneRight = $("paneRight") || document.querySelector(".pane-right");
          if (paneRight) paneRight.scrollTop = 0;
          const wb = document.querySelector("#tab-daily .split-workbench");
          if (wb && wb.getBoundingClientRect().top < -120) {
            smartScrollToEl(wb, 14);
          }
          if (inspCard) {
            inspCard.classList.remove("insp-flash");
            void inspCard.offsetWidth;
            inspCard.classList.add("insp-flash");
          }
        }
      }
    });

    // TAB 2: Vocab Book + 1-click Auto-Lookup
    async function fillVbLookup() {
      const word = $("vbWord").value.trim();
      if (!word) return showToast("请先输入英文单词");
      const btn = $("btnVbLookup");
      if (btn) { btn.disabled = true; btn.textContent = "查词中…"; }
      const res = await lookupWordOnline(word);
      if (btn) { btn.disabled = false; btn.textContent = "自动查词"; }
      if (!res) return showToast(`未能在线查到「${word}」，可手动填写`);
      $("vbMeaning").value = `${res.pos ? res.pos + " " : ""}${res.cn || ""}`.trim();
      if (!$("vbNote").value.trim() && res.noteText) $("vbNote").value = res.noteText;
      showToast(`已查到「${word}」的释义与同义词`);
    }
    if ($("btnVbLookup")) $("btnVbLookup").addEventListener("click", fillVbLookup);
    $("vbWord").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); $("btnAddVocab").click(); }
    });

    $("btnAddVocab").addEventListener("click", () => {
      const word = $("vbWord").value.trim();
      if (!word) return showToast("请输入英文单词");
      addWordToVocabBook({
        word,
        meaning: $("vbMeaning").value.trim(),
        category: $("vbCategory").value,
        note: $("vbNote").value.trim(),
        autoEnrich: true
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

      const enr = e.target.closest("[data-vb-enrich]");
      if (enr) {
        enr.disabled = true;
        enr.textContent = "补全中…";
        enrichVocabById(enr.dataset.vbEnrich, false).finally(() => {
          enr.disabled = false;
        });
        return;
      }

      const dayChip = e.target.closest("[data-occ-day]");
      if (dayChip) {
        selectDay(dayChip.dataset.occDay);
        goTab("daily");
        return;
      }

      const prChip = e.target.closest("[data-occ-practice]");
      if (prChip) {
        goTab("practice");
        setTimeout(() => {
          const target = document.querySelector(`[data-pr-id="${CSS.escape(prChip.dataset.occPractice)}"]`);
          if (target) smartScrollToEl(target.closest(".card") || target, 16);
        }, 80);
        return;
      }

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
      const autoTag = payload.type === "listening" ? "听力" : "阅读";
      if (!autoCheckTaskByTag(autoTag, `已保存${autoTag}复盘`)) {
        showToast("精听/精读记录已保存！");
      }
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
        $("practiceFormTitle").textContent = "编辑精听 / 精读记录";
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
          showToast("时间到！");
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
      if (!(payload.draft && autoCheckTaskByTag("口语", "已保存口语作答草稿"))) {
        showToast("口语题已保存！");
      }
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
        const checkedTask = autoCheckTaskByTag("口语", "已保存口语作答草稿");
        if (inAi) {
          const msg = `请按雅思口语 6.0–6.5 标准帮我批改并升级这道题：\n【${item.part} · ${item.topic}】\n题目：${item.question}\n我的回答：${item.draft}`;
          navigator.clipboard.writeText(msg).then(
            () => showToast("草稿已保存并复制，直接粘贴发给 AI 批改！"),
            () => { if (!checkedTask) showToast("草稿已保存！"); }
          );
        } else if (!checkedTask) {
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
        $("spFormTitle").textContent = "编辑口语题与草稿";
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
    mergeInitialDays(days);
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
      wordStats: incoming.wordStats && typeof incoming.wordStats === "object" ? incoming.wordStats : {},
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

  function getActiveSequentialDay() {
    const ordered = [...(state.days || [])].sort((a, b) => {
      const na = parseInt(String(a.id || "").replace(/\D+/g, ""), 10) || 0;
      const nb = parseInt(String(b.id || "").replace(/\D+/g, ""), 10) || 0;
      if (na !== nb) return na - nb;
      return String(a.date || "").localeCompare(String(b.date || ""));
    });
    return ordered.find((d) => !d.tasks || !d.tasks.length || d.tasks.some((t) => !t.done)) || ordered[ordered.length - 1] || getCurrentDay();
  }

  function syncDayCompletionGlobal(day) {
    if (!day || !Array.isArray(day.tasks)) return;
    const allDone = day.tasks.length > 0 && day.tasks.every((t) => t.done);
    if (allDone) {
      if (!day.completedAt) day.completedAt = todayStr();
    } else {
      delete day.completedAt;
    }
  }

  function autoCheckTaskByTag(tag, reason = "") {
    const day = getCurrentDay() || getActiveSequentialDay();
    if (!day || !Array.isArray(day.tasks)) return false;
    const target = day.tasks.find((t) => !t.done && (t.tag === tag || String(t.text || "").includes(tag)));
    if (!target) return false;
    target.done = true;
    target.doneAt = todayStr();
    syncDayCompletionGlobal(day);
    saveState();
    renderDailyTasks();
    showToast(`已自动勾选今日「${tag}」任务${reason ? "（" + reason + "）" : ""}`);
    return true;
  }

  function toggleTaskDone(dayId, taskId) {
    const day = (state.days || []).find((d) => d.id === dayId) || getCurrentDay();
    if (!day || !Array.isArray(day.tasks)) return false;
    const target = day.tasks.find((t) => t.id === taskId);
    if (!target) return false;
    target.done = !target.done;
    if (target.done) target.doneAt = todayStr();
    else delete target.doneAt;
    syncDayCompletionGlobal(day);
    saveState();
    renderDailyTasks();
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
    lookupWordOnline,
    findWordOccurrences,
    enrichVocabById,
    getWordEncounterStats,
    markWordWeak,
    markWordMastered,
    autoCheckTaskByTag,
    toggleTaskDone,
    refresh: initRenderAll,
    goTab,
    scrollToEl: smartScrollToEl,
    selectDay,
    openModal,
    closeAllModals,
    getCurrentDayId: () => currentDayId
  };

  // Boot
  initTabs();
  bindEvents();
  // Always open the first unfinished sequential day so progress is never skipped
  const orderedBootDays = [...state.days].sort((a, b) => {
    const na = parseInt(String(a.id || "").replace(/\D+/g, ""), 10) || 0;
    const nb = parseInt(String(b.id || "").replace(/\D+/g, ""), 10) || 0;
    if (na !== nb) return na - nb;
    return String(a.date || "").localeCompare(String(b.date || ""));
  });
  const firstPending = orderedBootDays.find((d) => !d.tasks || !d.tasks.length || d.tasks.some((t) => !t.done));
  if (firstPending) currentDayId = firstPending.id;
  else if (orderedBootDays.length) currentDayId = orderedBootDays[orderedBootDays.length - 1].id;
  initRenderAll();
})();
