// @ts-nocheck
// =====================================================
// Edge Function: eliminar-usuario
// El coordinador elimina a un profe o alumno de su centro:
// borra su cuenta (si la tiene) y lo quita de la lista.
// =====================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respuesta(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. ¿Quién hace la petición?
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user }, error: errorUsuario } = await admin.auth.getUser(token);
    if (errorUsuario || !user) {
      return respuesta({ error: 'Tienes que iniciar sesión.' }, 401);
    }

    // 2. ¿Es el coordinador?
    const { data: perfil } = await admin
      .from('perfiles')
      .select('rol, email, organizacion_id')
      .eq('id', user.id)
      .single();

    if (!perfil || perfil.rol !== 'coordinador') {
      return respuesta({ error: 'Solo el coordinador puede eliminar usuarios.' }, 403);
    }

    // 3. Correo a eliminar
    const { email } = await req.json();
    const correo = String(email ?? '').trim().toLowerCase();

    if (correo === perfil.email) {
      return respuesta({ error: 'No puedes eliminar tu propia cuenta.' }, 400);
    }

    // 4. Tiene que ser de su centro y no ser coordinador
    const { data: autorizado } = await admin
      .from('correos_autorizados')
      .select('rol')
      .eq('email', correo)
      .eq('organizacion_id', perfil.organizacion_id)
      .maybeSingle();

    if (!autorizado) {
      return respuesta({ error: 'Ese correo no está en tu centro.' }, 404);
    }
    if (autorizado.rol === 'coordinador') {
      return respuesta({ error: 'No se puede eliminar al coordinador.' }, 400);
    }

    // 5. Si tiene cuenta, se borra (y con ella su perfil y sus clases)
    const { data: usuario } = await admin
      .from('perfiles')
      .select('id')
      .eq('email', correo)
      .eq('organizacion_id', perfil.organizacion_id)
      .maybeSingle();

    if (usuario) {
      const { error: errorBorrar } = await admin.auth.admin.deleteUser(usuario.id);
      if (errorBorrar) {
        return respuesta({ error: errorBorrar.message }, 400);
      }
    }

    // 6. Se quita de la lista de correos autorizados
    await admin.from('correos_autorizados').delete().eq('email', correo);

    return respuesta({ ok: true });
  } catch (error) {
    console.error(error);
    return respuesta({ error: 'Error inesperado al eliminar el usuario.' }, 500);
  }
});