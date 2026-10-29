/**
 * Cloud progress flush for one level player.
 *
 * mrj-auth savePack returns pack_not_loaded until loadPack has succeeded for
 * that program, and any failed save clears the loaded flag. Answers that land
 * before loadPack (or after a failed load) stay dirty and are written once a
 * later loadPack succeeds. A pack_not_loaded / failed save reloads once, then
 * saves again.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.SB_PACK_SAVE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RETRY_MS = 1000;

  function retryable(res) {
    const err = res && res.error;
    return err !== "bad_token" && err !== "id_blocked" && err !== "stale_session";
  }

  function create(opts) {
    const program = opts.program;
    const level = opts.level;
    const Progress = opts.Progress;
    const getAuth = opts.getAuth;
    const getProgress = opts.getProgress;
    const setProgress = opts.setProgress;
    const getStudentId = opts.getStudentId;
    const setStatus = typeof opts.setStatus === "function" ? opts.setStatus : function () {};
    const applyTeacher = opts.applyTeacher;
    const afterMerge = opts.afterMerge;
    const setTimer = opts.setTimer || function (fn, ms) { return setTimeout(fn, ms); };
    const clearTimerFn = opts.clearTimer || function (id) { clearTimeout(id); };
    const retryMs = opts.retryMs != null ? opts.retryMs : RETRY_MS;

    let packReady = false;
    let dirty = false;
    let dirtyGen = 0;
    let generation = 0;
    let loadFlight = null;
    let retryTimer = null;
    let chain = Promise.resolve();

    function auth() {
      return getAuth() || null;
    }

    function authPackReady() {
      const a = auth();
      if (!a || typeof a.packReady !== "function") return packReady;
      try {
        return !!a.packReady(program);
      } catch (_) {
        return packReady;
      }
    }

    function clearRetry() {
      if (!retryTimer) return;
      clearTimerFn(retryTimer);
      retryTimer = null;
    }

    function scheduleRetry() {
      if (retryTimer || !getStudentId() || !dirty) return;
      const gen = generation;
      retryTimer = setTimer(() => {
        retryTimer = null;
        if (gen !== generation || !getStudentId() || !dirty) return;
        return flush().catch(() => {});
      }, retryMs);
    }

    function enqueue(task) {
      const run = chain.then(() => task());
      chain = run.then(
        () => {},
        () => {}
      );
      return run;
    }

    function applyLoaded(res) {
      const remote = Progress.parseProgress(res && res.progress_json, level);
      const local = getProgress();
      const merged = Progress.mergeProgress(local, remote, level);
      if (typeof applyTeacher === "function") applyTeacher(merged);
      const before = JSON.stringify(local);
      const after = JSON.stringify(merged);
      setProgress(merged);
      packReady = true;
      if (after !== JSON.stringify(remote)) dirty = true;
      if (after !== before && typeof afterMerge === "function") afterMerge(merged);
    }

    function beginLoad() {
      if (packReady && authPackReady()) return Promise.resolve(true);
      const a = auth();
      if (!getStudentId() || !a || typeof a.loadPack !== "function") {
        packReady = false;
        if (dirty) {
          setStatus("pending");
          scheduleRetry();
        }
        return Promise.resolve(false);
      }
      if (loadFlight) return loadFlight;
      const gen = generation;
      const flight = Promise.resolve()
        .then(() => a.loadPack(program))
        .then((res) => {
          if (gen !== generation || !getStudentId()) return false;
          if (!res || res.ok !== true) {
            packReady = false;
            if (dirty && retryable(res)) {
              setStatus("pending");
              scheduleRetry();
            } else if (dirty) {
              setStatus("error");
            }
            return false;
          }
          applyLoaded(res);
          return true;
        })
        .catch(() => {
          if (gen !== generation || !getStudentId()) return false;
          packReady = false;
          if (dirty) {
            setStatus("pending");
            scheduleRetry();
          }
          return false;
        })
        .finally(() => {
          if (loadFlight === flight) loadFlight = null;
        });
      loadFlight = flight;
      return flight;
    }

    async function saveLoaded(gen) {
      if (!getStudentId() || gen !== generation) return false;
      if (!dirty) {
        setStatus("saved");
        return true;
      }
      const a = auth();
      if (!a || typeof a.savePack !== "function" || !packReady || !authPackReady()) {
        setStatus("pending");
        return false;
      }
      setStatus("saving");
      const seen = dirtyGen;
      const payload = JSON.stringify(getProgress());
      let res;
      try {
        res = await a.savePack(program, payload);
      } catch (_) {
        res = { ok: false, error: "network" };
      }
      if (gen !== generation || !getStudentId()) return false;
      if (res && res.ok) {
        packReady = true;
        if (seen === dirtyGen) {
          dirty = false;
          setStatus("saved");
          clearRetry();
        } else {
          dirty = true;
          setStatus("pending");
        }
        return true;
      }
      packReady = false;
      dirty = true;
      if (!retryable(res)) {
        setStatus("error");
        return "fatal";
      }
      setStatus("pending");
      return false;
    }

    async function writeOnce() {
      const gen = generation;
      if (!getStudentId() || gen !== generation) return false;

      let ready = packReady && authPackReady();
      if (!ready) {
        if (dirty) setStatus("pending");
        ready = await beginLoad();
        if (gen !== generation || !getStudentId()) return false;
        if (!ready) return false;
      }

      let ok = await saveLoaded(gen);
      if (ok === "fatal" || gen !== generation || !getStudentId()) return false;
      if (ok && dirty && packReady && authPackReady()) ok = await saveLoaded(gen);
      if (ok) return true;
      if (!dirty || gen !== generation || !getStudentId()) return false;

      packReady = false;
      const reloaded = await beginLoad();
      if (gen !== generation || !getStudentId()) return false;
      if (!reloaded) {
        if (dirty) {
          setStatus("error");
          scheduleRetry();
        }
        return false;
      }
      ok = await saveLoaded(gen);
      if (ok === "fatal" || gen !== generation || !getStudentId()) return false;
      if (ok && dirty && packReady && authPackReady()) ok = await saveLoaded(gen);
      if (ok) return true;
      if (dirty && gen === generation && getStudentId()) {
        setStatus("error");
        scheduleRetry();
      }
      return false;
    }

    function noteLocalChange() {
      dirtyGen += 1;
      dirty = true;
      setStatus(packReady && authPackReady() ? "saving" : "pending");
      return enqueue(() => writeOnce());
    }

    function flush() {
      return enqueue(() => writeOnce());
    }

    function refresh() {
      return enqueue(() => {
        packReady = false;
        return writeOnce();
      });
    }

    function invalidate() {
      generation += 1;
      packReady = false;
      dirty = false;
      dirtyGen += 1;
      clearRetry();
    }

    return {
      noteLocalChange: noteLocalChange,
      flush: flush,
      refresh: refresh,
      invalidate: invalidate,
    };
  }

  return { create: create, RETRY_MS: RETRY_MS };
});
