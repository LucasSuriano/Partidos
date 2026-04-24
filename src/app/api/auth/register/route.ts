import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServiceClient } from '@/lib/supabase-server';
import { BCRYPT_ROUNDS, getCorsHeaders } from '@/lib/auth-constants';

const RESERVED_USERNAMES = [
  'admin', 'root', 'superuser', 'moderator', 'soporte',
  'support', 'sistema', 'system', 'administrator', 'test',
];

/** Valida el formato del username: 3–30 caracteres, solo letras, números, puntos, guiones y guiones bajos */
function isValidUsername(u: string): boolean {
  return u.length >= 3 && u.length <= 30 && /^[a-zA-Z0-9._-]+$/.test(u);
}

/** Valida que la contraseña tenga al menos 6 caracteres y máximo 128 */
function isValidPassword(p: string): boolean {
  return p.length >= 6 && p.length <= 128;
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Usamos service_role: bypasea RLS, puede insertar en users sin restricciones
  const supabase = createServiceClient();

  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return Response.json({ ok: false, error: 'Cuerpo de request inválido' }, { status: 400, headers: corsHeaders });
    }

    const { username, password } = body;

    if (!username || !password) {
      return Response.json({ ok: false, error: 'Faltan credenciales' }, { status: 400, headers: corsHeaders });
    }

    const u = String(username).trim();
    const p = String(password).trim();

    // Validación de formato
    if (!isValidUsername(u)) {
      return Response.json(
        { ok: false, error: 'El nombre de usuario debe tener entre 3 y 30 caracteres y solo puede contener letras, números, puntos, guiones y guiones bajos.' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!isValidPassword(p)) {
      return Response.json(
        { ok: false, error: 'La contraseña debe tener entre 6 y 128 caracteres.' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Prevenir el registro de nombres de usuario reservados
    if (RESERVED_USERNAMES.includes(u.toLowerCase())) {
      return Response.json({ ok: false, error: 'Este nombre de usuario no está permitido' }, { status: 403, headers: corsHeaders });
    }

    // Verificar que el username no exista ya
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', u)
      .maybeSingle();

    if (existing) {
      return Response.json({ ok: false, error: 'El usuario ya existe' }, { status: 409, headers: corsHeaders });
    }

    // Hashear la contraseña con bcrypt
    const hash = await bcrypt.hash(p, BCRYPT_ROUNDS);

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
      return Response.json({ ok: false, error: 'Error al crear el usuario' }, { status: 500, headers: corsHeaders });
    }

    const user = { id: inserted.id, username: inserted.username, role: inserted.role };
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error('JWT_SECRET no configurado');
    const token = jwt.sign(
      { userId: inserted.id, username: inserted.username },
      jwtSecret,
      { expiresIn: '7d' }
    );
    return Response.json({ ok: true, user, token }, { headers: corsHeaders });


  } catch (err) {
    console.error('Error en /api/auth/register:', err);
    return Response.json({ ok: false, error: 'Error interno del servidor' }, { status: 500, headers: corsHeaders });
  }
}
