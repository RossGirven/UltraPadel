export const MAX_GENERATION_ATTEMPTS = 900;
export const EXACT_TEAM_SEARCH_LIMIT = 12;

export function uid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : ((random & 0x3) | 0x8);
    return value.toString(16);
  });
}

export function ensureUuid(value) {
  const stringValue = String(value || "");
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(stringValue) ? stringValue : uid();
}

export function createPlayer(name, sex, skill) {
  return { id: uid(), name, sex, skill };
}

export function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

export function averageSkill(players) {
  return players.reduce((sum, player) => sum + Number(player.skill), 0) / players.length;
}

export function teamKey(team) {
  return team.members.map((member) => normalizeName(member.name)).sort().join("|");
}

export function clonePlayers(players) {
  return players.map((player) => ({ ...player, skill: Number(player.skill) }));
}

export function shuffleArray(input) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function calculateTotalRounds(bookingDuration, matchDuration) {
  const totalBooking = Number(bookingDuration) || 0;
  const matchLength = Number(matchDuration) || 0;
  if (totalBooking <= 0 || matchLength <= 0) {
    return 0;
  }
  return Math.floor(totalBooking / matchLength);
}

export function validatePlayers(players) {
  if (players.length < 4) {
    return "Add at least 4 players to create doubles teams.";
  }
  if (players.length % 2 !== 0) {
    return "Player count must be even so everyone can be placed in fixed teams of 2.";
  }
  const names = players.map((player) => player.name.trim()).filter(Boolean);
  if (names.length !== players.length) {
    return "Every player needs a name.";
  }
  const normalized = new Set(names.map((name) => normalizeName(name)));
  if (normalized.size !== names.length) {
    return "Player names must be unique for history tracking to work properly.";
  }
  return "";
}

export function buildTeamHistoryMap(sessions) {
  const historyMap = new Map();
  sessions.forEach((session) => {
    (session.teams || []).forEach((team) => {
      const key = team.members.map((member) => normalizeName(member.name)).sort().join("|");
      historyMap.set(key, (historyMap.get(key) || 0) + 1);
    });
  });
  return historyMap;
}

export function buildMatchHistoryMap(sessions) {
  const historyMap = new Map();
  sessions.forEach((session) => {
    (session.matches || []).forEach((match) => {
      const teams = [match.teamAKey, match.teamBKey].sort().join("::");
      historyMap.set(teams, (historyMap.get(teams) || 0) + 1);
    });
  });
  return historyMap;
}

export function isSameSession(left, right) {
  if (!left || !right) {
    return false;
  }
  const leftTeams = (left.teams || []).map((team) => team.key || teamKey(team)).sort().join("::");
  const rightTeams = (right.teams || []).map((team) => team.key || teamKey(team)).sort().join("::");
  return left.createdAt === right.createdAt && leftTeams === rightTeams;
}

function evaluateTeaming(pairing, historyMap) {
  const teamAverages = pairing.map((team) => averageSkill(team));
  const sessionAverage = teamAverages.reduce((sum, value) => sum + value, 0) / teamAverages.length;

  let repeatedTeams = 0;
  let repeatWeight = 0;
  let sameSexTeams = 0;
  let averageSpreadPenalty = 0;
  let internalBalancePenalty = 0;

  pairing.forEach((team, index) => {
    const key = team.map((member) => normalizeName(member.name)).sort().join("|");
    const repeats = historyMap.get(key) || 0;
    if (repeats > 0) {
      repeatedTeams += 1;
      repeatWeight += repeats;
    }
    if (team[0].sex === team[1].sex) {
      sameSexTeams += 1;
    }
    averageSpreadPenalty += Math.abs(teamAverages[index] - sessionAverage) * 12;
    internalBalancePenalty += Math.abs(Number(team[0].skill) - Number(team[1].skill)) * 3;
  });

  return {
    repeatedTeams,
    repeatWeight,
    sameSexTeams,
    averageSpreadPenalty,
    internalBalancePenalty,
    totalScore: (sameSexTeams * 10) + averageSpreadPenalty + internalBalancePenalty
  };
}

