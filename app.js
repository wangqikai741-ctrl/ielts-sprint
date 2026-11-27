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
  let clozeActiveInput = null;
  let clozeLastWrongWords = [];
  let transMode = false;
  let hideVocabCn = false;
  let currentPracticeFilter = "listening";
  let currentPracticeMode = "listening";
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
      showToast("本地存储空间不足，请先导出备份");
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
    t._timer = setTimeout(() => t.classList.add("hidden"), String(msg).length > 28 ? 3600 : 2400);
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
      3800
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

  const inFlightLookups = new Map();

  function peekWordLookup(rawTerm) {
    const key = String(rawTerm || "").trim().replace(/\s+/g, " ").toLowerCase();
    if (!key) return false;
    if (findCoreWordAcrossDays(key)) return true;
    const cached = getDictCache()[key];
    return !!(cached && hasChineseChars(cached.cn));
  }

  function fetchMyMemoryCn(enc, key) {
    return fetchWithTimeout(`https://api.mymemory.translated.net/get?q=${enc}&langpair=en|zh-CN`, 3500).then((transData) => {
      if (transData && transData.responseData && transData.responseData.translatedText) {
        const rawCn = String(transData.responseData.translatedText).trim();
        if (rawCn && rawCn.toLowerCase() !== key && hasChineseChars(rawCn) && !/MYMEMORY WARNING/i.test(rawCn)) {
          return rawCn.replace(/[。.!！]+$/, "");
        }
      }
      return "";
    });
  }

  async function lookupWordOnline(rawTerm, opts = {}) {
    const clean = String(rawTerm || "").trim().replace(/\s+/g, " ");
    if (!clean) return null;
    const key = clean.toLowerCase();
    const onPartial = typeof opts.onPartial === "function" ? opts.onPartial : null;

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

    // 2) LocalStorage cache hit (0ms; only trust cached entries that have Chinese meaning)
    const cached = getDictCache()[key];
    if (cached && hasChineseChars(cached.cn)) return cached;

    // 3) Reuse in-flight request (e.g., started the instant Kai highlighted the word!)
    if (inFlightLookups.has(key)) {
      const entry = inFlightLookups.get(key);
      if (onPartial) {
        if (entry.partial) {
          try { onPartial(entry.partial); } catch (e) { /* ignore */ }
        } else {
          entry.listeners.add(onPartial);
        }
      }
      return entry.promise;
    }

    const isSingleWord = /^[a-z][a-z'-]*$/i.test(clean);
    const enc = encodeURIComponent(clean);
    const flight = { partial: null, listeners: new Set(), promise: null };
    if (onPartial) flight.listeners.add(onPartial);

    const emitPartial = (partialObj) => {
      flight.partial = partialObj;
      flight.listeners.forEach((fn) => {
        try { fn(partialObj); } catch (e) { /* ignore */ }
      });
      flight.listeners.clear();
    };

    const run = async () => {
      // Hedged backup: if Google is slow or unreachable, start MyMemory after 900ms instead of waiting for a full timeout
      let gSettled = false;
      let mmPromise = null;
      const hedgeTimer = setTimeout(() => {
        if (!gSettled) mmPromise = fetchMyMemoryCn(enc, key).then((mmCn) => {
          if (mmCn && !flight.partial) {
            emitPartial({ word: clean, phonetic: "", pos: "", cn: mmCn, enDef: "", senses: [], synonyms: [], example: "", noteText: "", source: "online-partial" });
          }
          return mmCn;
        });
      }, 900);
      // Launch fast Chinese dict + English dict + synonyms in parallel; stream Chinese immediately!
      const gZhPromise = fetchGoogleZhDict(enc, key).then((gZh) => {
        gSettled = true;
        clearTimeout(hedgeTimer);
        if (gZh && hasChineseChars(gZh.cn)) {
          emitPartial({
            word: clean,
            phonetic: "",
            pos: gZh.pos || "",
            cn: gZh.cn,
            enDef: "",
            senses: Array.isArray(gZh.senses) ? gZh.senses : [],
            synonyms: [],
            example: "",
            noteText: "",
            source: "online-partial"
          });
        }
        return gZh;
      });
      const dictPromise = isSingleWord
        ? fetchWithTimeout(`https://api.dictionaryapi.dev/api/v2/entries/en/${enc}`, 3200)
        : Promise.resolve(null);
      const dmPromise = isSingleWord
        ? fetchWithTimeout(`https://api.datamuse.com/words?rel_syn=${enc}&max=6`, 2600)
        : Promise.resolve(null);

      const [gZh, dictData, dmSyn] = await Promise.all([gZhPromise, dictPromise, dmPromise]);

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

      // Secondary Chinese fallback via MyMemory only if Google Translate didn't return Chinese
      if (!hasChineseChars(cn)) {
        cn = (await (mmPromise || fetchMyMemoryCn(enc, key))) || cn;
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
    };

    flight.promise = run().finally(() => {
      inFlightLookups.delete(key);
    });
    inFlightLookups.set(key, flight);
    return flight.promise;
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
    const topbarH = topbar ? topbar.getBoundingClientRect().height : 0;
    let stickyOffset = topbarH + extraGap;
    if (navTabs && window.innerWidth > 980) {
      const navStyle = window.getComputedStyle(navTabs);
      if (navStyle.position === "sticky" || navStyle.position === "fixed") {
        stickyOffset += navTabs.offsetHeight;
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

  // Keep sticky panes rock-steady directly below the real header height (zero scroll-hide jank)
  function syncStickyTop() {
    const topbar = document.querySelector(".topbar");
    const navTabs = document.querySelector(".nav-tabs");
    let h = topbar ? topbar.getBoundingClientRect().height : 0;
    if (navTabs && window.innerWidth > 980) {
      const pos = getComputedStyle(navTabs).position;
      if (pos === "sticky" || pos === "fixed") h += navTabs.offsetHeight;
    }
    document.documentElement.style.setProperty("--sticky-top", `${Math.round(h)}px`);
  }
  document.body.classList.remove("nav-hidden");
  let stickyRaf = 0;
  window.addEventListener("resize", () => {
    if (stickyRaf) return;
    stickyRaf = requestAnimationFrame(() => { stickyRaf = 0; syncStickyTop(); });
  }, { passive: true });
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => syncStickyTop());
    ["topbar", "nav-tabs"].forEach((c) => { const el = document.querySelector("." + c); if (el) ro.observe(el); });
  }
  syncStickyTop();

  // ==================== TAB 1: DAILY PLAN & STORY ====================
  function renderDaySelect() {
    const sel = $("daySelect");
    sel.innerHTML = state.days
      .map((d) => `<option value="${escapeHtml(d.id)}" ${d.id === currentDayId ? "selected" : ""}>${escapeHtml(d.label)}</option>`)
      .join("");
    fitSelectWidth(sel);
  }

  // Size a <select> to its current label so the chevron sits right after the text
  let measureCtx = null;
  function fitSelectWidth(sel) {
    if (!sel || !sel.options.length) return;
    const opt = sel.options[sel.selectedIndex] || sel.options[0];
    const cs = getComputedStyle(sel);
    if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
    measureCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const textW = measureCtx.measureText(opt.textContent || "").width;
    const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.borderLeftWidth) || 0) * 2;
    sel.style.width = `${Math.ceil(textW + pad + 2)}px`;
  }

  function renderDailyTasks() {
    const day = getCurrentDay();
    if (!day) return;
    const list = $("dailyTaskList");
    const completedList = $("dailyCompletedList");
    const completedFold = $("completedTasksFold");
    const completedSummary = $("completedTasksSummary");
    const pillsBox = $("dayCompactPills");
    const tasks = day.tasks || [];
    const doneTasks = tasks.filter((t) => t.done);
    const pendingTasks = tasks.filter((t) => !t.done);
    const doneCount = doneTasks.length;
    const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

    $("dayProgressText").textContent = `${doneCount}/${tasks.length}`;
    $("dayProgressFill").style.width = `${pct}%`;

    // Compact 1-line status pills: completed items softly dim; when all done, collapse into 1 clean pill
    if (pillsBox) {
      if (tasks.length > 0 && pendingTasks.length === 0) {
        pillsBox.innerHTML = `<span class="day-pill-all-done"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>本日 ${doneCount} 项已全部完成</span></span>`;
      } else {
        pillsBox.innerHTML = tasks
          .map((t) => {
            const label = t.tag || String(t.text || "").slice(0, 6);
            return `<button type="button" class="day-task-pill ${t.done ? "is-done" : ""}" data-pill-toggle="${escapeHtml(t.id)}" title="${escapeHtml(t.text)}（点击切换完成状态）">
              <span class="dtp-dot">${t.done ? "✓" : ""}</span>
              <span>${escapeHtml(label)}</span>
            </button>`;
          })
          .join("");
      }
    }

    const renderRow = (t) => `
      <div class="task-item ${t.done ? "done" : ""}" data-tid="${escapeHtml(t.id)}">
        <label class="task-left">
          <input type="checkbox" ${t.done ? "checked" : ""} data-toggle-task="${escapeHtml(t.id)}" />
          <span class="task-text">
            ${t.tag ? `<span class="task-tag">${escapeHtml(t.tag)}</span>` : ""}${escapeHtml(t.text)}
          </span>
        </label>
        <button class="btn btn-ghost btn-sm" data-del-task="${escapeHtml(t.id)}" title="删除任务">✕</button>
      </div>
    `;

    // Active list only displays unfinished items so completing each task cleanly clears the canvas
    if (list) {
      list.innerHTML = pendingTasks.length
        ? pendingTasks.map(renderRow).join("")
        : (tasks.length ? `<div class="tasks-all-clear">太棒了，今日全部待办已完成</div>` : "");
    }
    if (completedFold && completedList && completedSummary) {
      if (doneTasks.length) {
        completedSummary.textContent = `已完成 ${doneTasks.length} 项（点击查看或取消）`;
        completedList.innerHTML = doneTasks.map(renderRow).join("");
        completedFold.classList.remove("hidden");
      } else {
        completedList.innerHTML = "";
        completedFold.open = false;
        completedFold.classList.add("hidden");
      }
    }
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
    clone.querySelectorAll(".active-word").forEach((el) => el.classList.remove("active-word"));
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
      if (inspCard || $("wordInspector")) (inspCard || $("wordInspector")).scrollTop = 0;
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

    const res = await lookupWordOnline(clean, {
      onPartial(partial) {
        if (reqId !== inspLookupSeq || !partial) return;
        renderInspectorWordObj({
          word: partial.word || clean,
          phonetic: partial.phonetic || "",
          pos: partial.pos || "",
          cn: partial.cn || "",
          category: "拓展生词",
          enDef: partial.enDef || "",
          senses: Array.isArray(partial.senses) ? partial.senses : [],
          synonyms: Array.isArray(partial.synonyms) ? partial.synonyms : [],
          collocations: [],
          example: partial.example || "",
          tip: ""
        });
      }
    });
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
  }

  function renderInspectorWordObj(wObj) {
    if (!wObj) return;
    currentInspectedWord = wObj;
    // Preload studio British RP audio immediately while Kai reads the meaning so clicking "英音" is 0ms instant
    preloadWordAudio(wObj.word);

    // Highlight ONLY the currently inspected word in passage (clear both core-word & user-saved-word active states)
    document.querySelectorAll("#passageContent .active-word").forEach((el) => el.classList.remove("active-word"));
    document.querySelectorAll(`#passageContent .core-word[data-word="${CSS.escape(wObj.word)}"]`).forEach((el) => el.classList.add("active-word"));
    document.querySelectorAll(`#passageContent .user-saved-word[data-user-word="${CSS.escape(String(wObj.word || "").toLowerCase())}"]`).forEach((el) => el.classList.add("active-word"));

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

    // Never re-open highlight toolbar when clicking buttons/controls outside the reading text (e.g., right inspector)
    if (!e.target.closest("#passageContent, .record-excerpt")) {
      hideHlToolbar();
      return;
    }

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

    // Speculatively warm up dictionary & British RP audio the moment Kai selects a short English word
    const selWord = sel.toString().trim();
    if (isShortSpeakable(selWord)) {
      preloadWordAudio(selWord);
      lookupWordOnline(selWord);
    }
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
      container.innerHTML = `<div class="empty-state">还没有生词。在串文里点词收藏，或在上方直接添加。</div>`;
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
      showToast("目前没有未掌握的词");
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
  // ==================== 58-DAY CAMBRIDGE 10-19 LISTENING & READING SCHEDULE ====================
  function getActiveDaySeqNumber() {
    const active = getActiveSequentialDay();
    if (!active) return 1;
    const n = parseInt(String(active.id || "").replace(/\D+/g, ""), 10);
    return n > 0 ? n : 1;
  }

  function getCambridgePlanForDay(daySeq, mode) {
    const d = Math.max(1, Math.min(58, Number(daySeq) || 1));
    if (mode === "listening") {
      if (d <= 18) {
        // Stage 1 (Day 1-18): 剑10-12 夯实 Part 1 & 2 为主，每 3 天穿插 1 次 Part 3 & 4
        const stage1 = [
          { src: "剑10 Test 1 Part 1 & Part 2", total: 20, min: 15, note: "阶段一 · 保分基石（冲 17/20）" },
          { src: "剑10 Test 2 Part 1 & Part 2", total: 20, min: 15, note: "阶段一 · 保分基石（冲 17/20）" },
          { src: "剑10 Test 1 Part 3 & Part 4", total: 20, min: 18, note: "阶段一 · 学术段初适应" },
          { src: "剑10 Test 3 Part 1 & Part 2", total: 20, min: 15, note: "阶段一 · 地图/信息填空稳准" },
          { src: "剑10 Test 4 Part 1 & Part 2", total: 20, min: 15, note: "阶段一 · 拼写与单复数零失误" },
          { src: "剑10 Test 2 Part 3 & Part 4", total: 20, min: 18, note: "阶段一 · 学术替换词精听" },
          { src: "剑11 Test 1 Part 1 & Part 2", total: 20, min: 15, note: "阶段一 · 剑11 生活场景" },
          { src: "剑11 Test 2 Part 1 & Part 2", total: 20, min: 15, note: "阶段一 · 干扰项改口识别" },
          { src: "剑11 Test 1 Part 3 & Part 4", total: 20, min: 18, note: "阶段一 · 讨论题态度抓取" },
          { src: "剑11 Test 3 Part 1 & Part 2", total: 20, min: 15, note: "阶段一 · 冲 18/20" },
          { src: "剑11 Test 4 Part 1 & Part 2", total: 20, min: 15, note: "阶段一 · 冲 18/20" },
          { src: "剑11 Test 2 Part 3 & Part 4", total: 20, min: 18, note: "阶段一 · Part 4 笔记填空" },
          { src: "剑12 Test 5 Part 1 & Part 2", total: 20, min: 15, note: "阶段一 · 剑12 实战提速" },
          { src: "剑12 Test 6 Part 1 & Part 2", total: 20, min: 15, note: "阶段一 · 剑12 实战提速" },
          { src: "剑12 Test 5 Part 3 & Part 4", total: 20, min: 18, note: "阶段一 · 学术长难句精听" },
          { src: "剑12 Test 7 Part 1 & Part 2", total: 20, min: 15, note: "阶段一 · 冲 18/20" },
          { src: "剑12 Test 8 Part 1 & Part 2", total: 20, min: 15, note: "阶段一 · 阶段一收官" },
          { src: "剑13 Test 1 全套 Part 1–4", total: 40, min: 30, note: "阶段一验收 · 首次 40 题整套模考" }
        ];
        return stage1[d - 1];
      }
      if (d <= 42) {
        // Stage 2 (Day 19-42): 剑13-16 整套 40 题限时与错题段精听交替
        const idx = d - 19;
        const books = [13, 14, 15, 16];
        const testIdx = Math.floor(idx / 2);
        const book = books[Math.min(3, Math.floor(testIdx / 4))];
        const tNum = (testIdx % 4) + 1;
        if (idx % 2 === 0) {
          return { src: `剑${book} Test ${tNum} 全套 Part 1–4`, total: 40, min: 30, note: "阶段二 · 整套原速限时盲做（冲 23+/40）" };
        }
        return { src: `剑${book} Test ${tNum} Part 3 & Part 4 精听复刷`, total: 20, min: 20, note: "阶段二 · 错题段盲听 + 拆解同义替换" };
      }
      // Stage 3 (Day 43-58): 剑17-19 全真机考 40 题连考
      const idx = d - 43;
      if (idx < 12) {
        const book = 17 + Math.floor(idx / 4);
        const tNum = (idx % 4) + 1;
        return { src: `剑${book} Test ${tNum} 全套 Part 1–4`, total: 40, min: 30, note: "阶段三 · 全真机考模考（稳 23+ 冲 26/40）" };
      }
      return { src: `考前错题复盘套卷 #${idx - 11}（剑17–19 错题回听）`, total: 40, min: 30, note: "阶段三 · 考前保温防失误" };
    }

    // READING SCHEDULE (Day 1-58)
    if (d <= 18) {
      // Stage 1 (Day 1-18): 剑10-12 逐篇限时 20 分钟精研
      const pIdx = d - 1;
      const pNum = (pIdx % 3) + 1;
      const tAbs = Math.floor(pIdx / 3); // 0..5 -> 剑10 T1-T4, 剑11 T1-T2
      const book = tAbs < 4 ? 10 : 11;
      const tNum = tAbs < 4 ? tAbs + 1 : (tAbs - 4) + 1;
      const total = pNum === 3 ? 14 : 13;
      return {
        src: `剑${book} Test ${tNum} Passage ${pNum}`,
        total,
        min: 20,
        note: pNum === 1 ? "阶段一 · Passage 1 冲 10+/13" : pNum === 2 ? "阶段一 · Passage 2 抓同义替换" : "阶段一 · Passage 3 练定位取舍"
      };
    }
    if (d <= 42) {
      // Stage 2 (Day 19-42): 剑13-16 过渡到整套 60 分钟限时
      const idx = d - 19;
      const books = [13, 14, 15, 16];
      const testIdx = Math.floor(idx / 2);
      const book = books[Math.min(3, Math.floor(testIdx / 4))];
      const tNum = (testIdx % 4) + 1;
      if (idx % 2 === 0) {
        return { src: `剑${book} Test ${tNum} Passage 1 & Passage 2`, total: 26, min: 38, note: "阶段二 · 双篇连做控速（保 18+/26）" };
      }
      return { src: `剑${book} Test ${tNum} Passage 3（含全套同义复盘）`, total: 14, min: 22, note: "阶段二 · 难题突破 + 真题雷达扫词" };
    }
    const idx = d - 43;
    if (idx < 12) {
      const book = 17 + Math.floor(idx / 4);
      const tNum = (idx % 4) + 1;
      return { src: `剑${book} Test ${tNum} 全套 Passage 1–3`, total: 40, min: 60, note: "阶段三 · 60 分钟全真机考模考（稳 23+ 冲 27/40）" };
    }
    return { src: `考前高频题型回刷 #${idx - 11}（TFNG / 配对题复盘）`, total: 40, min: 60, note: "阶段三 · 保持手感稳 6.0+" };
  }

  function estimatePracticeBand(records, type) {
    const valid = records.filter((r) => Number(r.total) > 0 && r.correct !== "" && r.correct !== null);
    if (!valid.length) return "--";
    const recent = valid.slice(0, 6);
    const avgRatio = recent.reduce((s, r) => s + Number(r.correct) / Number(r.total), 0) / recent.length;
    const eq40 = Math.round(avgRatio * 40);
    const table = type === "listening"
      ? [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4]]
      : [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4]];
    for (const [minScore, band] of table) {
      if (eq40 >= minScore) return `${band.toFixed(1)}`;
    }
    return "3.5";
  }

  function syncPracticeModeUI() {
    const isListen = currentPracticeMode === "listening";
    currentPracticeFilter = currentPracticeMode;
    if ($("prType")) $("prType").value = currentPracticeMode;

    document.querySelectorAll("#practiceModeSwitch .pr-seg-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.prMode === currentPracticeMode);
    });

    const isEditing = !!($("prEditId") && $("prEditId").value);
    if (!isEditing) {
      if ($("practiceFormTitle")) $("practiceFormTitle").textContent = isListen ? "记录今日听力训练" : "记录今日阅读训练";
      if ($("practiceFormSub")) {
        $("practiceFormSub").textContent = isListen
          ? "严格分两步：先填限时盲做原始对题数（非精听），再精听错题并导入精听原文。"
          : "严格分两步：先填 20 分钟限时首做对题数（非精读），再拆解同义替换并导入精读文章。";
      }
      if ($("btnSavePractice")) $("btnSavePractice").textContent = isListen ? "保存听力记录" : "保存阅读记录";
    }

    if ($("prStage1Title")) $("prStage1Title").textContent = isListen ? "第一步 · 限时盲做原始成绩（精听前第一遍）" : "第一步 · 限时首做原始成绩（精读前第一遍）";
    if ($("prStage1Hint")) {
      $("prStage1Hint").innerHTML = isListen
        ? "先去雅思哥<strong>原速限时盲做第一遍（不要暂停、不要看原文）</strong>，把真实裸做对题数填在这里，用来准确估算听力分数。"
        : "先去雅思哥<strong>限时首做（单篇 20 分钟 / 整套 60 分钟）</strong>，把还没查词精读前的真实首做对题数填在这里，用来准确估算阅读分数。";
    }
    if ($("prSourceLabel")) $("prSourceLabel").textContent = isListen ? "听力真题来源" : "阅读真题来源";
    if ($("prSource")) $("prSource").placeholder = isListen ? "例如：剑10 Test 1 Part 1 & Part 2" : "例如：剑10 Test 1 Passage 1";
    if ($("prCorrectLabel")) $("prCorrectLabel").textContent = isListen ? "首做对题数（非精听）" : "首做对题数（非精读）";
    if ($("prStage2Title")) $("prStage2Title").textContent = isListen ? "第二步 · 错题精听复盘 & 导入精听原文" : "第二步 · 同义替换拆解 & 导入精读文章";
    if ($("prSynLabel")) $("prSynLabel").textContent = isListen ? "同义替换积累（每行一组：题干词 = 录音原文词）" : "同义替换积累（每行一组：题干词 = 文章原文词）";
    if ($("prNotesLabel")) {
      $("prNotesLabel").textContent = isListen
        ? "错题复盘 / 精听卡壳点（漏听词、连读弱读、单复数拼写、干扰项）"
        : "错题复盘 / 精读卡壳点（定位偏了、同义替换没认出、TFNG 逻辑混淆）";
    }
    if ($("prNotes")) {
      $("prNotes").placeholder = isListen
        ? "例：Q7 把 receipt 拼错了；Q14 没听出 however 后的改口答案"
        : "例：Q5 把 Not Given 选成 False；Q11 没认出 mandatory = compulsory";
    }
    if ($("prExcerptLabel")) {
      $("prExcerptLabel").textContent = isListen
        ? "导入精听原文片段（保存后可在右侧划词高亮，并一键「词频雷达」扫生词）"
        : "导入精读文章 / 长难句段落（保存后可在右侧划词高亮，并一键「词频雷达」扫生词）";
    }
    if ($("prExcerpt")) {
      $("prExcerpt").placeholder = isListen
        ? "把本篇精听的对话 / 独白原文粘贴在这里（选填）..."
        : "把本篇精读的英文段落或整篇文章粘贴在这里（选填）...";
    }

    // Update Daily Cambridge Schedule Banner & Next-Day Preview
    const daySeq = getActiveDaySeqNumber();
    const todayPlan = getCambridgePlanForDay(daySeq, currentPracticeMode);
    const nextPlan = daySeq < 58 ? getCambridgePlanForDay(daySeq + 1, currentPracticeMode) : null;
    if ($("prPlanDayTag")) $("prPlanDayTag").textContent = `DAY ${daySeq} · 今日指定${isListen ? "听力" : "阅读"}`;
    if ($("prPlanTodayTitle")) $("prPlanTodayTitle").textContent = todayPlan.src;
    if ($("prPlanTodayMeta")) $("prPlanTodayMeta").textContent = `${todayPlan.total} 题 · 建议限时 ${todayPlan.min} 分钟 · ${todayPlan.note}`;
    if ($("prPlanNextLine")) {
      $("prPlanNextLine").textContent = nextPlan
        ? `明日预告（Day ${daySeq + 1}）：${nextPlan.src}（${nextPlan.total} 题 · ${nextPlan.min} 分钟）`
        : "考前最后一天，保持节奏";
    }
    if ($("prScheduleDrawer")) {
      const rows = [];
      for (let d = daySeq; d <= Math.min(58, daySeq + 6); d++) {
        const p = getCambridgePlanForDay(d, currentPracticeMode);
        rows.push(`
          <div class="pr-sched-row ${d === daySeq ? "is-today" : ""}" data-apply-sched="${escapeHtml(p.src)}" data-apply-total="${p.total}" data-apply-min="${p.min}">
            <span class="pr-sched-day">Day ${d}${d === daySeq ? " · 今日" : ""}</span>
            <strong class="pr-sched-src">${escapeHtml(p.src)}</strong>
            <span class="pr-sched-meta">${p.total} 题 · ${p.min}m · ${escapeHtml(p.note)}</span>
            <button type="button" class="btn btn-ghost btn-sm">填入</button>
          </div>
        `);
      }
      $("prScheduleDrawer").innerHTML = `<div class="pr-sched-head">未来 7 天${isListen ? "听力" : "阅读"}剑雅推进排期（点击任意一天可一键填入左侧）</div>${rows.join("")}`;
    }

    // Auto-prefill empty source & total when not editing
    if (!isEditing && $("prSource") && !$("prSource").value.trim()) {
      $("prSource").value = todayPlan.src;
      if ($("prTotal")) $("prTotal").value = String(todayPlan.total);
    }

    if ($("prStatCountLabel")) $("prStatCountLabel").textContent = isListen ? "累计听力记录" : "累计阅读记录";
    if ($("prStatBandLabel")) $("prStatBandLabel").textContent = isListen ? "估算听力分数" : "估算阅读分数";
  }

  function renderPracticeRecords() {
    const all = state.practiceRecords;
    const listen = all.filter((r) => r.type === "listening");
    const read = all.filter((r) => r.type === "reading");

    if ($("prSegListenCnt")) $("prSegListenCnt").textContent = listen.length;
    if ($("prSegReadCnt")) $("prSegReadCnt").textContent = read.length;
    if ($("statListenCount")) $("statListenCount").textContent = `${listen.length} 篇`;
    if ($("statReadCount")) $("statReadCount").textContent = `${read.length} 篇`;

    const calcAcc = (arr) => {
      const valid = arr.filter((r) => Number(r.total) > 0 && r.correct !== "" && r.correct !== null);
      if (!valid.length) return "--";
      const avg = valid.reduce((s, r) => s + (Number(r.correct) / Number(r.total)) * 100, 0) / valid.length;
      return `${Math.round(avg)}%`;
    };
    if ($("statListenAcc")) $("statListenAcc").textContent = calcAcc(listen);
    if ($("statReadAcc")) $("statReadAcc").textContent = calcAcc(read);

    const activeList = currentPracticeMode === "listening" ? listen : read;
    if ($("prStatCount")) $("prStatCount").textContent = `${activeList.length} 篇`;
    if ($("prStatAcc")) $("prStatAcc").textContent = calcAcc(activeList);
    if ($("prStatBand")) $("prStatBand").textContent = estimatePracticeBand(activeList, currentPracticeMode);

    const isListen = currentPracticeMode === "listening";
    const list = $("practiceRecordsList");
    if (!activeList.length) {
      const daySeq = getActiveDaySeqNumber();
      const plan = getCambridgePlanForDay(daySeq, currentPracticeMode);
      list.innerHTML = `<div class="card empty-state">还没有${isListen ? "听力" : "阅读"}记录。先去雅思哥限时盲做 <b>${escapeHtml(plan.src)}</b>，在左侧第一步记下真实首做对题数，第二步导入${isListen ? "精听原文" : "精读文章"}与错题复盘。</div>`;
      return;
    }

    list.innerHTML = activeList
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
                <span class="muted">${escapeHtml(r.date || "")} ${r.minutes ? `· 限时 ${escapeHtml(r.minutes)} 分钟` : ""}</span>
                <h3 style="margin-top:4px;font-size:16px;">${escapeHtml(r.source)}</h3>
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                ${r.correct !== "" ? `<span class="record-score-badge">首做 ${escapeHtml(r.correct)} / ${escapeHtml(r.total)}${pct !== null ? ` (${pct}%)` : ""}</span>` : ""}
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
                <span class="field-label">${r.type === "listening" ? "错题复盘 / 精听漏听点：" : "错题复盘 / 精读错因："}</span>
                <div class="record-notes">${escapeHtml(r.notes)}</div>
              </div>
            ` : ""}
            ${(r.excerptHtml || r.excerpt) ? `
              <div style="margin-top:10px;">
                <span class="field-label">${r.type === "listening" ? "导入的精听原文（选中英文可黄/红高亮或查词记生词）：" : "导入的精读文章（选中英文可黄/红高亮或查词记生词）："}</span>
                <div class="record-excerpt" data-pr-id="${escapeHtml(r.id)}">${r.excerptHtml || escapeHtml(r.excerpt)}</div>
              </div>
            ` : ""}
          </div>
        `;
      })
      .join("");
  }

  function resetPracticeForm() {
    const plan = getCambridgePlanForDay(getActiveDaySeqNumber(), currentPracticeMode);
    $("prEditId").value = "";
    $("prSource").value = plan ? plan.src : "";
    $("prCorrect").value = "";
    $("prTotal").value = plan ? String(plan.total) : (currentPracticeMode === "listening" ? "20" : "13");
    $("prMinutes").value = "";
    $("prSynonyms").value = "";
    $("prNotes").value = "";
    $("prExcerpt").value = "";
    $("prDate").value = todayStr();
    $("btnCancelPracticeEdit").classList.add("hidden");
    if ($("prLiveScorePreview")) $("prLiveScorePreview").classList.add("hidden");
    syncPracticeModeUI();
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
      list.innerHTML = `<div class="card empty-state">没有匹配的口语题。可在左侧添加今天要练的题目。</div>`;
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
        try { window.getSelection().removeAllRanges(); } catch (err) { /* ignore */ }
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
      fitSelectWidth(e.target);
      clozeMode = false;
      $("clozeBar").classList.add("hidden");
      $("btnToggleCloze").classList.remove("active-toggle");
      syncClozeAssistVisibility();
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

    const taskDrawerEl = $("dailyTaskDrawer");
    const handleTaskToggle = (tid, forceChecked) => {
      const day = getCurrentDay();
      const task = day && day.tasks ? day.tasks.find((t) => t.id === tid) : null;
      if (!task) return;
      task.done = typeof forceChecked === "boolean" ? forceChecked : !task.done;
      if (task.done) task.doneAt = todayStr();
      else {
        delete task.doneAt;
        clearStepsForTask(day, task);
      }
      syncDayCompletion(day);
      saveState();
      renderDailyTasks();
    };

    if ($("dayCompactPills")) {
      $("dayCompactPills").addEventListener("click", (e) => {
        const pill = e.target.closest("[data-pill-toggle]");
        if (!pill) return;
        handleTaskToggle(pill.dataset.pillToggle);
      });
    }

    if ($("btnToggleTaskDrawer") && taskDrawerEl) {
      $("btnToggleTaskDrawer").addEventListener("click", () => {
        const isOpen = !taskDrawerEl.classList.toggle("hidden");
        $("btnToggleTaskDrawer").classList.toggle("is-open", isOpen);
        $("btnToggleTaskDrawer").setAttribute("aria-expanded", String(isOpen));
      });
    }

    if (taskDrawerEl) {
      taskDrawerEl.addEventListener("change", (e) => {
        const tid = e.target.dataset.toggleTask;
        if (tid) handleTaskToggle(tid, e.target.checked);
      });
      taskDrawerEl.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-del-task]");
        if (!btn) return;
        const day = getCurrentDay();
        day.tasks = day.tasks.filter((t) => t.id !== btn.dataset.delTask);
        syncDayCompletion(day);
        saveState();
        renderDailyTasks();
      });
    }

    // Dismissible passage hint bar
    const hintBar = $("passageHintBar");
    if (hintBar) {
      try {
        if (localStorage.getItem("bandup_hide_passage_hint") === "1") {
          hintBar.classList.add("hidden");
        }
      } catch (e) { /* ignore */ }
      const btnDismissHint = $("btnDismissHint");
      if (btnDismissHint) {
        btnDismissHint.addEventListener("click", () => {
          hintBar.classList.add("hidden");
          try { localStorage.setItem("bandup_hide_passage_hint", "1"); } catch (e) { /* ignore */ }
        });
      }
    }

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
      trackCoreWordSeen(wKey);

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
      if (inspCard || $("wordInspector")) (inspCard || $("wordInspector")).scrollTop = 0;
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

    // Cloze Dictation Assistant (spoiler-free right panel)
    function syncClozeAssistVisibility() {
      const caCard = $("clozeAssistCard");
      const inspCard = $("wordInspector");
      const quickAdd = $("quickAddDetails");
      const drawer = $("coreWordDrawer");
      if (caCard) caCard.classList.toggle("hidden", !clozeMode);
      if (inspCard) inspCard.classList.toggle("hidden", clozeMode);
      if (quickAdd) quickAdd.classList.toggle("hidden", clozeMode);
      if (drawer) {
        drawer.classList.toggle("hidden", clozeMode);
        if (clozeMode) drawer.open = false;
      }
      if (!clozeMode) {
        clozeActiveInput = null;
        clozeLastWrongWords = [];
        if ($("caReviewBox")) $("caReviewBox").classList.add("hidden");
      }
    }

    function updateClozeProgressPill() {
      const pill = $("caProgressPill");
      if (!pill) return;
      const inputs = Array.from(document.querySelectorAll("#passageContent .cloze-input"));
      const filled = inputs.filter((i) => i.value.trim().length > 0).length;
      pill.textContent = `已填 ${filled} / ${inputs.length}`;
    }

    function buildSpellingDiffHtml(rawTyped, rawAns) {
      const a = String(rawTyped || "").trim();
      const b = String(rawAns || "").trim();
      const aLow = a.toLowerCase();
      const bLow = b.toLowerCase();
      const m = aLow.length;
      const n = bLow.length;
      const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
      for (let i = m - 1; i >= 0; i--) {
        for (let j = n - 1; j >= 0; j--) {
          dp[i][j] = aLow[i] === bLow[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
      let typedHtml = "";
      let ansHtml = "";
      let i = 0;
      let j = 0;
      let wrongCnt = 0;
      let missCnt = 0;
      while (i < m || j < n) {
        if (i < m && j < n && aLow[i] === bLow[j]) {
          typedHtml += `<span class="cd-ok">${escapeHtml(a[i])}</span>`;
          ansHtml += `<span class="cd-ok">${escapeHtml(b[j])}</span>`;
          i++;
          j++;
        } else if (j < n && (i === m || dp[i][j + 1] >= dp[i + 1][j])) {
          ansHtml += `<span class="cd-add">${escapeHtml(b[j])}</span>`;
          missCnt++;
          j++;
        } else {
          typedHtml += `<span class="cd-del">${escapeHtml(a[i])}</span>`;
          wrongCnt++;
          i++;
        }
      }
      return { typedHtml, ansHtml, wrongCnt, missCnt };
    }

    function renderLiveClozeSlots(inp) {
      if (!inp || !$("caMask")) return;
      const ans = String(inp.dataset.ans || "").trim();
      const val = inp.value.trim();
      const total = ans.length;
      const slots = [];
      for (let k = 0; k < Math.max(total, val.length); k++) {
        if (k < val.length) {
          const over = k >= total ? " is-over" : "";
          slots.push(`<span class="ca-slot is-filled${over}">${escapeHtml(val[k])}</span>`);
        } else if (k === 0 && !val.length && ans[0]) {
          slots.push(`<span class="ca-slot is-hint">${escapeHtml(ans[0])}</span>`);
        } else {
          slots.push(`<span class="ca-slot">_</span>`);
        }
      }
      $("caMask").innerHTML = slots.join("");
      if ($("caLenBadge")) {
        const day = getCurrentDay();
        const wObj = findWordObjInDay(day, ans);
        const cat = wObj && wObj.category ? wObj.category : "听力拼写";
        const diffLen = val.length - total;
        const lenHint = !val.length
          ? `${total} 个字母`
          : diffLen === 0
            ? `已输 ${val.length} / ${total} 字母（长度吻合）`
            : diffLen < 0
              ? `已输 ${val.length} / ${total} 字母（还差 ${-diffLen} 个）`
              : `已输 ${val.length} / ${total} 字母（多出 ${diffLen} 个）`;
        $("caLenBadge").textContent = `${lenHint} · ${cat}`;
      }
    }

    function renderBlankDiffBox(inp) {
      const box = $("caDiffBox");
      if (!box) return;
      if (!inp) {
        box.classList.add("hidden");
        box.innerHTML = "";
        return;
      }
      const ans = String(inp.dataset.ans || "").trim();
      const day = getCurrentDay();
      const wObj = findWordObjInDay(day, ans);
      const userVal = inp.dataset.revealed === "1" ? (inp.dataset.prevTyped || "") : inp.value.trim();

      if (inp.classList.contains("correct") && inp.dataset.revealed !== "1") {
        box.innerHTML = `<div class="ca-diff-ok">✓ 拼写完全正确：<strong>${escapeHtml(ans)}</strong></div>`;
        box.classList.remove("hidden");
        return;
      }

      if (inp.dataset.revealed === "1" || inp.classList.contains("wrong")) {
        const diff = buildSpellingDiffHtml(userVal, ans);
        const summaryParts = [];
        if (userVal) {
          if (diff.wrongCnt) summaryParts.push(`写错/多写 ${diff.wrongCnt} 处`);
          if (diff.missCnt) summaryParts.push(`漏写/少写 ${diff.missCnt} 处`);
        } else {
          summaryParts.push("未填写，已显示标准拼写");
        }
        box.innerHTML = `
          <div class="ca-diff-summary">${escapeHtml(summaryParts.join(" · "))}</div>
          ${userVal ? `<div class="ca-diff-row"><span class="ca-diff-lbl">你填的</span><span class="ca-diff-word">${diff.typedHtml}</span></div>` : ""}
          <div class="ca-diff-row"><span class="ca-diff-lbl">标准词</span><span class="ca-diff-word">${diff.ansHtml}</span></div>
          ${wObj && wObj.tip ? `<div class="ca-diff-tip">${escapeHtml(wObj.tip)}</div>` : ""}
        `;
        box.classList.remove("hidden");
        return;
      }

      box.classList.add("hidden");
      box.innerHTML = "";
    }

    function focusClozeBlank(inp, autoPlay = false) {
      if (!clozeMode) return;
      const inputs = Array.from(document.querySelectorAll("#passageContent .cloze-input"));
      const target = inp || inputs[0] || null;
      clozeActiveInput = target;
      updateClozeProgressPill();
      if (!target) return;

      const idx = inputs.indexOf(target);
      const ans = String(target.dataset.ans || "").trim();
      const day = getCurrentDay();
      const wObj = findWordObjInDay(day, ans);

      preloadWordAudio(ans);
      if (inputs[idx + 1] && inputs[idx + 1].dataset.ans) {
        preloadWordAudio(inputs[idx + 1].dataset.ans);
      }

      if ($("caIdxBadge")) $("caIdxBadge").textContent = `第 ${idx + 1} / ${inputs.length} 空`;
      renderLiveClozeSlots(target);
      renderBlankDiffBox(target);
      if ($("caCn")) {
        $("caCn").textContent = wObj ? `${wObj.pos ? wObj.pos + " " : ""}${wObj.cn}` : "请根据上下文与英音拼写该词";
      }
      if ($("caPhonetic")) {
        if (wObj && wObj.phonetic) {
          $("caPhonetic").textContent = wObj.phonetic;
          $("caPhonetic").classList.remove("hidden");
        } else {
          $("caPhonetic").classList.add("hidden");
        }
      }
      if (autoPlay && $("caAutoSpeak") && $("caAutoSpeak").checked && ans) {
        speakText(ans);
      }
    }

    function renderClozeWrongReview(wrongItems) {
      const box = $("caReviewBox");
      const list = $("caReviewList");
      const title = $("caReviewTitle");
      if (!box || !list) return;
      clozeLastWrongWords = wrongItems.map((x) => x.wObj || x.ans).filter(Boolean);
      if (!wrongItems.length) {
        title.textContent = "全部拼写正确";
        list.innerHTML = `<div class="ca-all-right">本组拼写全部正确。</div>`;
        if ($("btnCaMarkAllWeak")) $("btnCaMarkAllWeak").classList.add("hidden");
        if ($("btnCaRetryWrong")) $("btnCaRetryWrong").classList.add("hidden");
        box.classList.remove("hidden");
        return;
      }
      title.textContent = `本次错词 / 漏填 (${wrongItems.length})`;
      if ($("btnCaMarkAllWeak")) $("btnCaMarkAllWeak").classList.remove("hidden");
      if ($("btnCaRetryWrong")) $("btnCaRetryWrong").classList.remove("hidden");
      list.innerHTML = wrongItems
        .map((it) => {
          const diff = it.userVal ? buildSpellingDiffHtml(it.userVal, it.ans) : null;
          return `
          <div class="ca-wrong-row" data-ca-jump="${it.idx}">
            <div class="ca-wrong-top">
              <div class="ca-wrong-words">
                <span class="ca-wrong-num">#${it.idx + 1}</span>
                ${diff ? `<span class="ca-diff-inline">${diff.typedHtml}</span><span class="ca-wrong-arrow">→</span><span class="ca-diff-inline">${diff.ansHtml}</span>` : `<span class="ca-wrong-empty">${it.revealed ? "看过答案 →" : "未填 →"}</span><strong class="ca-wrong-ans">${escapeHtml(it.ans)}</strong>`}
              </div>
              <button type="button" class="btn btn-ghost btn-sm" data-ca-speak="${escapeHtml(it.ans)}" title="听英音">${SF.speaker}</button>
            </div>
            ${it.wObj && it.wObj.cn ? `<div class="ca-wrong-cn">${escapeHtml((it.wObj.pos ? it.wObj.pos + " " : "") + it.wObj.cn)}</div>` : ""}
            ${it.wObj && it.wObj.tip ? `<div class="ca-wrong-tip">${escapeHtml(it.wObj.tip)}</div>` : ""}
          </div>
        `;
        })
        .join("");
      box.classList.remove("hidden");
    }

    $("passageContent").addEventListener("focusin", (e) => {
      const inp = e.target.closest(".cloze-input");
      if (inp && clozeMode) focusClozeBlank(inp, true);
    });
    $("passageContent").addEventListener("input", (e) => {
      const inp = e.target.closest(".cloze-input");
      if (inp && clozeMode) {
        clozeActiveInput = inp;
        if (inp.dataset.revealed !== "1") {
          inp.classList.remove("correct", "wrong");
        }
        updateClozeProgressPill();
        renderLiveClozeSlots(inp);
        renderBlankDiffBox(inp);
      }
    });

    function revealSingleClozeBlank(inp) {
      const target = inp || clozeActiveInput || document.querySelector("#passageContent .cloze-input");
      if (!target) return;
      const ans = String(target.dataset.ans || "").trim();
      if (!ans) return;
      const typed = target.value.trim();
      const alreadyRight = typed.toLowerCase() === ans.toLowerCase() && target.dataset.revealed !== "1";
      if (alreadyRight) {
        target.classList.remove("wrong", "revealed");
        target.classList.add("correct");
        renderLiveClozeSlots(target);
        renderBlankDiffBox(target);
        speakText(ans);
        target.focus();
        showToast(`拼写正确：${ans}`);
        return;
      }
      // Preserve what the user typed BEFORE filling answer so we can show letter-by-letter diff!
      if (target.dataset.revealed !== "1") {
        target.dataset.prevTyped = typed;
      }
      target.value = ans;
      target.dataset.revealed = "1";
      target.classList.remove("correct", "wrong");
      target.classList.add("revealed");
      updateClozeProgressPill();
      renderLiveClozeSlots(target);
      renderBlankDiffBox(target);
      speakText(ans);
      target.focus();
      showToast(typed ? `已标出「${typed}」与「${ans}」的逐字母差异（本空不计分）` : `已显示本空答案「${ans}」（本空不计分）`);
    }

    function resetSingleClozeBlank(inp) {
      const target = inp || clozeActiveInput || document.querySelector("#passageContent .cloze-input");
      if (!target) return;
      target.value = "";
      delete target.dataset.revealed;
      delete target.dataset.prevTyped;
      target.classList.remove("correct", "wrong", "revealed");
      updateClozeProgressPill();
      renderLiveClozeSlots(target);
      renderBlankDiffBox(target);
      target.focus();
      showToast("已清空当前空，可以独立重默这一词");
    }

    if ($("btnCaSpeak")) {
      $("btnCaSpeak").addEventListener("click", () => {
        const target = clozeActiveInput || document.querySelector("#passageContent .cloze-input");
        if (target && target.dataset.ans) {
          speakText(target.dataset.ans);
          target.focus();
        }
      });
    }
    if ($("btnCaRevealOne")) {
      $("btnCaRevealOne").addEventListener("click", () => revealSingleClozeBlank());
    }
    if ($("btnCaResetOne")) {
      $("btnCaResetOne").addEventListener("click", () => resetSingleClozeBlank());
    }
    if ($("btnCaRetryWrong")) {
      $("btnCaRetryWrong").addEventListener("click", () => {
        const inputs = Array.from(document.querySelectorAll("#passageContent .cloze-input"));
        let cleared = 0;
        let firstCleared = null;
        inputs.forEach((inp) => {
          const isRight = inp.classList.contains("correct") && inp.dataset.revealed !== "1";
          if (!isRight) {
            inp.value = "";
            delete inp.dataset.revealed;
            delete inp.dataset.prevTyped;
            inp.classList.remove("correct", "wrong", "revealed");
            cleared++;
            if (!firstCleared) firstCleared = inp;
          }
        });
        if ($("caReviewBox")) $("caReviewBox").classList.add("hidden");
        updateClozeProgressPill();
        if (firstCleared) {
          focusClozeBlank(firstCleared, false);
          firstCleared.focus();
          showToast(`已清空 ${cleared} 个错词空，已拼对的词已保留`);
        }
      });
    }
    if ($("btnRevealOneCloze")) {
      $("btnRevealOneCloze").addEventListener("click", () => revealSingleClozeBlank());
    }
    if ($("btnResetCloze")) {
      $("btnResetCloze").addEventListener("click", () => {
        if (!clozeMode) return;
        renderPassage();
        if ($("caReviewBox")) $("caReviewBox").classList.add("hidden");
        $("clozeScore").textContent = "已清空，请独立默写后点核对";
        const firstInp = document.querySelector("#passageContent .cloze-input");
        focusClozeBlank(firstInp, false);
        if (firstInp) firstInp.focus();
      });
    }
    if ($("btnCaMarkAllWeak")) {
      $("btnCaMarkAllWeak").addEventListener("click", () => {
        if (!clozeLastWrongWords.length) return;
        clozeLastWrongWords.forEach((w) => markWordWeak(w, { fromQuiz: true, silent: true }));
        showToast(`已将 ${clozeLastWrongWords.length} 个错词标为不熟，加入闪卡与明日复现队列`);
      });
    }
    if ($("caReviewList")) {
      $("caReviewList").addEventListener("click", (e) => {
        const sp = e.target.closest("[data-ca-speak]");
        if (sp) {
          e.stopPropagation();
          speakText(sp.dataset.caSpeak);
          return;
        }
        const row = e.target.closest("[data-ca-jump]");
        if (row) {
          const all = Array.from(document.querySelectorAll("#passageContent .cloze-input"));
          const target = all[Number(row.dataset.caJump)];
          if (target) {
            target.focus();
            target.select();
          }
        }
      });
    }

    // Cloze mode keyboard flow: Enter moves to next input; Alt replays British audio; Enter on last checks answers
    $("passageContent").addEventListener("keydown", (e) => {
      const inp = e.target.closest(".cloze-input");
      if (!inp) return;
      if (e.key === "Alt") {
        e.preventDefault();
        if (inp.dataset.ans) speakText(inp.dataset.ans);
        return;
      }
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
      syncClozeAssistVisibility();
      renderPassage();
      if (clozeMode) {
        if ($("caReviewBox")) $("caReviewBox").classList.add("hidden");
        const firstInp = document.querySelector("#passageContent .cloze-input");
        focusClozeBlank(firstInp, false);
        if (firstInp) setTimeout(() => firstInp.focus(), 60);
      }
    });

    $("clozeScope").addEventListener("change", () => {
      if (clozeMode) {
        renderPassage();
        if ($("caReviewBox")) $("caReviewBox").classList.add("hidden");
        focusClozeBlank(document.querySelector("#passageContent .cloze-input"), false);
      }
    });

    $("btnCheckCloze").addEventListener("click", () => {
      const inputs = Array.from(document.querySelectorAll("#passageContent .cloze-input"));
      const day = getCurrentDay();
      let correct = 0;
      let revealedCount = 0;
      const wrongItems = [];
      inputs.forEach((inp, idx) => {
        const userVal = inp.value.trim();
        const ans = inp.dataset.ans.trim();
        const wasRevealed = inp.dataset.revealed === "1";
        inp.classList.remove("correct", "wrong", "revealed");
        if (wasRevealed) {
          revealedCount++;
          inp.classList.add("revealed");
          wrongItems.push({ idx, userVal: inp.dataset.prevTyped || "", ans, revealed: true, wObj: findWordObjInDay(day, ans) });
        } else if (userVal.toLowerCase() === ans.toLowerCase()) {
          inp.classList.add("correct");
          correct++;
        } else {
          inp.classList.add("wrong");
          wrongItems.push({ idx, userVal, ans, wObj: findWordObjInDay(day, ans) });
        }
      });
      renderClozeWrongReview(wrongItems);
      if (clozeActiveInput) renderBlankDiffBox(clozeActiveInput);
      const pass = inputs.length > 0 && correct / inputs.length >= 0.8;
      const revSuffix = revealedCount > 0 ? `（含看答案 ${revealedCount} 空不计分）` : "";
      $("clozeScore").textContent = `独立拼对：${correct} / ${inputs.length}${revSuffix}${pass ? " · 已达标" : inputs.length ? ` · 需独立拼对 ≥ ${Math.ceil(inputs.length * 0.8)} 个才算通关` : ""}`;
      const active = getActiveSequentialDay();
      if (active && active.id === currentDayId && inputs.length) {
        if (!state.clozeBest || typeof state.clozeBest !== "object") state.clozeBest = {};
        const prev = String(state.clozeBest[active.id] || "0/1").split("/").map(Number);
        if (!prev[1] || correct / inputs.length >= prev[0] / prev[1]) state.clozeBest[active.id] = `${correct}/${inputs.length}`;
        if (pass) setStepDone("2", true, `独立拼写达标 ${correct}/${inputs.length}`);
        else saveState();
      }
    });

    $("btnRevealCloze").addEventListener("click", () => {
      let count = 0;
      document.querySelectorAll("#passageContent .cloze-input").forEach((inp) => {
        if (inp.value.trim().toLowerCase() !== inp.dataset.ans.trim().toLowerCase()) {
          inp.value = inp.dataset.ans;
          inp.dataset.revealed = "1";
          inp.classList.remove("wrong", "correct");
          inp.classList.add("revealed");
          count++;
        }
      });
      updateClozeProgressPill();
      showToast(count ? `已显示剩余 ${count} 空答案（这些空不计入通关分，点「重做」可清零重默）` : "全部已填正确");
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
          const rec = state.practiceRecords.find((r) => r.id === prBtn.dataset.occPractice);
          if (rec && (rec.type === "listening" || rec.type === "reading")) {
            currentPracticeMode = rec.type;
            syncPracticeModeUI();
            renderPracticeRecords();
          }
          goTab("practice");
          setTimeout(() => {
            const target = document.querySelector(`[data-pr-id="${CSS.escape(prBtn.dataset.occPractice)}"]`);
            if (target) smartScrollToEl(target.closest(".record-card") || target, 16);
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
          if (inspCard || $("wordInspector")) (inspCard || $("wordInspector")).scrollTop = 0;
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
        () => showToast(`已复制 ${list.length} 个未掌握生词，可直接粘贴发送`),
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
        const rec = state.practiceRecords.find((r) => r.id === prChip.dataset.occPractice);
        if (rec && (rec.type === "listening" || rec.type === "reading")) {
          currentPracticeMode = rec.type;
          syncPracticeModeUI();
          renderPracticeRecords();
        }
        goTab("practice");
        setTimeout(() => {
          const target = document.querySelector(`[data-pr-id="${CSS.escape(prChip.dataset.occPractice)}"]`);
          if (target) smartScrollToEl(target.closest(".record-card") || target, 16);
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
      showToast(`已导入 ${count} 个生词`);
    });

    // TAB 3: Separated Listening & Reading Workspaces
    $("prDate").value = todayStr();

    function updatePrLiveScorePreview() {
      const el = $("prLiveScorePreview");
      if (!el) return;
      const c = Number($("prCorrect") ? $("prCorrect").value : "");
      const t = Number($("prTotal") ? $("prTotal").value : "");
      if ($("prCorrect") && $("prCorrect").value !== "" && t > 0 && c >= 0 && c <= t) {
        const pct = Math.round((c / t) * 100);
        const est = estimatePracticeBand([{ correct: c, total: t }], currentPracticeMode);
        el.textContent = `首做 ${c}/${t} (${pct}%) · 约 ${est} 分`;
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    }
    if ($("prCorrect")) $("prCorrect").addEventListener("input", updatePrLiveScorePreview);
    if ($("prTotal")) $("prTotal").addEventListener("input", updatePrLiveScorePreview);

    function switchPracticeWorkspace(mode, forcePrefill = false) {
      const m = mode === "reading" ? "reading" : "listening";
      const changed = currentPracticeMode !== m;
      currentPracticeMode = m;
      const isEditing = !!($("prEditId") && $("prEditId").value);
      if ((changed || forcePrefill) && !isEditing) {
        const plan = getCambridgePlanForDay(getActiveDaySeqNumber(), m);
        if ($("prSource")) $("prSource").value = plan.src;
        if ($("prTotal")) $("prTotal").value = String(plan.total);
      }
      syncPracticeModeUI();
      renderPracticeRecords();
    }

    if ($("practiceModeSwitch")) {
      $("practiceModeSwitch").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-pr-mode]");
        if (!btn) return;
        switchPracticeWorkspace(btn.dataset.prMode, true);
      });
    }
    if ($("prType")) {
      $("prType").addEventListener("change", () => {
        const v = $("prType").value;
        if (v === "listening" || v === "reading") {
          switchPracticeWorkspace(v, false);
        }
      });
    }
    if ($("btnApplyTodayPlan")) {
      $("btnApplyTodayPlan").addEventListener("click", () => {
        const plan = getCambridgePlanForDay(getActiveDaySeqNumber(), currentPracticeMode);
        if ($("prSource")) $("prSource").value = plan.src;
        if ($("prTotal")) $("prTotal").value = String(plan.total);
        if ($("prMinutes") && !$("prMinutes").value) $("prMinutes").placeholder = `建议 ${plan.min}`;
        showToast(`已填入今日指定真题：${plan.src}`);
        if ($("prCorrect")) $("prCorrect").focus();
      });
    }
    if ($("btnToggleSchedule") && $("prScheduleDrawer")) {
      $("btnToggleSchedule").addEventListener("click", () => {
        const open = !$("prScheduleDrawer").classList.toggle("hidden");
        $("btnToggleSchedule").textContent = open ? "收起排期 ▴" : "排期预览 ▾";
      });
      $("prScheduleDrawer").addEventListener("click", (e) => {
        const row = e.target.closest("[data-apply-sched]");
        if (!row) return;
        if ($("prSource")) $("prSource").value = row.dataset.applySched;
        if ($("prTotal")) $("prTotal").value = row.dataset.applyTotal || "20";
        $("prScheduleDrawer").classList.add("hidden");
        $("btnToggleSchedule").textContent = "排期预览 ▾";
        showToast(`已填入：${row.dataset.applySched}`);
      });
    }

    $("btnSavePractice").addEventListener("click", () => {
      const source = $("prSource").value.trim();
      if (!source) return showToast("请填写真题来源（如：剑10 Test 1 Part 1 & Part 2）");

      const editId = $("prEditId").value;
      const payload = {
        id: editId || "pr-" + Date.now(),
        type: currentPracticeMode,
        date: $("prDate").value || todayStr(),
        source,
        correct: $("prCorrect").value,
        total: $("prTotal").value || (currentPracticeMode === "listening" ? 20 : 13),
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
      const stepNo = payload.type === "listening" ? "3" : "4";
      if (!markStepDone(stepNo, `已保存${payload.type === "listening" ? "听力" : "阅读"}复盘`)) {
        showToast(`${payload.type === "listening" ? "听力" : "阅读"}记录已保存`);
      }
    });

    $("btnCancelPracticeEdit").addEventListener("click", resetPracticeForm);

    $("practiceRecordsList").addEventListener("click", (e) => {
      const edt = e.target.closest("[data-pr-edit]");
      if (edt) {
        const rec = state.practiceRecords.find((r) => r.id === edt.dataset.prEdit);
        if (!rec) return;
        currentPracticeMode = rec.type === "reading" ? "reading" : "listening";
        $("prEditId").value = rec.id;
        $("practiceFormTitle").textContent = rec.type === "reading" ? "编辑阅读记录" : "编辑听力记录";
        $("prType").value = currentPracticeMode;
        $("prDate").value = rec.date || todayStr();
        $("prSource").value = rec.source || "";
        $("prCorrect").value = rec.correct ?? "";
        $("prTotal").value = rec.total ?? 20;
        $("prMinutes").value = rec.minutes ?? "";
        $("prSynonyms").value = rec.synonyms || "";
        $("prNotes").value = rec.notes || "";
        $("prExcerpt").value = rec.excerpt || "";
        $("btnCancelPracticeEdit").classList.remove("hidden");
        syncPracticeModeUI();
        renderPracticeRecords();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const del = e.target.closest("[data-pr-del]");
      if (del) {
        if (!confirm("确定删除这条记录吗？")) return;
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
          showToast("时间到");
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
      if (!(payload.draft && markStepDone("6", "已保存口语作答草稿"))) {
        showToast("口语题已保存");
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
        const checkedTask = markStepDone("6", "已保存口语作答草稿");
        if (inAi) {
          const msg = `请按雅思口语 6.0–6.5 标准帮我批改并升级这道题：\n【${item.part} · ${item.topic}】\n题目：${item.question}\n我的回答：${item.draft}`;
          navigator.clipboard.writeText(msg).then(
            () => showToast("草稿已保存并复制，可直接粘贴给 AI 批改"),
            () => { if (!checkedTask) showToast("草稿已保存"); }
          );
        } else if (!checkedTask) {
          showToast("口语草稿已保存");
        }
        return;
      }

      const cpy = e.target.closest("[data-sp-copy]");
      if (cpy) {
        const item = state.speakingTopics.find((s) => s.id === cpy.dataset.spCopy);
        if (!item) return;
        const msg = `请按雅思口语 6.0–6.5 标准帮我批改并升级这道题：\n【${item.part} · ${item.topic}】\n题目：${item.question}\n我的回答：${item.draft || "（还没写，请先给我一个 6.5 分参考示范和思路）"}`;
        navigator.clipboard.writeText(msg).then(
          () => showToast("已复制题目与回答，可直接粘贴批改"),
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
      showToast("备份文件已导出");
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
          showToast("备份已恢复");
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
    syncPracticeModeUI();
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

  function findTaskByTag(day, tag, pendingOnly = false) {
    if (!day || !Array.isArray(day.tasks)) return null;
    const pool = pendingOnly ? day.tasks.filter((t) => !t.done) : day.tasks;
    const exact = day.tasks.filter((t) => t.tag === tag);
    if (exact.length) return pool.find((t) => t.tag === tag) || null;
    return pool.find((t) => !t.tag && String(t.text || "").includes(tag)) || null;
  }

  function autoCheckTaskByTag(tag, reason = "") {
    const day = getActiveSequentialDay() || getCurrentDay();
    const target = findTaskByTag(day, tag, true);
    if (!target) return false;
    target.done = true;
    target.doneAt = todayStr();
    syncDayCompletionGlobal(day);
    saveState();
    renderDailyTasks();
    showToast(`已自动勾选今日「${tag}」任务${reason ? "（" + reason + "）" : ""}`);
    return true;
  }

  // ==================== DAILY 8-STEP ROUTE ENGINE（每一步完成都有追踪） ====================
  const STEP_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8"];
  const STEP_TASK_TAG = { "1": "词汇", "2": "词汇", "3": "听力", "4": "阅读", "5": "写作", "6": "口语" };
  const STEP_SHORT = {
    "1": "精读串文", "2": "拼写听写", "3": "听力复盘", "4": "阅读复盘",
    "5": "机考写作", "6": "口语练习", "7": "闪卡回顾", "8": "今日汇报"
  };
  const READ_SEEN_TARGET = 10;

  function getStepLog(dayId, create = false) {
    if (!state.stepLog || typeof state.stepLog !== "object") state.stepLog = {};
    if (!state.stepLog[dayId]) {
      const legacy = state.guideSteps && state.guideSteps[dayId];
      const migrated = {};
      if (legacy && typeof legacy === "object") {
        Object.keys(legacy).forEach((k) => { if (legacy[k] === true) migrated[k] = { at: "", via: "manual" }; });
      }
      if (!create && !Object.keys(migrated).length) return {};
      state.stepLog[dayId] = migrated;
    }
    return state.stepLog[dayId];
  }

  function stepsOfTag(tag) {
    return STEP_ORDER.filter((n) => STEP_TASK_TAG[n] === tag);
  }

  function isStepDone(day, n) {
    if (!day) return false;
    const log = getStepLog(day.id);
    if (log[n]) return true;
    const tag = STEP_TASK_TAG[n];
    if (!tag) return false;
    const task = findTaskByTag(day, tag);
    return !!(task && task.done);
  }

  function getStepStatus(day) {
    day = day || getActiveSequentialDay();
    const log = day ? getStepLog(day.id) : {};
    const steps = STEP_ORDER.map((n) => {
      const entry = log[n];
      const tag = STEP_TASK_TAG[n];
      const task = day && tag ? findTaskByTag(day, tag) : null;
      return {
        num: n,
        done: isStepDone(day, n),
        at: entry && entry.at ? entry.at : "",
        via: entry ? entry.via : (task && task.done ? "task" : ""),
        task
      };
    });
    const next = steps.find((x) => !x.done) || null;
    const seen = day && state.readSeen && Array.isArray(state.readSeen[day.id]) ? state.readSeen[day.id].length : 0;
    const seenTarget = day && Array.isArray(day.words) ? Math.min(READ_SEEN_TARGET, day.words.length || READ_SEEN_TARGET) : READ_SEEN_TARGET;
    const cloze = day && state.clozeBest ? state.clozeBest[day.id] || "" : "";
    return { day, steps, next, doneCount: steps.filter((x) => x.done).length, seen, seenTarget, cloze };
  }

  function setStepDone(n, done, reason = "", opts = {}) {
    n = String(n);
    const day = opts.day || getActiveSequentialDay();
    if (!day || !STEP_ORDER.includes(n)) return false;
    const log = getStepLog(day.id, true);
    const wasDone = isStepDone(day, n);
    const tag = STEP_TASK_TAG[n];
    let taskChecked = false;
    if (done) {
      if (!log[n]) log[n] = { at: new Date().toISOString(), via: reason || "auto" };
      if (tag) {
        const group = stepsOfTag(tag);
        const isLastOfGroup = group[group.length - 1] === n;
        // Finishing the last step of a subject (e.g. step 2 cloze) back-fills earlier steps and ticks the daily task
        if (isLastOfGroup) {
          group.forEach((g) => { if (!log[g]) log[g] = { at: log[n].at, via: "auto-fill" }; });
          const task = findTaskByTag(day, tag, true);
          if (task) {
            task.done = true;
            task.doneAt = todayStr();
            taskChecked = true;
          }
        }
      }
    } else {
      delete log[n];
      if (state.guideSteps && state.guideSteps[day.id]) delete state.guideSteps[day.id][n];
      if (tag) {
        const task = findTaskByTag(day, tag);
        if (task && task.done) {
          task.done = false;
          delete task.doneAt;
        }
      }
    }
    syncDayCompletionGlobal(day);
    saveState();
    renderDailyTasks();
    if (opts.silent) return !wasDone && done;
    if (done && !wasDone) {
      const status = getStepStatus(day);
      const nextTxt = status.next ? `下一步：第 ${status.next.num} 步 ${STEP_SHORT[status.next.num]}` : "今日 8 步全部完成";
      showToast(`第 ${n} 步「${STEP_SHORT[n]}」已完成${taskChecked ? `，已勾选「${tag}」任务` : ""} · ${nextTxt}`);
      document.dispatchEvent(new CustomEvent("bandup:step-done", { detail: { step: n, dayId: day.id } }));
    } else if (!done && wasDone) {
      showToast(`已取消第 ${n} 步完成状态`);
    }
    return done && !wasDone;
  }

  function markStepDone(n, reason = "") {
    return setStepDone(n, true, reason);
  }

  function clearStepsForTask(day, task) {
    if (!day || !task || !task.tag) return;
    const log = getStepLog(day.id);
    stepsOfTag(task.tag).forEach((n) => { delete log[n]; });
  }

  function trackCoreWordSeen(wordKey) {
    const active = getActiveSequentialDay();
    if (!active || active.id !== currentDayId || !wordKey) return;
    if (isStepDone(active, "1")) return;
    if (!state.readSeen || typeof state.readSeen !== "object") state.readSeen = {};
    const arr = Array.isArray(state.readSeen[active.id]) ? state.readSeen[active.id] : [];
    const k = String(wordKey).toLowerCase();
    if (arr.includes(k)) return;
    arr.push(k);
    state.readSeen[active.id] = arr;
    const target = Math.min(READ_SEEN_TARGET, (active.words || []).length || READ_SEEN_TARGET);
    if (arr.length >= target) {
      setStepDone("1", true, `已查看 ${arr.length} 个高频词`);
    } else {
      saveState();
    }
  }

  function toggleTaskDone(dayId, taskId) {
    const day = (state.days || []).find((d) => d.id === dayId) || getCurrentDay();
    if (!day || !Array.isArray(day.tasks)) return false;
    const target = day.tasks.find((t) => t.id === taskId);
    if (!target) return false;
    target.done = !target.done;
    if (target.done) target.doneAt = todayStr();
    else {
      delete target.doneAt;
      clearStepsForTask(day, target);
    }
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
    peekWordLookup,
    findWordOccurrences,
    enrichVocabById,
    getWordEncounterStats,
    markWordWeak,
    markWordMastered,
    autoCheckTaskByTag,
    toggleTaskDone,
    getStepStatus,
    setStepDone,
    markStepDone,
    stepShort: STEP_SHORT,
    getActiveDayId: () => (getActiveSequentialDay() || {}).id,
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
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitSelectWidth($("daySelect")));
})();
