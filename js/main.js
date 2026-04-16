import {
  createPlayer,
  clonePlayers,
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
  startShuffleAnimation,
  stopShuffleAnimation,
  renderShuffleTeams
} from "./ui.js";
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
  shuffleInterval: null
};

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

function getSeedPlayers() {
  return [
    createPlayer("Alex", "Male", 4),
    createPlayer("Sophie", "Female", 4),
    createPlayer("Daniel", "Male", 3),
    createPlayer("Maya", "Female", 5),
    createPlayer("Luca", "Male", 2),
    createPlayer("Chloe", "Female", 3),
    createPlayer("Tom", "Male", 5),
    createPlayer("Nina", "Female", 2)
  ];
}

function buildInitialPlayers(roster) {
  if (roster.length) {
    return roster.slice(0, 8).map((player) => ({
      ...player,
      id: player.id || createPlayer("", "Male", 3).id
    }));
  }
  return getSeedPlayers();
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
  renderHistory(state.sessions, els);
  renderTeams(state.currentSession, els);
  renderSchedule(state.currentSession, els);
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
  state.players = buildInitialPlayers(state.roster);
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
  renderRoster(state.roster, els, normalizeName);
}

async function handleRemoveRosterPlayer(playerName) {
  const trimmedName = String(playerName || "").trim();
  if (!trimmedName) {
    return;
  }

  if (!confirm(`Remove ${trimmedName} from the saved roster?`)) {
    return;
  }

  state.roster = await removeRosterPlayer(trimmedName, state.roster);
  if (normalizeName(els.rosterSelect.value) === normalizeName(trimmedName)) {
    els.rosterSelect.value = "";
  }
  renderRoster(state.roster, els, normalizeName);
}

async function handleGenerate() {
  const players = clonePlayers(state.players).map((player) => ({
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

  await new Promise((resolve) => {
    window.setTimeout(resolve, 1800);
  });

  for (const player of players) {
    await persistRosterPlayer(player);
  }

  const teams = generateTeams(players, state.sessions);
  const scheduleData = scheduleMatches(teams, settings.totalRounds, settings.courts, state.sessions);
  const session = buildSession(teams, scheduleData, settings);

  state.currentSession = session;
  await saveSession(session);
  state.sessions = await getStoredSessions();

  stopShuffleAnimation(els, state, "Session locked in");
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

  els.generateBtn.disabled = false;
}

async function syncPlayerField(target) {
  const player = state.players.find((entry) => entry.id === target.dataset.id);
  if (!player) {
    return;
  }

  if (target.dataset.field === "skill") {
    player.skill = Number(target.value);
  } else {
    player[target.dataset.field] = target.value;
  }

  if (String(player.name || "").trim()) {
    await persistRosterPlayer(player);
  }
}

function addPlayer(player) {
  state.players.push(player);
  renderPlayers(state.players, els);
}

function removePlayer(id) {
  state.players = state.players.filter((player) => player.id !== id);
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

  addPlayer(createPlayer(rosterPlayer.name, rosterPlayer.sex, rosterPlayer.skill));
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

function attachEvents() {
  els.addPlayerBtn.addEventListener("click", () => {
    addPlayer(createPlayer("", "Male", 3));
  });
  els.addFromRosterBtn.addEventListener("click", addPlayerFromRoster);

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

  els.playersList.addEventListener("input", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
      return;
    }
    if (target.dataset.id && target.dataset.field) {
      await syncPlayerField(target);
    }
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

  els.rosterPreview.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
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
