/**
 * Helper para verificar autenticación en API Routes.
 * Valida el JWT del header Authorization o de la cookie auth_token.
 *
 * Uso:
 *   const auth = verifyApiAuth(request);
 *   if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
 */
import 'server-only';
import jwt from 'jsonwebtoken';
import { createServiceClient } from './supabase-server';

interface AuthPayload {
  userId: string;
  username: string;
}

/**
 * Extrae y verifica el JWT desde:
 * 1. Header `Authorization: Bearer <token>`
 * 2. Cookie `auth_token`
 *
 * Retorna el payload si el token es válido, o null si no lo es.
 */
export function verifyApiAuth(request: Request): AuthPayload | null {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('JWT_SECRET no configurado — todas las API requests serán rechazadas');
    return null;
  }

  // 1. Intentar Bearer token en Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return verifyToken(token, jwtSecret);
  }

  // 2. Fallback a cookie auth_token
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
  if (match?.[1]) {
    return verifyToken(match[1], jwtSecret);
  }

  return null;
}

function verifyToken(token: string, secret: string): AuthPayload | null {
  try {
    const payload = jwt.verify(token, secret) as AuthPayload;
    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}

/**
 * Verifica si un usuario tiene acceso a un torneo específico.
 * Tiene acceso si:
 * 1. Su rol es 'superadmin' en la tabla users.
 * 2. Es el owner_id en la tabla tournaments.
 * 3. Existe un registro en user_tournaments con su user_id y el tournament_id.
 */
export async function verifyTournamentAccess(userId: string, tournamentId: string): Promise<boolean> {
  const supabase = createServiceClient();

  // 1. Check if user is superadmin
  const { data: userData } = await supabase.from('users').select('role').eq('id', userId).single();
  if (userData?.role === 'superadmin') return true;

  // 2. Check if user is owner of the tournament
  const { data: tournamentData } = await supabase.from('tournaments').select('owner_id').eq('id', tournamentId).single();
  if (tournamentData?.owner_id === userId) return true;

  // 3. Check if user is a member of the tournament
  const { data: memberData } = await supabase
    .from('user_tournaments')
    .select('tournament_id')
    .eq('user_id', userId)
    .eq('tournament_id', tournamentId)
    .maybeSingle();
    
  if (memberData) return true;

  return false;
}
