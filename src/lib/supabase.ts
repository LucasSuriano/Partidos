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

// ⚠️ createServiceClient fue movido a src/lib/supabase-server.ts
// Ese archivo usa 'server-only' para garantizar que la service_role key
// nunca llegue al bundle del cliente. Importar desde ahí en API routes.
