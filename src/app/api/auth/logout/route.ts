import { NextResponse } from 'next/server';

/**
 * Endpoint de logout que limpia el cookie httpOnly del JWT.
 * El JavaScript del cliente no puede eliminar cookies httpOnly directamente,
 * por eso se necesita este endpoint server-side.
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });

  // Sobreescribir el cookie con maxAge=0 para eliminarlo inmediatamente
  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });

  return response;
}
