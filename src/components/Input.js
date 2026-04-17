import { escapeHtml, renderAttributes } from "../utils/helpers.js";

export function renderInputField({
  label,
  id,
  type = "text",
  value = "",
  placeholder = "",
  autocomplete = "",
  min,
  step
}) {
  return `
    <div class="field">
      <label for="${escapeHtml(id)}">${escapeHtml(label)}</label>
      <input${renderAttributes({
        id,
        type,
        value,
        placeholder,
        autocomplete,
        min,
        step
      })} />
    </div>
  `;
}

export function renderSelectField({ label, id, options = [] }) {
  return `
    <div class="field">
      <label for="${escapeHtml(id)}">${escapeHtml(label)}</label>
      <select id="${escapeHtml(id)}">
        ${options.map((option) => `
          <option value="${escapeHtml(option.value)}"${option.selected ? " selected" : ""}>${escapeHtml(option.label)}</option>
        `).join("")}
      </select>
    </div>
  `;
}
