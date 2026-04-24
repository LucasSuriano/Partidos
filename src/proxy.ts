import { NextRequest, NextResponse } from 'next/server';

/**
 * Rate limiting para las rutas de autenticación.
 *
 * Usa un Map en memoria por instancia de Edge. En Vercel con múltiples instancias
 * la protección es por instancia (no global), pero sigue siendo efectiva contra
 * ataques de fuerza bruta básicos. Para producción crítica, reemplazar por
 * @upstash/ratelimit con Redis.
 */

const WINDOW_MS = 60 * 1000; // 1 minuto

/** Máximo de intentos por IP por ventana de tiempo, según ruta */
const MAX_ATTEMPTS: Record<string, number> = {
  '/api/auth/login': 10,
  '/api/auth/register': 5,
  '/api/auth/change-password': 8,
};

interface RateEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateEntry>();

function checkRateLimit(ip: string, pathname: string, max: number): boolean {
  const key = `${ip}:${pathname}`;
  const now = Date.now();

  // Limpiar entradas viejas cuando el store crece (evitar memory leak)
  if (store.size > 2000) {
    for (const [k, entry] of store.entries()) {
      if (now > entry.resetAt) store.delete(k);
    }
  }

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true; // permitido
  }

  if (entry.count >= max) {
    return false; // bloqueado
  }

  entry.count++;
  return true; // permitido
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const max = MAX_ATTEMPTS[pathname];

  // Solo aplica rate limiting a POSTs de las rutas de auth
  if (max && req.method === 'POST') {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('x-real-ip') ??
      'unknown';

    const allowed = checkRateLimit(ip, pathname, max);

    if (!allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Demasiados intentos. Esperá 1 minuto antes de volver a intentar.',
        },
        {
          status: 429,
          headers: { 'Retry-After': '60' },
        }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/auth/:path*'],
};
