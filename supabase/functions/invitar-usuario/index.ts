
// @ts-nocheck
// =====================================================
// Edge Function: invitar-usuario
// Envía el correo de invitación a un profe o alumno.
// Se ejecuta en el servidor de Supabase, así que puede usar
// la clave secreta sin que nadie la vea.
// =====================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

// Permisos para que la web pueda llamar a esta función
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
    // Cliente con permisos de administrador (clave secreta)
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
      .select('rol, organizacion_id')
      .eq('id', user.id)
      .single();

    if (!perfil || perfil.rol !== 'coordinador') {
      return respuesta({ error: 'Solo el coordinador puede enviar invitaciones.' }, 403);
    }

    // 3. Datos que envía la web
    const { email, redirectTo } = await req.json();
    const correo = String(email ?? '').trim().toLowerCase();

    // 4. El correo tiene que estar dado de alta en su centro
    const { data: autorizado } = await admin
      .from('correos_autorizados')
      .select('email')
      .eq('email', correo)
      .eq('organizacion_id', perfil.organizacion_id)
      .maybeSingle();

    if (!autorizado) {
      return respuesta({ error: 'Ese correo no está dado de alta en tu centro.' }, 400);
    }

    // 5. Si ya se le invitó antes y no activó la cuenta, se borra
    //    la invitación anterior para poder enviarle una nueva
    const { data: existente } = await admin
      .from('perfiles')
      .select('id, cuenta_activada')
      .eq('email', correo)
      .maybeSingle();

    if (existente?.cuenta_activada) {
      return respuesta({ error: 'Este usuario ya ha activado su cuenta.' }, 400);
    }
    if (existente) {
      await admin.auth.admin.deleteUser(existente.id);
    }

    // 6. Enviar la invitación
    const { error: errorInvitacion } = await admin.auth.admin.inviteUserByEmail(correo, {
      redirectTo,
    });

    if (errorInvitacion) {
      return respuesta({ error: errorInvitacion.message }, 400);
    }

    return respuesta({ ok: true });
  } catch (error) {
    console.error(error);
    return respuesta({ error: 'Error inesperado al enviar la invitación.' }, 500);
  }
});