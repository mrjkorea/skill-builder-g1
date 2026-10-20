(() => {
  const PACK = "./pack/";
  const PACK_SAVE_THROTTLE_MS = 17000;
  const GRADE = "g1";
  function packProgram() {
    const api = packApi();
    return (api && api.PACK_PROGRAM) || "skill-builder";
  }
  function legacyPackProgram() {
    const api = packApi();
    return (api && api.LEGACY_PACK_PROGRAM) || "skill-builder-g1";
  }
  // Shared MRJ sign-in. Student id comes from mrj-auth-ready, not a typed name.
  const CATEGORIES = [
    { key: "phonics", label: "Phonics" },
    { key: "reading", label: "Reading" },
    { key: "grammar", label: "Grammar" },
    { key: "vocabulary", label: "Vocabulary" },
  ];

  const SECTION_COLORS = {
    phonics: "#0ea5e9",
    reading: "#a855f7",
    grammar: "#f97316",
    vocabulary: "#22c55e",
  };

  const SUBSECTIONS = {
    phonics: [
      { name: "Sounds, rhyme, syllables", min: 1, max: 8 },
      { name: "Blend and change sounds", min: 9, max: 17 },
      { name: "Starting and ending letters", min: 18, max: 21 },
      { name: "Short vowels", min: 22, max: 49 },
      { name: "Digraphs and blends", min: 50, max: 59 },
      { name: "Long vowels", min: 60, max: 81 },
      { name: "R-control, diphthongs, two syllables", min: 82, max: 91 },
      { name: "Sight words", min: 92, max: 105 },
    ],
    grammar: [
      { name: "Sentences", min: 1, max: 11 },
      { name: "Nouns", min: 12, max: 22 },
      { name: "Pronouns", min: 23, max: 27 },
      { name: "Verbs", min: 28, max: 48 },
      { name: "Articles, adjectives, prepositions", min: 49, max: 58 },
      { name: "Order, contractions, capitals", min: 59, max: 68 },
    ],
    reading: [{ name: "Pictures and stories", all: true }],
    vocabulary: [{ name: "Word meanings", all: true }],
  };

  const LANGUAGES = [
    { code: "en", label: "English" },
    { code: "ko", label: "한국어" },
    { code: "zh-Hans", label: "简体中文" },
    { code: "es", label: "Español" },
    { code: "hi", label: "हिन्दी" },
    { code: "ja", label: "日本語" },
    { code: "de", label: "Deutsch" },
    { code: "vi", label: "Tiếng Việt" },
    { code: "pt-BR", label: "Português" },
    { code: "id", label: "Indonesia" },
    { code: "fr", label: "Français" },
    { code: "ar", label: "العربية" },
    { code: "tr", label: "Türkçe" },
    { code: "it", label: "Italiano" },
    { code: "pl", label: "Polski" },
  ];

  const LANG_CODES = new Set(LANGUAGES.map((l) => l.code));
  const initialLang = "en";

  const state = {
    skills: [],
    pictures: {},
    scoreTable: null,
    lang: initialLang,
    skillIntroPlayed: {},
    skill: null,
    selectedCategory: null,
    queue: [],
    items: [],
    idx: 0,
    scores: {},
    streaks: {},
    locked: false,
    orderPicked: [],
    packReady: false,
    lastPlace: null,
  };

  let studentId = "";
  let studentIdKey = "";
  let packSyncSeq = 0;
  let packLoadOk = false;
  let packSavePending = false;
  let packDirty = false;
  let packSaveTimer = null;
  let packLastSaveAt = 0;
  let packLoadRetryTimer = null;

  const packApi = () => (typeof window !== "undefined" && window.SB_PACK_SYNC) || null;

  function buildProgressJson() {
    const api = packApi();
    const last = api && api.normalizeLast ? api.normalizeLast(state.lastPlace) : state.lastPlace;
    return JSON.stringify({
      v: 2,
      grade: GRADE,
      scores: state.scores,
      stats: loadStats(),
      lang: state.lang,
      last,
    });
  }

  function scoresStorageKey() {
    const api = packApi();
    if (!studentIdKey || !api) return "sb_scores";
    return api.studentStorageKey(api.SCORES_BASE, studentIdKey);
  }

  function statsStorageKey() {
    const api = packApi();
    if (!studentIdKey || !api) return "sb_stats";
    return api.studentStorageKey(api.STATS_BASE, studentIdKey);
  }

  function langStorageKey() {
    const api = packApi();
    if (!studentIdKey || !api) return "sb_lang";
    return api.studentStorageKey(api.LANG_BASE, studentIdKey);
  }

  function readJsonStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function applyProgressBlob(blob) {
    const api = packApi();
    const empty = api ? api.emptyProgress(GRADE) : { v: 2, grade: GRADE, scores: {}, stats: {}, lang: null, last: null };
    const p = blob || empty;
    state.scores = p.scores && typeof p.scores === "object" ? p.scores : {};
    state.lastPlace = api && api.normalizeLast ? api.normalizeLast(p.last) : p.last || null;
    if (p.lang && LANG_CODES.has(p.lang)) {
      state.lang = p.lang;
      localStorage.setItem(langStorageKey(), p.lang);
    }
    localStorage.setItem(scoresStorageKey(), JSON.stringify(state.scores));
    localStorage.setItem(statsStorageKey(), JSON.stringify(p.stats && typeof p.stats === "object" ? p.stats : {}));
  }

  function captureProgressFromState() {
    const api = packApi();
    const langRaw = localStorage.getItem(langStorageKey());
    const lang =
      (langRaw && LANG_CODES.has(langRaw) ? langRaw : null) ||
      (LANG_CODES.has(state.lang) ? state.lang : null);
    const last = api && api.normalizeLast ? api.normalizeLast(state.lastPlace) : state.lastPlace;
    return {
      v: 2,
      grade: GRADE,
      scores: Object.assign({}, state.scores),
      stats: readJsonStorage(statsStorageKey(), {}),
      lang,
      last,
    };
  }

  function resetInMemoryForStudentSwitch() {
    state.scores = {};
    state.streaks = {};
    state.skillIntroPlayed = {};
    state.lastPlace = null;
    state.skill = null;
    state.selectedCategory = null;
    state.lang = initialLang;
  }

  function resetPackSession() {
    packSyncSeq += 1;
    packLoadOk = false;
    packSavePending = false;
    packDirty = false;
    packLastSaveAt = 0;
    clearPackSaveTimer();
    if (packLoadRetryTimer) {
      clearTimeout(packLoadRetryTimer);
      packLoadRetryTimer = null;
    }
  }

  function mergeKeyedStorageIntoState() {
    const api = packApi();
    if (!api) return;
    const langRaw = localStorage.getItem(langStorageKey());
    const stored = {
      v: 2,
      grade: GRADE,
      scores: readJsonStorage(scoresStorageKey(), {}),
      stats: readJsonStorage(statsStorageKey(), {}),
      lang: langRaw && LANG_CODES.has(langRaw) ? langRaw : null,
      last: null,
    };
    const legacy = api.consumeDeviceLegacy ? api.consumeDeviceLegacy(studentIdKey, GRADE) : null;
    let base = stored;
    if (legacy) base = api.mergeProgress(stored, legacy, GRADE);
    const merged = api.mergeProgress(base, captureProgressFromState(), GRADE);
    state.scores = merged.scores && typeof merged.scores === "object" ? merged.scores : {};
    state.lastPlace = api.normalizeLast ? api.normalizeLast(merged.last) : merged.last;
    localStorage.setItem(scoresStorageKey(), JSON.stringify(state.scores));
    localStorage.setItem(
      statsStorageKey(),
      JSON.stringify(merged.stats && typeof merged.stats === "object" ? merged.stats : {})
    );
    if (merged.lang && LANG_CODES.has(merged.lang)) {
      state.lang = merged.lang;
      localStorage.setItem(langStorageKey(), merged.lang);
    }
  }

  function markPackDirty() {
    packDirty = true;
  }

  function authHasPackApi() {
    const auth = window.MRJ_AUTH;
    return !!(auth && typeof auth.loadPack === "function" && typeof auth.savePack === "function");
  }

  function canPackSave() {
    const api = packApi();
    if (!api) return false;
    return api.canSaveToServer(packLoadOk, window.MRJ_AUTH, packProgram());
  }

  function clearPackSaveTimer() {
    if (packSaveTimer) {
      clearTimeout(packSaveTimer);
      packSaveTimer = null;
    }
  }

  async function flushPackSave(force) {
    if (!studentId || !canPackSave()) return;
    if (!force && !packSavePending && !packDirty) return;
    const auth = window.MRJ_AUTH;
    if (!auth || typeof auth.savePack !== "function") return;
    packSavePending = false;
    clearPackSaveTimer();
    try {
      const res = await auth.savePack(packProgram(), buildProgressJson());
      if (res && res.ok) {
        packLastSaveAt = Date.now();
        packDirty = false;
      } else {
        packSavePending = true;
        packDirty = true;
        packLoadOk = false;
        schedulePackLoadRetry();
      }
    } catch (_) {
      packSavePending = true;
      packDirty = true;
      packLoadOk = false;
      schedulePackLoadRetry();
    }
  }

  function schedulePackSave() {
    if (!studentId) return;
    markPackDirty();
    if (!canPackSave()) return;
    packSavePending = true;
    const elapsed = Date.now() - packLastSaveAt;
    if (elapsed >= PACK_SAVE_THROTTLE_MS) {
      flushPackSave();
      return;
    }
    if (!packSaveTimer) {
      packSaveTimer = setTimeout(() => {
        packSaveTimer = null;
        flushPackSave();
      }, PACK_SAVE_THROTTLE_MS - elapsed);
    }
  }

  function schedulePackLoadRetry() {
    if (packLoadRetryTimer || !studentId) return;
    packLoadRetryTimer = setTimeout(() => {
      packLoadRetryTimer = null;
      syncStudentPack(studentId).catch(() => {});
    }, 30000);
  }

  async function loadCloudPack(auth, program) {
    try {
      return await auth.loadPack(program);
    } catch (_) {
      return { ok: false, error: "network" };
    }
  }

  async function syncStudentPack(id) {
    const api = packApi();
    if (!api) return;
    const seq = packSyncSeq;
    const program = packProgram();
    studentIdKey = api.idKey(id);
    packLoadOk = false;
    clearPackSaveTimer();

    mergeKeyedStorageIntoState();

    if (!authHasPackApi()) return;

    let loadRes = await loadCloudPack(window.MRJ_AUTH, program);
    if (seq !== packSyncSeq || api.idKey(studentId) !== studentIdKey) return;

    if (loadRes && loadRes.ok && !loadRes.found) {
      const legacyRes = await loadCloudPack(window.MRJ_AUTH, legacyPackProgram());
      if (seq !== packSyncSeq || api.idKey(studentId) !== studentIdKey) return;
      if (legacyRes && legacyRes.ok && legacyRes.found && legacyRes.progress_json) {
        const migrated = api.parseProgressJson(legacyRes.progress_json, GRADE);
        migrated.grade = GRADE;
        try {
          await window.MRJ_AUTH.savePack(program, JSON.stringify(migrated));
        } catch (_) {}
        loadRes = {
          ok: true,
          found: true,
          progress_json: JSON.stringify(migrated),
        };
      }
    }

    if (!loadRes || !loadRes.ok) {
      schedulePackLoadRetry();
      return;
    }

    packLoadOk = true;
    const { merged, serverParsed } = api.mergeAfterPackLoad(
      captureProgressFromState(),
      loadRes.progress_json,
      GRADE
    );
    applyProgressBlob(merged);

    if (api.isRicherThan(merged, serverParsed)) {
      try {
        const saveRes = await window.MRJ_AUTH.savePack(program, JSON.stringify(merged));
        if (saveRes && saveRes.ok) {
          packLastSaveAt = Date.now();
          packDirty = false;
        } else {
          markPackDirty();
        }
      } catch (_) {
        markPackDirty();
      }
    }
  }

  function rememberLastSkill(skill, category) {
    if (!skill || !skill.skill_id) return;
    const api = packApi();
    state.lastPlace = {
      skill_id: skill.skill_id,
      category: category || skill.category || state.selectedCategory || null,
    };
    if (api && api.normalizeLast) state.lastPlace = api.normalizeLast(state.lastPlace);
    markPackDirty();
    schedulePackSave();
  }

  function skillById(skillId) {
    return state.skills.find((s) => s.skill_id === skillId) || null;
  }

  function logAnswer(skillId, q, correct, smartScore, tier) {
    const api = window.SB_SCORE_SAVE;
    if (!api || !api.logAnswer) return;
    api.logAnswer(
      { studentId, MRJ_SCORES: window.MRJ_SCORES, MRJ_AUTH: window.MRJ_AUTH },
      skillId,
      q,
      correct,
      smartScore,
      tier
    );
  }

  const $ = (html) => {
    const d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstElementChild;
  };
  const app = () => document.getElementById("app");

  let skillAudio = null;
  let audioGen = 0;
  let picturesLoadPromise = null;
  const SOUND_GESTURE_KEY = "sb_sound_gesture_ok";

  function soundGestureOk() {
    try {
      return sessionStorage.getItem(SOUND_GESTURE_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function markSoundGesture() {
    try {
      sessionStorage.setItem(SOUND_GESTURE_KEY, "1");
    } catch (_) {}
    const hint = document.getElementById("sound-gesture-hint");
    if (hint) hint.remove();
  }

  function installSoundGestureCapture() {
    if (soundGestureOk()) return;
    const onGesture = () => {
      markSoundGesture();
      document.removeEventListener("pointerdown", onGesture, true);
      document.removeEventListener("keydown", onGesture, true);
    };
    document.addEventListener("pointerdown", onGesture, true);
    document.addEventListener("keydown", onGesture, true);
  }

  function appendSoundGestureHint(el) {
    if (!soundEnabled() || soundGestureOk()) return;
    const hint = $(
      `<p class="sound-gesture-hint" id="sound-gesture-hint">Tap the screen once so sound can play. · 한 번 눌러 주세요.</p>`
    );
    el.appendChild(hint);
  }
  const TAP_SKIP = new Set(["the", "and", "for", "with", "that", "this"]);
  const TAP_MARK_RE = /\[\[([^\]]+)\]\]/g;

  function t(en, ko) {
    return state.lang === "ko" && ko ? ko : en;
  }

  function soundEnabled() {
    const v = localStorage.getItem("sb_sound");
    if (v === null) return true;
    return v === "on" || v === "1" || v === "true";
  }

  function setSound(on) {
    localStorage.setItem("sb_sound", on ? "on" : "off");
  }

  function loadStats() {
    return readJsonStorage(statsStorageKey(), {});
  }

  function saveStats(all) {
    localStorage.setItem(statsStorageKey(), JSON.stringify(all));
    markPackDirty();
    schedulePackSave();
  }

  function statCount(skillId, key) {
    const st = loadStats()[skillId];
    return st && st[key] ? st[key] : 0;
  }

  function bumpStat(skillId, correct) {
    const all = loadStats();
    const st = all[skillId] || { correct: 0, wrong: 0 };
    if (correct) st.correct += 1;
    else st.wrong += 1;
    all[skillId] = st;
    saveStats(all);
  }

  function saveScores() {
    localStorage.setItem(scoresStorageKey(), JSON.stringify(state.scores));
    markPackDirty();
    schedulePackSave();
  }

  function skillScore(id) {
    return state.scores[id] || 0;
  }

  function band(score) {
    if (score >= 90) return "star";
    if (score >= 71) return "high";
    if (score >= 40) return "mid";
    return "low";
  }

  function applyScore(skillId, correct, tier, q) {
    const table = state.scoreTable;
    let s = skillScore(skillId);
    const b = band(s);
    const bands = table.bands;
    if (correct) {
      if (b === "low") s += bands.low.gain;
      else if (b === "mid") s += bands.mid.gain;
      else if (b === "high") s += tier >= 3 ? bands.high.gain.tier3 : bands.high.gain.tier2;
      else {
        const st = (state.streaks[skillId] || 0) + 1;
        state.streaks[skillId] = st;
        s += st >= 3 ? bands.star.gain.streak3 : bands.star.gain.base;
      }
    } else {
      state.streaks[skillId] = 0;
      if (b === "star") s -= bands.star.loss.first;
      else if (b === "high") s -= bands.high.loss;
      else if (b === "mid") s -= bands.mid.loss;
      else s -= bands.low.loss;
    }
    s = Math.max(0, Math.min(99, s));
    state.scores[skillId] = s;
    saveScores();
    logAnswer(skillId, q, correct, s, tier);
    return s;
  }

  function servePool(items, skillId) {
    const s = skillScore(skillId);
    const mix = state.scoreTable.serve[band(s)];
    const weighted = [];
    for (const it of items) {
      const tier = String(it.tier || 2);
      const w = mix[tier] || mix["2"] || 0.2;
      if (w > 0) weighted.push(it);
    }
    const pool = weighted.length ? weighted : items;
    return pool.slice().sort(() => Math.random() - 0.5);
  }

  function picUrl(lemma) {
    if (!lemma) return null;
    const rel = state.pictures[String(lemma).toLowerCase()];
    return rel ? PACK + rel : null;
  }

  function scenePicUrl(it) {
    const media = it && it.media;
    const first = Array.isArray(media) ? media[0] : media;
    if (first && first.file) return PACK + first.file;
    const id = (it && it.item_id) || "";
    if (id.includes("real_life")) return PACK + "media/scenes/real_life/" + id + ".png";
    if (id.includes("happen_next")) return PACK + "media/scenes/happen_next/" + id + ".png";
    return null;
  }

  function addScenePic(el, it) {
    const url = scenePicUrl(it) || picUrl(lemmas(it)[0]);
    if (!url) return;
    const img = document.createElement("img");
    img.className = "pic scene-pic";
    img.src = url;
    img.alt = "";
    img.onerror = () => img.remove();
    el.appendChild(img);
  }


  function lemmas(it) {
    const media = it.media || [];
    const arr = Array.isArray(media) ? media : [media];
    return arr.map((m) => (m && m.lemma) || "").filter(Boolean);
  }

  function answerWord(it) {
    const choices = it.choices || [];
    const idx = it.answer_index;
    if (typeof idx === "number" && choices[idx]) return choices[idx];
    const ls = lemmas(it);
    return ls[0] || "";
  }

  function isBlendListen(skill) {
    return skill && skill.present === "listen" && skill.listen_mode === "blend";
  }

  function isListenPresent(skill) {
    return skill && skill.present === "listen";
  }

  function isSpacedLetterStem(stem) {
    if (!stem || !/\s/.test(stem)) return false;
    const parts = String(stem).trim().split(/\s+/);
    if (parts.length < 2) return false;
    return parts.every((p) => p.length <= 4);
  }

  function itemReadText(skill, it, stemVisible) {
    if (it.speak_en) return String(it.speak_en).trim();
    if (isListenPresent(skill)) return answerWord(it);
    if (it.stem && stemVisible) return it.stem;
    return t(skill.prompt_en, skill.prompt_ko);
  }

  function skillPromptText(skill) {
    if (isBlendListen(skill)) return "Listen. Which word?";
    return t(skill.prompt_en, skill.prompt_ko);
  }

  function skillExplainText(it) {
    const fromItem = it && it.explain_skill_en;
    if (fromItem) return String(fromItem).trim();
    const fromSkill = state.skill && state.skill.explain_skill_en;
    if (fromSkill) return String(fromSkill).trim();
    return "";
  }

  function itemExplainText(it) {
    if (it.explain_item_en) return String(it.explain_item_en).trim();
    if (it.explain_en) return String(it.explain_en).trim();
    const choices = it.choices || [];
    const idx = it.answer_index;
    const correct = typeof idx === "number" && choices[idx] ? choices[idx] : answerWord(it);
    return "The answer is " + correct + ".";
  }

  function extractTapMarks(text) {
    const marks = [];
    TAP_MARK_RE.lastIndex = 0;
    String(text || "").replace(TAP_MARK_RE, (_, w) => {
      marks.push(w);
      return w;
    });
    TAP_MARK_RE.lastIndex = 0;
    return marks;
  }

  function uniqueTapKeys(words) {
    const seen = new Set();
    const out = [];
    for (const w of words) {
      if (!w || seen.has(w)) continue;
      seen.add(w);
      out.push(w);
    }
    return out;
  }

  function autoPickTapWords(text, n) {
    const words = [];
    const seen = new Set();
    const re = /[A-Za-z][A-Za-z']*/g;
    let m;
    while ((m = re.exec(String(text || ""))) && words.length < n) {
      const raw = m[0];
      if (raw.length < 3) continue;
      const key = raw.toLowerCase();
      if (TAP_SKIP.has(key) || seen.has(key)) continue;
      seen.add(key);
      words.push(raw);
    }
    return words;
  }

  function stopSkillAudio() {
    if (!skillAudio) return;
    try {
      skillAudio.pause();
      skillAudio.removeAttribute("src");
      skillAudio.load();
    } catch (_) {}
    skillAudio = null;
  }

  const missingClipLog = new Set();
  function warnMissingClip(kind, label) {
    const key = kind + "\n" + String(label || "");
    if (missingClipLog.has(key)) return;
    missingClipLog.add(key);
    console.warn("Missing clip:", kind, label || "");
  }

  function stopAllAudio() {
    audioGen += 1;
    stopSkillAudio();
  }

  function playSkillFish(skill) {
    const rel = skill && skill.audio_skill;
    if (!rel) return Promise.resolve(false);
    return new Promise((resolve) => {
      stopSkillAudio();
      const audio = new Audio(PACK + rel);
      skillAudio = audio;
      let settled = false;
      let started = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          audio.pause();
        } catch (_) {}
        if (skillAudio === audio) skillAudio = null;
        resolve(ok);
      };
      const timer = setTimeout(() => done(started), 8000);
      audio.addEventListener("playing", () => {
        started = true;
      });
      audio.addEventListener("ended", () => done(true));
      audio.addEventListener("error", () => done(false));
      const playP = audio.play();
      if (playP && playP.then) {
        playP.then(() => {
          started = true;
        }).catch(() => done(false));
      }
    });
  }

  function makeTapChip(surface, key, tappedSet, onTap) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tap-word" + (tappedSet.has(key) ? " tapped" : "");
    b.dataset.tap = key;
    b.textContent = surface;
    b.onclick = () => onTap(key);
    return b;
  }

  function appendMarkedExplain(parent, text, tappedSet, needed, onTap) {
    const src = String(text || "");
    const re = /\[\[([^\]]+)\]\]/g;
    let last = 0;
    let m;
    while ((m = re.exec(src))) {
      if (m.index > last) parent.appendChild(document.createTextNode(src.slice(last, m.index)));
      const surface = m[1];
      needed.add(surface);
      parent.appendChild(makeTapChip(surface, surface, tappedSet, onTap));
      last = re.lastIndex;
    }
    if (last < src.length) parent.appendChild(document.createTextNode(src.slice(last)));
  }

  function appendAutoExplain(parent, text, tapWords, tappedSet, needed, onTap) {
    const src = String(text || "");
    if (!tapWords.length) {
      parent.appendChild(document.createTextNode(src));
      return;
    }
    const escaped = tapWords
      .slice()
      .sort((a, b) => b.length - a.length)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp("\\b(" + escaped.join("|") + ")\\b", "gi");
    let last = 0;
    let m;
    while ((m = re.exec(src))) {
      if (m.index > last) parent.appendChild(document.createTextNode(src.slice(last, m.index)));
      const surface = m[1];
      const key = surface.toLowerCase();
      needed.add(key);
      parent.appendChild(makeTapChip(surface, key, tappedSet, onTap));
      last = re.lastIndex;
    }
    if (last < src.length) parent.appendChild(document.createTextNode(src.slice(last)));
  }

  function appendExplainBlock(panel, heading, text, mode, tapWords, tappedSet, needed, onTap) {
    if (!text) return;
    const block = document.createElement("div");
    block.className = "explain-block";
    if (heading) {
      const h = document.createElement("div");
      h.className = "explain-h";
      h.textContent = heading;
      block.appendChild(h);
    }
    const body = document.createElement("p");
    body.className = "explain-body";
    if (mode === "marks") appendMarkedExplain(body, text, tappedSet, needed, onTap);
    else appendAutoExplain(body, text, tapWords, tappedSet, needed, onTap);
    block.appendChild(body);
    panel.appendChild(block);
  }

  function fillExplainPanel(panel, it, nextBtn) {
    panel.innerHTML = "";
    const skillText = skillExplainText(it);
    const itemText = itemExplainText(it);
    const marked = uniqueTapKeys(extractTapMarks(skillText).concat(extractTapMarks(itemText)));
    const mode = marked.length ? "marks" : "auto";
    TAP_MARK_RE.lastIndex = 0;
    const autoWords =
      mode === "auto" ? autoPickTapWords((skillText + " " + itemText).replace(TAP_MARK_RE, "$1"), 3) : [];
    const tappedSet = new Set();
    const needed = new Set();
    const syncNext = () => {
      const ready = needed.size === 0 || [...needed].every((k) => tappedSet.has(k));
      if (nextBtn) {
        nextBtn.disabled = !ready;
        nextBtn.classList.toggle("wait-taps", !ready);
      }
    };
    const onTap = (key) => {
      if (tappedSet.has(key)) return;
      tappedSet.add(key);
      panel.querySelectorAll(".tap-word").forEach((el) => {
        if (el.dataset.tap === key) el.classList.add("tapped");
      });
      syncNext();
    };
    appendExplainBlock(panel, skillText ? "The skill:" : "", skillText, mode, autoWords, tappedSet, needed, onTap);
    appendExplainBlock(panel, "This one:", itemText, mode, autoWords, tappedSet, needed, onTap);
    if (mode === "auto" && needed.size === 0 && autoWords.length) {
      const row = document.createElement("div");
      row.className = "tap-word-row";
      for (const w of autoWords) {
        const key = w.toLowerCase();
        needed.add(key);
        row.appendChild(makeTapChip(w, key, tappedSet, onTap));
      }
      panel.appendChild(row);
    }
    syncNext();
  }

  function skillsInCategory(key) {
    return state.skills
      .filter((s) => s.category === key && !s.hidden)
      .sort((a, b) => (a.number || 0) - (b.number || 0));
  }

  function skillTried(skillId) {
    return statCount(skillId, "correct") + statCount(skillId, "wrong") > 0;
  }

  function triedSkillsInCategory(key) {
    return skillsInCategory(key).filter((s) => skillTried(s.skill_id)).length;
  }

  function scorePillTier(skillId) {
    const sc = skillScore(skillId);
    if (sc >= 90) return "pill-green";
    if (sc >= 40) return "pill-blue";
    return "pill-orange";
  }

  function skillRowButton(s, accentKey, onClick) {
    const catKey = accentKey || s.category;
    const color = SECTION_COLORS[catKey] || "#64748b";
    const tried = skillTried(s.skill_id);
    const num = s.number != null ? s.number : "";
    let pillHtml;
    if (tried) {
      const sc = skillScore(s.skill_id);
      pillHtml = `<span class="score-pill ${scorePillTier(s.skill_id)}">${sc}</span>`;
    } else {
      pillHtml = `<span class="score-pill pill-none" aria-label="Not started">—</span>`;
    }
    const b = $(
      `<button type="button" class="skill-row">
        <span class="skill-row-num" style="background:${escapeHtml(color)}">${escapeHtml(String(num))}</span>
        <span class="skill-row-title">${escapeHtml(s.title_en)}</span>
        ${pillHtml}
      </button>`
    );
    b.onclick = onClick;
    return b;
  }

  function groupSkillsBySubsection(catKey, skills) {
    const defs = SUBSECTIONS[catKey];
    if (!defs) return [{ name: "Skills", skills }];
    const grouped = [];
    const used = new Set();
    for (const g of defs) {
      const list = skills.filter((s) => {
        if (g.all) return true;
        const n = Number(s.number) || 0;
        return n >= g.min && n <= g.max;
      });
      for (const s of list) used.add(s.skill_id);
      if (list.length) grouped.push({ name: g.name, skills: list });
    }
    const rest = skills.filter((s) => !used.has(s.skill_id));
    if (rest.length) grouped.push({ name: "More skills", skills: rest });
    return grouped;
  }

  function categoryLabel(key) {
    const c = CATEGORIES.find((x) => x.key === key);
    if (c) return c.label;
    const s = state.skills.find((sk) => sk.category === key);
    return (s && s.category_label) || key;
  }

  function appendSoundToggle(el, rerender) {
    const on = soundEnabled();
    const btn = $(`<button type="button" class="btn small sound-toggle">${on ? "Sound on" : "Sound off"}</button>`);
    btn.onclick = () => {
      setSound(!soundEnabled());
      rerender();
    };
    el.appendChild(btn);
    return btn;
  }

  function setLang(code) {
    if (!LANG_CODES.has(code)) return;
    state.lang = code;
    localStorage.setItem(langStorageKey(), code);
    markPackDirty();
    schedulePackSave();
  }

  function appendLanguageControl(el, rerender) {
    const wrap = $('<label class="lang-wrap"><span class="lang-lbl">Language</span></label>');
    const sel = document.createElement("select");
    sel.className = "lang-select";
    sel.setAttribute("aria-label", "Language");
    for (const L of LANGUAGES) {
      const o = document.createElement("option");
      o.value = L.code;
      o.textContent = L.label;
      if (L.code === state.lang) o.selected = true;
      sel.appendChild(o);
    }
    sel.onchange = () => {
      setLang(sel.value);
      rerender();
    };
    wrap.appendChild(sel);
    el.appendChild(wrap);
    return wrap;
  }

  function appendPlayToolbar(el, rerender) {
    appendSoundToggle(el, rerender);
    appendLanguageControl(el, rerender);
  }

  function appendScoreBar(el, skillId) {
    const sc = skillScore(skillId);
    const bar = $(
      `<div class="scorebar" role="group" aria-label="Skill scores">
        <div class="score-col score-wrong"><span class="num" id="stat-wrong">${statCount(skillId, "wrong")}</span></div>
        <div class="score-col score-mid">
          <span class="lbl">AI skill score</span>
          <span class="num" id="stat-mid">${sc}%</span>
        </div>
        <div class="score-col score-good"><span class="num" id="stat-right">${statCount(skillId, "correct")}</span></div>
      </div>`
    );
    el.appendChild(bar);
  }

  function refreshScoreBar(skillId) {
    const w = document.getElementById("stat-wrong");
    const m = document.getElementById("stat-mid");
    const c = document.getElementById("stat-right");
    if (w) w.textContent = String(statCount(skillId, "wrong"));
    if (m) m.textContent = skillScore(skillId) + "%";
    if (c) c.textContent = String(statCount(skillId, "correct"));
  }

  function ensurePicturesLoaded() {
    if (state.pictures && Object.keys(state.pictures).length > 0) {
      return Promise.resolve(state.pictures);
    }
    if (!picturesLoadPromise) {
      picturesLoadPromise = fetch(PACK + "pictures.json")
        .then((r) => {
          if (!r.ok) throw new Error("pictures.json " + r.status);
          return r.json();
        })
        .then((pictures) => {
          state.pictures = pictures && typeof pictures === "object" ? pictures : {};
          return state.pictures;
        })
        .catch((err) => {
          picturesLoadPromise = null;
          console.error("Pictures load failed", err);
          state.pictures = state.pictures || {};
          return state.pictures;
        });
    }
    return picturesLoadPromise;
  }

  async function loadPackData() {
    const [skills, score] = await Promise.all([
      fetch(PACK + "skills.json").then((r) => {
        if (!r.ok) throw new Error("skills.json " + r.status);
        return r.json();
      }),
      fetch(PACK + "score.json").then((r) => {
        if (!r.ok) throw new Error("score.json " + r.status);
        return r.json();
      }),
    ]);
    state.skills = skills;
    state.pictures = {};
    state.scoreTable = score;
    state.packReady = true;
    ensurePicturesLoaded();
  }

  async function waitForPack() {
    while (!state.packReady) {
      await new Promise((r) => setTimeout(r, 40));
    }
  }

  async function enterApp() {
    await waitForPack();
    installSoundGestureCapture();
    home();
  }

  function signOut() {
    if (packDirty || packSavePending) flushPackSave(true);
    studentId = "";
    studentIdKey = "";
    resetPackSession();
    resetInMemoryForStudentSwitch();
    const api = packApi();
    if (api && api.purgeDeviceWideKeys) api.purgeDeviceWideKeys();
    localStorage.removeItem("sb_account");
    const el = app();
    if (el) el.innerHTML = "";
    if (window.MRJ_AUTH && typeof window.MRJ_AUTH.signOut === "function") {
      window.MRJ_AUTH.signOut();
    }
    const gate = document.getElementById("mrj-auth-gate");
    if (gate) gate.hidden = false;
    document.documentElement.classList.add("mrj-auth-locked");
  }

  function boot() {
    const packPromise = loadPackData();
    window.addEventListener("mrj-auth-ready", async (event) => {
      const raw = event && event.detail ? event.detail.id : "";
      const id = String(raw == null ? "" : raw).trim();
      if (!id) return;
      const api = packApi();
      const nextKey = api ? api.idKey(id) : id;
      const prevKey = studentIdKey;
      if (prevKey && nextKey && prevKey !== nextKey) {
        if (packDirty || packSavePending) await flushPackSave(true);
        resetInMemoryForStudentSwitch();
        resetPackSession();
      }
      studentId = id;
      studentIdKey = nextKey;
      try {
        await packPromise;
      } catch (e) {
        console.error("Pack load failed", e);
        const root = app();
        if (root) {
          root.innerHTML =
            "<h1>Could not load pack</h1><p class='muted'>" + escapeHtml(e.message || e) + "</p>";
        }
        return;
      }
      try {
        await syncStudentPack(id);
      } catch (e) {
        console.error("Progress pack sync failed", e);
      }
      await enterApp();
    });
    window.addEventListener("pagehide", () => {
      if (packDirty || packSavePending) flushPackSave(true);
    });
  }

  function home() {
    state.skill = null;
    state.selectedCategory = null;
    const el = app();
    el.innerHTML = "";
    el.appendChild($(`<h1 class="title-main">English Skill Builder · Grade 1</h1>`));
    const gradesLink = $(`<a class="btn small grades-link" href="../">← Grades</a>`);
    el.appendChild(gradesLink);

    const toolbar = $('<div class="toolbar row"></div>');
    if (studentId) {
      const user = $(`<span class="home-user">${escapeHtml(studentId)}</span>`);
      const out = $(`<button type="button" class="btn small">Sign out</button>`);
      out.onclick = signOut;
      toolbar.appendChild(user);
      toolbar.appendChild(out);
    }
    appendPlayToolbar(toolbar, home);
    el.appendChild(toolbar);
    appendSoundGestureHint(el);

    const last = state.lastPlace;
    const lastSkill = last && last.skill_id ? skillById(last.skill_id) : null;
    if (lastSkill) {
      const resume = $(
        `<button type="button" class="btn primary resume-btn">Continue: ${escapeHtml(lastSkill.title_en)}</button>`
      );
      resume.onclick = () =>
        startSkill(lastSkill, { category: last.category || lastSkill.category, fromResume: true });
      el.appendChild(resume);
    }

    const search = $(`<input class="search" type="search" placeholder="Find a skill" autocomplete="off" />`);
    el.appendChild(search);

    const tilesHost = document.createElement("div");
    const resultsHost = document.createElement("div");
    el.appendChild(tilesHost);
    el.appendChild(resultsHost);

    const drawTiles = () => {
      tilesHost.innerHTML = "";
      const stack = $('<div class="section-stack"></div>');
      for (const cat of CATEGORIES) {
        const n = skillsInCategory(cat.key).length;
        const done = triedSkillsInCategory(cat.key);
        const progress = done > 0 ? `${done} started` : "Not started";
        const color = SECTION_COLORS[cat.key];
        const card = $(
          `<button type="button" class="section-card" style="--section-color:${escapeHtml(color)}">
            <span class="section-card-bar" aria-hidden="true"></span>
            <span class="section-card-body">
              <span class="section-card-name">${escapeHtml(cat.label)}</span>
              <span class="section-card-meta">${n} skills</span>
              <span class="section-card-progress">${escapeHtml(progress)}</span>
            </span>
          </button>`
        );
        card.onclick = () => categoryList(cat.key);
        stack.appendChild(card);
      }
      tilesHost.appendChild(stack);
    };

    const draw = () => {
      const q = search.value.trim().toLowerCase();
      resultsHost.innerHTML = "";
      if (!q) {
        tilesHost.style.display = "";
        drawTiles();
        return;
      }
      tilesHost.style.display = "none";
      for (const s of state.skills) {
        if (s.hidden) continue;
        if (!String(s.title_en || "").toLowerCase().includes(q)) continue;
        resultsHost.appendChild(
          skillRowButton(s, s.category, () => startSkill(s, { fromSearch: true }))
        );
      }
      if (!resultsHost.children.length) {
        resultsHost.appendChild($(`<p class="muted">No skills match.</p>`));
      }
    };

    search.oninput = draw;
    draw();
  }

  function categoryList(catKey) {
    state.skill = null;
    state.selectedCategory = catKey;
    const el = app();
    el.innerHTML = "";
    const back = $(`<button type="button" class="btn small">← Index</button>`);
    back.onclick = home;
    el.appendChild(back);
    el.appendChild($(`<h1 class="title-main">${escapeHtml(categoryLabel(catKey))}</h1>`));

    const toolbar = $('<div class="toolbar row"></div>');
    appendPlayToolbar(toolbar, () => categoryList(catKey));
    el.appendChild(toolbar);

    const list = document.createElement("div");
    list.className = "skill-list";
    list.style.setProperty("--section-color", SECTION_COLORS[catKey] || "#64748b");
    el.appendChild(list);

    const skills = skillsInCategory(catKey);
    for (const group of groupSkillsBySubsection(catKey, skills)) {
      const block = document.createElement("section");
      block.className = "subsection";
      block.appendChild(
        $(
          `<div class="subsection-header">
            <span class="subsection-name">${escapeHtml(group.name)}</span>
            <span class="subsection-count">${group.skills.length} skills</span>
          </div>`
        )
      );
      const rows = document.createElement("div");
      rows.className = "subsection-rows";
      for (const s of group.skills) {
        rows.appendChild(
          skillRowButton(s, catKey, () => startSkill(s, { category: catKey }))
        );
      }
      block.appendChild(rows);
      list.appendChild(block);
    }
  }

  async function loadItems(skill) {
    const ids = [skill.skill_id, skill.family_id].filter(Boolean);
    for (const id of ids) {
      try {
        const r = await fetch(PACK + "items/" + encodeURIComponent(id) + ".json");
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data) && data.length) return data;
        }
      } catch (_) {}
    }
    return [];
  }

  async function startSkill(skill, opts = {}) {
    stopAllAudio();
    markSoundGesture();
    state.skill = skill;
    state.selectedCategory = opts.category || state.selectedCategory || skill.category || null;
    state.fromSearch = !!opts.fromSearch;
    app().innerHTML = "<p class='muted'>Loading…</p>";
    await ensurePicturesLoaded();
    state.items = await loadItems(skill);
    if (!state.items.length) {
      app().innerHTML = "";
      const back = $(`<button type="button" class="btn small">← Back</button>`);
      back.onclick = () => {
        if (state.fromSearch) home();
        else if (state.selectedCategory) categoryList(state.selectedCategory);
        else home();
      };
      app().appendChild(back);
      app().appendChild($(`<p>No questions for this skill yet.</p>`));
      return;
    }
    state.queue = servePool(state.items, skill.skill_id);
    state.idx = 0;
    state.skillIntroPlayed[skill.skill_id] = false;
    rememberLastSkill(skill, opts.category || state.selectedCategory);
    showItem();
  }

  function currentItem() {
    return state.queue[state.idx];
  }

  function playBack() {
    stopAllAudio();
    if (state.fromSearch) home();
    else if (state.selectedCategory) categoryList(state.selectedCategory);
    else home();
  }

  function showItem() {
    stopAllAudio();
    const skill = state.skill;
    const it = currentItem();
    if (!it) {
      playBack();
      return;
    }
    state.locked = false;
    state.orderPicked = [];
    const el = app();
    el.innerHTML = "";
    const gen = audioGen;

    appendScoreBar(el, skill.skill_id);

    const top = $('<div class="play-top row"></div>');
    const back = $(`<button type="button" class="btn small">Index</button>`);
    back.onclick = home;
    top.appendChild(back);
    const skip = $(`<button type="button" class="btn small">Skip</button>`);
    skip.onclick = () => {
      stopAllAudio();
      state.idx += 1;
      if (state.idx >= state.queue.length) {
        state.queue = servePool(state.items, skill.skill_id);
        state.idx = 0;
      }
      showItem();
    };
    top.appendChild(skip);
    appendPlayToolbar(top, showItem);
    el.appendChild(top);

    el.appendChild($(`<div class="muted skill-line">${escapeHtml(skill.number)}. ${escapeHtml(skill.title_en)}</div>`));

    const blend = isBlendListen(skill);
    const listen = isListenPresent(skill);
    const hideStem = blend || (listen && isSpacedLetterStem(it.stem));
    const stemVisible = !hideStem && !!it.stem;

    let promptText;
    let todoText;
    if (blend) {
      promptText = "Listen. Which word?";
      todoText = t("Tap the picture or word.", "사진이나 낱말을 누르세요.");
    } else {
      promptText = t(skill.prompt_en, skill.prompt_ko);
      todoText = t(skill.what_to_do_en, skill.what_to_do_ko);
    }

    el.appendChild($(`<h2 class="prompt">${escapeHtml(promptText)}</h2>`));
    if (todoText) el.appendChild($(`<p class="muted todo">${escapeHtml(todoText)}</p>`));

    if (stemVisible) el.appendChild($(`<div class="stem">${escapeHtml(it.stem)}</div>`));
    addScenePic(el, it);

    const readText = itemReadText(skill, it, stemVisible);

    const type = it.item_type || skill.item_type || "abcd";
    if (blend) renderBlendChoices(el, it);
    else if (type === "word_to_picture") renderPicChoices(el, it);
    else if (type === "order_words" || type === "order_sentences") renderOrder(el, it);
    else renderChoices(el, it);

    const fb = $(`<div class="feedback" id="fb"></div>`);
    el.appendChild(fb);
    const explainEl = $(`<div class="explain-panel" id="explain" hidden></div>`);
    el.appendChild(explainEl);
    const next = $(`<button type="button" class="btn primary wait-taps" id="next" style="display:none" disabled>Next</button>`);
    next.onclick = () => {
      if (next.disabled) return;
      state.idx += 1;
      if (state.idx >= state.queue.length) {
        state.queue = servePool(state.items, skill.skill_id);
        state.idx = 0;
      }
      showItem();
    };
    el.appendChild(next);

    if (soundEnabled()) {
      setTimeout(() => {
        if (gen !== audioGen) return;
        playItemAudio(skill, readText, gen);
      }, 300);
    }
  }

  async function playItemAudio(skill, itemText, gen) {
    if (gen !== audioGen) return;
    const sid = skill.skill_id;
    const needSkillIntro = !state.skillIntroPlayed[sid];
    if (needSkillIntro) {
      state.skillIntroPlayed[sid] = true;
      if (!skill || !skill.audio_skill) warnMissingClip("skill intro", sid || "");
      else if (soundEnabled()) {
        const playedMp3 = await playSkillFish(skill);
        if (gen !== audioGen) return;
        if (!playedMp3) warnMissingClip("skill intro", sid || "");
      }
    }
    if (itemText) warnMissingClip("question", itemText);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function addPic(el, lemma) {
    const url = picUrl(lemma);
    if (!url) return;
    const img = document.createElement("img");
    img.className = "pic";
    img.src = url;
    img.alt = lemma;
    el.appendChild(img);
  }

  function renderChoices(el, it) {
    const type = it.item_type || "abcd";
    if (type === "picture_to_word" || type === "ab" || type === "odd_one_out") {
      addPic(el, lemmas(it)[0]);
    }
    const choices = it.choices || [];
    choices.forEach((c, i) => {
      const b = $(`<button type="button" class="choice">${escapeHtml(c)}</button>`);
      b.onclick = () => gradeIndex(i, it, el.querySelectorAll(".choice"));
      el.appendChild(b);
    });
  }

  function renderBlendChoices(el, it) {
    const wrap = $("<div class='pics'></div>");
    const choices = it.choices || [];
    choices.forEach((c, i) => {
      const cell = $("<button type='button' class='picwrap choice'></button>");
      const url = picUrl(c);
      if (url) {
        const img = document.createElement("img");
        img.className = "pic";
        img.src = url;
        img.alt = c;
        cell.appendChild(img);
      } else {
        cell.appendChild($(`<span class="choice-text">${escapeHtml(c)}</span>`));
      }
      cell.onclick = () => gradeIndex(i, it, wrap.querySelectorAll(".picwrap"));
      wrap.appendChild(cell);
    });
    el.appendChild(wrap);
  }

  function renderPicChoices(el, it) {
    const wrap = $("<div class='pics'></div>");
    const choices = it.choices || [];
    const lems = lemmas(it);
    choices.forEach((c, i) => {
      const lem = lems[i] || c;
      const cell = $("<button type='button' class='picwrap'></button>");
      const url = picUrl(lem);
      if (url) {
        const img = document.createElement("img");
        img.className = "pic";
        img.src = url;
        img.alt = lem;
        cell.appendChild(img);
      }
      cell.appendChild($(`<div>${escapeHtml(c)}</div>`));
      cell.onclick = () => gradeIndex(i, it, wrap.querySelectorAll(".picwrap"));
      wrap.appendChild(cell);
    });
    el.appendChild(wrap);
  }

  function renderOrder(el, it) {
    const target = it.answer_index || it.answer_order || [];
    const slots = $("<div id='slots'></div>");
    el.appendChild(slots);
    const chips = $("<div class='chips' id='chips'></div>");
    const order = (it.choices || []).map((_, i) => i).sort(() => Math.random() - 0.5);
    order.forEach((i) => {
      const ch = $(`<button type="button" class="chip" data-i="${i}">${escapeHtml(it.choices[i])}</button>`);
      ch.onclick = () => {
        if (state.locked) return;
        state.orderPicked.push(i);
        ch.disabled = true;
        slots.appendChild($(`<div class="order-slot">${escapeHtml(it.choices[i])}</div>`));
        if (state.orderPicked.length === (it.choices || []).length) {
          const ok = Array.isArray(target)
            ? state.orderPicked.every((v, k) => v === target[k])
            : false;
          finish(ok, it);
        }
      };
      chips.appendChild(ch);
    });
    el.appendChild(chips);
  }

  function gradeIndex(i, it, nodes) {
    if (state.locked) return;
    const ans = it.answer_index;
    const ok = i === ans;
    Array.from(nodes).forEach((n, idx) => {
      if (!n.classList) return;
      if (idx === ans) n.classList.add("ok");
      if (idx === i && !ok) n.classList.add("no");
    });
    finish(ok, it);
  }

  function finish(ok, it) {
    state.locked = true;
    const skillId = state.skill.skill_id;
    bumpStat(skillId, ok);
    const s = applyScore(skillId, ok, it.tier || 2, it);
    const fb = document.getElementById("fb");
    if (fb) fb.textContent = ok ? "Yes  ·  " + s + "%" : "Not that  ·  " + s + "%";
    const n = document.getElementById("next");
    const ex = document.getElementById("explain");
    if (ok) {
      if (ex) {
        ex.hidden = true;
        ex.innerHTML = "";
      }
      if (n) {
        n.style.display = "block";
        n.disabled = false;
        n.classList.remove("wait-taps");
      }
    } else if (ex) {
      ex.hidden = false;
      fillExplainPanel(ex, it, n);
      if (n) n.style.display = "block";
    } else if (n) {
      n.style.display = "block";
      n.disabled = false;
    }
    refreshScoreBar(skillId);
  }

  boot();
})();
