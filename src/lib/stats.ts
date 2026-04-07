import { Match, Player, PlayerStats } from '../types';

export function calculateStats(players: Player[], matches: Match[]): PlayerStats[] {
  const statsMap: Record<string, Omit<PlayerStats, 'player'>> = {};

  // Initialize stats for all players
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
    };
  });

  const teammateWins: Record<string, Record<string, number>> = {};
  const teammateLosses: Record<string, Record<string, number>> = {};
  const opponentWins: Record<string, Record<string, number>> = {};
  
  const currentStreaks: Record<string, { type: 'WIN' | 'LOSS' | 'DRAW' | null, count: number }> = {};

  players.forEach(p => {
    teammateWins[p.id] = {};
    teammateLosses[p.id] = {};
    opponentWins[p.id] = {};
    currentStreaks[p.id] = { type: null, count: 0 };
  });

  const sortedMatches = [...matches].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sortedMatches.forEach(match => {
    const teamA = match.teamA;
    const teamB = match.teamB;
    const result = match.result;

    const processTeam = (team: string[], isWin: boolean, isLoss: boolean, isDraw: boolean, opponents: string[]) => {
      team.forEach(playerId => {
        if (!statsMap[playerId]) return;
        statsMap[playerId].matchesPlayed += 1;
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

        // Record teammates
        team.forEach(teammateId => {
          if (playerId !== teammateId) {
            if (isWin) teammateWins[playerId][teammateId] = (teammateWins[playerId][teammateId] || 0) + 1;
            if (isLoss) teammateLosses[playerId][teammateId] = (teammateLosses[playerId][teammateId] || 0) + 1;
          }
        });

        // Record opponents
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

    processTeam(teamA, teamAWins, teamBWins, isDraw, teamB);
    processTeam(teamB, teamBWins, teamAWins, isDraw, teamA);
  });

  const getTopPlayers = (counts: Record<string, number>): { players: Player[], count: number } | null => {
    let topIds: string[] = [];
    let max = 0;
    Object.entries(counts).forEach(([id, count]) => {
      if (count > max) {
        max = count;
        topIds = [id];
      } else if (count === max && max > 0) {
        topIds.push(id);
      }
    });
    if (topIds.length === 0) return null;
    
    const matchedPlayers = topIds
      .map(id => players.find(p => p.id === id))
      .filter((p): p is Player => p !== undefined);

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

    return {
      player: p,
      ...s,
      winPercentage: winPct,
      bestTeammate: bestT ? { players: bestT.players, matches: bestT.count } : null,
      worstTeammate: worstT ? { players: worstT.players, matches: worstT.count } : null,
      favoriteVictim: favVic ? { players: favVic.players, winsAgainst: favVic.count } : null,
    };
  }).sort((a, b) => b.wins - a.wins || b.winPercentage - a.winPercentage); // Sort by gross wins then win %
}
