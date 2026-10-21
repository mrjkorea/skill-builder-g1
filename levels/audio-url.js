/**
 * Resolve manifest clip paths to playable URLs (local relative or audio_base CDN).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.SB_AUDIO_URL = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function resolveClipUrl(manifest, file) {
    if (file == null || file === "") return "";
    const rel = String(file).replace(/^\//, "");
    const base = manifest && manifest.audio_base != null ? String(manifest.audio_base).trim() : "";
    if (!base) return rel;
    const prefix = base.endsWith("/") ? base : base + "/";
    return prefix + rel;
  }

  return { resolveClipUrl };
});
