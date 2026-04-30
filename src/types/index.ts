export type Tournament = {
  id: string;
  name: string;
  description?: string | null;
  owner_id?: string | null;
  owner_username?: string | null;
  type_id: string;
  type_slug?: string;
  type_name?: string;
  type_icon?: string;
  match_types?: number[];
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
  type_id?: string | null;
};

export type Role = 'superadmin' | 'user';

export type MatchResult = 'A_WIN' | 'B_WIN' | 'DRAW';

export type Match = {
  id: string;
  date: string; // ISO string
  teamA: string[]; // array of player IDs
  teamB: string[]; // array of player IDs
  result: MatchResult;
  scoreA?: number | null;
  scoreB?: number | null;
  metadata?: {
    sets?: { scoreA: number; scoreB: number }[];
    video_url?: string | null;
    mvp_id?: string | null;
  } | null;
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
  elo: number;
  recentWinPercentage: number;
  formScore: number;
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
  elo: number;
  recentWinPercentage: number;
  formScore: number;
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
