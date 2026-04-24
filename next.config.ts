import type { NextConfig } from "next";

const isCapacitor = process.env.IS_CAPACITOR === 'true';

/**
 * Headers de seguridad HTTP aplicados a todas las rutas.
 * Protegen contra XSS, clickjacking, sniffing de MIME types, etc.
 */
const securityHeaders = [
  // Impide que la app sea embebida en iframes (previene clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Impide que el navegador "adivine" el MIME type de los archivos
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Controla qué información de referrer se envía en requests salientes
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Protección XSS básica (legacy, complementa a CSP)
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Permissions Policy: deshabilitar APIs sensibles que no se usan
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  // Content Security Policy: restringe de dónde se puede cargar cada tipo de recurso
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js requiere unsafe-inline para estilos. En el futuro se puede usar nonce-based CSP.
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
      // Next.js requiere unsafe-inline y unsafe-eval para hot reload en dev
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "font-src 'self' fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      // Supabase: API REST y WebSockets para realtime
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://partidos-ruby.vercel.app`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  output: isCapacitor ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  async headers() {
    // En modo Capacitor (export estático) no se aplican headers del servidor
    if (isCapacitor) return [];
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
