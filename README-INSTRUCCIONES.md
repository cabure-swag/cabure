# CABURE.STORE — versión PRO (Next.js + Supabase + Vercel)

Proyecto listo para deploy con **Next.js 14 (pages/)** + **Supabase (Auth/DB/Realtime/Storage)** + **Mercado Pago por marca** + **Vercel**.

> Estética dark, urbana y minimal. Roles (admin / vendor / cliente), catálogos por marca, soporte en tiempo real, checkout con MP por marca o transferencia.

---

## 0) Requisitos previos

- Cuenta en **Supabase** (un proyecto nuevo).
- Cuenta en **Vercel** conectada a GitHub.
- (Opcional) Tokens de **Mercado Pago** de cada marca (se cargan en la DB por marca).

---

## 1) Subir el .zip a GitHub

1. Descargá este zip: **cabure-store-pro.zip**.
2. En tu repo (GitHub) → **Add file → Upload files** → arrastrá el zip y **Commit**.
3. (Opcional) Clonalo local si querés correr `npm run dev`.

---

## 2) Variables de entorno (Vercel)

En el proyecto de Vercel, agregá en **Settings → Environment Variables**:

```
NEXT_PUBLIC_SUPABASE_URL = https://TU-PROJECT.ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = TU_ANON_KEY
NEXT_PUBLIC_ADMIN_EMAIL = cabureswag@gmail.com   # Solo informativo; el rol admin se setea en DB o por UI
NEXT_PUBLIC_SITE_URL = https://tu-dominio.vercel.app  # para canonical/sitemap

# Solo del lado servidor (requerido para /api/mp/create-preference)
SUPABASE_SERVICE_ROLE_KEY = TU_SERVICE_ROLE_KEY
```

> **IMPORTANTE**: *El Service Role nunca se expone en el cliente.* Vercel lo guarda como Server Env. Es necesario para que el endpoint serverless lea `mp_access_token` desde la tabla `brands` respetando RLS.

Tras setearlas, hacé **Redeploy** del proyecto.

---

## 3) Supabase — ejecutar SQL (en este orden)

En **Supabase → SQL Editor**, ejecutá secuencialmente (copiar/pegar desde el repo):

1. `supabase/schema.sql`
2. `supabase/rls_policies.sql`
3. (Opcional) `supabase/seed_optional.sql`

### Activar Realtime
En **Supabase → Realtime**, habilitá el esquema **public** (o al menos las tablas `support_messages` y `support_threads`).

### Storage (imágenes)
En **Storage → Create bucket**:

- `brand-logos` (público *read*)
- `product-images` (público *read*)

Luego ejecutá las **políticas** de Storage incluidas al final de `supabase/rls_policies.sql` (están listas para pegar).

### Cron limpieza de soporte (90 días)
En **SQL Editor** ejecutá `supabase/cron_cleanup.sql` y confirmá que `pg_cron` quedó habilitada y la tarea programada.

---

## 4) Probar en producción (flujo mínimo)

1. Abrí `/` → **lista de marcas** (vacío sin errores).
2. **Login con Google** desde `/soporte` (para crear `profiles`). 
3. En `/admin` (primero asignate **admin** por DB, ver abajo), **crear marca** (no exige `mp_access_token`).
   - Subí logo (se guarda en Storage y URL pública queda en DB).
   - Asigná un vendor por email (el usuario debió ingresar al menos una vez).
4. `/marcas/[slug]` muestra catálogo (vacío → estado “No hay productos…”).
5. `/vendor` (como vendor) CRUD de productos + **export CSV** por mes.
6. `/soporte` abre chat **Realtime** (cliente). `/admin/support` ve y contesta.
7. `/checkout/[brandSlug]`:
   - Si la marca tiene `mp_access_token` → botón **Mercado Pago** (crea Preference via `/api/mp/create-preference`).
   - Si **no** tiene token → muestra **Transferencia** (alias/CBU) y CTA al chat.

---

## 5) Cómo asignar tu usuario como **admin**

Entrá con tu cuenta en `/soporte` (para crear el `profile`). Luego ejecutá en **SQL**:

```sql
update profiles set role = 'admin' where email = 'cabureswag@gmail.com';
```

> Después ya podés usar `/admin` para gestionar marcas, roles y vendors desde UI.

---

## 6) Reemplazar logo y colores

- Reemplazá `public/cabure-logo.png` por tu logo (mismo nombre/ubicación).
- El color por marca se configura en **/admin** y se guarda en la tabla `brands.color` (podés usarlo para más estilos).

---

## 7) Mercado Pago

- Endpoint serverless: `pages/api/mp/create-preference.js`
- Requiere **SUPABASE_SERVICE_ROLE_KEY** para leer `mp_access_token` de `brands`.
- Espera body: `{ brandSlug, items: [{ title, quantity, currency_id:'ARS', unit_price }], back_urls } → { id, init_point }`
- Webhook placeholder: `pages/api/mp/webhook.js` (documentado y listo para recibir).

> Las credenciales se cargan **por marca** en `/admin` (o directo en DB). Si falta token, el checkout muestra **Transferencia** sin bloquear la compra.

---

## 8) Accesibilidad, SEO & Performance

- Labels, focus visible, contraste AA (tema dark).
- `<Head>` por página + OpenGraph + canonical + manifest + favicon.
- `next-sitemap` genera `sitemap.xml` y `robots.txt` en cada build.
- Imágenes optimizadas (usar Storage con tamaños razonables) y UI con *skeletons*.

---

## 9) Scripts útiles

```bash
npm i
npm run dev
npm run build
npm start
```

---

## 10) Estructura principal

```
lib/supabaseClient.js
styles/globals.css
public/cabure-logo.png
public/favicon.ico
public/site.webmanifest
pages/_app.js
pages/index.jsx
pages/marcas/[slug].jsx
pages/soporte.jsx
pages/admin/index.jsx
pages/admin/support.jsx
pages/admin/metrics.jsx
pages/vendor/index.jsx
pages/checkout/[brandSlug].jsx
pages/api/mp/create-preference.js
pages/api/mp/webhook.js
pages/api/auth/ensure-profile.js
components/ChatBox.jsx
components/ConfirmModal.jsx
components/Toast.jsx
utils/roleGuards.js
utils/formatters.js
supabase/schema.sql
supabase/rls_policies.sql
supabase/cron_cleanup.sql
supabase/seed_optional.sql
next-sitemap.config.js
README-INSTRUCCIONES.md
```

---

## 11) Notas finales

- **Soft delete**: `deleted_at` en `brands` y `products` (filtrado en selects públicos).
- **Audit log**: tabla `audit_logs` con inserts desde UI para deletes básicos.
- **Optimistic UI** en chat.
- **Guardas de ruta** con `withRoleGuard`.
- **CSV export** en vendor por mes.

Si querés extender (PWA, más métricas, charts, etc.) ya hay base lista.

¡Listo para subir a Vercel!