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

// ─── Match metadata: discriminated union por deporte ───────────────────────
/** Campos comunes a todos los deportes */
type MatchMetadataBase = {
  video_url?: string | null;
  mvp_id?: string | null;
};

/** Metadata para torneos de fútbol (y otros deportes sin sets) */
export type FootballMetadata = MatchMetadataBase & {
  sport?: 'football';
};

/** Metadata para torneos de pádel (incluye detalle de sets) */
export type PadelMetadata = MatchMetadataBase & {
  sport: 'padel';
  sets: { scoreA: number; scoreB: number }[];
};

/**
 * Tipo unificado de metadata para un Match.
 * Usar `metadata.sport` para discriminar entre deportes.
 * Para compatibilidad con datos históricos sin `sport`, ambos tipos lo tienen opcional.
 */
export type MatchMetadata = FootballMetadata | PadelMetadata;
// ───────────────────────────────────────────────────────────────────────────

export type Match = {
  id: string;
  date: string; // ISO string
  teamA: string[]; // array of player IDs
  teamB: string[]; // array of player IDs
  result: MatchResult;
  scoreA?: number | null;
  scoreB?: number | null;
  metadata?: MatchMetadata | null;
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
  mvps: number;
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
  mvps: number;
};
