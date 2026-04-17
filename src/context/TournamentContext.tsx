"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Tournament } from '../types';
import { useAuth } from './AuthContext';

interface TournamentContextProps {
  tournaments: Tournament[];
  activeTournament: Tournament | null;
  setActiveTournament: (t: Tournament) => void;
  clearActiveTournament: () => void;
  createTournament: (name: string, description: string, ownerId: string) => Promise<Tournament | null>;
  isAdminOfActiveTournament: boolean;
  isLoading: boolean;
}

const TournamentContext = createContext<TournamentContextProps | undefined>(undefined);

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTournament, setActiveTournamentState] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // The user is an admin of the active tournament if they are the owner or a superadmin
  const isAdminOfActiveTournament =
    user?.role === 'superadmin' ||
    (!!activeTournament?.owner_id && activeTournament.owner_id === user?.id);

  const loadTournaments = useCallback(async () => {
    if (!user) {
      setTournaments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      if (user.role === 'superadmin') {
        // Superadmin sees ALL tournaments
        const { data, error } = await supabase
          .from('tournaments')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) setTournaments(data as Tournament[]);
      } else {
        // Regular users and admins: only their tournaments via user_tournaments
        const { data, error } = await supabase
          .from('user_tournaments')
          .select('tournament_id')
          .eq('user_id', user.id);

        if (!error && data && data.length > 0) {
          const tournamentIds = data.map((row: { tournament_id: string }) => row.tournament_id);
          const { data: tournamentData, error: tError } = await supabase
            .from('tournaments')
            .select('*')
            .in('id', tournamentIds)
            .order('created_at', { ascending: false });
          if (!tError && tournamentData) setTournaments(tournamentData as Tournament[]);
        } else if (error) {
          // Fallback: if user_tournaments is not accessible, load all tournaments
          console.warn('user_tournaments not accessible, falling back to all tournaments:', error.message);
          const { data: allData } = await supabase
            .from('tournaments')
            .select('*')
            .order('created_at', { ascending: false });
          if (allData) setTournaments(allData as Tournament[]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTournaments();
  }, [loadTournaments]);

  const setActiveTournament = (t: Tournament) => {
    setActiveTournamentState(t);
    sessionStorage.setItem('active_tournament', JSON.stringify(t));
  };

  const clearActiveTournament = () => {
    setActiveTournamentState(null);
    sessionStorage.removeItem('active_tournament');
  };

  // Restore from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('active_tournament');
    if (saved) {
      try {
        setActiveTournamentState(JSON.parse(saved) as Tournament);
      } catch {
        sessionStorage.removeItem('active_tournament');
      }
    }
  }, []);

  const createTournament = async (name: string, description: string, ownerId: string): Promise<Tournament | null> => {
    if (user?.role !== 'superadmin') return null;

    const { data, error } = await supabase
      .from('tournaments')
      .insert([{ name, description, owner_id: ownerId }])
      .select()
      .single();

    if (error || !data) {
      console.error('Error creating tournament:', error);
      return null;
    }

    // Auto-associate the owner with the tournament in user_tournaments
    await supabase
      .from('user_tournaments')
      .insert([{ user_id: ownerId, tournament_id: data.id }])
      .select();

    const newTournament = data as Tournament;
    setTournaments(prev => [newTournament, ...prev]);
    return newTournament;
  };

  return (
    <TournamentContext.Provider value={{
      tournaments,
      activeTournament,
      setActiveTournament,
      clearActiveTournament,
      createTournament,
      isAdminOfActiveTournament,
      isLoading
    }}>
      {children}
    </TournamentContext.Provider>
  );
};

export const useTournament = () => {
  const context = useContext(TournamentContext);
  if (!context) throw new Error('useTournament must be used within a TournamentProvider');
  return context;
};
