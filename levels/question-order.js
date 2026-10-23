/* Per-student question order: every unseen question once (shuffled),
   then questions answered wrong (shuffled), then loop. State lives in localStorage. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.QuestionOrder = factory();
})(typeof self !== "undefined" ? self : this, function () {
  function shuffle(a, rnd) {
    rnd = rnd || Math.random;
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function fresh() { return { seen: [], wrong: [], queue: [], phase: "new" }; }
  function clean(st, ids) {
    const valid = new Set(ids);
    st = st && typeof st === "object" ? st : fresh();
    ["seen", "wrong", "queue"].forEach((f) => { st[f] = Array.isArray(st[f]) ? st[f].filter((x) => valid.has(x)) : []; });
    if (st.phase !== "review") st.phase = "new";
    return st;
  }
  /* Returns next id and mutates st. */
  function next(st, ids, rnd) {
    st = clean(st, ids);
    if (!ids.length) return { st, id: null };
    const seen = new Set(st.seen);
    const unseen = ids.filter((x) => !seen.has(x));
    if (unseen.length) {
      st.phase = "new";
      const q = new Set(st.queue);
      if (!st.queue.length || !unseen.every((x) => q.has(x))) st.queue = shuffle(unseen.slice(), rnd);
      st.queue = st.queue.filter((x) => !seen.has(x));
      return { st, id: st.queue[0] };
    }
    if (st.phase !== "review" || !st.queue.length) {
      st.phase = "review";
      const pool = st.wrong.length ? Array.from(new Set(st.wrong)) : ids.slice();
      if (!st.wrong.length) { st.seen = []; st.phase = "new"; st.queue = shuffle(ids.slice(), rnd); return { st, id: st.queue[0] }; }
      st.queue = shuffle(pool, rnd);
    }
    return { st, id: st.queue[0] };
  }
  /* Record an answer (or skip: ok = null). */
  function record(st, ids, id, ok) {
    st = clean(st, ids);
    if (!st.seen.includes(id)) st.seen.push(id);
    st.queue = st.queue.filter((x) => x !== id);
    if (ok === false) { if (!st.wrong.includes(id)) st.wrong.push(id); }
    else if (ok === true && st.phase === "review") st.wrong = st.wrong.filter((x) => x !== id);
    if (st.phase === "review" && !st.queue.length) {
      st.phase = "new";
      if (!st.wrong.length) st.seen = []; /* everything fixed: loop all again */
    }
    return st;
  }
  function storeKey(student, level, skill) { return "mrj-qorder:" + (student || "guest") + ":" + level + ":" + skill; }
  function load(student, level, skill) {
    try { return JSON.parse(localStorage.getItem(storeKey(student, level, skill)) || "null"); } catch (e) { return null; }
  }
  function save(student, level, skill, st) {
    try { localStorage.setItem(storeKey(student, level, skill), JSON.stringify(st)); } catch (e) {}
  }
  return { shuffle, next, record, load, save, storeKey };
});