function compareTeamingMetrics(left, right) {
  if (!left) {
    return 1;
  }
  if (!right) {
    return -1;
  }
  if (left.repeatedTeams !== right.repeatedTeams) {
    return left.repeatedTeams < right.repeatedTeams ? -1 : 1;
  }
  if (left.repeatWeight !== right.repeatWeight) {
    return left.repeatWeight < right.repeatWeight ? -1 : 1;
  }
  if (left.sameSexTeams !== right.sameSexTeams) {
    return left.sameSexTeams < right.sameSexTeams ? -1 : 1;
  }
  if (left.averageSpreadPenalty !== right.averageSpreadPenalty) {
    return left.averageSpreadPenalty < right.averageSpreadPenalty ? -1 : 1;
  }
  if (left.internalBalancePenalty !== right.internalBalancePenalty) {
    return left.internalBalancePenalty < right.internalBalancePenalty ? -1 : 1;
  }
  return 0;
}

function getPairHistoryCount(playerA, playerB, historyMap) {
  const key = [playerA.name, playerB.name].map((name) => normalizeName(name)).sort().join("|");
  return historyMap.get(key) || 0;
}

function buildGreedyCandidate(players, historyMap) {
  const pool = shuffleArray(players);
  const candidate = [];

  while (pool.length) {
    const first = pool.shift();
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < pool.length; i += 1) {
      const partner = pool[i];
      let score = getPairHistoryCount(first, partner, historyMap) * 1000;
      score += Math.abs(Number(first.skill) - Number(partner.skill)) * 4;
      if (first.sex === partner.sex) {
        score += 7;
      }
      score += Math.random() * 1.5;

      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    const partner = pool.splice(bestIndex, 1)[0];
    candidate.push([first, partner]);
  }

  return candidate;
}

function searchBestTeaming(remainingPlayers, historyMap, currentPairing, bestResult) {
  if (!remainingPlayers.length) {
    const metrics = evaluateTeaming(currentPairing, historyMap);
    if (!bestResult || compareTeamingMetrics(metrics, bestResult.metrics) < 0) {
      return {
        pairing: currentPairing.map((team) => team.map((player) => ({ ...player }))),
        metrics
      };
    }
    return bestResult;
  }

  const [first, ...rest] = remainingPlayers;
  const orderedPartners = rest
    .map((partner, index) => ({
      partner,
      index,
      repeatCount: getPairHistoryCount(first, partner, historyMap),
      sameSex: first.sex === partner.sex ? 1 : 0,
      skillGap: Math.abs(Number(first.skill) - Number(partner.skill))
    }))
    .sort((a, b) => {
      if (a.repeatCount !== b.repeatCount) {
        return a.repeatCount - b.repeatCount;
      }
      if (a.sameSex !== b.sameSex) {
        return a.sameSex - b.sameSex;
      }
      if (a.skillGap !== b.skillGap) {
        return a.skillGap - b.skillGap;
      }
      return Math.random() - 0.5;
    });

  let candidateBest = bestResult;

  orderedPartners.forEach(({ partner, index }) => {
    const nextPairing = [...currentPairing, [first, partner]];
    const partialMetrics = evaluateTeaming(nextPairing, historyMap);

    if (candidateBest && partialMetrics.repeatedTeams > candidateBest.metrics.repeatedTeams) {
      return;
    }

    const nextRemaining = rest.filter((_, restIndex) => restIndex !== index);
    candidateBest = searchBestTeaming(nextRemaining, historyMap, nextPairing, candidateBest);
  });

  return candidateBest;
}

export function generateTeams(players, sessions) {
  const historyMap = buildTeamHistoryMap(sessions);
  const workingPlayers = shuffleArray(clonePlayers(players));
  let bestPairing = null;
  let bestMetrics = null;

  if (workingPlayers.length <= EXACT_TEAM_SEARCH_LIMIT) {
    const result = searchBestTeaming(workingPlayers, historyMap, [], null);
    bestPairing = result ? result.pairing : null;
    bestMetrics = result ? result.metrics : null;
  } else {
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const pairing = buildGreedyCandidate(workingPlayers, historyMap);
      const metrics = evaluateTeaming(pairing, historyMap);
      if (!bestMetrics || compareTeamingMetrics(metrics, bestMetrics) < 0) {
        bestPairing = pairing;
        bestMetrics = metrics;
      }
    }
  }

  return (bestPairing || []).map((pair, index) => ({
    id: `T${index + 1}`,
    members: pair.map((player) => ({ ...player })),
    averageSkill: averageSkill(pair),
    mixed: pair[0].sex !== pair[1].sex
  })).sort((a, b) => a.averageSkill - b.averageSkill);
}

