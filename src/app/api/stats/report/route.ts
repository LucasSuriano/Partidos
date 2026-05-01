/**
 * GET /api/stats/report?tournamentId=xxx&playerId=yyy
 *
 * Genera el reporte detallado de un jugador específico.
 * Corre server-side para evitar el doble cálculo que ocurría en el cliente
 * (getPlayerReport llamaba a calculateStats internamente).
 */
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getPlayerReport } from '@/lib/stats';
import type { Match, Player, MatchResult } from '@/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId');
  const playerId = searchParams.get('playerId');

  if (!tournamentId || !playerId) {
    return NextResponse.json({ error: 'tournamentId y playerId son requeridos' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 1. Fetch players
  const { data: playersData, error: playersError } = await supabase
    .from('players')
    .select('id, name')
    .eq('tournament_id', tournamentId);

  if (playersError || !playersData) {
    return NextResponse.json({ error: 'Error cargando jugadores' }, { status: 500 });
  }

  // 2. Fetch badges
  const { data: votesData } = await supabase
    .from('player_badges')
    .select('player_id, badge_id, user_id')
    .eq('tournament_id', tournamentId);

  const players: Player[] = playersData.map(p => ({
    id: p.id,
    name: p.name,
    badges: votesData
      ? votesData.filter(v => v.player_id === p.id).map(v => ({ badgeId: v.badge_id, userId: v.user_id }))
      : [],
  }));

  // 3. Fetch ALL matches
  const { data: matchesData, error: matchesError } = await supabase
    .from('matches')
    .select('id, date, result, score_a, score_b, metadata')
    .eq('tournament_id', tournamentId)
    .order('date', { ascending: true });

  if (matchesError || !matchesData) {
    return NextResponse.json({ error: 'Error cargando partidos' }, { status: 500 });
  }

  // 4. Fetch pivot
  const matchIds = matchesData.map(m => m.id);
  let matches: Match[] = [];

  if (matchIds.length > 0) {
    const { data: pivotData } = await supabase
      .from('match_players')
      .select('match_id, player_id, team')
      .in('match_id', matchIds);

    matches = matchesData.map(m => ({
      id: m.id,
      date: m.date,
      result: m.result as MatchResult,
      scoreA: m.score_a,
      scoreB: m.score_b,
      metadata: m.metadata,
      teamA: pivotData ? pivotData.filter(p => p.match_id === m.id && p.team === 'A').map(p => p.player_id) : [],
      teamB: pivotData ? pivotData.filter(p => p.match_id === m.id && p.team === 'B').map(p => p.player_id) : [],
    }));
  }

  // 5. Generar reporte del jugador
  try {
    const report = getPlayerReport(playerId, players, matches);
    return NextResponse.json(report, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 });
  }
}
