export type PlayerBadgeVote = {
  badgeId: string;
  userId: string;
};

export type Player = {
  id: string;
  name: string;
  badges?: PlayerBadgeVote[];
};

export const PREDEFINED_BADGES = [
  // --- Positivas ---
  { id: 'goleador', label: 'Goleador', icon: '⚽', description: 'Olfato de gol intacto' },
  { id: 'muro', label: 'Muro', icon: '🧱', description: 'Impasable en la defensa' },
  { id: 'asistidor', label: 'Asistidor', icon: '👟', description: 'Siempre da el pase gol' },
  { id: 'mvp', label: 'MVP', icon: '🌟', description: 'Suele ser el mejor de la cancha' },
  { id: 'francotirador', label: 'Francotirador', icon: '🎯', description: 'Pega tiros libres al ángulo' },
  { id: 'pulpo', label: 'Pulpo', icon: '🐙', description: 'Recupera todas las pelotas' },
  { id: 'motorcito', label: 'Motorcito', icon: '🔋', description: 'Tiene 3 pulmones, no para' },
  { id: 'arquero_estrella', label: 'Muralla', icon: '🧤', description: 'Ataja hasta lo inatajable' },
  { id: 'magia', label: 'El 10', icon: '🪄', description: 'Pisa la pelota y hace magia' },
  { id: 'estratega', label: 'Estratega', icon: '🧠', description: 'Juega con la cabeza levantada' },
  { id: 'fair_play', label: 'Fair Play', icon: '🤝', description: 'Juega limpio, cero faltas' },
  { id: 'lirico', label: 'Lírico', icon: '🎩', description: 'Espectáculo puro, lujos y tacos' },

  // --- Negativas / Cómicas ---
  { id: 'lesiones', label: 'De Cristal', icon: '🚑', description: 'Se lesiona con el viento' },
  { id: 'rustico', label: 'Rústico', icon: '🪓', description: 'Pega de abajo y de arriba' },
  { id: 'fantasma', label: 'Fantasma', icon: '👻', description: 'Desaparece en partidos importantes' },
  { id: 'calenton', label: 'Calentón', icon: '🤬', description: 'Se enoja muy rápido' },
  { id: 'trotamundos', label: 'Trotamundos', icon: '🚶‍♂️', description: 'Juega caminando permanentemente' },
  { id: 'patadura', label: 'Patadura', icon: '🪵', description: 'Poca técnica con el balón' },
  { id: 'comilon', label: 'Comilón', icon: '🍔', description: 'No suelta la pelota ni loco' },
  { id: 'lloron', label: 'Llorón', icon: '😭', description: 'Se queja por todo, pide VAR' },
  { id: 'llegatarde', label: 'Llega Tarde', icon: '⏱️', description: 'Cae siempre cuando ya armamos' },
  { id: 'vendehumo', label: 'Vendehumo', icon: '💨', description: 'Mucha facha, poco fútbol' },
  { id: 'calesita', label: 'Calesita', icon: '🎠', description: 'Da mil vueltas y la pierde' },
  { id: 'mantequilla', label: 'Manos Flojas', icon: '🧈', description: 'Se le resbala todo (o ataja mal)' },
  { id: 'piscinero', label: 'Piscinero', icon: '🤿', description: 'Al mínimo roce se tira pidiendo falta' },
  { id: 'piernabrava', label: 'Terminator', icon: '🦾', description: 'Entra a romper y pide disculpas' },
  { id: 'abeja', label: 'Abeja', icon: '🐝', description: 'Primer pique y muere' }
];

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
