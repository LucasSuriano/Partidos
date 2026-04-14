"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Player, Match, MatchResult } from '../types';
import { supabase } from '../lib/supabase';

interface AppContextProps {
  players: Player[];
  matches: Match[];
  addPlayer: (name: string) => Promise<void>;
  removePlayer: (id: string) => Promise<void>;
  updatePlayer: (id: string, newName: string) => Promise<void>;
  updatePlayerBadges: (id: string, badges: string[]) => Promise<void>;
  addMatch: (date: string, teamA: string[], teamB: string[], result: MatchResult, scoreA?: number, scoreB?: number) => Promise<void>;
  removeMatch: (id: string) => Promise<void>;
  updateMatchResult: (id: string, result: MatchResult, scoreA?: number, scoreB?: number) => Promise<void>;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      // Fetch players
      const { data: playersData, error: playersError } = await supabase.from('players').select('*');
      if (playersError) console.error("Error loading players:", playersError);

      // Fetch player badges
      const { data: badgesData, error: badgesError } = await supabase.from('player_badges').select('*');
      if (badgesError && badgesError.code !== '42P01') {
        // Ignore 42P01 (relation does not exist) until they create the table
        console.error("Error loading badges:", badgesError);
      }

      if (playersData) {
        const formattedPlayers: Player[] = playersData.map(p => {
          const pBadges = badgesData ? badgesData.filter(b => b.player_id === p.id).map(b => b.badge_id) : [];
          return {
            id: p.id,
            name: p.name,
            badges: p.badges || pBadges // backward compat / default
          };
        });
        setPlayers(formattedPlayers);
      }

      // Fetch matches
      const { data: matchesData, error: matchesError } = await supabase.from('matches').select('*').order('date', { ascending: false });
      if (matchesError) console.error("Error loading matches:", matchesError);
      if (matchesData) {
        // Map database fields to our frontend type
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
  }, []);

  const addPlayer = async (name: string) => {
    const newPlayer: Player = { id: crypto.randomUUID(), name };
    // Optimistic update
    setPlayers(prev => [...prev, newPlayer]);
    
    await supabase.from('players').insert([newPlayer]);
  };

  const removePlayer = async (id: string) => {
    // Optimistic update
    setPlayers(prev => prev.filter(p => p.id !== id));
    
    await supabase.from('players').delete().eq('id', id);
  };

  const updatePlayer = async (id: string, newName: string) => {
    // Optimistic update
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
    
    await supabase.from('players').update({ name: newName }).eq('id', id);
  };

  const updatePlayerBadges = async (id: string, badges: string[]) => {
    // Optimistic update
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, badges } : p));
    
    // First remove all existing badges for the player
    const { error: delError } = await supabase.from('player_badges').delete().eq('player_id', id);
    if (delError) console.error("Error deleting old badges", delError);

    // Then insert the new ones if any
    if (badges.length > 0) {
      const inserts = badges.map(badge_id => ({ player_id: id, badge_id }));
      const { error: insError } = await supabase.from('player_badges').insert(inserts);
      if (insError) console.error("Error inserting new badges", insError);
    }
  };

  const addMatch = async (date: string, teamA: string[], teamB: string[], result: MatchResult, scoreA?: number, scoreB?: number) => {
    const newMatch: Match = { id: crypto.randomUUID(), date, teamA, teamB, result, scoreA, scoreB };
    // Optimistic update
    setMatches(prev => [...prev, newMatch]);
    
    await supabase.from('matches').insert([{
      id: newMatch.id,
      date: newMatch.date,
      team_a: newMatch.teamA,
      team_b: newMatch.teamB,
      result: newMatch.result,
      score_a: newMatch.scoreA,
      score_b: newMatch.scoreB
    }]);
  };

  const removeMatch = async (id: string) => {
    // Optimistic update
    setMatches(prev => prev.filter(m => m.id !== id));
    
    await supabase.from('matches').delete().eq('id', id);
  };

  const updateMatchResult = async (id: string, result: MatchResult, scoreA?: number, scoreB?: number) => {
    // Optimistic update
    setMatches(prev => prev.map(m => m.id === id ? { ...m, result, scoreA, scoreB } : m));
    
    await supabase.from('matches').update({
      result,
      score_a: scoreA ?? null,
      score_b: scoreB ?? null
    }).eq('id', id);
  };

  if (!isLoaded) return null; // Prevent hydration mismatch by rendering only on client

  return (
    <AppContext.Provider value={{ players, matches, addPlayer, removePlayer, updatePlayer, updatePlayerBadges, addMatch, removeMatch, updateMatchResult }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within an AppProvider");
  return context;
};
