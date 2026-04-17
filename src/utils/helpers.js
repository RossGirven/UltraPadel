export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderAttributes(attributes = {}) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== false && value !== null && value !== undefined)
    .map(([key, value]) => {
      if (value === true) {
        return ` ${key}`;
      }
      return ` ${key}="${escapeHtml(value)}"`;
    })
    .join("");
}

export function getElements() {
  return {
    openAuthFlyoutBtn: document.getElementById("openAuthFlyoutBtn"),
    authFlyout: document.getElementById("authFlyout"),
    closeAuthFlyoutBtn: document.getElementById("closeAuthFlyoutBtn"),
    authEmail: document.getElementById("authEmail"),
    authPassword: document.getElementById("authPassword"),
    signUpBtn: document.getElementById("signUpBtn"),
    signInBtn: document.getElementById("signInBtn"),
    signOutBtn: document.getElementById("signOutBtn"),
    authStatusBadge: document.getElementById("authStatusBadge"),
    authMessage: document.getElementById("authMessage"),
    courts: document.getElementById("courts"),
    bookingDuration: document.getElementById("bookingDuration"),
    matchDuration: document.getElementById("matchDuration"),
    openAddRosterBtn: document.getElementById("openAddRosterBtn"),
    openRosterManagerBtn: document.getElementById("openRosterManagerBtn"),
    rosterSelect: document.getElementById("rosterSelect"),
    addFromRosterBtn: document.getElementById("addFromRosterBtn"),
    playersList: document.getElementById("playersList"),
    generateBtn: document.getElementById("generateBtn"),
    exportHistoryBtn: document.getElementById("exportHistoryBtn"),
    importHistoryBtn: document.getElementById("importHistoryBtn"),
    importHistoryInput: document.getElementById("importHistoryInput"),
    clearHistoryBtn: document.getElementById("clearHistoryBtn"),
    roundsStat: document.getElementById("roundsStat"),
    teamsStat: document.getElementById("teamsStat"),
    historyStat: document.getElementById("historyStat"),
    shuffleTitle: document.getElementById("shuffleTitle"),
    shuffleState: document.getElementById("shuffleState"),
    teamsOutput: document.getElementById("teamsOutput"),
    scheduleOutput: document.getElementById("scheduleOutput"),
    historyOutput: document.getElementById("historyOutput"),
    rosterModal: document.getElementById("rosterModal"),
    closeRosterModalBtn: document.getElementById("closeRosterModalBtn"),
    rosterModalTitle: document.getElementById("rosterModalTitle"),
    rosterModalSubtitle: document.getElementById("rosterModalSubtitle"),
    rosterModalMessage: document.getElementById("rosterModalMessage"),
    rosterForm: document.getElementById("rosterForm"),
    rosterNameInput: document.getElementById("rosterNameInput"),
    rosterSexInput: document.getElementById("rosterSexInput"),
    rosterSkillInput: document.getElementById("rosterSkillInput"),
    submitRosterBtn: document.getElementById("submitRosterBtn"),
    cancelRosterEditBtn: document.getElementById("cancelRosterEditBtn"),
    rosterManagerList: document.getElementById("rosterManagerList")
  };
}

export function openLayer(layer, trigger) {
  layer.classList.remove("hidden");
  layer.setAttribute("aria-hidden", "false");
  if (trigger) {
    trigger.setAttribute("aria-expanded", "true");
  }
}

export function closeLayer(layer, trigger) {
  layer.classList.add("hidden");
  layer.setAttribute("aria-hidden", "true");
  if (trigger) {
    trigger.setAttribute("aria-expanded", "false");
  }
}

export function formatDateTime(value) {
  return new Date(value).toLocaleString();
}

export function createDownload(name, contents, mimeType) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function getButtonText(button) {
  return button.dataset.defaultLabel || button.textContent || "";
}
