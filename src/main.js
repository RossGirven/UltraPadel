import {
  createPlayer,
  normalizeName,
  calculateTotalRounds,
  validatePlayers,
  generateTeams,
  scheduleMatches,
  buildSession
} from "../js/logic.js";
import {
  getStoredSessions,
  getStoredRoster,
  saveSession,
  upsertPlayer,
  removeRosterPlayer,
  clearHistory,
  getExportableHistoryPayload,
  importHistoryFromText,
  syncLocalCacheToSupabase
} from "../js/storage.js";
import { initAuth, getCurrentUser, signIn, signOut, signUp } from "../js/auth.js";
import { renderButton, renderIconButton } from "./components/Button.js";
import { renderInputField, renderSelectField } from "./components/Input.js";
import { renderCard } from "./components/Card.js";
import { renderPlayerList, renderRosterManager } from "./components/PlayerList.js";
import { renderTeamDisplay } from "./components/TeamDisplay.js";
import { renderMatchSchedule } from "./components/MatchSchedule.js";
import {
  createDownload,
  closeLayer,
  escapeHtml,
  formatDateTime,
  getButtonText,
  getElements,
  openLayer
} from "./utils/helpers.js";

const root = document.getElementById("app");

const state = {
  players: [],
  roster: [],
  sessions: [],
  currentSession: null,
  currentUser: null,
  authMessage: "",
  authVariant: "",
  rosterModalMode: "add",
  editingRosterId: null,
  rosterModalMessage: "",
  rosterModalVariant: "",
  shuffleInterval: null
};

root.innerHTML = buildAppShell();

const els = getElements();
els.generateBtn.dataset.defaultLabel = els.generateBtn.textContent;

