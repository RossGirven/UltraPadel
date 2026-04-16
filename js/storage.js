import { supabase, isSupabaseConfigured } from "./supabaseClient.js";
import { getCurrentUser } from "./auth.js";
import { isSameSession, normalizeName, teamKey, ensureUuid } from "./logic.js";

const SESSION_CACHE_KEY = "ultrapadel-pro-sessions";
const ROSTER_CACHE_KEY = "ultrapadel-pro-roster";
const HISTORY_LIMIT = 40;

function readLocalJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeLocalJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getLocalSessions() {
  return readLocalJson(SESSION_CACHE_KEY, []);
}

function getLocalRoster() {
  return readLocalJson(ROSTER_CACHE_KEY, []);
}

function cacheSessions(sessions) {
  writeLocalJson(SESSION_CACHE_KEY, sessions.slice(0, HISTORY_LIMIT));
}

function cacheRoster(roster) {
  writeLocalJson(ROSTER_CACHE_KEY, roster);
}

function mergeSessionShape(row) {
  if (!row) {
    return null;
  }
  const sessionData = row.session_data || {};
  return {
    ...sessionData,
    id: ensureUuid(row.id || sessionData.id),
    createdAt: row.created_at || sessionData.createdAt
  };
}

function normalizeSession(session) {
  return {
    ...session,
    id: ensureUuid(session.id),
    createdAt: session.createdAt || session.created_at || new Date().toISOString()
  };
}

function rosterRecordFromPlayer(player, userId) {
  return {
    id: player.id,
    user_id: userId,
    name: player.name,
    sex: player.sex,
    skill: Number(player.skill),
    created_at: player.createdAt || new Date().toISOString()
  };
}

function normalizeRosterPlayer(player) {
  return {
    id: ensureUuid(player.id),
    name: player.name,
    sex: player.sex,
    skill: Number(player.skill),
    createdAt: player.createdAt || player.created_at || new Date().toISOString()
  };
}

function dedupeRoster(roster) {
  const byId = new Map();
  const byName = new Map();

  roster.forEach((player) => {
    const normalized = normalizeRosterPlayer(player);
    byId.set(normalized.id, normalized);
  });

  byId.forEach((player) => {
    byName.set(normalizeName(player.name), player);
  });

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function canUseRemote() {
  if (!navigator.onLine || !isSupabaseConfigured() || !supabase) {
    return null;
  }

  const user = await getCurrentUser();
  return user || null;
}

export async function getStoredSessions() {
  const localSessions = getLocalSessions().map(normalizeSession);
  const user = await canUseRemote();

  if (!user) {
    return localSessions;
  }

  const { data, error } = await supabase
    .from("sessions")
    .select("id, created_at, session_data")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return localSessions;
  }

  const sessions = (data || []).map(mergeSessionShape).filter(Boolean);
  cacheSessions(sessions);
  return sessions;
}

export async function getStoredRoster() {
  const localRoster = dedupeRoster(getLocalRoster());
  const user = await canUseRemote();

  if (!user) {
    return localRoster;
  }

  const { data, error } = await supabase
    .from("players")
    .select("id, name, sex, skill, created_at")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error) {
    return localRoster;
  }

  const roster = dedupeRoster((data || []).map(normalizeRosterPlayer));
  cacheRoster(roster);
  return roster;
}

export async function saveSession(session) {
  const localSessions = getLocalSessions();
  const normalizedSession = normalizeSession(session);
  const merged = [...localSessions];
  const existingIndex = merged.findIndex((entry) => isSameSession(entry, normalizedSession));
  if (existingIndex >= 0) {
    merged.splice(existingIndex, 1);
  }
  merged.unshift(normalizedSession);
  cacheSessions(merged);

  const user = await canUseRemote();
  if (!user) {
    return session;
  }

  const payload = {
    id: normalizedSession.id,
    user_id: user.id,
    created_at: normalizedSession.createdAt,
    session_data: {
      ...normalizedSession
    }
  };

  const { error } = await supabase.from("sessions").upsert(payload).select("id");
  if (error) {
    console.error("Failed to save session to Supabase:", error);
  }

  return normalizedSession;
}

export async function saveRoster(roster) {
  const normalizedRoster = dedupeRoster(roster.map(normalizeRosterPlayer));
  cacheRoster(normalizedRoster);

  const user = await canUseRemote();
  if (!user || !normalizedRoster.length) {
    return normalizedRoster;
  }

  const rows = normalizedRoster.map((player) => rosterRecordFromPlayer(player, user.id));
  const { error } = await supabase.from("players").upsert(rows).select("id");
  if (error) {
    console.error("Failed to save roster to Supabase:", error);
  }

  return normalizedRoster;
}

export async function upsertPlayer(player, currentRoster = []) {
  const nextRoster = dedupeRoster(currentRoster);
  const name = String(player.name || "").trim();
  if (!name) {
    return nextRoster;
  }

  const incoming = normalizeRosterPlayer({ ...player, name });
  const existingIndex = nextRoster.findIndex((entry) => {
    return entry.id === incoming.id || normalizeName(entry.name) === normalizeName(name);
  });
  if (existingIndex >= 0) {
    nextRoster[existingIndex] = { ...nextRoster[existingIndex], ...incoming };
  } else {
    nextRoster.push(incoming);
  }

  const dedupedRoster = dedupeRoster(nextRoster);
  await saveRoster(dedupedRoster);
  return dedupedRoster;
}

