/**
 * Teacher button beside the mrj-auth student chip.
 * The PIN is checked on the server. It is not stored in this file.
 * study_teacher_check is the Study World action. If that action is missing,
 * the same PIN is sent as teacher_secret to teacher_list_students.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof root !== "undefined") {
    root.SB_TEACHER = api;
    if (root.document) api.install(root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BUILD = "20261027-teacher";
  const SESSION_KEY = "sb.teacher.session";
  const GAP = 8;

  let host = null;
  let installedWin = null;
  let unlocked = false;
  let anchor = null;
  let button = null;
  let panel = null;
  let strandFilter = "all";
  let query = "";
  let placeQueued = false;
  let chipWatch = null;
  let resizeObs = null;

  function buttonBox(chip, viewportWidth, buttonWidth, gap) {
    const g = Number.isFinite(gap) ? gap : GAP;
    const width = Number.isFinite(buttonWidth) ? buttonWidth : 0;
    const leftEdge = Number(chip && chip.left) || 0;
    const top = Number(chip && chip.top) || 0;
    const right = Number(viewportWidth) - leftEdge + g;
    return {
      top: top,
      right: right,
      left: leftEdge - g - width,
      gap: g,
    };
  }

  function authOf(win) {
    if (!win) return null;
    return win.MRJ_AUTH || win.MRJSignin || null;
  }

  function callFn(fn) {
    if (typeof fn !== "function") return undefined;
    try {
      return fn();
    } catch (_) {
      return undefined;
    }
  }

  function checkBody(auth, pin) {
    return {
      action: "study_teacher_check",
      pin: pin,
      id: callFn(auth && auth.student),
      token: callFn(auth && auth.token),
    };
  }

  function secretBody(auth, pin) {
    return {
      action: "teacher_list_students",
      teacher_secret: pin,
      id: callFn(auth && auth.student),
      token: callFn(auth && auth.token),
    };
  }

  async function postJson(fetchImpl, url, body) {
    const res = await fetchImpl(url, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });
    if (!res || typeof res.json !== "function") throw new Error("bad response");
    return res.json();
  }

  function failMessage(record, fallback) {
    if (record && typeof record.message === "string" && record.message.trim()) return record.message.trim();
    return fallback;
  }

  function listUnlocked(record) {
    if (!record || typeof record !== "object") return false;
    if (record.ok === true) return true;
    if (Array.isArray(record.students) || Array.isArray(record.list)) return true;
    return false;
  }

  async function verifyTeacherPin(pin, env) {
    const trimmed = String(pin == null ? "" : pin).trim();
    if (!trimmed) return { ok: false, message: "Type the teacher PIN." };
    const win = env && env.window;
    const auth = env && Object.prototype.hasOwnProperty.call(env, "auth") ? env.auth : authOf(win);
    const fetchImpl = (env && env.fetch) || (win && win.fetch) || null;
    if (auth && auth.preview) {
      if (typeof auth.teacherCheck !== "function") return { ok: false, message: "Preview has no teacher check." };
      try {
        const preview = await auth.teacherCheck(trimmed);
        if (preview && preview.ok === true) return { ok: true, message: "" };
        return { ok: false, message: failMessage(preview, "Wrong PIN.") };
      } catch (_) {
        return { ok: false, message: "Could not check the PIN. Try again." };
      }
    }
    if (!auth || !auth.ENDPOINT || typeof fetchImpl !== "function") {
      return { ok: false, message: "Sign-in is not loaded." };
    }
    let primary;
    try {
      primary = await postJson(fetchImpl, auth.ENDPOINT, checkBody(auth, trimmed));
    } catch (_) {
      return { ok: false, message: "Could not check the PIN. Try again." };
    }
    if (primary && primary.ok === true) return { ok: true, message: "" };
    if (primary && primary.error === "bad_action") {
      let secondary;
      try {
        secondary = await postJson(fetchImpl, auth.ENDPOINT, secretBody(auth, trimmed));
      } catch (_) {
        return { ok: false, message: "Could not check the PIN. Try again." };
      }
      if (secondary && secondary.error === "bad_action") {
        return { ok: false, message: "Teacher check is not available yet." };
      }
      if (listUnlocked(secondary)) return { ok: true, message: "" };
      return { ok: false, message: failMessage(secondary, "Wrong PIN.") };
    }
    return { ok: false, message: failMessage(primary, "Wrong PIN.") };
  }

  function gradeHost(ctx) {
    const source = ctx || {};
    return {
      levelId: source.levelId || "",
      levelTitle: source.levelTitle || "",
      levels: source.levels || [],
      catalog() {
        const cats = typeof source.categories === "function" ? source.categories() : [];
        const blocks = [];
        for (let i = 0; i < cats.length; i++) {
          const cat = cats[i];
          if (!cat) continue;
          const rows = typeof source.skillsIn === "function" ? source.skillsIn(cat.key) : [];
          const skills = [];
          const list = Array.isArray(rows) ? rows : [];
          for (let j = 0; j < list.length; j++) {
            const skill = list[j];
            if (!skill || !skill.skill_id) continue;
            const score = typeof source.score === "function" ? Number(source.score(skill.skill_id)) : 0;
            const title = typeof source.titleOf === "function" ? source.titleOf(skill) : String(skill.title_en || skill.skill_id);
            skills.push({ id: skill.skill_id, title: title, mastered: score >= 99 });
          }
          if (skills.length) blocks.push({ id: cat.key, label: cat.label || cat.key, skills: skills });
        }
        return blocks;
      },
      setMastered(skillId, on) {
        if (typeof source.setScore !== "function") return false;
        return source.setScore(skillId, on ? 99 : 0);
      },
      jump(skillId) {
        if (typeof source.open === "function") source.open(skillId);
      },
    };
  }

  function sessionOn(win) {
    try {
      return !!(win && win.sessionStorage && win.sessionStorage.getItem(SESSION_KEY) === "1");
    } catch (_) {
      return false;
    }
  }

  function setSession(win, on) {
    try {
      if (!win || !win.sessionStorage) return;
      if (on) win.sessionStorage.setItem(SESSION_KEY, "1");
      else win.sessionStorage.removeItem(SESSION_KEY);
    } catch (_) {}
  }

  function roleOn(doc) {
    return !!(doc && doc.body && doc.body.classList && doc.body.classList.contains("mrj-teacher"));
  }

  function teacherOn(win) {
    return unlocked || roleOn(win && win.document);
  }

  function studentLabel(win) {
    const id = callFn(authOf(win) && authOf(win).student);
    if (id) return String(id);
    const chip = win.document.getElementById("mrj-auth-student-chip");
    if (!chip) return "";
    const label = chip.querySelector(".mrj-auth-chip-label");
    return String((label ? label.textContent : chip.textContent) || "").replace(/\s+/g, " ").trim();
  }

  function blocks() {
    if (!host || typeof host.catalog !== "function") return [];
    try {
      const rows = host.catalog();
      return Array.isArray(rows) ? rows : [];
    } catch (_) {
      return [];
    }
  }

  function levels() {
    if (!host || !Array.isArray(host.levels)) return [];
    return host.levels;
  }

  function el(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function queuePlace(win) {
    if (placeQueued) return;
    placeQueued = true;
    const raf = win.requestAnimationFrame || function (fn) { return win.setTimeout(fn, 16); };
    raf(function () {
      placeQueued = false;
      place(win);
    });
  }

  function place(win) {
    if (!anchor || !button || !panel) return;
    const doc = win.document;
    const chip = doc.getElementById("mrj-auth-student-chip");
    const visible = !!(chip && !chip.hidden && chip.getClientRects && chip.getClientRects().length);
    if (!visible) {
      if (!anchor.hidden) anchor.hidden = true;
      if (!panel.hidden) panel.hidden = true;
      button.setAttribute("aria-expanded", "false");
      return;
    }
    if (anchor.hidden) anchor.hidden = false;
    if (chip !== chipWatch && win.ResizeObserver) {
      chipWatch = chip;
      if (resizeObs) resizeObs.disconnect();
      resizeObs = new win.ResizeObserver(function () { queuePlace(win); });
      resizeObs.observe(chip);
    }
    const rect = chip.getBoundingClientRect();
    const viewport = (doc.documentElement && doc.documentElement.clientWidth) || win.innerWidth || 0;
    const box = buttonBox({ top: rect.top, left: rect.left }, viewport, button.getBoundingClientRect().width || 0, GAP);
    const top = box.top + "px";
    const right = box.right + "px";
    const height = Math.round(rect.height) + "px";
    if (anchor.style.top !== top) anchor.style.top = top;
    if (anchor.style.right !== right) anchor.style.right = right;
    if (anchor.style.left !== "auto") anchor.style.left = "auto";
    if (height !== "0px" && anchor.style.height !== height) anchor.style.height = height;
    if (!panel.hidden) {
      const panelTop = Math.round(rect.bottom + GAP) + "px";
      const panelRight = Math.max(8, Math.round(viewport - rect.right)) + "px";
      if (panel.style.top !== panelTop) panel.style.top = panelTop;
      if (panel.style.right !== panelRight) panel.style.right = panelRight;
    }
  }

  function closePanel() {
    if (!panel || !button) return;
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  function markUnlocked(win) {
    unlocked = true;
    setSession(win, true);
    if (win.document.body) win.document.body.classList.add("sb-teacher");
    if (button) {
      button.classList.add("is-on");
      button.setAttribute("aria-pressed", "true");
    }
  }

  function lockDown(win) {
    unlocked = false;
    setSession(win, false);
    const doc = win.document;
    if (doc.body && !roleOn(doc)) doc.body.classList.remove("sb-teacher");
    if (button) {
      const on = teacherOn(win);
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    }
    closePanel();
  }

  function filteredBlocks() {
    const q = query.trim().toLowerCase();
    const source = blocks();
    const out = [];
    for (let i = 0; i < source.length; i++) {
      const block = source[i];
      if (!block || !Array.isArray(block.skills)) continue;
      if (strandFilter !== "all" && block.id !== strandFilter) continue;
      const skills = [];
      for (let j = 0; j < block.skills.length; j++) {
        const skill = block.skills[j];
        if (!skill) continue;
        const title = String(skill.title || "");
        const id = String(skill.id || "");
        if (q && title.toLowerCase().indexOf(q) === -1 && id.toLowerCase().indexOf(q) === -1) continue;
        skills.push(skill);
      }
      if (skills.length) out.push({ id: block.id, label: block.label, skills: skills });
    }
    return out;
  }

  function renderList(win) {
    if (!panel) return;
    const doc = win.document;
    const list = panel.querySelector(".sb-teacher-list");
    const empty = panel.querySelector(".sb-teacher-empty");
    if (!list) return;
    list.textContent = "";
    const shown = filteredBlocks();
    let count = 0;
    for (let i = 0; i < shown.length; i++) {
      const block = shown[i];
      for (let j = 0; j < block.skills.length; j++) {
        const skill = block.skills[j];
        count += 1;
        const item = el(doc, "li", "sb-teacher-skill" + (skill.mastered ? " is-mastered" : ""));
        item.appendChild(el(doc, "span", "sb-teacher-skill-name", skill.title || skill.id));
        item.appendChild(el(doc, "span", "sb-teacher-skill-state", skill.mastered ? "Mastered" : "Not mastered"));
        const acts = el(doc, "span", "sb-teacher-skill-acts");
        if (host && typeof host.jump === "function") {
          const jump = el(doc, "button", "sb-teacher-mini", "Jump");
          jump.type = "button";
          jump.addEventListener("click", function () { host.jump(skill.id); });
          acts.appendChild(jump);
        }
        if (host && typeof host.setMastered === "function") {
          const mark = el(doc, "button", "sb-teacher-mini", skill.mastered ? "Clear mastery" : "Mark mastered");
          mark.type = "button";
          mark.addEventListener("click", function () { saveMastery(win, skill.id, !skill.mastered); });
          acts.appendChild(mark);
        }
        item.appendChild(acts);
        list.appendChild(item);
      }
    }
    if (empty) empty.hidden = count > 0;
  }

  async function saveMastery(win, skillId, on) {
    if (!host || typeof host.setMastered !== "function" || !panel) return;
    const status = panel.querySelector(".sb-teacher-status");
    if (status) status.textContent = "Saving…";
    let result = false;
    try {
      result = await host.setMastered(skillId, !!on);
    } catch (_) {
      result = false;
    }
    if (status) {
      if (result === true) status.textContent = "Saved.";
      else if (result === "local") status.textContent = "Saved on this device. It will sync when online.";
      else status.textContent = "Could not save.";
    }
    renderList(win);
  }

  function drawPin(win) {
    const doc = win.document;
    panel.textContent = "";
    panel.setAttribute("aria-labelledby", "sb-teacher-title");
    const title = el(doc, "h2", "sb-teacher-title", "Teacher");
    title.id = "sb-teacher-title";
    panel.appendChild(title);
    panel.appendChild(el(doc, "p", "sb-teacher-lead", "Enter the teacher PIN."));
    const form = el(doc, "form", "sb-teacher-form");
    const field = el(doc, "label", "sb-teacher-field");
    field.appendChild(el(doc, "span", "sb-teacher-label", "PIN"));
    const input = el(doc, "input", "sb-teacher-pin");
    input.type = "password";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.autocapitalize = "none";
    input.setAttribute("autocorrect", "off");
    input.setAttribute("aria-label", "Teacher PIN");
    field.appendChild(input);
    form.appendChild(field);
    const err = el(doc, "p", "sb-teacher-error", "");
    err.id = "sb-teacher-error";
    err.setAttribute("role", "alert");
    form.appendChild(err);
    const acts = el(doc, "div", "sb-teacher-acts");
    const ok = el(doc, "button", "sb-teacher-go", "Unlock");
    ok.type = "submit";
    const cancel = el(doc, "button", "sb-teacher-quiet", "Close");
    cancel.type = "button";
    acts.appendChild(ok);
    acts.appendChild(cancel);
    form.appendChild(acts);
    panel.appendChild(form);
    cancel.addEventListener("click", function () { closePanel(); });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (ok.disabled) return;
      err.textContent = "Checking…";
      ok.disabled = true;
      verifyTeacherPin(input.value, { window: win, fetch: win.fetch }).then(function (result) {
        ok.disabled = false;
        if (result && result.ok) {
          markUnlocked(win);
          drawTools(win);
          return;
        }
        input.value = "";
        err.textContent = (result && result.message) || "Wrong PIN.";
        input.focus();
      });
    });
    input.focus();
  }

  function drawTools(win) {
    const doc = win.document;
    panel.textContent = "";
    panel.setAttribute("aria-labelledby", "sb-teacher-title");
    const title = el(doc, "h2", "sb-teacher-title", "Teacher");
    title.id = "sb-teacher-title";
    panel.appendChild(title);
    const who = studentLabel(win);
    if (who) panel.appendChild(el(doc, "p", "sb-teacher-who", who));
    panel.appendChild(el(doc, "p", "sb-teacher-lead", "Jump, or mark mastered to skip."));

    const levelRows = levels();
    if (levelRows.length) {
      const field = el(doc, "label", "sb-teacher-field");
      field.appendChild(el(doc, "span", "sb-teacher-label", "Level"));
      const select = el(doc, "select", "sb-teacher-select");
      for (let i = 0; i < levelRows.length; i++) {
        const level = levelRows[i];
        const option = el(doc, "option", "", level.title || level.id);
        option.value = level.id;
        if (host && level.id === host.levelId) option.selected = true;
        select.appendChild(option);
      }
      select.addEventListener("change", function () {
        const id = select.value;
        if (host && id === host.levelId) return;
        for (let i = 0; i < levelRows.length; i++) {
          if (levelRows[i].id === id && levelRows[i].href) {
            win.location.href = levelRows[i].href;
            return;
          }
        }
      });
      field.appendChild(select);
      panel.appendChild(field);
    }

    const catalog = blocks();
    if (catalog.length) {
      const field = el(doc, "label", "sb-teacher-field");
      field.appendChild(el(doc, "span", "sb-teacher-label", "Strand"));
      const select = el(doc, "select", "sb-teacher-select");
      const all = el(doc, "option", "", "All strands");
      all.value = "all";
      select.appendChild(all);
      let found = strandFilter === "all";
      for (let i = 0; i < catalog.length; i++) {
        const block = catalog[i];
        const option = el(doc, "option", "", block.label || block.id);
        option.value = block.id;
        if (block.id === strandFilter) {
          option.selected = true;
          found = true;
        }
        select.appendChild(option);
      }
      if (!found) strandFilter = "all";
      select.addEventListener("change", function () {
        strandFilter = select.value || "all";
        renderList(win);
      });
      field.appendChild(select);
      panel.appendChild(field);

      const search = el(doc, "input", "sb-teacher-search");
      search.type = "search";
      search.placeholder = "Find a skill";
      search.value = query;
      search.setAttribute("aria-label", "Find a skill");
      search.autocomplete = "off";
      search.addEventListener("input", function () {
        query = search.value;
        renderList(win);
      });
      panel.appendChild(search);
    }

    const status = el(doc, "p", "sb-teacher-status", "");
    status.setAttribute("role", "status");
    panel.appendChild(status);
    const empty = el(doc, "p", "sb-teacher-empty", catalog.length ? "No skills match." : "No skills on this page. Choose a level to jump.");
    panel.appendChild(empty);
    panel.appendChild(el(doc, "ul", "sb-teacher-list"));
    const acts = el(doc, "div", "sb-teacher-acts");
    const lock = el(doc, "button", "sb-teacher-quiet", "Lock");
    lock.type = "button";
    lock.addEventListener("click", function () { lockDown(win); });
    const close = el(doc, "button", "sb-teacher-quiet", "Close");
    close.type = "button";
    close.addEventListener("click", function () { closePanel(); });
    acts.appendChild(lock);
    acts.appendChild(close);
    panel.appendChild(acts);
    renderList(win);
  }

  function openPanel(win) {
    if (!panel || !button) return;
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    place(win);
    if (teacherOn(win)) drawTools(win);
    else drawPin(win);
  }

  function redrawIfOpen(win) {
    if (!panel || panel.hidden || !teacherOn(win)) return;
    const active = win.document.activeElement;
    const search = active && active.classList && active.classList.contains("sb-teacher-search");
    const typed = search ? active.value : null;
    drawTools(win);
    if (typed != null) {
      const next = panel.querySelector(".sb-teacher-search");
      if (next) {
        next.focus();
        const setRange = next.setSelectionRange;
        if (typeof setRange === "function") {
          try { setRange.call(next, typed.length, typed.length); } catch (_) {}
        }
      }
    }
  }

  function syncChrome(win) {
    const on = teacherOn(win);
    if (on && win.document.body) win.document.body.classList.add("sb-teacher");
    if (button) {
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function install(win) {
    if (!win || !win.document) return;
    if (installedWin === win && anchor) return;
    installedWin = win;
    const doc = win.document;
    if (sessionOn(win)) unlocked = true;
    const build = function () {
      if (!doc.body || anchor) return;
      anchor = el(doc, "div", "sb-teacher-anchor mrj-auth");
      anchor.id = "sb-teacher-anchor";
      anchor.hidden = true;
      button = el(doc, "button", "sb-teacher-btn", "Teacher");
      button.type = "button";
      button.id = "sb-teacher-btn";
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-pressed", "false");
      panel = el(doc, "div", "sb-teacher-panel");
      panel.id = "sb-teacher-panel";
      panel.hidden = true;
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "false");
      anchor.appendChild(button);
      anchor.appendChild(panel);
      doc.body.appendChild(anchor);
      button.addEventListener("click", function () {
        if (anchor.hidden) return;
        if (!panel.hidden) closePanel();
        else openPanel(win);
      });
      doc.addEventListener("mrj-teacher", function () {
        if (doc.body) doc.body.classList.add("sb-teacher");
        syncChrome(win);
        if (!panel.hidden) drawTools(win);
      });
      doc.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closePanel();
      });
      doc.addEventListener("pointerdown", function (event) {
        if (!panel || panel.hidden || !anchor) return;
        if (event.target && anchor.contains(event.target)) return;
        closePanel();
      });
      win.addEventListener("resize", function () { queuePlace(win); });
      win.addEventListener("scroll", function () { queuePlace(win); }, true);
      if (doc.body && win.MutationObserver) {
        const observer = new win.MutationObserver(function () { queuePlace(win); });
        observer.observe(doc.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["hidden", "class", "style"],
        });
      }
      syncChrome(win);
      queuePlace(win);
    };
    if (doc.body) build();
    else doc.addEventListener("DOMContentLoaded", build);
  }

  function mount(next) {
    host = next || null;
    if (installedWin) redrawIfOpen(installedWin);
  }

  function refresh() {
    if (installedWin) redrawIfOpen(installedWin);
  }

  function isUnlocked() {
    return teacherOn(installedWin);
  }

  return {
    BUILD: BUILD,
    SESSION_KEY: SESSION_KEY,
    buttonBox: buttonBox,
    verifyTeacherPin: verifyTeacherPin,
    checkBody: checkBody,
    secretBody: secretBody,
    gradeHost: gradeHost,
    install: install,
    mount: mount,
    refresh: refresh,
    isUnlocked: isUnlocked,
  };
});
