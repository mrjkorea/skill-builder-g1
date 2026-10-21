/**
 * Seed, Roots, and Sprout player.
 * Reads each level's questions.jsonl and manifest.json. No hard-coded counts.
 * Sound is pre-made mp3 only. Progress is cloud-only through MRJ sign-in.
 */
(function (root) {
  "use strict";

  const COLORS = {
    phonics: "#0ea5e9",
    reading: "#a855f7",
    grammar: "#f97316",
    vocabulary: "#22c55e",
  };
  const STRAND_ORDER = ["phonics", "reading", "grammar", "vocabulary"];

  function $(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  function appEl() {
    return document.getElementById("app");
  }

  function parseJsonl(text) {
    const out = [];
    const lines = String(text || "").split(/\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        out.push(JSON.parse(line));
      } catch (err) {
        const e = new Error("questions.jsonl line " + (i + 1) + " is not valid JSON");
        e.cause = err;
        throw e;
      }
    }
    return out;
  }

  function strandFor(q, title) {
    if (q && q.strand) return String(q.strand);
    const s = String((q && q.skill_id) || "") + " " + String(title || "");
    const hay = s.toLowerCase();
    if (/phon|vowel|digraph|blend|syllab|rhyme|diphthong|consonant|schwa|trigraph|silent/.test(hay)) return "phonics";
    if (/comma|contract|pronoun|verb|noun|adject|adverb|sentence|capital|article|plural|possess|tense|prefix|suffix|punctuat/.test(hay))
      return "grammar";
    if (/synonym|antonym|context|vocab|dictionary|meaning|homophone|category|affix/.test(hay)) return "vocabulary";
    return "reading";
  }

  function labelStrand(key) {
    const k = String(key || "");
    if (!k) return "Skills";
    return k.charAt(0).toUpperCase() + k.slice(1);
  }

  root.SB_LEVELS = {
    start(opts) {
      const level = String((opts && opts.level) || "").trim();
      const title = String((opts && opts.title) || level || "Level");
      const program = String((opts && opts.program) || "skill-builder-" + level);
      const Progress = root.SB_LEVEL_PROGRESS;
      const Pictures = root.SB_PICTURES;
      const Nav = root.SB_SKILL_NAV;
      const UI = root.SB_LEVEL_UI;
      const AudioUrl = root.SB_AUDIO_URL;
      if (!level) throw new Error("level required");
      if (!Progress || !Pictures || !Nav || !UI || !AudioUrl) throw new Error("level helpers missing");
      const launchSkillId = Nav.parseSkillParam(root.location.href);

      let manifest = { intros: {}, questions: {} };
      let skills = [];
      let newPics = {};
      let oldPics = {};
      let progress = Progress.emptyProgress(level);
      let studentId = "";
      let packReady = false;
      let booted = false;
      let authGen = 0;
      let contentReady = false;
      let contentError = "";
      let soundOn = true;
      let gestureOk = false;
      let audio = null;
      let generation = 0;
      let contentPromise = null;
      const logged = new Set();
      const streaks = {};
      let view = { name: "home", strand: null, skill: null, index: 0, locked: false };

      function warnOnce(kind, label) {
        const key = kind + "\n" + String(label || "");
        if (logged.has(key)) return;
        logged.add(key);
        console.warn("Missing " + kind + ":", label || "");
      }

      function stopAudio() {
        UI.unbindQuestionKeys();
        generation += 1;
        if (!audio) return;
        try {
          audio.pause();
          audio.removeAttribute("src");
          audio.load();
        } catch (_) {}
        audio = null;
      }

      function playUrl(url, gen) {
        if (audio) {
          try {
            audio.pause();
            audio.removeAttribute("src");
            audio.load();
          } catch (_) {}
          audio = null;
        }
        return new Promise((resolve) => {
          if (gen !== generation) {
            resolve("stopped");
            return;
          }
          const el = new Audio(url);
          el.setAttribute("data-sb-clip", url);
          audio = el;
          let settled = false;
          const done = (status) => {
            if (settled) return;
            settled = true;
            resolve(gen === generation ? status : "stopped");
          };
          el.addEventListener("ended", () => done("ended"));
          el.addEventListener("error", () => done("error"));
          const p = el.play();
          if (p && typeof p.then === "function") p.then(() => {}).catch(() => done("blocked"));
        });
      }

      function introOf(skillId) {
        const row = manifest.intros && manifest.intros[skillId];
        return row && row.file ? row : null;
      }

      function clipForText(text) {
        if (text == null) return null;
        const row = manifest.questions && manifest.questions[text];
        return row && row.file ? row.file : null;
      }

      function clipUrl(file) {
        return AudioUrl.resolveClipUrl(manifest, file);
      }

      function questionClip(q) {
        return clipForText(q && q.prompt);
      }

      function soundClip(q) {
        const needs = String((q && q.needs) || "");
        if (!/^sound:/i.test(needs)) return null;
        const word = needs.slice(needs.indexOf(":") + 1).trim();
        return clipForText(word);
      }

      function pictureFor(q) {
        const subject = Pictures.subjectOf(q);
        if (!subject) return null;
        const resolved = Pictures.resolve(q, newPics, oldPics);
        if (!resolved) {
          warnOnce("picture", subject);
          return null;
        }
        if (resolved.kind === "new") return "../pictures/" + resolved.file;
        return "../../grade1/pack/" + resolved.file;
      }

      function skillById(id) {
        return skills.find((s) => s.skill_id === id) || null;
      }

      function scoreOf(skillId) {
        return Progress.skillScore(progress, skillId);
      }

      function appendGoToNextSkill(el, skill, sameTab) {
        if (!el || el.querySelector(".next-skill-btn")) return;
        const next = Progress.nextSkillInOrder(skills, skill.skill_id);
        if (!next) return;
        const go = $("button", "btn primary next-skill-btn");
        go.type = "button";
        go.textContent = "Go to next skill → " + next.title;
        go.onclick = () => {
          if (sameTab) root.location.href = Nav.skillPageUrl(next.skill_id);
          else root.open(Nav.skillPageUrl(next.skill_id), "_blank", "noopener,noreferrer");
        };
        el.appendChild(go);
      }

      async function syncProgressFromCloud() {
        if (!studentId || !packReady) return;
        const auth = root.MRJ_AUTH;
        if (!auth || typeof auth.loadPack !== "function") return;
        try {
          const res = await auth.loadPack(program);
          if (!res || !res.ok) return;
          const remote = Progress.parseProgress(res.progress_json, level);
          const merged = Progress.mergeProgress(progress, remote, level);
          if (JSON.stringify(merged) === JSON.stringify(progress)) return;
          progress = merged;
          if (view.name === "home") renderHome();
          else if (view.name === "question" && view.skill) showQuestion(view.skill, view.index);
          else if (view.name === "strand" && view.strand) renderStrand(view.strand);
        } catch (_) {}
      }

      function statOf(skillId, which) {
        const st = progress.stats[skillId] || { correct: 0, wrong: 0 };
        return Number(st[which]) || 0;
      }

      function markDirtySave() {
        const rootEl = appEl();
        if (rootEl) rootEl.dataset.progress = packReady ? "saving" : "pending";
        if (!packReady || !root.MRJ_AUTH || typeof root.MRJ_AUTH.savePack !== "function") return Promise.resolve(false);
        return root.MRJ_AUTH.savePack(program, JSON.stringify(progress))
          .then((res) => {
            const ok = !!(res && res.ok);
            const el = appEl();
            if (el) el.dataset.progress = ok ? "saved" : "error";
            return ok;
          })
          .catch(() => {
            const el = appEl();
            if (el) el.dataset.progress = "error";
            return false;
          });
      }

      function logAnswer(skillId, q, correct, smartScore) {
        const scores = root.MRJ_SCORES;
        if (!studentId || !scores || typeof scores.post !== "function") return;
        const qid = q && q.id != null ? String(q.id) : "";
        const base = {
          student: studentId,
          program: program,
          appName: "MRJ Skill Builder " + title,
          source: program,
          bookTitle: "English Skill Builder " + title,
          unitTitle: skillId || "",
        };
        scores.post({
          ...base,
          itemId: level + ":" + skillId + ":" + qid,
          itemType: "question",
          scoreValue: correct ? 1 : 0,
          scoreMax: 1,
          correctness: correct ? "correct" : "incorrect",
          metadata: { smart_score: smartScore },
        });
        const auth = root.MRJ_AUTH;
        if (auth && typeof auth.noteScore === "function") {
          auth.noteScore({
            program: program,
            itemId: level + ":" + skillId,
            scoreValue: smartScore,
            scoreMax: 100,
            scorePct: smartScore,
            localDate: scores.localDate ? scores.localDate() : "",
          });
        }
        scores.post({
          ...base,
          itemId: level + ":" + skillId,
          itemType: "skill_score",
          scoreValue: smartScore,
          scoreMax: 100,
          scorePct: smartScore,
        });
      }

      function optionsOf(q) {
        return Array.isArray(q && q.options) ? q.options.filter((o) => o != null && String(o) !== "") : [];
      }

      function explainOf(q) {
        if (!q) return "";
        if (q.explanation != null && String(q.explanation) !== "") return String(q.explanation);
        if (q.explain != null && String(q.explain) !== "") return String(q.explain);
        return "";
      }

      async function playQuestion(skill, q, gen) {
        const intro = introOf(skill.skill_id);
        if (!skill.introPlayed) {
          if (!intro) {
            skill.introPlayed = true;
            warnOnce("clip", "intro " + skill.skill_id);
          } else if (soundOn && gestureOk && gen === generation) {
            const status = await playUrl(clipUrl(intro.file), gen);
            if (status === "error") {
              skill.introPlayed = true;
              warnOnce("clip", "intro " + skill.skill_id);
            } else if (status !== "blocked") skill.introPlayed = true;
          }
        }
        if (gen !== generation) return;
        const qFile = questionClip(q);
        const sFile = soundClip(q);
        if (!qFile) warnOnce("clip", (q && q.id) || (q && q.prompt) || "");
        if (String((q && q.needs) || "").toLowerCase().startsWith("sound:") && !sFile) {
          warnOnce("clip", "sound " + ((q && q.id) || ""));
        }
        if (!soundOn || !gestureOk) return;
        const files = [];
        if (qFile) files.push(qFile);
        if (sFile && sFile !== qFile) files.push(sFile);
        for (const file of files) {
          if (gen !== generation || !soundOn) return;
          const status = await playUrl(clipUrl(file), gen);
          if (status === "error") warnOnce("clip", file);
        }
      }

      function renderHome() {
        stopAudio();
        view = { name: "home", strand: null, skill: null, index: 0, locked: false };
        const el = appEl();
        UI.setViewMode(el, "home");
        el.innerHTML = "";

        const header = $("header", "home-header");
        header.appendChild($("h1", "title-main", "Skill Builder · " + title));
        const back = $("a", "btn small levels-link", "← All levels");
        back.href = "../../";
        header.appendChild(back);
        const bar = $("div", "toolbar row");
        if (studentId) bar.appendChild($("span", "home-user", studentId));
        const out = $("button", "btn small", "Sign out");
        out.type = "button";
        out.onclick = () => {
          markDirtySave();
          studentId = "";
          packReady = false;
          progress = Progress.emptyProgress(level);
          if (root.MRJ_AUTH && typeof root.MRJ_AUTH.signOut === "function") root.MRJ_AUTH.signOut();
          el.innerHTML = "";
          const gate = document.getElementById("mrj-auth-gate");
          if (gate) gate.hidden = false;
          document.documentElement.classList.add("mrj-auth-locked");
        };
        bar.appendChild(out);
        const sound = $("button", "btn small sound-toggle", soundOn ? "Sound on" : "Sound off");
        sound.type = "button";
        sound.onclick = () => {
          gestureOk = true;
          soundOn = !soundOn;
          if (!soundOn) stopAudio();
          renderHome();
        };
        bar.appendChild(sound);
        header.appendChild(bar);
        el.appendChild(header);

        const layout = $("div", "home-layout");
        const side = $("div", "home-side");
        const main = $("div", "home-main");

        const masteredCount = skills.filter((s) => Progress.isSkillMastered(scoreOf(s.skill_id))).length;
        const indexHead = $("div", "skill-index-head");
        indexHead.appendChild($("h2", "skill-index-title", "Skills"));
        indexHead.appendChild($("p", "index-lead", masteredCount + " of " + skills.length + " done"));
        side.appendChild(indexHead);
        side.appendChild($("p", "home-hint", "Click a skill to open it in a new tab. This list stays open so you can pick the next one."));

        const last = progress.last;
        const lastSkill = last && skillById(last.skill_id);
        if (lastSkill && !Progress.isSkillMastered(scoreOf(lastSkill.skill_id))) {
          const resume = document.createElement("a");
          resume.className = "btn primary resume-btn";
          resume.href = Nav.skillPageUrl(lastSkill.skill_id);
          resume.target = "_blank";
          resume.rel = "noopener noreferrer";
          resume.textContent = "Continue: " + lastSkill.title;
          side.appendChild(resume);
        }

        const search = document.createElement("input");
        search.className = "search";
        search.type = "search";
        search.placeholder = "Find a skill";
        search.autocomplete = "off";
        side.appendChild(search);

        const host = $("div", "skill-index-list");
        main.appendChild(host);
        layout.appendChild(side);
        layout.appendChild(main);
        el.appendChild(layout);

        const strandsInOrder = () => {
          const strands = [];
          const seen = new Set();
          for (const key of STRAND_ORDER) {
            if (skills.some((s) => s.strand === key)) {
              strands.push(key);
              seen.add(key);
            }
          }
          for (const s of skills) {
            if (!seen.has(s.strand)) {
              strands.push(s.strand);
              seen.add(s.strand);
            }
          }
          return strands;
        };

        const draw = () => {
          host.innerHTML = "";
          const q = search.value.trim().toLowerCase();
          const show = q
            ? skills.filter((s) => s.title.toLowerCase().includes(q) || s.skill_id.toLowerCase().includes(q))
            : skills;
          if (!show.length) {
            host.appendChild($("p", "muted", "No skills match."));
            return;
          }
          if (!q) {
            for (const strand of strandsInOrder()) {
              const list = show.filter((s) => s.strand === strand);
              if (!list.length) continue;
              const doneInStrand = list.filter((s) => Progress.isSkillMastered(scoreOf(s.skill_id))).length;
              const head = $("div", "strand-block");
              head.style.setProperty("--section-color", COLORS[strand] || "#38bdf8");
              const label = $("div", "strand-label");
              label.appendChild($("span", "strand-name", labelStrand(strand)));
              label.appendChild($("span", "strand-meta", doneInStrand + "/" + list.length + " done"));
              head.appendChild(label);
              const grid = $("div", "skill-index-grid");
              for (const s of list) grid.appendChild(skillIndexLink(s));
              head.appendChild(grid);
              host.appendChild(head);
            }
            return;
          }
          const grid = $("div", "skill-index-grid");
          for (const s of show) grid.appendChild(skillIndexLink(s));
          host.appendChild(grid);
        };
        search.oninput = draw;
        draw();
      }

      function skillIndexLink(s) {
        const pct = scoreOf(s.skill_id);
        const mastered = Progress.isSkillMastered(pct);
        const a = document.createElement("a");
        a.className = "skill-row" + (mastered ? " skill-done" : "");
        a.href = Nav.skillPageUrl(s.skill_id);
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        const top = $("span", "skill-row-top");
        top.appendChild($("span", "skill-name", s.title));
        if (mastered) top.appendChild($("span", "skill-done-badge", "Done"));
        else top.appendChild($("span", "skill-pct", pct + "%"));
        a.appendChild(top);
        const track = $("div", "skill-progress-track");
        const fill = $("div", "skill-progress-fill");
        fill.style.width = pct + "%";
        if (mastered) fill.classList.add("full");
        track.appendChild(fill);
        a.appendChild(track);
        a.appendChild($("span", "skill-meta", s.questions.length + " questions"));
        return a;
      }

      function skillButton(s) {
        return skillIndexLink(s);
      }

      function renderStrand(strand) {
        stopAudio();
        view = { name: "strand", strand, skill: null, index: 0, locked: false };
        const el = appEl();
        el.innerHTML = "";
        const back = $("button", "btn small", "← " + title);
        back.type = "button";
        back.onclick = renderHome;
        el.appendChild(back);
        el.appendChild($("h1", "title-main", labelStrand(strand)));
        const list = skills.filter((s) => s.strand === strand);
        for (const s of list) el.appendChild(skillButton(s));
      }

      function openSkill(skill) {
        gestureOk = true;
        skill.introPlayed = false;
        let index = Number(progress.cursor[skill.skill_id]);
        if (!Number.isFinite(index) || index < 0 || index >= skill.questions.length) index = 0;
        progress.last = { skill_id: skill.skill_id, category: skill.strand, index: index };
        markDirtySave();
        showQuestion(skill, index);
      }

      function showQuestion(skill, index) {
        stopAudio();
        const q = skill.questions[index];
        view = { name: "question", strand: skill.strand, skill, index, locked: false };
        const el = appEl();
        UI.setViewMode(el, "play");
        el.innerHTML = "";
        if (!q) {
          el.appendChild($("p", "muted", "No questions for this skill yet."));
          const back = $("button", "btn small", "← Back");
          back.type = "button";
          back.onclick = () => renderStrand(skill.strand);
          el.appendChild(back);
          return;
        }

        const shell = $("div", "play-layout");
        const playMain = $("div", "play-main");
        shell.appendChild(playMain);
        el.appendChild(shell);

        const scorebar = $("div", "scorebar");
        scorebar.appendChild($("div", "score-col score-wrong", String(statOf(skill.skill_id, "wrong"))));
        const mid = $("div", "score-col score-mid");
        mid.appendChild($("span", "lbl", "Skill score"));
        mid.appendChild($("span", "num", scoreOf(skill.skill_id) + "%"));
        scorebar.appendChild(mid);
        scorebar.appendChild($("div", "score-col score-good", String(statOf(skill.skill_id, "correct"))));
        playMain.appendChild(scorebar);

        const top = $("div", "play-top row");
        const back = $("a", "btn small", "← Skill list");
        back.href = Nav.indexPageUrl();
        back.onclick = (ev) => {
          ev.preventDefault();
          stopAudio();
          root.location.href = Nav.indexPageUrl();
        };
        top.appendChild(back);
        const skip = $("button", "btn small", "Skip");
        skip.type = "button";
        skip.onclick = () => {
          const next = index + 1 >= skill.questions.length ? 0 : index + 1;
          progress.cursor[skill.skill_id] = next;
          progress.last = { skill_id: skill.skill_id, category: skill.strand, index: next };
          markDirtySave();
          showQuestion(skill, next);
        };
        top.appendChild(skip);
        playMain.appendChild(top);

        const card = $("div", "question-card");
        playMain.appendChild(card);

        card.appendChild($("div", "muted skill-line", skill.title));
        if (Progress.isSkillMastered(scoreOf(skill.skill_id))) {
          const doneBanner = $("div", "skill-mastered-banner");
          doneBanner.appendChild($("span", "skill-done-badge large", "Done"));
          doneBanner.appendChild($("span", "", "You reached " + Progress.MASTER_SCORE + "% on this skill."));
          card.appendChild(doneBanner);
          appendGoToNextSkill(card, skill, true);
        }
        const prompt = $("h2", "prompt");
        prompt.textContent = q.prompt == null ? "" : String(q.prompt);
        card.appendChild(prompt);

        const picUrl = pictureFor(q);
        if (picUrl) {
          const img = document.createElement("img");
          img.className = "q-pic";
          img.alt = "";
          img.src = picUrl;
          img.addEventListener("error", () => {
            warnOnce("picture", Pictures.subjectOf(q) || picUrl);
            img.remove();
          });
          card.appendChild(img);
        }

        const qFile = questionClip(q);
        const sFile = soundClip(q);
        if (qFile || sFile) {
          const replay = $("button", "btn replay", "▶");
          replay.type = "button";
          replay.setAttribute("aria-label", "Play sound");
          replay.onclick = () => {
            gestureOk = true;
            soundOn = true;
            stopAudio();
            const gen = generation;
            const files = [];
            if (qFile) files.push(qFile);
            if (sFile && sFile !== qFile) files.push(sFile);
            (async () => {
              for (const file of files) {
                if (gen !== generation) return;
                const status = await playUrl(clipUrl(file), gen);
                if (status === "error") warnOnce("clip", file);
              }
            })();
          };
          card.appendChild(replay);
        }

        const options = optionsOf(q);
        if (options.length) {
          card.appendChild($("p", "keyboard-hint", "Press 1–" + options.length + " to choose · Enter for next"));
          const grid = $("div", "choices-grid");
          if (options.length === 1) grid.classList.add("cols-1");
          if (options.length === 3) grid.classList.add("cols-3");
          options.forEach((choice, i) => {
            const b = UI.choiceButton(i, String(choice), () =>
              grade(skill, q, index, String(choice), b, card.querySelectorAll(".choice"))
            );
            grid.appendChild(b);
          });
          card.appendChild(grid);
        } else {
          card.appendChild($("p", "keyboard-hint", "Type your answer · Enter to check"));
          const form = $("form", "type-row");
          const input = document.createElement("input");
          input.className = "type-input";
          input.type = "text";
          input.autocomplete = "off";
          input.autocapitalize = "off";
          input.spellcheck = false;
          input.setAttribute("aria-label", "Type the word");
          const go = $("button", "btn primary", "Check");
          go.type = "submit";
          form.appendChild(input);
          form.appendChild(go);
          form.onsubmit = (ev) => {
            ev.preventDefault();
            grade(skill, q, index, input.value, null, []);
          };
          card.appendChild(form);
          input.focus();
        }

        card.appendChild($("div", "feedback"));
        const explain = $("div", "explain-panel");
        explain.hidden = true;
        card.appendChild(explain);
        const next = $("button", "btn primary next-btn", "Next (Enter)");
        next.type = "button";
        next.hidden = true;
        next.onclick = () => {
          const n = index + 1 >= skill.questions.length ? 0 : index + 1;
          showQuestion(skill, n);
        };
        card.appendChild(next);

        UI.bindQuestionKeys(() => ({ active: view.name === "question", locked: view.locked }));

        const gen = generation;
        playQuestion(skill, q, gen);
      }

      function grade(skill, q, index, given, node, nodes) {
        if (view.locked) return;
        view.locked = true;
        const expected = String(q.answer == null ? "" : q.answer);
        const typed = optionsOf(q).length === 0;
        const ok = typed
          ? String(given).trim().toLowerCase() === expected.trim().toLowerCase()
          : String(given) === expected;
        const applied = Progress.applyScore(scoreOf(skill.skill_id), ok, streaks[skill.skill_id] || 0);
        streaks[skill.skill_id] = applied.streak;
        progress.scores[skill.skill_id] = applied.score;
        const st = progress.stats[skill.skill_id] || { correct: 0, wrong: 0 };
        if (ok) st.correct += 1;
        else st.wrong += 1;
        progress.stats[skill.skill_id] = st;
        const nextIndex = index + 1 >= skill.questions.length ? 0 : index + 1;
        progress.cursor[skill.skill_id] = nextIndex;
        progress.last = { skill_id: skill.skill_id, category: skill.strand, index: nextIndex };
        logAnswer(skill.skill_id, q, ok, applied.score);
        markDirtySave();

        const choices = nodes && nodes.length ? Array.from(nodes) : Array.from(document.querySelectorAll(".choice"));
        choices.forEach((n) => {
          const txt = n.querySelector(".choice-text");
          const label = txt ? txt.textContent : n.textContent;
          if (String(label) === String(q.answer)) n.classList.add("ok");
          if (n === node && !ok) n.classList.add("no");
          n.disabled = true;
        });
        const fb = document.querySelector(".feedback");
        if (fb) fb.textContent = ok ? "Yes  ·  " + applied.score + "%" : "Not that  ·  " + applied.score + "%";
        const wrongCol = document.querySelector(".score-wrong");
        const goodCol = document.querySelector(".score-good");
        const num = document.querySelector(".score-mid .num");
        if (wrongCol) wrongCol.textContent = String(st.wrong);
        if (goodCol) goodCol.textContent = String(st.correct);
        if (num) num.textContent = applied.score + "%";
        if (!ok) {
          const ex = document.querySelector(".explain-panel");
          if (ex) {
            ex.hidden = false;
            ex.textContent = explainOf(q);
          }
        }
        const next = document.querySelector(".next-btn");
        if (next) next.hidden = false;
        const app = appEl();
        if (Progress.isSkillMastered(applied.score) && app) appendGoToNextSkill(app, skill, true);
      }

      function renderLoading() {
        const el = appEl();
        if (!el) return;
        el.innerHTML = "";
        el.appendChild($("h1", "title-main", title));
        el.appendChild($("p", "muted", contentError || "Loading…"));
      }

      function render() {
        if (!contentReady) {
          renderLoading();
          return;
        }
        if (view.name === "question" && view.skill) showQuestion(view.skill, view.index);
        else if (view.name === "strand" && view.strand) renderStrand(view.strand);
        else renderHome();
      }

      function ensureContent() {
        if (!contentPromise) {
          contentPromise = loadContent().catch((err) => {
            contentPromise = null;
            throw err;
          });
        }
        return contentPromise;
      }

      async function loadContent() {
        const [qRes, mRes, nRes, oRes] = await Promise.all([
          fetch("questions.jsonl"),
          fetch("manifest.json"),
          fetch("../pictures/index.json"),
          fetch("../../grade1/pack/pictures.json"),
        ]);
        if (!qRes.ok) throw new Error("questions.jsonl " + qRes.status);
        if (!mRes.ok) throw new Error("manifest.json " + mRes.status);
        const questions = parseJsonl(await qRes.text());
        manifest = await mRes.json();
        newPics = nRes.ok ? await nRes.json() : {};
        oldPics = oRes.ok ? await oRes.json() : {};
        const byId = new Map();
        for (const q of questions) {
          if (!q || typeof q !== "object") continue;
          const id = q.skill_id ? String(q.skill_id) : "unassigned";
          if (!byId.has(id)) {
            const intro = manifest.intros && manifest.intros[id];
            const titleText = q.name ? String(q.name) : intro && intro.title ? String(intro.title) : id;
            byId.set(id, {
              skill_id: id,
              title: titleText,
              strand: strandFor(q, titleText),
              questions: [],
              introPlayed: false,
            });
          }
          const skill = byId.get(id);
          if (!skill.strand && q.strand) skill.strand = String(q.strand);
          if (q.name && skill.title === id) skill.title = String(q.name);
          skill.questions.push(q);
        }
        skills = Array.from(byId.values());
        contentReady = true;
      }

      async function onStudent(id) {
        const next = String(id || "").trim();
        if (!next) return;
        const gen = ++authGen;
        if (studentId && studentId !== next) {
          progress = Progress.emptyProgress(level);
          packReady = false;
          view = { name: "home", strand: null, skill: null, index: 0, locked: false };
        }
        studentId = next;
        try {
          if (!contentReady && !contentError) await ensureContent();
        } catch (err) {
          contentError = err && err.message ? err.message : String(err);
          renderLoading();
          return;
        }
        if (gen !== authGen) return;
        const auth = root.MRJ_AUTH;
        if (auth && typeof auth.loadPack === "function") {
          const res = await auth.loadPack(program);
          if (gen !== authGen) return;
          if (res && res.ok) {
            packReady = true;
            const remote = Progress.parseProgress(res.progress_json, level);
            const local = progress;
            progress = Progress.mergeProgress(local, remote, level);
            const remoteWeight = JSON.stringify(remote);
            const mergedWeight = JSON.stringify(progress);
            if (mergedWeight !== remoteWeight) await markDirtySave();
            const el = appEl();
            if (el && el.dataset.progress === "pending") await markDirtySave();
          }
        }
        if (gen !== authGen) return;
        if (!booted) {
          booted = true;
          const launch = launchSkillId && skillById(launchSkillId);
          if (launch) openSkill(launch);
          else renderHome();
        } else {
          render();
        }
      }

      ensureContent()
        .then(() => {
          if (studentId && !booted) {
            booted = true;
            renderHome();
          }
        })
        .catch((err) => {
          contentError = err && err.message ? err.message : String(err);
          console.error(err);
          renderLoading();
        });

      root.addEventListener("mrj-auth-ready", (event) => {
        const id = event && event.detail ? event.detail.id : "";
        onStudent(id);
      });
      root.addEventListener("pagehide", () => {
        if (studentId) markDirtySave();
      });
      root.document.addEventListener("visibilitychange", () => {
        if (root.document.visibilityState === "visible") syncProgressFromCloud();
      });
      root.addEventListener("focus", () => {
        syncProgressFromCloud();
      });
      if (root.MRJ_AUTH && typeof root.MRJ_AUTH.student === "function") {
        const existing = root.MRJ_AUTH.student();
        if (existing) onStudent(existing);
      }
    },
  };
})(window);
