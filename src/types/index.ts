export type Tournament = {
  id: string;
  name: string;
  description?: string | null;
  owner_id?: string | null;
  owner_username?: string | null;
  created_at?: string;
};

export type PlayerBadgeVote = {
  badgeId: string;
  userId: string;
};

export type Player = {
  id: string;
  name: string;
  badges?: PlayerBadgeVote[];
};

export type Badge = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  description: string;
  category: string;
};

export type Role = 'superadmin' | 'admin' | 'user';

export type MatchResult = 'A_WIN' | 'B_WIN' | 'DRAW';

export type Match = {
  id: string;
  date: string; // ISO string
  teamA: string[]; // array of player IDs
  teamB: string[]; // array of player IDs
  result: MatchResult;
  scoreA?: number | null;
  scoreB?: number | null;
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
  bestTeammate: { players: Player[]; matches: number } | null;
  worstTeammate: { players: Player[]; matches: number } | null;
  favoriteVictim: { players: Player[]; winsAgainst: number } | null;
  nemesis: { players: Player[]; lossesAgainst: number } | null;
  // Estadísticas generales del jugador
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winPercentage: number;
  bestStreak: number;
  currentStreak: { type: 'WIN' | 'LOSS' | 'DRAW' | null; count: number };
  // Presencia
  presencePercentage: number; // % de partidos del total en que participó
  totalMatchesInHistory: number;
  // Ranking
  rank: number; // posición en la tabla general
  totalPlayers: number;
  // Como Equipo A vs Equipo B
  teamARecord: { wins: number; losses: number; draws: number; total: number };
  teamBRecord: { wins: number; losses: number; draws: number; total: number };
};
