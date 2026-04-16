import {
  createPlayer,
  normalizeName,
  calculateTotalRounds,
  validatePlayers,
  generateTeams,
  scheduleMatches,
  buildSession
} from "./logic.js";
import {
  getElements,
  renderPlayers,
  renderRoster,
  renderTeams,
  renderSchedule,
  renderHistory,
  updateStats,
  renderAuthState,
  openRosterModal,
  closeRosterModal,
  setRosterModalState,
  startShuffleAnimation,
  stopShuffleAnimation,
  renderShuffleTeams
} from "./ui.js";
import {
  getStoredSessions,
  getStoredRoster,
  saveSession,
  removeSession,
  upsertPlayer,
  removeRosterPlayer,
  clearHistory,
  getExportableHistoryPayload,
  importHistoryFromText,
  syncLocalCacheToSupabase
} from "./storage.js";
import { initAuth, getCurrentUser, signIn, signOut, signUp } from "./auth.js";

const els = getElements();

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

function invalidateCurrentSession() {
  if (!state.currentSession) {
    return;
  }

  state.currentSession = null;
  stopShuffleAnimation(els, state, "Ready to build a session");
  els.shuffleState.innerHTML = "";
  refreshUi();
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

function buildInitialPlayers(roster) {
  return [];
}

function refreshUi() {
  renderAuthState(
    {
      currentUser: state.currentUser,
      message: state.authMessage,
      variant: state.authVariant
    },
    els
  );
  renderPlayers(state.players, els);
  renderRoster(state.roster, els, normalizeName);
  setRosterModalState(
    {
      title: state.rosterModalMode === "edit" ? "Edit Roster Player" : "Add To Roster",
      subtitle: state.rosterModalMode === "edit"
        ? "Update this player and save the changes back to the roster."
        : "Enter full player details, then submit them to the saved roster.",
      submitLabel: state.rosterModalMode === "edit" ? "Save Changes" : "Submit To Roster",
      player: state.editingRosterId
        ? state.roster.find((player) => player.id === state.editingRosterId)
        : null,
      message: state.rosterModalMessage,
      variant: state.rosterModalVariant
    },
    els
  );
  renderHistory(state.sessions, els);
  renderTeams(state.currentSession, els);
  renderSchedule(state.currentSession, els);
  els.reshuffleBtn.disabled = !state.currentSession;
  updateStats(
    {
      rounds: getSessionSettings().totalRounds,
      currentSession: state.currentSession,
      sessions: state.sessions
    },
    els
  );
}

async function loadData() {
  state.currentUser = await getCurrentUser();
  state.sessions = await getStoredSessions();
  state.roster = await getStoredRoster();
  state.players = state.players.filter((player) => state.roster.some((rosterPlayer) => rosterPlayer.id === player.id));
  if (!state.players.length) {
    state.players = buildInitialPlayers(state.roster);
  }
  refreshUi();
}

function getAuthCredentials() {
  return {
    email: String(els.authEmail.value || "").trim(),
    password: String(els.authPassword.value || "")
  };
}

function setAuthFeedback(message, variant = "") {
  state.authMessage = message;
  state.authVariant = variant;
  renderAuthState(
    {
      currentUser: state.currentUser,
      message: state.authMessage,
      variant: state.authVariant
    },
    els
  );
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

async function persistRosterPlayer(player) {
  state.roster = await upsertPlayer(player, state.roster);
  refreshUi();
}

function resetRosterModal(mode = "add") {
  state.rosterModalMode = mode;
  state.editingRosterId = null;
  state.rosterModalMessage = "";
  state.rosterModalVariant = "";
}

function setRosterModalFeedback(message, variant = "") {
  state.rosterModalMessage = message;
  state.rosterModalVariant = variant;
  refreshUi();
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

function openAddRosterFlow() {
  resetRosterModal("add");
  refreshUi();
  openRosterModal(els);
  els.rosterNameInput.focus();
}

function openEditRosterFlow(playerId) {
  state.rosterModalMode = "edit";
  state.editingRosterId = playerId;
  state.rosterModalMessage = "";
  state.rosterModalVariant = "";
  refreshUi();
  openRosterModal(els);
  els.rosterNameInput.focus();
}

function openRosterManagerFlow() {
  resetRosterModal("add");
  refreshUi();
  openRosterModal(els);
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

function closeRosterFlow() {
  resetRosterModal("add");
  refreshUi();
  closeRosterModal(els);
}

async function handleGenerate() {
  await runSessionGeneration({ saveToHistory: true });
}

async function runSessionGeneration({ saveToHistory }) {
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

  startShuffleAnimation(players.map((player) => player.name), els, state);
  els.generateBtn.disabled = true;
  els.reshuffleBtn.disabled = true;

  try {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 1800);
    });

    const teams = generateTeams(players, state.sessions);
    const scheduleData = scheduleMatches(teams, settings.totalRounds, settings.courts, state.sessions);
    const session = buildSession(teams, scheduleData, settings);

    state.currentSession = session;
    if (saveToHistory) {
      await saveSession(session);
      state.sessions = await getStoredSessions();
    }

    stopShuffleAnimation(els, state, saveToHistory ? "Session locked in" : "Session reshuffled");
    renderTeams(session, els);
    renderSchedule(session, els);
    renderHistory(state.sessions, els);
    updateStats(
      {
        rounds: settings.totalRounds,
        currentSession: state.currentSession,
        sessions: state.sessions
      },
      els
    );
    renderShuffleTeams(session, els);
  } catch (error) {
    stopShuffleAnimation(els, state, "Generation failed");
    els.shuffleState.innerHTML = "";
    alert(error.message || "Something went wrong while generating the session.");
  } finally {
    els.generateBtn.disabled = false;
    els.reshuffleBtn.disabled = !state.currentSession;
  }
}

async function handleReshuffle() {
  await runSessionGeneration({ saveToHistory: false });
}

function addPlayer(player) {
  state.players.push(player);
  invalidateCurrentSession();
  renderPlayers(state.players, els);
}

function removePlayer(id) {
  state.players = state.players.filter((player) => player.id !== id);
  invalidateCurrentSession();
  renderPlayers(state.players, els);
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

  addPlayer({
    ...rosterPlayer,
    id: rosterPlayer.id
  });
  els.rosterSelect.value = "";
}

async function exportHistory() {
  const payload = await getExportableHistoryPayload(state.currentSession, state.roster);
  if (!payload.sessions.length && !payload.roster.length) {
    alert("There is no saved history to export yet.");
    return;
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  link.href = url;
  link.download = `ultrapadel-pro-history-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
  } catch (error) {
    setAuthFeedback(error.message || "Could not sign you out.", "error");
  }
}

async function handleRemoveHistorySession(sessionId) {
  const existingSession = state.sessions.find((session) => session.id === sessionId);
  if (!existingSession) {
    return;
  }

  if (!confirm("Remove this recent session record?")) {
    return;
  }

  state.sessions = await removeSession(sessionId);
  if (state.currentSession?.id === sessionId) {
    state.currentSession = null;
    stopShuffleAnimation(els, state, "Ready to build a session");
    els.shuffleState.innerHTML = "";
  }
  refreshUi();
}

function attachEvents() {
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
  els.reshuffleBtn.addEventListener("click", handleReshuffle);
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
      renderHistory(state.sessions, els);
      updateStats(
        {
          rounds: getSessionSettings().totalRounds,
          currentSession: state.currentSession,
          sessions: state.sessions
        },
        els
      );
    }
  });

  [els.courts, els.bookingDuration, els.matchDuration].forEach((input) => {
    input.addEventListener("input", () => {
      invalidateCurrentSession();
      updateStats(
        {
          rounds: getSessionSettings().totalRounds,
          currentSession: state.currentSession,
          sessions: state.sessions
        },
        els
      );
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

  els.historyOutput.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest("[data-history-remove]");
    if (!(button instanceof HTMLElement)) {
      return;
    }

    await handleRemoveHistorySession(button.getAttribute("data-history-remove"));
  });

  window.addEventListener("online", async () => {
    await syncLocalCacheToSupabase();
    await loadData();
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
