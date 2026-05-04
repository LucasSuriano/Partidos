"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Player, Match, MatchResult, Badge, MatchMetadata } from '../types';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastContext';

interface AppContextProps {
  players: Player[];
  matches: Match[];
  badges: Badge[];
  activeTournamentId: string | null;
  addPlayer: (name: string) => Promise<void>;
  removePlayer: (id: string) => Promise<void>;
  updatePlayer: (id: string, updates: Partial<Player>) => Promise<void>;
  togglePlayerBadge: (playerId: string, badgeId: string, userId: string) => Promise<void>;
  addMatch: (date: string, teamA: string[], teamB: string[], result: MatchResult, scoreA?: number, scoreB?: number, metadata?: MatchMetadata) => Promise<void>;
  removeMatch: (id: string) => Promise<void>;
  updateMatchResult: (id: string, result: MatchResult, scoreA?: number, scoreB?: number, date?: string, metadata?: MatchMetadata) => Promise<void>;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode; tournamentId: string | null; tournamentTypeId?: string | null }> = ({ children, tournamentId, tournamentTypeId }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!tournamentId) {
      setPlayers([]);
      setMatches([]);
      setIsLoaded(true);
      return;
    }

    const loadData = async () => {
      setIsLoaded(false);

      // Fetch badges definition (global or specific to this sport type)
      const { data: badgesDefData, error: badgesDefError } = await supabase.from('badges').select('*');
      if (badgesDefError) {
        console.error("Error loading badge definitions:", badgesDefError);
      }
      if (badgesDefData) {
        // Filter out badges that belong exclusively to another sport
        const filteredBadges = badgesDefData.filter(b => !b.type_id || b.type_id === tournamentTypeId);
        setBadges(filteredBadges);
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
            badges: pVotes,
            tier: p.tier,
            position: p.position
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

      if (matchesData && matchesData.length > 0) {
        // Fetch pivot table to reconstruct teams
        const matchIds = matchesData.map(m => m.id);
        const { data: pivotData, error: pivotError } = await supabase
          .from('match_players')
          .select('match_id, player_id, team')
          .in('match_id', matchIds);

        if (pivotError) console.error('match_players fetch error:', pivotError.message);

        const formattedMatches: Match[] = matchesData.map(m => {
          const teamA = pivotData
            ? pivotData.filter(p => p.match_id === m.id && p.team === 'A').map(p => p.player_id)
            : [];
          const teamB = pivotData
            ? pivotData.filter(p => p.match_id === m.id && p.team === 'B').map(p => p.player_id)
            : [];

          return {
            id: m.id,
            date: m.date,
            teamA,
            teamB,
            result: m.result as MatchResult,
            scoreA: m.score_a,
            scoreB: m.score_b,
            metadata: m.metadata
          };
        });
        setMatches(formattedMatches);
      } else if (matchesData) {
        setMatches([]);
      }
      setIsLoaded(true);
    };

    loadData();
  }, [tournamentId]);

  // ── Jugadores: esperan confirmación antes de actualizar la UI ──────────────────

  const addPlayer = async (name: string) => {
    if (!tournamentId) return;
    const newPlayer: Player = { id: crypto.randomUUID(), name };
    const { error } = await supabase
      .from('players')
      .insert([{ ...newPlayer, tournament_id: tournamentId }]);
    if (error) {
      console.error('Error al agregar jugador:', error.message);
      showToast('No se pudo agregar el jugador. Intentá de nuevo.', 'error');
      return;
    }
    setPlayers(prev => [...prev, newPlayer]);
    showToast(`${newPlayer.name} fue agregado correctamente.`, 'success');
  };

  const removePlayer = async (id: string) => {
    const { error } = await supabase.from('players').delete().eq('id', id);
    if (error) {
      console.error('Error al eliminar jugador:', error.message);
      showToast('No se pudo eliminar el jugador. Intentá de nuevo.', 'error');
      return;
    }
    setPlayers(prev => prev.filter(p => p.id !== id));
  };

  const updatePlayer = async (id: string, updates: Partial<Player>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.tier !== undefined) dbUpdates.tier = updates.tier;
    if (updates.position !== undefined) dbUpdates.position = updates.position;

    const { error } = await supabase
      .from('players')
      .update(dbUpdates)
      .eq('id', id);
    if (error) {
      console.error('Error al actualizar jugador:', error.message);
      showToast('No se pudo actualizar el jugador. Intentá de nuevo.', 'error');
      return;
    }
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  // ── Badges: optimistic update + rollback ─────────────────────────────────

  const togglePlayerBadge = async (playerId: string, badgeId: string, userId: string) => {
    if (!tournamentId) return;
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const existingBadges = player.badges || [];
    const hasVoted = existingBadges.some(b => b.badgeId === badgeId && b.userId === userId);
    const newBadges = hasVoted
      ? existingBadges.filter(b => !(b.badgeId === badgeId && b.userId === userId))
      : [...existingBadges, { badgeId, userId }];

    // Guardar estado anterior para rollback
    const previousPlayers = players;
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, badges: newBadges } : p));

    const { error } = hasVoted
      ? await supabase.from('player_badges').delete().match({ player_id: playerId, badge_id: badgeId, user_id: userId, tournament_id: tournamentId })
      : await supabase.from('player_badges').insert([{ player_id: playerId, badge_id: badgeId, user_id: userId, tournament_id: tournamentId }]);

    if (error) {
      console.error('Error al actualizar badge:', error.message);
      showToast('No se pudo actualizar la insignia.', 'error');
      setPlayers(previousPlayers);
    }
  };

  // ── Partidos: optimistic update + rollback ─────────────────────────────

  const addMatch = async (date: string, teamA: string[], teamB: string[], result: MatchResult, scoreA?: number, scoreB?: number, metadata?: MatchMetadata) => {
    if (!tournamentId) return;
    const newMatch: Match = { id: crypto.randomUUID(), date, teamA, teamB, result, scoreA, scoreB, metadata };

    // Guardar estado anterior para rollback
    const previousMatches = matches;
    setMatches(prev => [...prev, newMatch]);

    // 1. Insert into matches
    const { error } = await supabase.from('matches').insert([{
      id: newMatch.id,
      date: newMatch.date,
      result: newMatch.result,
      score_a: newMatch.scoreA,
      score_b: newMatch.scoreB,
      metadata: newMatch.metadata,
      tournament_id: tournamentId
    }]);

    if (error) {
      console.error('Error al guardar el partido:', error.message);
      showToast('No se pudo guardar el partido. Los cambios fueron revertidos.', 'error');
      setMatches(previousMatches);
      return;
    }

    // 2. Insert en match_players
    const pivotRows = [
      ...teamA.map(pid => ({ match_id: newMatch.id, player_id: pid, team: 'A' })),
      ...teamB.map(pid => ({ match_id: newMatch.id, player_id: pid, team: 'B' })),
    ];
    const { error: pivotError } = await supabase.from('match_players').insert(pivotRows);
    if (pivotError) {
      console.warn('match_players insert warning (non-critical):', pivotError.message);
    }
    showToast('Partido registrado correctamente.', 'success');
  };

  const removeMatch = async (id: string) => {
    const previousMatches = matches;
    setMatches(prev => prev.filter(m => m.id !== id));

    const { error } = await supabase.from('matches').delete().eq('id', id);
    if (error) {
      console.error('Error al eliminar el partido:', error.message);
      showToast('No se pudo eliminar el partido. Los cambios fueron revertidos.', 'error');
      setMatches(previousMatches);
    }
  };

  const updateMatchResult = async (id: string, result: MatchResult, scoreA?: number, scoreB?: number, date?: string, metadata?: MatchMetadata) => {
    const previousMatches = matches;
    setMatches(prev => prev.map(m => m.id === id
      ? { ...m, result, scoreA, scoreB, date: date ?? m.date, metadata: metadata ?? m.metadata }
      : m
    ));

    const { error } = await supabase.from('matches').update({
      result,
      score_a: scoreA ?? null,
      score_b: scoreB ?? null,
      date: date ?? undefined,
      metadata: metadata ?? undefined
    }).eq('id', id);

    if (error) {
      console.error('Error al actualizar el partido:', error.message);
      showToast('No se pudo actualizar el partido. Los cambios fueron revertidos.', 'error');
      setMatches(previousMatches);
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
