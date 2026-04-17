import { escapeHtml } from "../utils/helpers.js";

export function renderMatchSchedule(session) {
  if (!session || !session.rounds.length) {
    return '<div class="empty">The match schedule will appear after team generation.</div>';
  }

  return session.rounds.map((round) => `
    <article class="round-card">
      <header>
        <strong>Round ${round.round}</strong>
        <span class="badge">${round.matches.length} ${round.matches.length === 1 ? "match" : "matches"}</span>
      </header>
      ${round.matches.length ? round.matches.map((match) => `
        <div class="match-line">
          <span class="court-tag">Court ${match.court}</span>
          <span>${escapeHtml(match.teamA.members.map((member) => member.name).join(" / "))}</span>
          <span class="vs">vs</span>
          <span>${escapeHtml(match.teamB.members.map((member) => member.name).join(" / "))}</span>
        </div>
      `).join("") : '<div class="subtle">No court assignment in this round. All available teams have already had fair rotation opportunities.</div>'}
    </article>
  `).join("");
}
