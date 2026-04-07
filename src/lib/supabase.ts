import { createClient } from '@supabase/supabase-js';

// Verificamos que las variables de entorno existan
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Faltan configurar las variables de entorno de Supabase.');
}

// Creamos y exportamos el cliente de Supabase
export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? ''
);
