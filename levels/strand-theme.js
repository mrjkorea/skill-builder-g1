/**
 * Subject (strand) colors and icons for the skill index UI — no scoring/progress.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.SB_STRAND_THEME = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STRAND_ORDER = ["phonics", "reading", "grammar", "vocabulary"];

  const THEMES = {
    phonics: {
      key: "phonics",
      label: "Phonics & spelling",
      color: "#0ea5e9",
      icon: "phonics",
    },
    reading: {
      key: "reading",
      label: "Reading",
      color: "#a855f7",
      icon: "reading",
    },
    grammar: {
      key: "grammar",
      label: "Grammar",
      color: "#f97316",
      icon: "grammar",
    },
    vocabulary: {
      key: "vocabulary",
      label: "Vocabulary",
      color: "#22c55e",
      icon: "vocabulary",
    },
  };

  const DEFAULT = {
    key: "skills",
    label: "Skills",
    color: "#38bdf8",
    icon: "skills",
  };

  function themeFor(strand) {
    const k = String(strand || "").toLowerCase();
    return THEMES[k] || { ...DEFAULT, key: k || DEFAULT.key, label: titleCase(k) || DEFAULT.label };
  }

  function titleCase(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    return k.charAt(0).toUpperCase() + k.slice(1);
  }

  function sectionId(strand) {
    const k = String(strand || "skills")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return "strand-" + (k || "skills");
  }

  function iconSvg(icon) {
    const common = 'viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" focusable="false"';
    switch (icon) {
      case "phonics":
        return `<svg class="strand-svg" ${common}><text x="4" y="23" font-size="18" font-weight="800" fill="currentColor">Aa</text></svg>`;
      case "reading":
        return `<svg class="strand-svg" ${common}><path fill="currentColor" d="M6 8h8v16H8V10H6V8zm12 0h8v2h-6v14h-2V8z"/></svg>`;
      case "grammar":
        return `<svg class="strand-svg" ${common}><path fill="currentColor" d="M8 22l4-12h2l4 12h-2.2l-.8-2.6H11l-.8 2.6H8zm3.2-4.8h3.6L13 12.8l-1.8 4.4z"/></svg>`;
      case "vocabulary":
        return `<svg class="strand-svg" ${common}><circle cx="11" cy="14" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/><path fill="currentColor" d="M17 20l7 7 2-2-7-7z"/></svg>`;
      default:
        return `<svg class="strand-svg" ${common}><rect x="8" y="8" width="16" height="16" rx="4" fill="currentColor" opacity="0.85"/></svg>`;
    }
  }

  return {
    STRAND_ORDER,
    THEMES,
    themeFor,
    sectionId,
    iconSvg,
  };
});