function buildAppShell() {
  const setupCard = renderCard({
    className: "panel-setup",
    body: `
      <h2>Session Setup</h2>
      <div class="config-grid">
        ${renderInputField({ label: "Number of courts", id: "courts", type: "number", value: "2", min: "1", step: "1" })}
        ${renderInputField({ label: "Total booking duration (minutes)", id: "bookingDuration", type: "number", value: "90", min: "1", step: "1" })}
        ${renderInputField({ label: "Match duration (minutes)", id: "matchDuration", type: "number", value: "20", min: "1", step: "1" })}
      </div>

      <div class="section-head">
        <h3>Players</h3>
        <div class="actions">
          ${renderButton({ id: "openAddRosterBtn", label: "Add To Roster" })}
          ${renderButton({ id: "openRosterManagerBtn", label: "View / Edit Roster" })}
        </div>
      </div>

      <div class="roster-panel">
        <div class="roster-controls">
          ${renderSelectField({
            label: "Add player from roster",
            id: "rosterSelect",
            options: [{ value: "", label: "Select a saved player" }]
          })}
          ${renderButton({ id: "addFromRosterBtn", label: "Add To Session" })}
        </div>
        <p class="footer-note">Players are added to the roster through the roster modal, then selected here for the current session.</p>
      </div>

      <div class="results-group">
        <h3>Current Session Players</h3>
        <div id="playersList" class="session-player-list">
          <div class="empty">Add players from the roster to build the current session.</div>
        </div>
      </div>

      <div class="actions">
        ${renderButton({ id: "generateBtn", label: "Generate Teams", variant: "primary" })}
        ${renderButton({ id: "exportHistoryBtn", label: "Export History" })}
        ${renderButton({ id: "importHistoryBtn", label: "Import History" })}
        <input id="importHistoryInput" type="file" accept=".json,application/json" hidden />
        ${renderButton({ id: "clearHistoryBtn", label: "Clear Stored History" })}
      </div>

      <div class="meta-row">
        <div class="stat-card">
          <span>Rounds Available</span>
          <strong id="roundsStat">0</strong>
        </div>
        <div class="stat-card">
          <span>Session Teams</span>
          <strong id="teamsStat">0</strong>
        </div>
        <div class="stat-card">
          <span>Stored Sessions</span>
          <strong id="historyStat">0</strong>
        </div>
      </div>

      <p class="footer-note">Teams are fixed once generated. Scheduling rotates those same teams through the available courts without reshuffling them mid-session.</p>
    `
  });

  const resultsCard = renderCard({
    className: "panel-results",
    body: `
      <div class="shuffle-box">
        <div class="shuffle-inner">
          <strong id="shuffleTitle">Ready to build a session</strong>
          <div id="shuffleState" class="shuffle-state"></div>
        </div>
      </div>

      <div class="results-grid">
        <section class="results-group">
          <h2>Fixed Teams</h2>
          <div id="teamsOutput" class="team-list">
            <div class="empty">Generate a session to lock in teams for the booking.</div>
          </div>
        </section>

        <section class="results-group">
          <h2>Match Schedule</h2>
          <div id="scheduleOutput" class="schedule-list">
            <div class="empty">The match schedule will appear after team generation.</div>
          </div>
        </section>

        <section class="results-group">
          <h2>Recent Sessions</h2>
          <div id="historyOutput" class="history-list">
            <div class="empty">No previous sessions stored yet.</div>
          </div>
        </section>
      </div>
    `
  });

  return `
    <div class="app">
      <section class="hero">
        <div class="hero-bar">
          <div class="logo">UltraPadel <span class="pro">Pro</span></div>
          <button id="openAuthFlyoutBtn" class="account-pill" type="button" aria-expanded="false" aria-controls="authFlyout">
            <span class="account-pill-label">Account</span>
            <span id="authStatusBadge" class="badge">Local Mode</span>
          </button>
        </div>
      </section>

      <div class="layout">
        ${setupCard}
        ${resultsCard}
      </div>
    </div>

    <div id="authFlyout" class="auth-flyout hidden" aria-hidden="true" hidden>
      <div class="auth-panel auth-flyout-card" role="dialog" aria-modal="true" aria-labelledby="authFlyoutTitle">
        <div class="auth-heading">
          <h2 id="authFlyoutTitle">Account</h2>
          ${renderIconButton({ id: "closeAuthFlyoutBtn", label: "×", attributes: { "aria-label": "Close account panel" } })}
        </div>
        <div class="auth-grid">
          ${renderInputField({ label: "Email", id: "authEmail", type: "email", autocomplete: "email", placeholder: "you@example.com" })}
          ${renderInputField({ label: "Password", id: "authPassword", type: "password", autocomplete: "current-password", placeholder: "Enter password" })}
        </div>
        <div class="actions">
          ${renderButton({ id: "signUpBtn", label: "Sign Up" })}
          ${renderButton({ id: "signInBtn", label: "Sign In", variant: "primary" })}
          ${renderButton({ id: "signOutBtn", label: "Sign Out" })}
        </div>
        <p id="authMessage" class="footer-note">Sign in to store your roster and session history in Supabase. If you stay signed out, the app falls back to local browser storage.</p>
      </div>
    </div>

    <div id="rosterModal" class="modal-backdrop hidden" aria-hidden="true" hidden>
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="rosterModalTitle">
        <div class="modal-head">
          <div>
            <h2 id="rosterModalTitle">Roster</h2>
            <p id="rosterModalSubtitle" class="footer-note">Add or edit players in your saved roster.</p>
          </div>
          ${renderIconButton({ id: "closeRosterModalBtn", label: "×", attributes: { "aria-label": "Close roster modal" } })}
        </div>

        <div id="rosterModalMessage" class="footer-note"></div>

        <form id="rosterForm" class="modal-form">
          <div class="auth-grid">
            ${renderInputField({ label: "Name", id: "rosterNameInput", placeholder: "Player name" })}
            ${renderSelectField({
              label: "Sex",
              id: "rosterSexInput",
              options: [
                { value: "Male", label: "Male" },
                { value: "Female", label: "Female" }
              ]
            })}
            ${renderSelectField({
              label: "Skill",
              id: "rosterSkillInput",
              options: [1, 2, 3, 4, 5].map((value) => ({
                value: String(value),
                label: String(value),
                selected: value === 3
              }))
            })}
          </div>
          <div class="actions">
            ${renderButton({ id: "submitRosterBtn", label: "Submit To Roster", variant: "primary", type: "submit" })}
            ${renderButton({ id: "cancelRosterEditBtn", label: "Cancel" })}
          </div>
        </form>

        <div class="modal-roster-list-wrap">
          <div class="section-head">
            <h3>Current Roster</h3>
          </div>
          <div id="rosterManagerList" class="modal-roster-list">
            <div class="empty">No players in the roster yet.</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getSessionSettings() {
  const bookingDuration = Number(els.bookingDuration.value) || 0;
  const matchDuration = Number(els.matchDuration.value) || 0;
  return {
    courts: Number(els.courts.value) || 0,
    bookingDuration,
    matchDuration,
    totalRounds: calculateTotalRounds(bookingDuration, matchDuration)
  };
}

function renderHistory(sessions) {
  if (!sessions.length) {
    els.historyOutput.innerHTML = '<div class="empty">No previous sessions stored yet.</div>';
    return;
  }

  els.historyOutput.innerHTML = sessions.slice(0, 6).map((session) => `
    <article class="history-card">
      <strong>${escapeHtml(formatDateTime(session.createdAt))}</strong>
      <div class="history-line subtle">${session.teams.length} teams · ${session.settings.totalRounds} rounds · ${session.settings.courts} courts</div>
      <div class="history-line subtle">${escapeHtml(session.teams.map((team) => team.members.map((member) => member.name).join(" / ")).join(" · "))}</div>
    </article>
  `).join("");
}

function updateStats() {
  els.roundsStat.textContent = String(getSessionSettings().totalRounds);
  els.teamsStat.textContent = String(state.currentSession ? state.currentSession.teams.length : 0);
  els.historyStat.textContent = String(state.sessions.length);
}

function renderAuthState() {
  const isSignedIn = Boolean(state.currentUser);
  els.authStatusBadge.textContent = isSignedIn ? "Signed In" : "Local Mode";
  els.signOutBtn.disabled = !isSignedIn;
  els.signInBtn.disabled = false;
  els.signUpBtn.disabled = false;

  els.authMessage.classList.remove("auth-message-success", "auth-message-error");
  if (state.authVariant === "success") {
    els.authMessage.classList.add("auth-message-success");
  }
  if (state.authVariant === "error") {
    els.authMessage.classList.add("auth-message-error");
  }

  if (state.authMessage) {
    els.authMessage.textContent = state.authMessage;
    return;
  }

  if (isSignedIn) {
    els.authMessage.textContent = `Signed in as ${state.currentUser.email}. Your roster and session history now sync with Supabase.`;
    return;
  }

  els.authMessage.textContent = "Sign in to store your roster and session history in Supabase. If you stay signed out, the app falls back to local browser storage.";
}

function setAuthFeedback(message, variant = "") {
  state.authMessage = message;
  state.authVariant = variant;
  renderAuthState();
}

function setRosterModalFeedback(message, variant = "") {
  state.rosterModalMessage = message;
  state.rosterModalVariant = variant;
  renderRosterModalState();
}

function renderRosterModalState() {
  const editingPlayer = state.editingRosterId
    ? state.roster.find((player) => player.id === state.editingRosterId)
    : null;

  els.rosterModalTitle.textContent = state.rosterModalMode === "edit" ? "Edit Roster Player" : "Add To Roster";
  els.rosterModalSubtitle.textContent = state.rosterModalMode === "edit"
    ? "Update this player and save the changes back to the roster."
    : "Enter full player details, then submit them to the saved roster.";
  els.submitRosterBtn.textContent = state.rosterModalMode === "edit" ? "Save Changes" : "Submit To Roster";
  els.rosterNameInput.value = editingPlayer?.name || "";
  els.rosterSexInput.value = editingPlayer?.sex || "Male";
  els.rosterSkillInput.value = String(editingPlayer?.skill || 3);
  els.rosterModalMessage.textContent = state.rosterModalMessage || "";
  els.rosterModalMessage.classList.remove("auth-message-success", "auth-message-error");
  if (state.rosterModalVariant === "success") {
    els.rosterModalMessage.classList.add("auth-message-success");
  }
  if (state.rosterModalVariant === "error") {
    els.rosterModalMessage.classList.add("auth-message-error");
  }
}

function renderRoster() {
  const orderedRoster = [...state.roster].sort((a, b) => a.name.localeCompare(b.name));
  els.rosterSelect.innerHTML = '<option value="">Select a saved player</option>';

  orderedRoster.forEach((player) => {
    const option = document.createElement("option");
    option.value = normalizeName(player.name);
    option.textContent = `${player.name} · ${player.sex} · Skill ${player.skill}`;
    els.rosterSelect.appendChild(option);
  });

  els.rosterManagerList.innerHTML = renderRosterManager(orderedRoster);
}

function renderCurrentSession() {
  els.playersList.innerHTML = renderPlayerList(state.players);
  els.teamsOutput.innerHTML = renderTeamDisplay(state.currentSession);
  els.scheduleOutput.innerHTML = renderMatchSchedule(state.currentSession);
  renderHistory(state.sessions);
  updateStats();
}

function refreshUi() {
  renderAuthState();
  renderRoster();
  renderRosterModalState();
  renderCurrentSession();
}

async function loadData() {
  state.currentUser = await getCurrentUser();
  state.sessions = await getStoredSessions();
  state.roster = await getStoredRoster();
  state.players = state.players.filter((player) => state.roster.some((rosterPlayer) => rosterPlayer.id === player.id));
  refreshUi();
}

function resetRosterModal(mode = "add") {
  state.rosterModalMode = mode;
  state.editingRosterId = null;
  state.rosterModalMessage = "";
  state.rosterModalVariant = "";
}

function getAuthCredentials() {
  return {
    email: String(els.authEmail.value || "").trim(),
    password: String(els.authPassword.value || "")
  };
}

function validateAuthCredentials() {
  const { email, password } = getAuthCredentials();
  if (!email) {
    throw new Error("Enter your email address.");
  }
  if (!password) {
    throw new Error("Enter your password.");
  }
  return { email, password };
}

function getRosterFormPlayer() {
  const name = String(els.rosterNameInput.value || "").trim();
  const sex = els.rosterSexInput.value;
  const skill = Number(els.rosterSkillInput.value) || 3;

  if (!name) {
    throw new Error("Enter the player's name.");
  }

  return {
    id: state.editingRosterId || createPlayer("", sex, skill).id,
    name,
    sex,
    skill
  };
}

function openAccountFlow() {
  openLayer(els.authFlyout, els.openAuthFlyoutBtn);
  window.setTimeout(() => {
    els.authEmail.focus();
  }, 0);
}

function closeAccountFlow() {
  closeLayer(els.authFlyout, els.openAuthFlyoutBtn);
  els.openAuthFlyoutBtn.focus();
}

function invalidateCurrentSession() {
  if (!state.currentSession) {
    return;
  }

  state.currentSession = null;
  stopShuffleAnimation("Ready to build a session");
  els.shuffleState.innerHTML = "";
  els.teamsOutput.innerHTML = renderTeamDisplay(null);
  els.scheduleOutput.innerHTML = renderMatchSchedule(null);
  updateStats();
}

function openAddRosterFlow() {
  resetRosterModal("add");
  renderRosterModalState();
  openLayer(els.rosterModal);
  els.rosterNameInput.focus();
}

function openEditRosterFlow(playerId) {
  state.rosterModalMode = "edit";
  state.editingRosterId = playerId;
  state.rosterModalMessage = "";
  state.rosterModalVariant = "";
  renderRosterModalState();
  openLayer(els.rosterModal);
  els.rosterNameInput.focus();
}

function openRosterManagerFlow() {
  resetRosterModal("add");
  renderRosterModalState();
  openLayer(els.rosterModal);
}

function closeRosterFlow() {
  resetRosterModal("add");
  renderRosterModalState();
  closeLayer(els.rosterModal);
}

async function persistRosterPlayer(player) {
  state.roster = await upsertPlayer(player, state.roster);
  refreshUi();
}

async function handleRosterFormSubmit(event) {
  event.preventDefault();
  try {
    const player = getRosterFormPlayer();
    await persistRosterPlayer(player);
    resetRosterModal("add");
    els.rosterForm.reset();
    els.rosterSexInput.value = "Male";
    els.rosterSkillInput.value = "3";
    setRosterModalFeedback("Player saved to the roster.", "success");
  } catch (error) {
    setRosterModalFeedback(error.message || "Could not save this player to the roster.", "error");
  }
}

async function handleRemoveRosterPlayer(playerId) {
  const rosterPlayer = state.roster.find((player) => player.id === playerId);
  if (!rosterPlayer) {
    return;
  }

  if (!confirm(`Remove ${rosterPlayer.name} from the saved roster?`)) {
    return;
  }

  state.roster = await removeRosterPlayer(playerId, state.roster);
  state.players = state.players.filter((player) => player.id !== playerId);
  if (normalizeName(els.rosterSelect.value) === normalizeName(rosterPlayer.name)) {
    els.rosterSelect.value = "";
  }
  refreshUi();
}

function addPlayer(player) {
  state.players.push(player);
  invalidateCurrentSession();
  els.playersList.innerHTML = renderPlayerList(state.players);
}

function removePlayer(id) {
  state.players = state.players.filter((player) => player.id !== id);
  invalidateCurrentSession();
  els.playersList.innerHTML = renderPlayerList(state.players);
}

function addPlayerFromRoster() {
  const selectedName = els.rosterSelect.value;
  if (!selectedName) {
    alert("Select a saved player from the roster first.");
    return;
  }

  const rosterPlayer = state.roster.find((player) => normalizeName(player.name) === selectedName);
  if (!rosterPlayer) {
    return;
  }

  const alreadyInSession = state.players.some((player) => normalizeName(player.name) === selectedName);
  if (alreadyInSession) {
    alert(`${rosterPlayer.name} is already in this session setup.`);
    return;
  }

  addPlayer({ ...rosterPlayer, id: rosterPlayer.id });
  els.rosterSelect.value = "";
}

function startShuffleAnimation(playerNames) {
  stopShuffleAnimation();
  els.shuffleTitle.textContent = "Generating balanced session teams...";
  const update = () => {
    const picks = [...playerNames]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(8, playerNames.length));
    els.shuffleState.innerHTML = picks.map((name) => `<span class="shuffle-pill">${escapeHtml(name)}</span>`).join("");
  };
  update();
  state.shuffleInterval = window.setInterval(update, 140);
}

function stopShuffleAnimation(message) {
  if (state.shuffleInterval) {
    window.clearInterval(state.shuffleInterval);
    state.shuffleInterval = null;
  }
  if (message) {
    els.shuffleTitle.textContent = message;
  }
}

function renderShuffleTeams(session) {
  els.shuffleState.innerHTML = session.teams.map((team, index) => `
    <span class="shuffle-pill">Team ${index + 1}: ${escapeHtml(team.members.map((member) => member.name).join(" + "))}</span>
  `).join("");
}

function setGenerateBusy(isBusy) {
  els.generateBtn.disabled = isBusy;
  els.generateBtn.textContent = isBusy ? "Generating..." : getButtonText(els.generateBtn);
}

async function handleGenerate() {
  const players = state.players.map((player) => ({
    ...player,
    name: player.name.trim()
  }));
  const settings = getSessionSettings();
  const validationError = validatePlayers(players);

  if (validationError) {
    alert(validationError);
    return;
  }
  if (settings.courts < 1) {
    alert("Number of courts must be at least 1.");
    return;
  }
  if (settings.totalRounds < 1) {
    alert("Booking duration must allow at least one full match.");
    return;
  }

  startShuffleAnimation(players.map((player) => player.name));
  setGenerateBusy(true);

  try {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 1800);
    });

    const teams = generateTeams(players, state.sessions);
    const scheduleData = scheduleMatches(teams, settings.totalRounds, settings.courts, state.sessions);
    const session = buildSession(teams, scheduleData, settings);

    state.currentSession = session;
    await saveSession(session);
    state.sessions = await getStoredSessions();

    stopShuffleAnimation("Session locked in");
    els.teamsOutput.innerHTML = renderTeamDisplay(session);
    els.scheduleOutput.innerHTML = renderMatchSchedule(session);
    renderHistory(state.sessions);
    updateStats();
    renderShuffleTeams(session);
  } catch (error) {
    stopShuffleAnimation("Generation failed");
    els.shuffleState.innerHTML = "";
    alert(error.message || "Something went wrong while generating the session.");
  } finally {
    setGenerateBusy(false);
  }
}

async function exportHistory() {
  const payload = await getExportableHistoryPayload(state.currentSession, state.roster);
  if (!payload.sessions.length && !payload.roster.length) {
    alert("There is no saved history to export yet.");
    return;
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  createDownload(
    `ultrapadel-pro-history-${stamp}.json`,
    JSON.stringify(payload, null, 2),
    "application/json;charset=utf-8;"
  );
}

function handleImportHistoryFile(file) {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const result = await importHistoryFromText(String(reader.result || ""), state.roster);
      state.sessions = result.sessions;
      state.roster = result.roster;
      refreshUi();
      alert(`History import complete. Added ${result.addedSessions} new sessions and ${result.addedRosterPlayers} roster entries.`);
    } catch (error) {
      alert(error.message || "The selected history file could not be imported.");
    } finally {
      els.importHistoryInput.value = "";
    }
  };
  reader.onerror = () => {
    alert("The selected file could not be read.");
    els.importHistoryInput.value = "";
  };
  reader.readAsText(file);
}

async function handleSignUp() {
  try {
    const { email, password } = validateAuthCredentials();
    setAuthFeedback("Creating your account...", "");
    await signUp(email, password);
    state.currentUser = await getCurrentUser();
    await syncLocalCacheToSupabase();
    await loadData();
    setAuthFeedback("Account created. Check your email if Supabase confirmation is enabled, then sign in if required.", "success");
    closeAccountFlow();
  } catch (error) {
    setAuthFeedback(error.message || "Could not create your account.", "error");
  }
}

async function handleSignIn() {
  try {
    const { email, password } = validateAuthCredentials();
    setAuthFeedback("Signing you in...", "");
    await signIn(email, password);
    state.currentUser = await getCurrentUser();
    await syncLocalCacheToSupabase();
    await loadData();
    setAuthFeedback("Signed in successfully.", "success");
    closeAccountFlow();
  } catch (error) {
    setAuthFeedback(error.message || "Could not sign you in.", "error");
  }
}

async function handleSignOut() {
  try {
    await signOut();
    state.currentUser = null;
    state.currentSession = null;
    await loadData();
    setAuthFeedback("Signed out. The app is now using local browser storage.", "success");
    closeAccountFlow();
  } catch (error) {
    setAuthFeedback(error.message || "Could not sign you out.", "error");
  }
}

function attachEvents() {
  els.openAuthFlyoutBtn.addEventListener("click", () => {
    const isHidden = els.authFlyout.classList.contains("hidden");
    if (isHidden) {
      openAccountFlow();
      return;
    }
    closeAccountFlow();
  });

  els.closeAuthFlyoutBtn.addEventListener("click", closeAccountFlow);
  els.authFlyout.addEventListener("click", (event) => {
    if (event.target === els.authFlyout) {
      closeAccountFlow();
    }
  });

  els.openAddRosterBtn.addEventListener("click", openAddRosterFlow);
  els.openRosterManagerBtn.addEventListener("click", openRosterManagerFlow);
  els.addFromRosterBtn.addEventListener("click", addPlayerFromRoster);
  els.closeRosterModalBtn.addEventListener("click", closeRosterFlow);
  els.cancelRosterEditBtn.addEventListener("click", closeRosterFlow);
  els.rosterForm.addEventListener("submit", handleRosterFormSubmit);
  els.rosterModal.addEventListener("click", (event) => {
    if (event.target === els.rosterModal) {
      closeRosterFlow();
    }
  });

  els.signUpBtn.addEventListener("click", handleSignUp);
  els.signInBtn.addEventListener("click", handleSignIn);
  els.signOutBtn.addEventListener("click", handleSignOut);
  els.generateBtn.addEventListener("click", handleGenerate);
  els.exportHistoryBtn.addEventListener("click", exportHistory);
  els.importHistoryBtn.addEventListener("click", () => {
    els.importHistoryInput.click();
  });
  els.importHistoryInput.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.files || !target.files[0]) {
      return;
    }
    handleImportHistoryFile(target.files[0]);
  });

  els.clearHistoryBtn.addEventListener("click", async () => {
    if (confirm("Clear all stored session history? This will remove previous team-combination memory.")) {
      await clearHistory();
      state.sessions = [];
      renderHistory(state.sessions);
      updateStats();
    }
  });

  [els.courts, els.bookingDuration, els.matchDuration].forEach((input) => {
    input.addEventListener("input", () => {
      invalidateCurrentSession();
      updateStats();
    });
  });

  els.playersList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const removeId = target.getAttribute("data-remove-id");
    if (removeId) {
      removePlayer(removeId);
    }
  });

  els.rosterManagerList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const editButton = target.closest("[data-roster-edit]");
    if (editButton instanceof HTMLElement) {
      openEditRosterFlow(editButton.getAttribute("data-roster-edit"));
      return;
    }

    const button = target.closest("[data-roster-remove]");
    if (!(button instanceof HTMLElement)) {
      return;
    }

    await handleRemoveRosterPlayer(button.getAttribute("data-roster-remove"));
  });

  window.addEventListener("online", async () => {
    await syncLocalCacheToSupabase();
    await loadData();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.authFlyout.classList.contains("hidden")) {
      closeAccountFlow();
    }
  });
}

async function init() {
  await initAuth();
  attachEvents();
  await loadData();
  setAuthFeedback("", "");

  window.UltraPadelAuth = {
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    reloadData: loadData
  };
}

init().catch((error) => {
  console.error("Failed to initialize UltraPadel Pro:", error);
});
