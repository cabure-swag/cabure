// lib/supabaseAdmin.js
// Cliente "server-side" con la Service Role Key (bypass de RLS para acciones de administrador)
// ⚠️ Solo se importa desde páginas API (nunca desde el cliente)

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE;

if (!url || !serviceKey) {
  console.warn(
    "[supabaseAdmin] Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE. Setealo en Vercel > Settings > Environment Variables."
  );
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
