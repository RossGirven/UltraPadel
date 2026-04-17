import { escapeHtml } from "../utils/helpers.js";

export function renderTeamDisplay(session) {
  if (!session || !session.teams.length) {
    return '<div class="empty">Generate a session to lock in teams for the booking.</div>';
  }

  return session.teams.map((team, index) => `
    <article class="team-card">
      <header>
        <span class="team-tag">Team ${index + 1}</span>
        <span class="badge">${team.mixed ? "Mixed Pair" : "Same-Sex Pair"} · Avg ${team.averageSkill.toFixed(1)}</span>
      </header>
      <div class="team-players">
        ${team.members.map((member) => `
          <span class="name-chip">${escapeHtml(member.name)}<small>${member.sex} · Skill ${member.skill}</small></span>
        `).join("")}
      </div>
    </article>
  `).join("");
}
