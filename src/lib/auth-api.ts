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
