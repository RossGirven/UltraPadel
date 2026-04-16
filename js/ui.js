function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getElements() {
  return {
    courts: document.getElementById("courts"),
    bookingDuration: document.getElementById("bookingDuration"),
    matchDuration: document.getElementById("matchDuration"),
    authEmail: document.getElementById("authEmail"),
    authPassword: document.getElementById("authPassword"),
    signUpBtn: document.getElementById("signUpBtn"),
    signInBtn: document.getElementById("signInBtn"),
    signOutBtn: document.getElementById("signOutBtn"),
    authStatusBadge: document.getElementById("authStatusBadge"),
    authMessage: document.getElementById("authMessage"),
    playersList: document.getElementById("playersList"),
    rosterSelect: document.getElementById("rosterSelect"),
    rosterPreview: document.getElementById("rosterPreview"),
    addPlayerBtn: document.getElementById("addPlayerBtn"),
    addFromRosterBtn: document.getElementById("addFromRosterBtn"),
    generateBtn: document.getElementById("generateBtn"),
    exportHistoryBtn: document.getElementById("exportHistoryBtn"),
    importHistoryBtn: document.getElementById("importHistoryBtn"),
    importHistoryInput: document.getElementById("importHistoryInput"),
    clearHistoryBtn: document.getElementById("clearHistoryBtn"),
    shuffleTitle: document.getElementById("shuffleTitle"),
    shuffleState: document.getElementById("shuffleState"),
    teamsOutput: document.getElementById("teamsOutput"),
    scheduleOutput: document.getElementById("scheduleOutput"),
    historyOutput: document.getElementById("historyOutput"),
    roundsStat: document.getElementById("roundsStat"),
    teamsStat: document.getElementById("teamsStat"),
    historyStat: document.getElementById("historyStat")
  };
}

export function renderPlayers(players, els) {
  els.playersList.innerHTML = "";
  players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = `
      <div class="player-cell">
        <label>Name</label>
        <input type="text" value="${escapeHtml(player.name)}" data-id="${player.id}" data-field="name" placeholder="Player name" />
      </div>
      <div class="player-cell">
        <label>Sex</label>
        <select data-id="${player.id}" data-field="sex">
          <option value="Male" ${player.sex === "Male" ? "selected" : ""}>Male</option>
          <option value="Female" ${player.sex === "Female" ? "selected" : ""}>Female</option>
        </select>
      </div>
      <div class="player-cell">
        <label>Skill</label>
        <select data-id="${player.id}" data-field="skill">
          ${[1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${Number(player.skill) === value ? "selected" : ""}>${value}</option>`).join("")}
        </select>
      </div>
      <button class="icon-btn" type="button" data-remove-id="${player.id}" aria-label="Remove player">×</button>
    `;
    els.playersList.appendChild(row);
  });
}

export function renderRoster(roster, els, normalizeName) {
  const orderedRoster = [...roster].sort((a, b) => a.name.localeCompare(b.name));
  els.rosterSelect.innerHTML = '<option value="">Select a saved player</option>';

  orderedRoster.forEach((player) => {
    const option = document.createElement("option");
    option.value = normalizeName(player.name);
    option.textContent = `${player.name} · ${player.sex} · Skill ${player.skill}`;
    els.rosterSelect.appendChild(option);
  });

  if (!orderedRoster.length) {
    els.rosterPreview.innerHTML = '<div class="empty">New players you enter will be remembered here for future sessions.</div>';
    return;
  }

  els.rosterPreview.innerHTML = orderedRoster.map((player) => `
    <span class="roster-chip">
      <span>${escapeHtml(player.name)}<small>${player.sex} · ${player.skill}</small></span>
      <button class="roster-remove-btn" type="button" data-roster-remove="${escapeHtml(player.name)}" aria-label="Remove ${escapeHtml(player.name)} from roster">×</button>
    </span>
  `).join("");
}

export function renderTeams(session, els) {
  if (!session || !session.teams.length) {
    els.teamsOutput.innerHTML = '<div class="empty">Generate a session to lock in teams for the booking.</div>';
    return;
  }

  els.teamsOutput.innerHTML = session.teams.map((team, index) => `
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

export function renderSchedule(session, els) {
  if (!session || !session.rounds.length) {
    els.scheduleOutput.innerHTML = '<div class="empty">The match schedule will appear after team generation.</div>';
    return;
  }

  els.scheduleOutput.innerHTML = session.rounds.map((round) => `
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

export function renderHistory(sessions, els) {
  if (!sessions.length) {
    els.historyOutput.innerHTML = '<div class="empty">No previous sessions stored yet.</div>';
    return;
  }

  els.historyOutput.innerHTML = sessions.slice(0, 6).map((session) => `
    <article class="history-card">
      <strong>${new Date(session.createdAt).toLocaleString()}</strong>
      <div class="history-line subtle">${session.teams.length} teams · ${session.settings.totalRounds} rounds · ${session.settings.courts} courts</div>
      <div class="history-line subtle">${session.teams.map((team) => team.members.map((member) => member.name).join(" / ")).join(" · ")}</div>
    </article>
  `).join("");
}

export function updateStats(meta, els) {
  els.roundsStat.textContent = String(meta.rounds);
  els.teamsStat.textContent = String(meta.currentSession ? meta.currentSession.teams.length : 0);
  els.historyStat.textContent = String(meta.sessions.length);
}

export function renderAuthState(auth, els) {
  const isSignedIn = Boolean(auth.currentUser);
  els.authStatusBadge.textContent = isSignedIn ? "Signed In" : "Local Mode";
  els.signOutBtn.disabled = !isSignedIn;
  els.signInBtn.disabled = false;
  els.signUpBtn.disabled = false;

  els.authMessage.classList.remove("auth-message-success", "auth-message-error");
  if (auth.variant === "success") {
    els.authMessage.classList.add("auth-message-success");
  }
  if (auth.variant === "error") {
    els.authMessage.classList.add("auth-message-error");
  }

  if (auth.message) {
    els.authMessage.textContent = auth.message;
    return;
  }

  if (isSignedIn) {
    els.authMessage.textContent = `Signed in as ${auth.currentUser.email}. Your roster and session history now sync with Supabase.`;
    return;
  }

  els.authMessage.textContent = "Sign in to store your roster and session history in Supabase. If you stay signed out, the app falls back to local browser storage.";
}

export function startShuffleAnimation(playerNames, els, state) {
  stopShuffleAnimation(els, state);
  els.shuffleTitle.textContent = "Generating balanced session teams...";
  const update = () => {
    const picks = [...playerNames]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(8, playerNames.length));
    els.shuffleState.innerHTML = picks.map((name) => `<span class="shuffle-pill">${escapeHtml(name)}</span>`).join("");
  };
  update();
  state.shuffleInterval = window.setInterval(update, 130);
}

export function stopShuffleAnimation(els, state, message) {
  if (state.shuffleInterval) {
    window.clearInterval(state.shuffleInterval);
    state.shuffleInterval = null;
  }
  if (message) {
    els.shuffleTitle.textContent = message;
  }
}

export function renderShuffleTeams(session, els) {
  els.shuffleState.innerHTML = session.teams.map((team, index) => `
    <span class="shuffle-pill">Team ${index + 1}: ${escapeHtml(team.members.map((member) => member.name).join(" + "))}</span>
  `).join("");
}
