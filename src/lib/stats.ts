import { Match, Player, PlayerStats, PlayerReport, RelationStats } from '../types';

export function calculateStats(players: Player[], matches: Match[]): PlayerStats[] {
  const statsMap: Record<string, Omit<PlayerStats, 'player'>> = {};

  players.forEach(p => {
    statsMap[p.id] = {
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winPercentage: 0,
      bestStreak: 0,
      worstStreak: 0,
      bestTeammate: null,
      worstTeammate: null,
      favoriteVictim: null,
      currentStreak: { type: null, count: 0 },
      elo: 1200,
      recentWinPercentage: 0,
      formScore: 0,
      mvps: 0,
    };
  });

  const teammateWins: Record<string, Record<string, number>> = {};
  const teammateLosses: Record<string, Record<string, number>> = {};
  const opponentWins: Record<string, Record<string, number>> = {};
  const currentStreaks: Record<string, { type: 'WIN' | 'LOSS' | 'DRAW' | null, count: number }> = {};
  const recentResults: Record<string, boolean[]> = {};

  players.forEach(p => {
    teammateWins[p.id] = {};
    teammateLosses[p.id] = {};
    opponentWins[p.id] = {};
    currentStreaks[p.id] = { type: null, count: 0 };
    recentResults[p.id] = [];
  });

  const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sortedMatches.forEach(match => {
    const teamA = match.teamA;
    const teamB = match.teamB;
    const result = match.result;

    // Elo calculation
    const avgEloA = teamA.length > 0 ? teamA.reduce((sum, id) => sum + (statsMap[id]?.elo || 1200), 0) / teamA.length : 1200;
    const avgEloB = teamB.length > 0 ? teamB.reduce((sum, id) => sum + (statsMap[id]?.elo || 1200), 0) / teamB.length : 1200;
    
    const expectedA = 1 / (1 + Math.pow(10, (avgEloB - avgEloA) / 400));
    const expectedB = 1 / (1 + Math.pow(10, (avgEloA - avgEloB) / 400));
    
    let actualA = 0.5, actualB = 0.5;
    if (result === 'A_WIN') { actualA = 1; actualB = 0; }
    else if (result === 'B_WIN') { actualA = 0; actualB = 1; }
    
    const K = 32;
    const deltaA = K * (actualA - expectedA);
    const deltaB = K * (actualB - expectedB);

    if (match.metadata?.mvp_id && statsMap[match.metadata.mvp_id]) {
      statsMap[match.metadata.mvp_id].mvps += 1;
    }

    const processTeam = (team: string[], isWin: boolean, isLoss: boolean, isDraw: boolean, opponents: string[], deltaElo: number) => {
      team.forEach(playerId => {
        if (!statsMap[playerId]) return;
        statsMap[playerId].matchesPlayed += 1;
        statsMap[playerId].elo += deltaElo;

        recentResults[playerId].push(isWin);
        if (recentResults[playerId].length > 10) {
          recentResults[playerId].shift();
        }
        if (isWin) statsMap[playerId].wins += 1;
        if (isLoss) statsMap[playerId].losses += 1;
        if (isDraw) statsMap[playerId].draws += 1;

        const resultType = isWin ? 'WIN' : (isLoss ? 'LOSS' : 'DRAW');
        const streak = currentStreaks[playerId];
        if (streak.type === resultType) {
          streak.count += 1;
        } else {
          streak.type = resultType;
          streak.count = 1;
        }

        if (isWin && streak.count > statsMap[playerId].bestStreak) {
          statsMap[playerId].bestStreak = streak.count;
        }
        if (isLoss && streak.count > statsMap[playerId].worstStreak) {
          statsMap[playerId].worstStreak = streak.count;
        }

        team.forEach(teammateId => {
          if (playerId !== teammateId) {
            if (isWin) teammateWins[playerId][teammateId] = (teammateWins[playerId][teammateId] || 0) + 1;
            if (isLoss) teammateLosses[playerId][teammateId] = (teammateLosses[playerId][teammateId] || 0) + 1;
          }
        });

        if (isWin) {
          opponents.forEach(opponentId => {
            opponentWins[playerId][opponentId] = (opponentWins[playerId][opponentId] || 0) + 1;
          });
        }
      });
    };

    const teamAWins = result === 'A_WIN';
    const teamBWins = result === 'B_WIN';
    const isDraw = result === 'DRAW';

    processTeam(teamA, teamAWins, teamBWins, isDraw, teamB, deltaA);
    processTeam(teamB, teamBWins, teamAWins, isDraw, teamA, deltaB);
  });

  const getTopPlayers = (counts: Record<string, number>): { players: Player[], count: number } | null => {
    let topIds: string[] = [];
    let max = 0;
    Object.entries(counts).forEach(([id, count]) => {
      if (count > max) { max = count; topIds = [id]; }
      else if (count === max && max > 0) topIds.push(id);
    });
    if (topIds.length === 0) return null;
    const matchedPlayers = topIds.map(id => players.find(p => p.id === id)).filter((p): p is Player => p !== undefined);
    if (matchedPlayers.length === 0) return null;
    return { players: matchedPlayers, count: max };
  };

  return players.map(p => {
    const s = statsMap[p.id];
    const bestT = getTopPlayers(teammateWins[p.id]);
    const worstT = getTopPlayers(teammateLosses[p.id]);
    const favVic = getTopPlayers(opponentWins[p.id]);
    const totalResolved = s.wins + s.losses + s.draws;
    const winPct = totalResolved > 0 ? (s.wins / totalResolved) * 100 : 0;

    const recRes = recentResults[p.id];
    const recWinPct = recRes.length > 0 ? (recRes.filter(w => w).length / recRes.length) * 100 : 0;
    const formScore = recWinPct;

    return {
      player: p,
      ...s,
      winPercentage: winPct,
      recentWinPercentage: recWinPct,
      formScore: formScore,
      bestTeammate: bestT ? { players: bestT.players, matches: bestT.count } : null,
      worstTeammate: worstT ? { players: worstT.players, matches: worstT.count } : null,
      favoriteVictim: favVic ? { players: favVic.players, winsAgainst: favVic.count } : null,
      currentStreak: currentStreaks[p.id],
    };
  }).sort((a, b) => 
    b.wins - a.wins || 
    b.draws - a.draws || 
    b.winPercentage - a.winPercentage || 
    a.player.name.localeCompare(b.player.name)
  );
}

