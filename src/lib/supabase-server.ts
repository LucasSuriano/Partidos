/**
 * Cliente Supabase con service_role key.
 *
 * ⚠️  SOLO usar en API routes (server-side).
 * La importación de 'server-only' hace que Next.js lance un error en build-time
 * si este archivo se importa desde un componente del cliente.
 */
import 'server-only';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

/**
 * Crea y devuelve un cliente Supabase autenticado con service_role.
 * La service_role bypasea RLS completamente — tiene acceso total a la DB.
 */
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey || serviceRoleKey === 'PEGAR_SERVICE_ROLE_KEY_AQUI') {
    console.error('⚠️ SUPABASE_SERVICE_ROLE_KEY no configurada en .env.local');
  }

  return createClient(supabaseUrl, serviceRoleKey ?? '', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
