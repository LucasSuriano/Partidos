import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// Cliente server-side (solo se ejecuta en el servidor, nunca en el browser)
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

    // Buscamos el usuario por username
    const { data, error } = await supabase
      .from('users')
      .select('id, username, role, password')
      .eq('username', u)
      .maybeSingle();

    if (error || !data) {
      return Response.json({ ok: false, error: 'Usuario no encontrado' }, { status: 401 });
    }

    // Si no tiene password (usuario de Google u otro), rechazamos login manual
    if (!data.password) {
      return Response.json({ ok: false, error: 'Este usuario no tiene contraseña manual' }, { status: 401 });
    }

    let isValid = false;

    const isHashed = typeof data.password === 'string' &&
      (data.password.startsWith('$2b$') || data.password.startsWith('$2a$'));

    if (isHashed) {
      // ✅ Contraseña ya en bcrypt — comparamos de forma segura
      isValid = await bcrypt.compare(p, data.password);
    } else {
      // 🔄 Contraseña en texto plano (legado) — comparamos y migramos
      isValid = data.password === p;

      if (isValid) {
        // Auto-migración: hasheamos y actualizamos en background
        const hash = await bcrypt.hash(p, 12);
        supabase
          .from('users')
          .update({ password: hash })
          .eq('username', u)
          .then(({ error: updateError }) => {
            if (updateError) console.error('Error migrando password a bcrypt:', updateError);
            else console.log(`✅ Password de "${u}" migrado a bcrypt correctamente.`);
          });
      }
    }

    if (!isValid) {
      return Response.json({ ok: false, error: 'Contraseña incorrecta' }, { status: 401 });
    }

    // Devolvemos los datos del usuario (sin password)
    const user = { id: data.id, username: data.username, role: data.role };
    return Response.json({ ok: true, user });

  } catch (err) {
    console.error('Error en /api/auth/login:', err);
    return Response.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
