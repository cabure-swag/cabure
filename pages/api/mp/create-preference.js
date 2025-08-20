import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { brandSlug, items=[], back_urls={} } = req.body || {};
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY y URL requeridos en el servidor' });
  const supabaseAdmin = createClient(url, serviceKey);
  const { data: brand, error } = await supabaseAdmin.from('brands').select('id, name, mp_access_token').eq('slug', brandSlug).single();
  if (error || !brand) return res.status(404).json({ error: 'Marca no encontrada' });
  if (!brand.mp_access_token) return res.status(400).json({ error: 'La marca no tiene token de MP' });

  try{
    const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method:'POST',
      headers: { 'Authorization': `Bearer ${brand.mp_access_token}`, 'Content-Type':'application/json' },
      body: JSON.stringify({
        items,
        back_urls,
        metadata: { brand_id: brand.id, brand_slug: brandSlug }
      })
    });
    const out = await prefRes.json();
    if (prefRes.ok) return res.status(200).json({ id: out.id, init_point: out.init_point });
    return res.status(400).json({ error: out.message || 'MP error' });
  }catch(e){
    return res.status(500).json({ error: e.message });
  }
}