/**
 * GET /api/stats/report?tournamentId=xxx&playerId=yyy
 *
 * Genera el reporte detallado de un jugador específico.
 * - Requiere JWT válido (Authorization: Bearer o cookie auth_token)
 * - Queries paralelas con Promise.all para reducir latencia ~50%
 */
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { verifyApiAuth, verifyTournamentAccess } from '@/lib/auth-api';
import { applyRateLimit } from '@/lib/rate-limit';
import { getPlayerReport } from '@/lib/stats';
import type { Match, Player, MatchResult } from '@/types';

export async function GET(request: Request) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const auth = verifyApiAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // ── Rate Limiting ────────────────────────────────────────────────────────
  const { success, remaining, resetAt } = applyRateLimit(`report_${auth.userId}`, 60, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: 'Demasiadas peticiones. Intenta de nuevo en unos segundos.' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetAt.toString()
        }
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId');
  const playerId = searchParams.get('playerId');

  if (!tournamentId || !playerId) {
    return NextResponse.json({ error: 'tournamentId y playerId son requeridos' }, { status: 400 });
  }

  // ── Verificación de Permisos sobre el Torneo ──────────────────────────────
  const hasAccess = await verifyTournamentAccess(auth.userId, tournamentId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'No tienes acceso a este torneo' }, { status: 403 });
  }

  const supabase = createServiceClient();

  // ── Queries paralelas: players + votes + matches al mismo tiempo ──────────
  const [playersResult, votesResult, matchesResult] = await Promise.all([
    supabase
      .from('players')
      .select('id, name')
      .eq('tournament_id', tournamentId),
    supabase
      .from('player_badges')
      .select('player_id, badge_id, user_id')
      .eq('tournament_id', tournamentId),
    supabase
      .from('matches')
      .select('id, date, result, score_a, score_b, metadata')
      .eq('tournament_id', tournamentId)
      .order('date', { ascending: true }),
  ]);

  if (playersResult.error || !playersResult.data) {
    return NextResponse.json({ error: 'Error cargando jugadores' }, { status: 500 });
  }
  if (matchesResult.error || !matchesResult.data) {
    return NextResponse.json({ error: 'Error cargando partidos' }, { status: 500 });
  }

  const playersData = playersResult.data;
  const votesData = votesResult.data ?? [];
  const matchesData = matchesResult.data;

  // ── Construir players ────────────────────────────────────────────────────
  const players: Player[] = playersData.map(p => ({
    id: p.id,
    name: p.name,
    badges: votesData
      .filter(v => v.player_id === p.id)
      .map(v => ({ badgeId: v.badge_id, userId: v.user_id })),
  }));

  // ── Fetch pivot ──────────────────────────────────────────────────────────
  let matches: Match[] = [];
  const matchIds = matchesData.map(m => m.id);

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

  // ── Generar reporte ──────────────────────────────────────────────────────
  try {
    const report = getPlayerReport(playerId, players, matches);
    return NextResponse.json(report, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        'X-RateLimit-Limit': '60',
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetAt.toString()
      },
    });
  } catch {
    return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 });
  }
}
