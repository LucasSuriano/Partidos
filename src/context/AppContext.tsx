"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Player, Match, MatchResult } from '../types';
import { supabase } from '../lib/supabase';

interface AppContextProps {
  players: Player[];
  matches: Match[];
  addPlayer: (name: string) => Promise<void>;
  removePlayer: (id: string) => Promise<void>;
  addMatch: (date: string, teamA: string[], teamB: string[], result: MatchResult) => Promise<void>;
  removeMatch: (id: string) => Promise<void>;
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
      if (playersData) setPlayers(playersData as Player[]);

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
          result: m.result as MatchResult
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

  const addMatch = async (date: string, teamA: string[], teamB: string[], result: MatchResult) => {
    const newMatch: Match = { id: crypto.randomUUID(), date, teamA, teamB, result };
    // Optimistic update
    setMatches(prev => [...prev, newMatch]);
    
    await supabase.from('matches').insert([{
      id: newMatch.id,
      date: newMatch.date,
      team_a: newMatch.teamA,
      team_b: newMatch.teamB,
      result: newMatch.result
    }]);
  };

  const removeMatch = async (id: string) => {
    // Optimistic update
    setMatches(prev => prev.filter(m => m.id !== id));
    
    await supabase.from('matches').delete().eq('id', id);
  };

  if (!isLoaded) return null; // Prevent hydration mismatch by rendering only on client

  return (
    <AppContext.Provider value={{ players, matches, addPlayer, removePlayer, addMatch, removeMatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within an AppProvider");
  return context;
};
