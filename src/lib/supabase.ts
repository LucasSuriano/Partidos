import { createClient } from '@supabase/supabase-js';

// Verificamos que las variables de entorno existan
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Faltan configurar las variables de entorno de Supabase.');
}

// Cliente principal (usado para Login con Google y mantener sesión)
export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? ''
);

// Cliente sin Auth (usado para el login manual y consultas sueltas, esquiva de fallos de caché)
export const supabaseNoAuth = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'sb-no-auth-token'
    }
  }
);

/**
 * Crea un cliente Supabase con la service_role key.
 * ⚠️ SOLO usar en API routes (server-side). Nunca importar desde componentes client-side.
 * La service_role bypasea RLS completamente — tiene acceso total.
 */
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey || serviceRoleKey === 'PEGAR_SERVICE_ROLE_KEY_AQUI') {
    console.error('⚠️ SUPABASE_SERVICE_ROLE_KEY no configurada en .env.local');
  }
  return createClient(supabaseUrl ?? '', serviceRoleKey ?? '', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}
