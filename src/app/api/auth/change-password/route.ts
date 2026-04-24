import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServiceClient } from '@/lib/supabase-server';
import { BCRYPT_ROUNDS } from '@/lib/auth-constants';

interface JwtPayload {
  userId: string;
  username: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Cuerpo de request inválido.' }, { status: 400 });
    }

    const { currentPassword, newPassword } = body;

    // Verificar el token JWT del header Authorization
    // El userId se extrae del token (no del body), así el servidor controla la identidad
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: 'No autorizado. Iniciá sesión nuevamente.' }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json({ error: 'Error de configuración del servidor.' }, { status: 500 });
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, jwtSecret) as JwtPayload;
    } catch {
      return NextResponse.json({ error: 'Sesión inválida o expirada. Iniciá sesión nuevamente.' }, { status: 401 });
    }

    // A partir de acá, payload.userId es confiable — viene de un token firmado por el servidor
    const userId = payload.userId;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Faltan campos requeridos.' }, { status: 400 });
    }

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'Tipos de datos inválidos.' }, { status: 400 });
    }

    if (newPassword.length < 6 || newPassword.length > 128) {
      return NextResponse.json({ error: 'La nueva contraseña debe tener entre 6 y 128 caracteres.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: user, error } = await supabase
      .from('users')
      .select('id, password')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    if (!user.password) {
      return NextResponse.json({ error: 'Esta cuenta usa Google para autenticarse. No podés cambiar la contraseña manualmente.' }, { status: 400 });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'La contraseña actual es incorrecta.' }, { status: 401 });
    }

    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashed })
      .eq('id', userId);

    if (updateError) {
      return NextResponse.json({ error: 'No se pudo actualizar la contraseña.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
