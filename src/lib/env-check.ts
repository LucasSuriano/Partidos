/**
 * Validación de variables de entorno requeridas.
 *
 * Se ejecuta al arrancar el servidor (importado desde layout.tsx).
 * Lanza warnings claros en consola para cada variable faltante,
 * evitando errores silenciosos en runtime.
 */
import 'server-only';

interface EnvVar {
  key: string;
  required: boolean;
  description: string;
}

const ENV_VARS: EnvVar[] = [
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'URL del proyecto Supabase (Project Settings → API → Project URL)',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Clave anon pública de Supabase (Project Settings → API → anon public)',
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Clave service_role de Supabase — solo en servidor (Project Settings → API → service_role)',
  },
  {
    key: 'JWT_SECRET',
    required: true,
    description: 'Secreto para firmar/verificar JWT de sesión — mínimo 32 caracteres',
  },
];

let validated = false;

/**
 * Verifica que todas las variables de entorno requeridas estén definidas.
 * Se ejecuta una sola vez por proceso (idempotente).
 */
export function validateEnvVars(): void {
  if (validated) return;
  validated = true;

  const missing: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.key];
    const isEmpty = !value || value.trim() === '' || value.includes('PEGAR_');

    if (envVar.required && isEmpty) {
      missing.push(envVar.key);
      console.error(
        `\x1b[31m[ENV] ❌ Falta: ${envVar.key}\x1b[0m\n` +
        `\x1b[33m      ${envVar.description}\x1b[0m`
      );
    }
  }

  if (missing.length > 0) {
    console.error(
      `\x1b[31m\n[ENV] ⚠️  ${missing.length} variable(s) de entorno faltante(s).\n` +
      `      Creá o actualizá .env.local con las claves necesarias.\n` +
      `      La app puede fallar silenciosamente en runtime.\x1b[0m\n`
    );
  } else {
    console.log('\x1b[32m[ENV] ✅ Variables de entorno validadas correctamente.\x1b[0m');
  }
}
