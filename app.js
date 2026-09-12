(() => {
  const PACK = "./pack/";
  const state = {
    skills: [],
    pictures: {},
    scoreTable: null,
    lang: "en",
    voice: localStorage.getItem("sb_voice") || "puck",
    skill: null,
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
      const t = String(it.tier || 2);
      const w = mix[t] || mix["2"] || 0.2;
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

  async function speak(text) {
    const word = String(text || "").trim();
    if (!word) return;
    const sid = state.voice === "bella" ? 0 : 1;
    const p = ttsPlugin();
    try {
      if (p && p.stop) p.stop().catch(() => {});
      if (p && p.speak) {
        await p.speak({ text: word, sid, gender: state.voice === "bella" ? "female" : "male" });
        return;
      }
    } catch (_) {}
    try {
      const u = new SpeechSynthesisUtterance(word);
      u.lang = "en-US";
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (_) {}
  }

  function lemmas(it) {
    const media = it.media || [];
    const arr = Array.isArray(media) ? media : [media];
    return arr.map((m) => (m && m.lemma) || "").filter(Boolean);
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
    home();
  }

  function home() {
    state.skill = null;
    const el = app();
    el.innerHTML = "";
    el.appendChild($(`<h1>English Skill Builder</h1>`));
    el.appendChild($(`<p class="muted">W.A.I.T. 4 LANGUAGES · Grade 1 · Seed · ${state.skills.length} skills</p>`));
    const row = $('<div class="row"></div>');
    const lang = $(`<button class="btn small">${state.lang === "ko" ? "한국어" : "English"}</button>`);
    lang.onclick = () => {
      state.lang = state.lang === "ko" ? "en" : "ko";
      home();
    };
    const voice = $(
      `<button class="btn small">Voice: ${state.voice === "bella" ? "Bella" : "Puck"}</button>`
    );
    voice.onclick = () => {
      state.voice = state.voice === "bella" ? "puck" : "bella";
      localStorage.setItem("sb_voice", state.voice);
      home();
    };
    row.appendChild(lang);
    row.appendChild(voice);
    el.appendChild(row);
    const search = $(`<input class="search" placeholder="Find a skill" />`);
    el.appendChild(search);
    const list = document.createElement("div");
    el.appendChild(list);
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = "";
      for (const s of state.skills) {
        if (q && !String(s.title_en || "").toLowerCase().includes(q)) continue;
        const sc = skillScore(s.skill_id);
        const b = $(
          `<button class="skill"><strong>${escapeHtml(s.title_en)}</strong><div class="muted">${s.n_items} questions · score ${sc}</div></button>`
        );
        b.onclick = () => startSkill(s);
        list.appendChild(b);
      }
    };
    search.oninput = draw;
    draw();
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

  async function startSkill(skill) {
    state.skill = skill;
    app().innerHTML = "<p class='muted'>Loading…</p>";
    state.items = await loadItems(skill);
    if (!state.items.length) {
      app().innerHTML = "";
      const back = $(`<button class="btn small">← Skills</button>`);
      back.onclick = home;
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

  function showItem() {
    const skill = state.skill;
    const it = currentItem();
    if (!it) {
      home();
      return;
    }
    state.locked = false;
    state.orderPicked = [];
    const el = app();
    el.innerHTML = "";
    const back = $(`<button class="btn small">← Skills</button>`);
    back.onclick = home;
    el.appendChild(back);
    el.appendChild($(`<div class="muted">${escapeHtml(skill.title_en)}</div>`));
    el.appendChild($(`<div class="score">${skillScore(skill.skill_id)}</div>`));
    const prompt = t(skill.prompt_en, skill.prompt_ko);
    const todo = t(skill.what_to_do_en, skill.what_to_do_ko);
    el.appendChild($(`<h2>${escapeHtml(prompt)}</h2>`));
    el.appendChild($(`<p class="muted">${escapeHtml(todo)}</p>`));

    const type = it.item_type || "abcd";
    const hideStem = type === "listen_tap";
    if (!hideStem && it.stem) el.appendChild($(`<div class="stem">${escapeHtml(it.stem)}</div>`));
    if (hideStem) {
      const hear = $(`<button class="btn primary">▶ Listen</button>`);
      const word = lemmas(it)[0] || (it.choices || [])[it.answer_index] || "";
      hear.onclick = () => speak(word);
      el.appendChild(hear);
      setTimeout(() => speak(word), 300);
    }

    if (type === "word_to_picture") renderPicChoices(el, it);
    else if (type === "order_words" || type === "order_sentences") renderOrder(el, it);
    else renderChoices(el, it);

    const fb = $(`<div class="feedback" id="fb"></div>`);
    el.appendChild(fb);
    const next = $(`<button class="btn primary" id="next" style="display:none">Next</button>`);
    next.onclick = () => {
      state.idx += 1;
      if (state.idx >= state.queue.length) {
        state.queue = servePool(state.items, skill.skill_id);
        state.idx = 0;
      }
      showItem();
    };
    el.appendChild(next);
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
      const b = $(`<button class="choice">${escapeHtml(c)}</button>`);
      b.onclick = () => gradeIndex(i, it, el.querySelectorAll(".choice"));
      el.appendChild(b);
    });
  }

  function renderPicChoices(el, it) {
    const wrap = $("<div class='pics'></div>");
    const choices = it.choices || [];
    const lems = lemmas(it);
    choices.forEach((c, i) => {
      const lem = lems[i] || c;
      const cell = $("<button class='picwrap'></button>");
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
      const ch = $(`<button class="chip" data-i="${i}">${escapeHtml(it.choices[i])}</button>`);
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
    const s = applyScore(state.skill.skill_id, ok, it.tier || 2);
    const fb = document.getElementById("fb");
    if (fb) fb.textContent = ok ? "Yes  ·  " + s : "Not that  ·  " + s;
    const n = document.getElementById("next");
    if (n) n.style.display = "block";
    const scoreEl = document.querySelector(".score");
    if (scoreEl) scoreEl.textContent = String(s);
  }

  boot().catch((e) => {
    app().innerHTML =
      "<h1>Could not load pack</h1><p class='muted'>" + escapeHtml(e.message || e) + "</p>";
  });
})();
