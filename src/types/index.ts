export type Player = {
  id: string;
  name: string;
};

export type MatchResult = 'A_WIN' | 'B_WIN' | 'DRAW';

export type Match = {
  id: string;
  date: string; // ISO string
  teamA: string[]; // array of player IDs
  teamB: string[]; // array of player IDs
  result: MatchResult;
};

export type PlayerStats = {
  player: Player;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winPercentage: number;
  bestStreak: number;
  worstStreak: number;
  bestTeammate: { player: Player; matches: number } | null;
  worstTeammate: { player: Player; matches: number } | null;
  favoriteVictim: { player: Player; winsAgainst: number } | null;
};
