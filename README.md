
# CABUREE — Supabase Full (Pages Router)

Modo oscuro, Next.js 14, Supabase (Auth + DB con RLS), carrito por marca (localStorage), checkout con órdenes reales.

## 1) Requisitos
- Cuenta en **GitHub** (repo público)
- **Vercel** conectado a tu GitHub
- **Supabase** (proyecto con Auth Google habilitado)

## 2) Variables de entorno
En Vercel → Project → Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

También podés crear `.env.local` en desarrollo local (opcional):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 3) Base de datos (Supabase)
Abrí Supabase → **SQL Editor** → pegá y ejecutá `supabase/schema.sql` (este repo lo incluye).  
Esto crea:
- `profiles` (rol del usuario: user/vendor/admin)
- `brands`, `products`
- `vendor_brands` (asignaciones vendor → marcas)
- `orders`, `order_items`
- Políticas RLS seguras (owner, admin, vendor)

### Importante
- Cuando un usuario se loguea por primera vez, se crea su **profile** con rol `user` automáticamente.
- Para volver **admin** a alguien:
  ```sql
  update public.profiles set role = 'admin' where email = 'TU_EMAIL';
  ```

## 4) Flujo principal
- **Home / Marcas**: lee `brands` desde Supabase.
- **Marca (`/marcas/[slug]`)**: lista `products` y permite agregar al **carrito** (localStorage).  
  Si sos **admin** o **vendor** de esa marca, podés **crear productos**.
- **Checkout (`/pedido/[brandSlug]`)**: inserta `orders` y `order_items` (requiere login Google).
- **Mis Compras**: muestra tus `orders` (RLS dueña).
- **Vendedor**: muestra órdenes de las marcas asignadas en `vendor_brands`.
- **Admin**: crear marcas, asignar vendors, ver marcas.

## 5) Endpoint de salud
`/api/debug/health` → JSON con `ok: true` y metadatos.

## 6) Estilo
CSS simple en `styles/globals.css` (oscuro, acentos violeta/azul).

## 7) Deploy
1. Subí este proyecto a GitHub.
2. Importá en Vercel y Deploy.
3. Cargá **env vars** de Supabase.
4. Ejecutá `supabase/schema.sql` en tu proyecto de Supabase.
5. Logueate con Google y probá el flujo completo.

— Listo para F2–F7 sobre esta base.
