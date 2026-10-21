/**
 * URL helpers for level skill index vs skill player tabs (no DOM).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.SB_SKILL_NAV = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function parseSkillParam(href) {
    try {
      const u = new URL(href || "", typeof location !== "undefined" ? location.href : "http://localhost/");
      const id = u.searchParams.get("skill");
      return id ? String(id).trim() : "";
    } catch (_) {
      return "";
    }
  }

  function skillPageUrl(skillId, href) {
    const u = new URL(href || (typeof location !== "undefined" ? location.href : "http://localhost/"));
    u.searchParams.set("skill", String(skillId || "").trim());
    return u.pathname + u.search;
  }

  function indexPageUrl(href) {
    const u = new URL(href || (typeof location !== "undefined" ? location.href : "http://localhost/"));
    u.searchParams.delete("skill");
    const q = u.searchParams.toString();
    return u.pathname + (q ? "?" + q : "");
  }

  return { parseSkillParam, skillPageUrl, indexPageUrl };
});