function generateTeamMatchups(teams, matchHistoryMap) {
  const matchups = [];
  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      const key = [teamKey(teams[i]), teamKey(teams[j])].sort().join("::");
      matchups.push({
        teamA: teams[i],
        teamB: teams[j],
        key,
        historicalCount: matchHistoryMap.get(key) || 0
      });
    }
  }
  return matchups.sort((a, b) => a.historicalCount - b.historicalCount);
}

function pickBestMatchCandidate(candidates, playCounts, lastPlayedTeams, seenSessionMatchups) {
  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate) => {
    const teamAKey = teamKey(candidate.teamA);
    const teamBKey = teamKey(candidate.teamB);
    const playGapScore = playCounts[teamAKey] + playCounts[teamBKey];
    const repeatPenalty = seenSessionMatchups.has(candidate.key) ? 180 : 0;
    const restPenalty = (lastPlayedTeams.has(teamAKey) ? 16 : 0) + (lastPlayedTeams.has(teamBKey) ? 16 : 0);
    const historicalPenalty = candidate.historicalCount * 8;
    const score = playGapScore * 10 + repeatPenalty + restPenalty + historicalPenalty;

    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  });

  return best;
}

export function scheduleMatches(teams, totalRounds, courtCount, sessions) {
  const matchHistoryMap = buildMatchHistoryMap(sessions);
  const allMatchups = generateTeamMatchups(teams, matchHistoryMap);
  const playCounts = Object.fromEntries(teams.map((team) => [teamKey(team), 0]));
  const schedule = [];
  const seenSessionMatchups = new Set();
  let lastPlayedTeams = new Set();

  for (let round = 1; round <= totalRounds; round += 1) {
    const matchesThisRound = [];
    const teamsUsedThisRound = new Set();

    for (let court = 1; court <= courtCount; court += 1) {
      const available = allMatchups.filter((match) => {
        const teamAKey = teamKey(match.teamA);
        const teamBKey = teamKey(match.teamB);
        return !teamsUsedThisRound.has(teamAKey) && !teamsUsedThisRound.has(teamBKey);
      });

      if (!available.length) {
        break;
      }

      const chosen = pickBestMatchCandidate(available, playCounts, lastPlayedTeams, seenSessionMatchups);
      if (!chosen) {
        break;
      }

      const teamAKey = teamKey(chosen.teamA);
      const teamBKey = teamKey(chosen.teamB);

      teamsUsedThisRound.add(teamAKey);
      teamsUsedThisRound.add(teamBKey);
      seenSessionMatchups.add(chosen.key);
      playCounts[teamAKey] += 1;
      playCounts[teamBKey] += 1;

      matchesThisRound.push({
        court,
        teamA: chosen.teamA,
        teamB: chosen.teamB,
        teamAKey,
        teamBKey
      });
    }

    schedule.push({
      round,
      matches: matchesThisRound
    });

    lastPlayedTeams = teamsUsedThisRound;
  }

  return { schedule, playCounts };
}

export function buildSession(teams, scheduleData, settings) {
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    sessionDate: settings.sessionDate || new Date().toISOString().slice(0, 10),
    settings: {
      sessionDate: settings.sessionDate || new Date().toISOString().slice(0, 10),
      courts: Number(settings.courts) || 0,
      bookingDuration: Number(settings.bookingDuration) || 0,
      matchDuration: Number(settings.matchDuration) || 0,
      totalRounds: Number(settings.totalRounds) || 0
    },
    teams: teams.map((team) => ({
      id: team.id,
      members: team.members.map((member) => ({ id: member.id, name: member.name, sex: member.sex, skill: Number(member.skill) })),
      averageSkill: team.averageSkill,
      mixed: team.mixed,
      key: teamKey(team)
    })),
    rounds: scheduleData.schedule,
    matches: scheduleData.schedule.flatMap((round) => round.matches.map((match) => ({
      round: round.round,
      court: match.court,
      teamAKey: match.teamAKey,
      teamBKey: match.teamBKey
    }))),
    playCounts: scheduleData.playCounts
  };
}
