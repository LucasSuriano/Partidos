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
  createTournament: (name: string, description: string, ownerId: string, typeId: string) => Promise<Tournament | null>;
  updateTournamentConfig: (matchTypes: number[]) => Promise<boolean>;
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
      setActiveTournamentState(null);
      sessionStorage.removeItem('active_tournament');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    let accessibleTournaments: Tournament[] = [];

    try {
      if (user.role === 'superadmin') {
        // Superadmin sees ALL tournaments
        const { data, error } = await supabase
          .from('tournaments')
          .select('*, owner:users!owner_id(username), type:tournament_types(name, slug, icon), tournament_formats(match_type)')
          .order('created_at', { ascending: false });
        if (!error && data) {
          accessibleTournaments = data.map((t: any) => ({
            ...t,
            owner_username: t.owner?.username ?? null,
            type_name: t.type?.name ?? null,
            type_slug: t.type?.slug ?? null,
            type_icon: t.type?.icon ?? null,
            match_types: t.tournament_formats ? t.tournament_formats.map((f: any) => f.match_type).sort((a:number,b:number)=>a-b) : [],
            owner: undefined,
            type: undefined,
            tournament_formats: undefined
          })) as Tournament[];
        }
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
            .select('*, owner:users!owner_id(username), type:tournament_types(name, slug, icon), tournament_formats(match_type)')
            .in('id', tournamentIds)
            .order('created_at', { ascending: false });
          if (!tError && tournamentData) {
            accessibleTournaments = tournamentData.map((t: any) => ({
              ...t,
              owner_username: t.owner?.username ?? null,
              type_name: t.type?.name ?? null,
              type_slug: t.type?.slug ?? null,
              type_icon: t.type?.icon ?? null,
              match_types: t.tournament_formats ? t.tournament_formats.map((f: any) => f.match_type).sort((a:number,b:number)=>a-b) : [],
              owner: undefined,
              type: undefined,
              tournament_formats: undefined
            })) as Tournament[];
          }
        } else if (error) {
          console.warn('user_tournaments not accessible:', error.message);
          // Do NOT fallback to all tournaments — show empty list instead
        }
      }

      setTournaments(accessibleTournaments);

      // Restore saved tournament ONLY if it's in the user's accessible list
      const saved = sessionStorage.getItem('active_tournament');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Tournament;
          const stillAccessible = accessibleTournaments.find(t => t.id === parsed.id);
          if (stillAccessible) {
            // Use the fresh data from the DB (may have owner_id updates)
            setActiveTournamentState(stillAccessible);
          } else {
            // User no longer has access to this tournament — clear it
            sessionStorage.removeItem('active_tournament');
            setActiveTournamentState(null);
          }
        } catch {
          sessionStorage.removeItem('active_tournament');
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

  const createTournament = async (name: string, description: string, ownerId: string, typeId: string): Promise<Tournament | null> => {
    if (user?.role !== 'superadmin') return null;

    const { data, error } = await supabase
      .from('tournaments')
      .insert([{ name, description, owner_id: ownerId, type_id: typeId }])
      .select('*, owner:users!owner_id(username), type:tournament_types(name, slug, icon), tournament_formats(match_type)')
      .single();

    if (error || !data) {
      console.error('Error creating tournament:', error);
      return null;
    }

    // Auto-associate the owner with the tournament in user_tournaments
    await supabase
      .from('user_tournaments')
      .insert([{ user_id: ownerId, tournament_id: data.id }]);

    const newTournament: Tournament = {
      ...(data as any),
      owner_username: (data as any).owner?.username ?? null,
      type_name: (data as any).type?.name ?? null,
      type_slug: (data as any).type?.slug ?? null,
      type_icon: (data as any).type?.icon ?? null,
      match_types: (data as any).tournament_formats ? (data as any).tournament_formats.map((f: any) => f.match_type).sort((a:number,b:number)=>a-b) : [],
      owner: undefined,
      type: undefined,
      tournament_formats: undefined
    };
    setTournaments(prev => [newTournament, ...prev]);
    return newTournament;
  };
  const updateTournamentConfig = async (matchTypes: number[]): Promise<boolean> => {
    if (!activeTournament) return false;
    try {
      // 1. Limpiar todos los formatos anteriores del torneo
      const { error: deleteError } = await supabase
        .from('tournament_formats')
        .delete()
        .eq('tournament_id', activeTournament.id);

      if (deleteError) {
        console.error('Error vaciando formatos:', deleteError);
        return false;
      }

      // 2. Insertar las nuevas filas (si se eligieron formatos)
      if (matchTypes.length > 0) {
        const insertData = matchTypes.map((t) => ({ tournament_id: activeTournament.id, match_type: t }));
        const { error: insertError } = await supabase
          .from('tournament_formats')
          .insert(insertData);

        if (insertError) {
          console.error('Error insertando nuevos formatos:', insertError);
          return false;
        }
      }
      
      const updatedStr = JSON.stringify({ ...activeTournament, match_types: matchTypes });
      sessionStorage.setItem('active_tournament', updatedStr);
      setTournaments(prev => prev.map(t => t.id === activeTournament.id ? { ...t, match_types: matchTypes } : t));
      setActiveTournamentState(prev => prev ? { ...prev, match_types: matchTypes } : null);
      return true;
    } catch(e) {
      console.error('Catch error in updateTournamentConfig:', e);
      return false;
    }
  };

  return (
    <TournamentContext.Provider value={{
      tournaments,
      activeTournament,
      setActiveTournament,
      clearActiveTournament,
      createTournament,
      updateTournamentConfig,
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
