import { escapeHtml } from "../utils/helpers.js";

export function renderCard({ title = "", className = "", body = "", headingTag = "h2", headerExtras = "" }) {
  const heading = title ? `<${headingTag}>${escapeHtml(title)}</${headingTag}>` : "";
  return `
    <section class="${["panel", className].filter(Boolean).join(" ")}">
      ${heading || headerExtras ? `
        <div class="panel-header">
          ${heading}
          ${headerExtras}
        </div>
      ` : ""}
      ${body}
    </section>
  `;
}