export async function removeRosterPlayer(playerName, currentRoster = []) {
  const normalizedName = normalizeName(playerName);
  const nextRoster = dedupeRoster(currentRoster).filter((player) => normalizeName(player.name) !== normalizedName);
  cacheRoster(nextRoster);

  const user = await canUseRemote();
  if (user) {
    const { error } = await supabase
      .from("players")
      .delete()
      .eq("user_id", user.id)
      .ilike("name", String(playerName || "").trim());

    if (error) {
      console.error("Failed to remove roster player from Supabase:", error);
    }
  }

  return nextRoster;
}

export async function clearHistory() {
  localStorage.removeItem(SESSION_CACHE_KEY);

  const user = await canUseRemote();
  if (!user) {
    return;
  }

  const { error } = await supabase.from("sessions").delete().eq("user_id", user.id);
  if (error) {
    console.error("Failed to clear remote history:", error);
  }
}

export async function getExportableHistoryPayload(currentSession = null, roster = []) {
  const sessions = await getStoredSessions();
  const mergedSessions = [...sessions];
  if (currentSession && !mergedSessions.some((session) => isSameSession(session, currentSession))) {
    mergedSessions.unshift(currentSession);
  }

  return {
    app: "UltraPadel Pro",
    type: "history-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: mergedSessions,
    roster: roster.length ? roster : await getStoredRoster()
  };
}

async function saveImportedSessions(sessions) {
  const user = await canUseRemote();
  if (!user || !sessions.length) {
    return;
  }

  const rows = sessions.map((session) => ({
    id: ensureUuid(session.id),
    user_id: user.id,
    created_at: session.createdAt,
    session_data: {
      ...session,
      id: ensureUuid(session.id)
    }
  }));

  const { error } = await supabase.from("sessions").upsert(rows).select("id");
  if (error) {
    console.error("Failed to import remote sessions:", error);
  }
}

async function saveImportedRoster(roster) {
  const user = await canUseRemote();
  if (!user || !roster.length) {
    return;
  }

  const rows = roster.map((player) => rosterRecordFromPlayer(player, user.id));
  const { error } = await supabase.from("players").upsert(rows).select("id");
  if (error) {
    console.error("Failed to import remote roster:", error);
  }
}

export async function importHistoryFromText(rawText, currentRoster = []) {
  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch (error) {
    throw new Error("This file is not valid JSON.");
  }

  if (!payload || payload.app !== "UltraPadel Pro" || payload.type !== "history-backup") {
    throw new Error("This file was not recognized as an UltraPadel Pro history export.");
  }

  const storedSessions = await getStoredSessions();
  const incomingSessions = Array.isArray(payload.sessions) ? payload.sessions.map(normalizeSession) : [];
  const mergedSessions = [...storedSessions];
  const sessionsToSave = [];
  let addedSessions = 0;

  incomingSessions.forEach((session) => {
    if (!mergedSessions.some((existing) => isSameSession(existing, session))) {
      mergedSessions.push(session);
      sessionsToSave.push(session);
      addedSessions += 1;
    }
  });

  mergedSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  cacheSessions(mergedSessions);
  await saveImportedSessions(sessionsToSave);

  const incomingRoster = Array.isArray(payload.roster) ? dedupeRoster(payload.roster.map(normalizeRosterPlayer)) : [];
  const rosterMap = new Map(dedupeRoster([...currentRoster, ...getLocalRoster()]).map((player) => [
    normalizeName(player.name),
    normalizeRosterPlayer(player)
  ]));
  let addedRosterPlayers = 0;

  incomingRoster.forEach((player) => {
    const key = normalizeName(player.name);
    if (!rosterMap.has(key)) {
      addedRosterPlayers += 1;
    }
    rosterMap.set(key, normalizeRosterPlayer(player));
  });

  mergedSessions.forEach((session) => {
    (session.teams || []).forEach((team) => {
      (team.members || []).forEach((member) => {
        const key = normalizeName(member.name);
        if (!key) {
          return;
        }
        if (!rosterMap.has(key)) {
          addedRosterPlayers += 1;
        }
        rosterMap.set(key, normalizeRosterPlayer(member));
      });
    });
  });

  const mergedRoster = dedupeRoster(Array.from(rosterMap.values()));
  cacheRoster(mergedRoster);
  await saveImportedRoster(mergedRoster);

  return {
    addedSessions,
    addedRosterPlayers,
    sessions: mergedSessions,
    roster: mergedRoster
  };
}

export async function syncLocalCacheToSupabase() {
  const user = await canUseRemote();
  if (!user) {
    return;
  }

  const localSessions = getLocalSessions().map(normalizeSession);
  const localRoster = dedupeRoster(getLocalRoster());
  await saveImportedSessions(localSessions);
  await saveImportedRoster(localRoster);
}

export function buildSessionRowData(session) {
  return {
    id: session.id,
    created_at: session.createdAt,
    session_data: session
  };
}

export function buildTeamLabel(team) {
  return team.key || teamKey(team);
}
