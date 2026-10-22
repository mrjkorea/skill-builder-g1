/**
 * DOM + keyboard UI for level player (no progress/scoring logic).
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.SB_LEVEL_UI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  let keyHandler = null;

  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  function setViewMode(app, mode) {
    if (!app) return;
    app.className = "app-shell app-view-" + (mode || "home");
  }

  function choiceButton(index, label, onPick, opts) {
    const b = el("button", "choice");
    b.type = "button";
    b.dataset.choiceIndex = String(index);
    const key = el("span", "choice-key", String(index + 1));
    const txt = el("span", "choice-text", label);
    b.appendChild(key);
    b.appendChild(txt);
    if (opts && opts.clipUrl) {
      b.dataset.clipUrl = opts.clipUrl;
      const sp = el("button", "choice-speaker");
      sp.type = "button";
      sp.setAttribute("aria-label", "Play word");
      sp.title = "Play word (Shift+" + (index + 1) + ")";
      sp.textContent = "▶";
      sp.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (opts.onClip) opts.onClip();
      };
      b.appendChild(sp);
    }
    b.onclick = onPick;
    return b;
  }

  function unbindQuestionKeys() {
    if (keyHandler && root.removeEventListener) {
      root.removeEventListener("keydown", keyHandler);
    }
    keyHandler = null;
  }

  function bindQuestionKeys(getState) {
    unbindQuestionKeys();
    keyHandler = (ev) => {
      if (!getState) return;
      const st = getState();
      if (!st || !st.active) return;
      const target = ev.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        if (ev.key === "Enter" && st.locked) {
          const next = document.querySelector(".next-btn:not([hidden])");
          if (next) {
            ev.preventDefault();
            next.click();
          }
        }
        return;
      }
      if (st.locked) {
        if (ev.key === "Enter") {
          const next = document.querySelector(".next-btn:not([hidden])");
          if (next) {
            ev.preventDefault();
            next.click();
          }
        }
        return;
      }
      const choices = Array.from(document.querySelectorAll("button.choice:not([disabled])"));
      if (choices.length) {
        const n = ev.key === " " ? -1 : parseInt(ev.key, 10);
        if (n >= 1 && n <= choices.length) {
          if (ev.shiftKey) {
            const sp = choices[n - 1].querySelector(".choice-speaker");
            if (sp) {
              ev.preventDefault();
              sp.click();
            }
          } else {
            ev.preventDefault();
            choices[n - 1].click();
          }
        }
        return;
      }
      if (ev.key === "Enter") {
        const form = document.querySelector("form.type-row");
        if (form && typeof form.requestSubmit === "function") {
          ev.preventDefault();
          form.requestSubmit();
        }
      }
    };
    root.addEventListener("keydown", keyHandler);
  }

  return {
    el,
    setViewMode,
    choiceButton,
    bindQuestionKeys,
    unbindQuestionKeys,
  };
});
