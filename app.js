(() => {
  const PACK = "./pack/";
  const CATEGORIES = [
    { key: "phonics", label: "Phonics" },
    { key: "reading", label: "Reading" },
    { key: "grammar", label: "Grammar" },
    { key: "vocabulary", label: "Vocabulary" },
  ];

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
  const savedLang = localStorage.getItem("sb_lang");
  const initialLang = savedLang && LANG_CODES.has(savedLang) ? savedLang : "en";

  const state = {
    skills: [],
    pictures: {},
    scoreTable: null,
    lang: initialLang,
    voice: localStorage.getItem("sb_voice") || "puck",
    skillIntroPlayed: {},
    skill: null,
    selectedCategory: null,
    queue: [],
    items: [],
    idx: 0,
    scores: JSON.parse(localStorage.getItem("sb_scores") || "{}"),
    streaks: {},
    locked: false,
    orderPicked: [],
  };

  const $ = (html) => {
    const d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstElementChild;
  };
  const app = () => document.getElementById("app");

  let skillAudio = null;
  let audioGen = 0;
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
    try {
      return JSON.parse(localStorage.getItem("sb_stats") || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveStats(all) {
    localStorage.setItem("sb_stats", JSON.stringify(all));
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
    localStorage.setItem("sb_scores", JSON.stringify(state.scores));
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

  function applyScore(skillId, correct, tier) {
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

  function ttsPlugin() {
    const cap = window.Capacitor;
    const plugins = cap && (cap.Plugins || (cap.getPlatform && cap.Plugins));
    if (plugins && plugins.SkillBuilderTts) return plugins.SkillBuilderTts;
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SkillBuilderTts) {
      return window.Capacitor.Plugins.SkillBuilderTts;
    }
    return null;
  }

  let voicesReadyPromise = null;
  function ensureVoices() {
    if (voicesReadyPromise) return voicesReadyPromise;
    voicesReadyPromise = new Promise((resolve) => {
      const pick = () => {
        const v = speechSynthesis.getVoices();
        if (v && v.length) {
          resolve(v);
          return true;
        }
        return false;
      };
      if (pick()) return;
      const onChange = () => {
        if (pick()) speechSynthesis.removeEventListener("voiceschanged", onChange);
      };
      speechSynthesis.addEventListener("voiceschanged", onChange);
      setTimeout(() => resolve(speechSynthesis.getVoices() || []), 800);
    });
    return voicesReadyPromise;
  }

  const FEMALE_HINTS = [
    "samantha",
    "karen",
    "moira",
    "victoria",
    "zira",
    "female",
    "google us english",
    "google uk english female",
  ];
  const MALE_HINTS = [
    "daniel",
    "alex",
    "fred",
    "david",
    "arthur",
    "gordon",
    "rishi",
    "male",
    "en-us-x-iom",
    "google uk english male",
    "google us english male",
  ];
  const FEMALE_REJECT = ["samantha", "karen", "moira", "victoria", "zira", "female"];

  function voiceKey(v) {
    return (v.voiceURI + " " + v.name).toLowerCase();
  }

  function isEnglishVoice(v) {
    const lang = (v.lang || "").toLowerCase();
    return lang.startsWith("en");
  }

  function scoreVoice(v, wantFemale) {
    const k = voiceKey(v);
    let score = isEnglishVoice(v) ? 10 : 0;
    const hints = wantFemale ? FEMALE_HINTS : MALE_HINTS;
    for (const h of hints) {
      if (k.includes(h)) score += 20;
    }
    if (wantFemale) {
      if (k.includes("male")) score -= 40;
      for (const h of MALE_HINTS) {
        if (h !== "male" && k.includes(h)) score -= 25;
      }
    } else {
      for (const r of FEMALE_REJECT) {
        if (k.includes(r)) score -= 50;
      }
      if (k.includes("female")) score -= 40;
    }
    return score;
  }

  function pickVoice(voices, wantFemale, storedUri) {
    if (storedUri) {
      const hit = voices.find((v) => v.voiceURI === storedUri);
      if (hit) return hit;
    }
    const en = voices.filter(isEnglishVoice);
    const pool = en.length ? en : voices;
    let best = null;
    let bestScore = -Infinity;
    for (const v of pool) {
      const s = scoreVoice(v, wantFemale);
      if (s > bestScore) {
        bestScore = s;
        best = v;
      }
    }
    if (!wantFemale && best) {
      const k = voiceKey(best);
      for (const r of FEMALE_REJECT) {
        if (k.includes(r)) best = null;
      }
    }
    return best;
  }

  function roleWantsFemale(role) {
    const puck = state.voice !== "bella";
    if (role === "skill") return puck;
    return !puck;
  }

  async function speak(text, opts = {}) {
    const word = String(text || "").trim();
    if (!word) return;
    const role = opts.role || "item";
    const wantFemale = roleWantsFemale(role);
    const sid = wantFemale ? 0 : 1;
    const p = ttsPlugin();
    try {
      if (p && p.stop) p.stop().catch(() => {});
      if (p && p.speak) {
        await p.speak({ text: word, sid, gender: wantFemale ? "female" : "male" });
        return;
      }
    } catch (_) {}
    const voices = await ensureVoices();
    const storeKey = wantFemale ? "sb_voice_uri_bella" : "sb_voice_uri_puck";
    const stored = localStorage.getItem(storeKey);
    let voice = pickVoice(voices, wantFemale, stored);
    return new Promise((resolve) => {
      try {
        const u = new SpeechSynthesisUtterance(word);
        u.lang = "en-US";
        if (voice) {
          u.voice = voice;
          if (!stored) localStorage.setItem(storeKey, voice.voiceURI);
        } else if (!wantFemale) {
          u.pitch = 0.85;
        }
        u.onend = () => resolve();
        u.onerror = () => resolve();
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      } catch (_) {
        resolve();
      }
    });
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

  function stopAllAudio() {
    audioGen += 1;
    stopSkillAudio();
    try {
      speechSynthesis.cancel();
    } catch (_) {}
    const p = ttsPlugin();
    if (p && p.stop) p.stop().catch(() => {});
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
    localStorage.setItem("sb_lang", code);
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

  function appendVoiceToggle(el, rerender) {
    const voice = $(
      `<button type="button" class="btn small">Voice: ${state.voice === "bella" ? "Bella" : "Puck"}</button>`
    );
    voice.onclick = () => {
      state.voice = state.voice === "bella" ? "puck" : "bella";
      localStorage.setItem("sb_voice", state.voice);
      rerender();
    };
    el.appendChild(voice);
    return voice;
  }

  function appendPlayToolbar(el, rerender) {
    appendSoundToggle(el, rerender);
    appendLanguageControl(el, rerender);
    appendVoiceToggle(el, rerender);
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

  async function boot() {
    app().innerHTML = "<h1>English Skill Builder</h1><p class='muted'>Loading Grade 1…</p>";
    const [skills, pictures, score] = await Promise.all([
      fetch(PACK + "skills.json").then((r) => r.json()),
      fetch(PACK + "pictures.json").then((r) => r.json()),
      fetch(PACK + "score.json").then((r) => r.json()),
    ]);
    state.skills = skills;
    state.pictures = pictures;
    state.scoreTable = score;
    ensureVoices();
    home();
  }

  function home() {
    state.skill = null;
    state.selectedCategory = null;
    const el = app();
    el.innerHTML = "";
    el.appendChild($(`<h1 class="title-main">English Skill Builder · Grade 1</h1>`));

    const toolbar = $('<div class="toolbar row"></div>');
    appendPlayToolbar(toolbar, home);
    el.appendChild(toolbar);

    const search = $(`<input class="search" type="search" placeholder="Find a skill" autocomplete="off" />`);
    el.appendChild(search);

    const tilesHost = document.createElement("div");
    const resultsHost = document.createElement("div");
    el.appendChild(tilesHost);
    el.appendChild(resultsHost);

    const drawTiles = () => {
      tilesHost.innerHTML = "";
      const grid = $('<div class="cat-grid"></div>');
      for (const cat of CATEGORIES) {
        const n = skillsInCategory(cat.key).length;
        const tile = $(
          `<button type="button" class="cat-tile">
            <span class="cat-name">${escapeHtml(cat.label)}</span>
            <span class="cat-count muted">${n} skills</span>
          </button>`
        );
        tile.onclick = () => categoryList(cat.key);
        grid.appendChild(tile);
      }
      tilesHost.appendChild(grid);
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
        const num = s.number != null ? s.number : "";
        const cat = s.category_label || s.category || "";
        const sc = skillScore(s.skill_id);
        const b = $(
          `<button type="button" class="skill">
            <strong>${escapeHtml(num)}. ${escapeHtml(s.title_en)}</strong>
            <div class="muted skill-meta">${escapeHtml(cat)} · AI ${sc}%</div>
          </button>`
        );
        b.onclick = () => startSkill(s, { fromSearch: true });
        resultsHost.appendChild(b);
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
    const back = $(`<button type="button" class="btn small">← Categories</button>`);
    back.onclick = home;
    el.appendChild(back);
    el.appendChild($(`<h1 class="title-main">${escapeHtml(categoryLabel(catKey))}</h1>`));

    const toolbar = $('<div class="toolbar row"></div>');
    appendPlayToolbar(toolbar, () => categoryList(catKey));
    el.appendChild(toolbar);

    const list = document.createElement("div");
    el.appendChild(list);
    for (const s of skillsInCategory(catKey)) {
      const sc = skillScore(s.skill_id);
      const b = $(
        `<button type="button" class="skill">
          <strong>${escapeHtml(s.number)}. ${escapeHtml(s.title_en)}</strong>
          <div class="muted skill-score-mini">AI ${sc}%</div>
        </button>`
      );
      b.onclick = () => startSkill(s, { category: catKey });
      list.appendChild(b);
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
    state.skill = skill;
    state.selectedCategory = opts.category || state.selectedCategory || skill.category || null;
    state.fromSearch = !!opts.fromSearch;
    app().innerHTML = "<p class='muted'>Loading…</p>";
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
    const replay = $(`<button type="button" class="btn replay" aria-label="Play again">▶</button>`);
    replay.onclick = () => speak(readText, { role: "item" });
    el.appendChild(replay);

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
    if (!soundEnabled()) return;
    const sid = skill.skill_id;
    const needSkillIntro = !state.skillIntroPlayed[sid];
    if (needSkillIntro) {
      state.skillIntroPlayed[sid] = true;
      const playedMp3 = await playSkillFish(skill);
      if (gen !== audioGen) return;
      if (!soundEnabled()) return;
      if (!playedMp3) {
        const intro = skillPromptText(skill);
        if (intro) await speak(intro, { role: "skill" });
      }
    }
    if (gen !== audioGen) return;
    if (!soundEnabled()) return;
    if (itemText) await speak(itemText, { role: "item" });
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
    const s = applyScore(skillId, ok, it.tier || 2);
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

  boot().catch((e) => {
    app().innerHTML =
      "<h1>Could not load pack</h1><p class='muted'>" + escapeHtml(e.message || e) + "</p>";
  });
})();
