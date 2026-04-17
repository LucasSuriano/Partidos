import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// Cliente server-side
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
);

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return Response.json({ ok: false, error: 'Faltan credenciales' }, { status: 400 });
    }

    const u = username.trim();
    const p = password.trim();

    // Verificar que el username no exista ya
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', u)
      .maybeSingle();

    if (existing) {
      return Response.json({ ok: false, error: 'El usuario ya existe' }, { status: 409 });
    }

    // Hashear la contraseña con bcrypt (salt rounds = 12)
    const hash = await bcrypt.hash(p, 12);

    // Insertar en tabla users con el hash
    const { data: inserted, error: insertError } = await supabase
      .from('users')
      .insert([{
        username: u,
        password: hash,
        role: 'user',
        last_sign_in_at: new Date().toISOString()
      }])
      .select('id, username, role')
      .single();

    if (insertError || !inserted) {
      console.error('Error registrando usuario:', insertError);
      return Response.json({ ok: false, error: 'Error al crear el usuario' }, { status: 500 });
    }

    const user = { id: inserted.id, username: inserted.username, role: inserted.role };
    return Response.json({ ok: true, user });

  } catch (err) {
    console.error('Error en /api/auth/register:', err);
    return Response.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
