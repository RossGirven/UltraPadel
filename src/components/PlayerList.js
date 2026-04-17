import { escapeHtml } from "../utils/helpers.js";

export function renderPlayerList(players) {
  if (!players.length) {
    return '<div class="empty">Add players from the roster to build the current session.</div>';
  }

  return `
    <article class="session-player-group">
      <div class="session-player-group-head">
        <span class="badge">${players.length} ${players.length === 1 ? "player" : "players"} selected</span>
      </div>
      <div class="session-player-group-list">
        ${players.map((player) => `
          <div class="session-player-row">
            <div class="session-player-meta">
              <span class="session-player-name">${escapeHtml(player.name)}</span>
              <span class="session-player-detail">${escapeHtml(player.sex)} · Skill ${Number(player.skill)}</span>
            </div>
            <div class="session-player-actions">
              <button class="session-remove-btn" type="button" data-remove-id="${player.id}" aria-label="Remove ${escapeHtml(player.name)} from session">X</button>
            </div>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

export function renderRosterManager(roster) {
  if (!roster.length) {
    return '<div class="empty">No players in the roster yet.</div>';
  }

  return roster.map((player) => `
    <article class="roster-manager-card">
      <div class="roster-manager-meta">
        <span class="roster-manager-name">${escapeHtml(player.name)}</span>
        <span class="roster-manager-detail">${escapeHtml(player.sex)} · Skill ${Number(player.skill)}</span>
      </div>
      <div class="roster-manager-actions">
        <button class="mini-btn" type="button" data-roster-edit="${player.id}">Edit</button>
        <button class="mini-btn danger-btn" type="button" data-roster-remove="${player.id}">Remove</button>
      </div>
    </article>
  `).join("");
}