export function getPlayerReport(playerId: string, players: Player[], matches: Match[]): PlayerReport {
  const player = players.find(p => p.id === playerId);
  if (!player) throw new Error('Player not found');

  const teammateStats: Record<string, Omit<RelationStats, 'player' | 'winPercentage'>> = {};
  const opponentStats: Record<string, Omit<RelationStats, 'player' | 'winPercentage'>> = {};

  players.forEach(p => {
    if (p.id !== playerId) {
      teammateStats[p.id] = { wins: 0, losses: 0, draws: 0, total: 0 };
      opponentStats[p.id] = { wins: 0, losses: 0, draws: 0, total: 0 };
    }
  });

  let pWins = 0, pLosses = 0, pDraws = 0, pBestStreak = 0;
  let streak = { type: null as 'WIN' | 'LOSS' | 'DRAW' | null, count: 0 };
  const teamARecord = { wins: 0, losses: 0, draws: 0, total: 0 };
  const teamBRecord = { wins: 0, losses: 0, draws: 0, total: 0 };

  const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sortedMatches.forEach(match => {
    const isPlayerInTeamA = match.teamA.includes(playerId);
    const isPlayerInTeamB = match.teamB.includes(playerId);
    if (!isPlayerInTeamA && !isPlayerInTeamB) return;

    const myTeam = isPlayerInTeamA ? match.teamA : match.teamB;
    const opponentTeam = isPlayerInTeamA ? match.teamB : match.teamA;

    const isWin = (isPlayerInTeamA && match.result === 'A_WIN') || (isPlayerInTeamB && match.result === 'B_WIN');
    const isLoss = (isPlayerInTeamA && match.result === 'B_WIN') || (isPlayerInTeamB && match.result === 'A_WIN');
    const isDraw = match.result === 'DRAW';

    if (isWin) pWins++;
    if (isLoss) pLosses++;
    if (isDraw) pDraws++;

    const resultType = isWin ? 'WIN' : (isLoss ? 'LOSS' : 'DRAW');
    if (streak.type === resultType) {
      streak.count++;
    } else {
      streak = { type: resultType, count: 1 };
    }
    if (isWin && streak.count > pBestStreak) pBestStreak = streak.count;

    if (isPlayerInTeamA) {
      teamARecord.total++;
      if (isWin) teamARecord.wins++;
      if (isLoss) teamARecord.losses++;
      if (isDraw) teamARecord.draws++;
    } else {
      teamBRecord.total++;
      if (isWin) teamBRecord.wins++;
      if (isLoss) teamBRecord.losses++;
      if (isDraw) teamBRecord.draws++;
    }

    myTeam.forEach(tid => {
      if (tid !== playerId && teammateStats[tid]) {
        teammateStats[tid].total += 1;
        if (isWin) teammateStats[tid].wins += 1;
        if (isLoss) teammateStats[tid].losses += 1;
        if (isDraw) teammateStats[tid].draws += 1;
      }
    });

    opponentTeam.forEach(oid => {
      if (opponentStats[oid]) {
        opponentStats[oid].total += 1;
        if (isWin) opponentStats[oid].wins += 1;
        if (isLoss) opponentStats[oid].losses += 1;
        if (isDraw) opponentStats[oid].draws += 1;
      }
    });
  });

  const formatStats = (statsMap: Record<string, { total: number; wins: number; losses: number; draws: number }>): RelationStats[] => {
    return Object.entries(statsMap)
      .map(([id, s]) => {
        const p = players.find(player => player.id === id)!;
        return { player: p, ...s, winPercentage: s.total > 0 ? (s.wins / s.total) * 100 : 0 };
      })
      .filter(s => s.total > 0)
      .sort((a, b) => b.total - a.total || b.winPercentage - a.winPercentage);
  };

  const teammates = formatStats(teammateStats);
  const opponents = formatStats(opponentStats);

  const getTop = (arr: RelationStats[], key: 'wins' | 'losses'): { players: Player[], count: number } | null => {
    let top: Player[] = [];
    let max = 0;
    arr.forEach(s => {
      if (s[key] > max) { max = s[key]; top = [s.player]; }
      else if (s[key] === max && max > 0) top.push(s.player);
    });
    return top.length > 0 ? { players: top, count: max } : null;
  };

  const bestT = getTop(teammates, 'wins');
  const worstT = getTop(teammates, 'losses');
  const favVic = getTop(opponents, 'wins');
  const nemesisTop = getTop(opponents, 'losses');

  const matchesPlayed = pWins + pLosses + pDraws;
  const winPercentage = matchesPlayed > 0 ? (pWins / matchesPlayed) * 100 : 0;

  const allStats = calculateStats(players, matches);
  const playerStatObj = allStats.find(s => s.player.id === playerId);
  const rank = allStats.findIndex(s => s.player.id === playerId) + 1;
  const presencePercentage = matches.length > 0 ? (matchesPlayed / matches.length) * 100 : 0;

  return {
    player,
    teammates,
    opponents,
    bestTeammate: bestT ? { players: bestT.players, matches: bestT.count } : null,
    worstTeammate: worstT ? { players: worstT.players, matches: worstT.count } : null,
    favoriteVictim: favVic ? { players: favVic.players, winsAgainst: favVic.count } : null,
    nemesis: nemesisTop ? { players: nemesisTop.players, lossesAgainst: nemesisTop.count } : null,
    matchesPlayed,
    wins: pWins,
    losses: pLosses,
    draws: pDraws,
    winPercentage,
    bestStreak: pBestStreak,
    currentStreak: { type: streak.type, count: streak.count },
    elo: playerStatObj?.elo || 1200,
    recentWinPercentage: playerStatObj?.recentWinPercentage || 0,
    formScore: playerStatObj?.formScore || 0,
    presencePercentage,
    totalMatchesInHistory: matches.length,
    rank,
    totalPlayers: players.length,
    teamARecord,
    teamBRecord,
    mvps: playerStatObj?.mvps || 0,
  };
}
