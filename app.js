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

  function explainText(it) {
    if (state.lang === "ko" && it.explain_ko) return String(it.explain_ko).trim();
    if (it.explain_en) return String(it.explain_en).trim();
    const choices = it.choices || [];
    const idx = it.answer_index;
    const correct = typeof idx === "number" && choices[idx] ? choices[idx] : answerWord(it);
    return "The answer is " + correct + ".";
  }

  function skillsInCategory(key) {
    return state.skills
      .filter((s) => s.category === key)
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
    showItem();
  }

  function currentItem() {
    return state.queue[state.idx];
  }

  function playBack() {
    if (state.fromSearch) home();
    else if (state.selectedCategory) categoryList(state.selectedCategory);
    else home();
  }

  function showItem() {
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

    appendScoreBar(el, skill.skill_id);

    const top = $('<div class="play-top row"></div>');
    const back = $(`<button type="button" class="btn small">← Back</button>`);
    back.onclick = playBack;
    top.appendChild(back);
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
    const next = $(`<button type="button" class="btn primary" id="next" style="display:none">Next</button>`);
    next.onclick = () => {
      state.idx += 1;
      if (state.idx >= state.queue.length) {
        state.queue = servePool(state.items, skill.skill_id);
        state.idx = 0;
      }
      showItem();
    };
    el.appendChild(next);

    if (soundEnabled()) {
      setTimeout(() => playItemAudio(skill, readText), 300);
    }
  }

  async function playItemAudio(skill, itemText) {
    const sid = skill.skill_id;
    const needSkillIntro = !state.skillIntroPlayed[sid];
    if (needSkillIntro) {
      state.skillIntroPlayed[sid] = true;
      const intro = skillPromptText(skill);
      if (intro) await speak(intro, { role: "skill" });
    }
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
    const ex = document.getElementById("explain");
    if (ex) {
      if (ok) {
        ex.hidden = true;
        ex.textContent = "";
      } else {
        ex.hidden = false;
        ex.textContent = explainText(it);
      }
    }
    const n = document.getElementById("next");
    if (n) n.style.display = "block";
    refreshScoreBar(skillId);
  }

  boot().catch((e) => {
    app().innerHTML =
      "<h1>Could not load pack</h1><p class='muted'>" + escapeHtml(e.message || e) + "</p>";
  });
})();
