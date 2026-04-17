"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Player, Match, MatchResult, Badge } from '../types';
import { supabase } from '../lib/supabase';

interface AppContextProps {
  players: Player[];
  matches: Match[];
  badges: Badge[];
  activeTournamentId: string | null;
  addPlayer: (name: string) => Promise<void>;
  removePlayer: (id: string) => Promise<void>;
  updatePlayer: (id: string, newName: string) => Promise<void>;
  togglePlayerBadge: (playerId: string, badgeId: string, userId: string) => Promise<void>;
  addMatch: (date: string, teamA: string[], teamB: string[], result: MatchResult, scoreA?: number, scoreB?: number) => Promise<void>;
  removeMatch: (id: string) => Promise<void>;
  updateMatchResult: (id: string, result: MatchResult, scoreA?: number, scoreB?: number) => Promise<void>;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode; tournamentId: string | null }> = ({ children, tournamentId }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!tournamentId) {
      setPlayers([]);
      setMatches([]);
      setIsLoaded(true);
      return;
    }

    const loadData = async () => {
      setIsLoaded(false);

      // Fetch badges definition (global — not scoped to tournament)
      const { data: badgesDefData, error: badgesDefError } = await supabase.from('badges').select('*');
      if (badgesDefError) {
        console.error("Error loading badge definitions:", badgesDefError);
      }
      if (badgesDefData) {
        setBadges(badgesDefData);
      }

      // Fetch players for this tournament
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournamentId);
      if (playersError) console.error("Error loading players:", playersError);

      // Fetch player badges (votes) for this tournament
      const { data: votesData, error: votesError } = await supabase
        .from('player_badges')
        .select('*')
        .eq('tournament_id', tournamentId);
      if (votesError && votesError.code !== '42P01') {
        console.error("Error loading votes:", votesError);
      }

      if (playersData) {
        const formattedPlayers: Player[] = playersData.map(p => {
          const pVotes = votesData
            ? votesData.filter(v => v.player_id === p.id).map(v => ({ badgeId: v.badge_id, userId: v.user_id }))
            : [];
          return {
            id: p.id,
            name: p.name,
            badges: pVotes
          };
        });
        setPlayers(formattedPlayers);
      }

      // Fetch matches for this tournament
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('date', { ascending: false });
      if (matchesError) console.error("Error loading matches:", matchesError);
      if (matchesData) {
        const formattedMatches: Match[] = matchesData.map(m => ({
          id: m.id,
          date: m.date,
          teamA: m.team_a,
          teamB: m.team_b,
          result: m.result as MatchResult,
          scoreA: m.score_a,
          scoreB: m.score_b
        }));
        setMatches(formattedMatches);
      }
      setIsLoaded(true);
    };

    loadData();
  }, [tournamentId]);

  const addPlayer = async (name: string) => {
    if (!tournamentId) return;
    const newPlayer: Player = { id: crypto.randomUUID(), name };
    setPlayers(prev => [...prev, newPlayer]);
    await supabase.from('players').insert([{ ...newPlayer, tournament_id: tournamentId }]);
  };

  const removePlayer = async (id: string) => {
    setPlayers(prev => prev.filter(p => p.id !== id));
    await supabase.from('players').delete().eq('id', id);
  };

  const updatePlayer = async (id: string, newName: string) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
    await supabase.from('players').update({ name: newName }).eq('id', id);
  };

  const togglePlayerBadge = async (playerId: string, badgeId: string, userId: string) => {
    if (!tournamentId) return;
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const existingBadges = player.badges || [];
    const hasVoted = existingBadges.some(b => b.badgeId === badgeId && b.userId === userId);

    const newBadges = hasVoted
      ? existingBadges.filter(b => !(b.badgeId === badgeId && b.userId === userId))
      : [...existingBadges, { badgeId, userId }];

    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, badges: newBadges } : p));

    if (hasVoted) {
      await supabase.from('player_badges').delete().match({ player_id: playerId, badge_id: badgeId, user_id: userId, tournament_id: tournamentId });
    } else {
      await supabase.from('player_badges').insert([{ player_id: playerId, badge_id: badgeId, user_id: userId, tournament_id: tournamentId }]);
    }
  };

  const addMatch = async (date: string, teamA: string[], teamB: string[], result: MatchResult, scoreA?: number, scoreB?: number) => {
    if (!tournamentId) return;
    const newMatch: Match = { id: crypto.randomUUID(), date, teamA, teamB, result, scoreA, scoreB };
    setMatches(prev => [...prev, newMatch]);

    const { error } = await supabase.from('matches').insert([{
      id: newMatch.id,
      date: newMatch.date,
      team_a: newMatch.teamA,
      team_b: newMatch.teamB,
      result: newMatch.result,
      score_a: newMatch.scoreA,
      score_b: newMatch.scoreB,
      tournament_id: tournamentId
    }]);

    if (error) {
      console.error("Supabase insert error:", error);
      alert("Error al guardar el partido en la base de datos: " + error.message);
    }
  };

  const removeMatch = async (id: string) => {
    setMatches(prev => prev.filter(m => m.id !== id));
    await supabase.from('matches').delete().eq('id', id);
  };

  const updateMatchResult = async (id: string, result: MatchResult, scoreA?: number, scoreB?: number) => {
    setMatches(prev => prev.map(m => m.id === id ? { ...m, result, scoreA, scoreB } : m));

    const { error } = await supabase.from('matches').update({
      result,
      score_a: scoreA ?? null,
      score_b: scoreB ?? null
    }).eq('id', id);

    if (error) {
      console.error("Supabase update error:", error);
      alert("Error al actualizar los goles en la base de datos: " + error.message);
    }
  };

  if (!isLoaded) return null;

  return (
    <AppContext.Provider value={{ players, matches, badges, activeTournamentId: tournamentId, addPlayer, removePlayer, updatePlayer, togglePlayerBadge, addMatch, removeMatch, updateMatchResult }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within an AppProvider");
  return context;
};
