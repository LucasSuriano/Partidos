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
  bestTeammate: { players: Player[]; matches: number } | null;
  worstTeammate: { players: Player[]; matches: number } | null;
  favoriteVictim: { players: Player[]; winsAgainst: number } | null;
  currentStreak: { type: 'WIN' | 'LOSS' | 'DRAW' | null, count: number };
};

export type RelationStats = {
  player: Player;
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winPercentage: number;
};

export type PlayerReport = {
  player: Player;
  teammates: RelationStats[];
  opponents: RelationStats[];
};
