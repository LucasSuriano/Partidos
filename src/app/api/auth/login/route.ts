import { timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { BCRYPT_ROUNDS, getCorsHeaders } from '@/lib/auth-constants';

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

  // Usamos service_role: bypasea RLS, puede leer/escribir users sin restricciones
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

    if (!u || !p) {
      return Response.json({ ok: false, error: 'Faltan credenciales' }, { status: 400, headers: corsHeaders });
    }

    // Buscamos el usuario por username
    const { data, error } = await supabase
      .from('users')
      .select('id, username, role, password')
      .eq('username', u)
      .maybeSingle();

    if (error || !data) {
      // Respuesta genérica para no revelar si el usuario existe o no (evitar user enumeration)
      return Response.json({ ok: false, error: 'Credenciales incorrectas' }, { status: 401, headers: corsHeaders });
    }

    // Si no tiene password (usuario de Google u otro), rechazamos login manual
    if (!data.password) {
      return Response.json({ ok: false, error: 'Este usuario no tiene contraseña manual' }, { status: 401, headers: corsHeaders });
    }

    let isValid = false;

    const isHashed =
      typeof data.password === 'string' &&
      (data.password.startsWith('$2b$') || data.password.startsWith('$2a$'));

    if (isHashed) {
      // ✅ Contraseña en bcrypt — comparamos de forma segura
      isValid = await bcrypt.compare(p, data.password);
    } else {
      // 🔄 Contraseña legacy en texto plano — comparamos con timingSafeEqual
      // para evitar timing attacks, y auto-migramos a bcrypt
      try {
        const storedBuf = Buffer.from(data.password, 'utf8');
        const inputBuf = Buffer.from(p, 'utf8');
        if (storedBuf.length === inputBuf.length) {
          isValid = timingSafeEqual(storedBuf, inputBuf);
        }
      } catch {
        isValid = false;
      }

      if (isValid) {
        // Auto-migración: hasheamos y actualizamos en background
        const hash = await bcrypt.hash(p, BCRYPT_ROUNDS);
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
      // Respuesta genérica (no distinguir usuario incorrecto de contraseña incorrecta)
      return Response.json({ ok: false, error: 'Credenciales incorrectas' }, { status: 401, headers: corsHeaders });
    }

    // Actualizar last_sign_in_at
    await supabase
      .from('users')
      .update({ last_sign_in_at: new Date().toISOString() })
      .eq('id', data.id);

    // Devolvemos los datos del usuario (sin password) + token JWT firmado
    const user = { id: data.id, username: data.username, role: data.role };
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error('JWT_SECRET no configurado');
    const token = jwt.sign(
      { userId: data.id, username: data.username },
      jwtSecret,
      { expiresIn: '7d' }
    );
    // Cookie httpOnly: el navegador la envía automáticamente y JS no puede leerla (protección XSS)
    // El token también se retorna en el body para compatibilidad con Capacitor (APK)
    const res = NextResponse.json({ ok: true, user, token }, { headers: corsHeaders });
    res.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 días
      path: '/',
    });
    return res;


  } catch (err) {
    console.error('Error en /api/auth/login:', err);
    return Response.json({ ok: false, error: 'Error interno del servidor' }, { status: 500, headers: corsHeaders });
  }
}
