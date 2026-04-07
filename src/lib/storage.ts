import { Player, Match } from '../types';

const PLAYERS_KEY = 'partidos_players';
const MATCHES_KEY = 'partidos_matches';

export const storage = {
  getPlayers: (): Player[] => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(PLAYERS_KEY) || '[]');
    } catch {
      return [];
    }
  },
  
  savePlayers: (players: Player[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
    }
  },
  
  getMatches: (): Match[] => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(MATCHES_KEY) || '[]');
    } catch {
      return [];
    }
  },
  
  saveMatches: (matches: Match[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MATCHES_KEY, JSON.stringify(matches));
    }
  }
};
