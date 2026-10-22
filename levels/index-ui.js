/**
 * Skill index layout (strand sections, quick nav, styled cards).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.SB_INDEX_UI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  function applyStrandVars(node, theme) {
    if (!node || !theme) return;
    node.style.setProperty("--strand-color", theme.color);
    node.dataset.strand = theme.key;
  }

  function buildQuickNav(strands, themeFor) {
    const nav = el("nav", "strand-quick-nav");
    nav.setAttribute("aria-label", "Jump to subject");
    for (const strand of strands) {
      const theme = themeFor(strand);
      const a = el("a", "strand-quick-btn");
      a.href = "#" + (theme.sectionId || "");
      applyStrandVars(a, { key: theme.key, color: theme.color });
      const icon = document.createElement("span");
      icon.className = "strand-quick-icon";
      icon.innerHTML = theme.iconSvg;
      a.appendChild(icon);
      a.appendChild(el("span", "strand-quick-label", theme.label));
      nav.appendChild(a);
    }
    return nav;
  }

  function buildStrandSection(strand, theme, doneCount, totalCount) {
    const section = el("section", "strand-block strand-block--" + theme.key);
    section.id = theme.sectionId;
    applyStrandVars(section, theme);
    const head = el("header", "strand-header");
    const iconWrap = el("span", "strand-header-icon");
    iconWrap.innerHTML = theme.iconSvg;
    head.appendChild(iconWrap);
    const text = el("div", "strand-header-text");
    text.appendChild(el("h3", "strand-title", theme.label));
    text.appendChild(el("p", "strand-meta", doneCount + " of " + totalCount + " skills done"));
    head.appendChild(text);
    section.appendChild(head);
    const grid = el("div", "skill-index-grid");
    section.appendChild(grid);
    return { section, grid };
  }

  function buildComingSoonRow(title, theme) {
    const row = el("div", "skill-row skill-row--soon strand-skill strand-skill--" + theme.key);
    applyStrandVars(row, theme);
    const top = el("span", "skill-row-top");
    top.appendChild(el("span", "skill-name", title));
    top.appendChild(el("span", "skill-soon-badge", "Coming soon"));
    row.appendChild(top);
    row.appendChild(el("span", "skill-meta muted", "Practice coming soon"));
    return row;
  }

  function decorateSkillRow(row, theme) {
    row.classList.add("strand-skill", "strand-skill--" + theme.key);
    applyStrandVars(row, theme);
    const pct = row.querySelector(".skill-pct");
    if (pct) pct.style.color = theme.color;
    const fill = row.querySelector(".skill-progress-fill:not(.full)");
    if (fill) fill.style.background = theme.color;
    return row;
  }

  return {
    el,
    buildQuickNav,
    buildStrandSection,
    buildComingSoonRow,
    decorateSkillRow,
    applyStrandVars,
  };
});
