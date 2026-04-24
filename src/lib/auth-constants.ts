/**
 * Constantes y helpers compartidos para los endpoints de autenticación.
 * Este archivo es seguro para importar tanto desde el servidor como desde el cliente
 * (no contiene secrets, solo configuración pública de auth).
 */

/** Número de rondas de bcrypt. Usar SIEMPRE esta constante, nunca un número literal. */
export const BCRYPT_ROUNDS = 12;

/**
 * Orígenes permitidos para CORS.
 * Incluye la web de producción, localhost para dev, y Capacitor para el APK.
 */
const ALLOWED_ORIGINS = [
  'https://partidos-ruby.vercel.app',
  'http://localhost:3000',
  'http://localhost',
  'capacitor://localhost',
];

/**
 * Devuelve los headers CORS correctos según el origen de la request.
 * Solo permite orígenes de la lista, rechazando el resto con el origen de producción.
 */
export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const allowed =
    requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
      ? requestOrigin
      : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    // Importante: indica a los proxies/CDN que el response varía según el origen
    Vary: 'Origin',
  };
}
