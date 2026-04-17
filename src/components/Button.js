import { escapeHtml, renderAttributes } from "../utils/helpers.js";

export function renderButton({
  id,
  label,
  variant = "secondary",
  className = "",
  type = "button",
  attributes = {}
}) {
  const classes = [`${variant}-btn`, className].filter(Boolean).join(" ");
  return `<button${renderAttributes({ id, type, class: classes, ...attributes })}>${escapeHtml(label)}</button>`;
}

export function renderIconButton({ id, label, className = "", attributes = {} }) {
  const classes = ["icon-btn", className].filter(Boolean).join(" ");
  return `<button${renderAttributes({ id, type: "button", class: classes, ...attributes })}>${escapeHtml(label)}</button>`;
}

export function renderMiniButton({ label, className = "", attributes = {} }) {
  const classes = ["mini-btn", className].filter(Boolean).join(" ");
  return `<button${renderAttributes({ type: "button", class: classes, ...attributes })}>${escapeHtml(label)}</button>`;
}
