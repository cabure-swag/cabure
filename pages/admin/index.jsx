import Head from "next/head";
import { useEffect, useState } from "react";
import { withRoleGuard } from "@/utils/roleGuards";
import { supabase } from "@/lib/supabaseClient";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/Toast";

function AdminPage(){
  const { push } = useToast();
  const [brands, setBrands] = useState([]);
  const [form, setForm] = useState({ name:'', slug:'', description:'', color:'#ffffff', active:true, bank_alias:'', bank_cbu:'', mp_access_token:'' });
  const [confirm, setConfirm] = useState({ open:false, brand:null });

  const list = async () => {
    const { data } = await supabase.from('brands').select('*').order('created_at', { ascending: false });
    setBrands(data || []);
  };
  useEffect(() => { list(); }, []);

  const createBrand = async (e) => {
    e.preventDefault();
    const payload = { ...form, mp_access_token: form.mp_access_token || null, logo_url: form.logo_url || null };
    const { error } = await supabase.from('brands').insert(payload);
    if (error) return push('Error al crear marca');
    setForm({ name:'', slug:'', description:'', color:'#ffffff', active:true, bank_alias:'', bank_cbu:'', mp_access_token:'' });
    push('Marca creada');
    list();
  };

  const removeBrand = async (brand) => {
    setConfirm({ open:false, brand:null });
    const { error } = await supabase.from('brands').update({ deleted_at: new Date().toISOString(), active:false }).eq('id', brand.id);
    if (error) return push('Error al eliminar');
    push('Marca eliminada');
    await supabase.from('audit_logs').insert({ action:'delete', entity:'brand', entity_id:brand.id });
    list();
  };

  const uploadLogo = async (file) => {
    if (!file) return;
    const filename = `${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from('brand-logos').upload(filename, file, { upsert:false });
    if (error) return push('No se pudo subir el logo');
    const { data } = await supabase.storage.from('brand-logos').getPublicUrl(filename);
    setForm(f => ({ ...f, logo_url: data.publicUrl }));
    push('Logo subido');
  };

  const assignVendor = async (brandId) => {
    const email = prompt('Email del vendedor (debe haber ingresado al menos una vez)');
    if (!email) return;
    const { data: p } = await supabase.from('profiles').select('user_id, email').eq('email', email).maybeSingle();
    if (!p) return push('No existe ese usuario');
    const { error } = await supabase.from('brand_users').insert({ brand_id: brandId, user_id: p.user_id });
    if (error) return push('No se pudo asignar');
    push('Vendedor asignado');
  };

  return (
    <div className="container">
      <Head><title>Admin — CABURE.STORE</title></Head>
      <div className="row" style={{justifyContent:'space-between'}}>
        <h1>Admin</h1>
        <div className="row">
          <a className="btn" href="/admin/support">Soporte</a>
          <a className="btn" href="/admin/metrics">Métricas</a>
        </div>
      </div>

      <form onSubmit={createBrand} className="card" style={{padding:14, marginTop:12}}>
        <h3 style={{marginTop:0}}>Crear marca</h3>
        <div className="row">
          <div style={{flex:1}}>
            <label className="label" htmlFor="name">Nombre</label>
            <input id="name" className="input" required value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
          </div>
          <div style={{flex:1}}>
            <label className="label" htmlFor="slug">Slug</label>
            <input id="slug" className="input" required value={form.slug} onChange={e=>setForm({...form, slug:e.target.value})} />
          </div>
        </div>
        <label className="label" htmlFor="description">Descripción</label>
        <textarea id="description" className="input" value={form.description} onChange={e=>setForm({...form, description:e.target.value})} />
        <div className="row">
          <div>
            <label className="label" htmlFor="color">Color</label>
            <input id="color" type="color" aria-label="Color de marca" className="input" style={{padding:4, height:40, width:80}} value={form.color} onChange={e=>setForm({...form, color:e.target.value})} />
          </div>
          <div>
            <label className="label" htmlFor="active">Activa</label>
            <select id="active" className="input" value={form.active} onChange={e=>setForm({...form, active: e.target.value==='true'})}>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>
        <div className="row">
          <div style={{flex:1}}>
            <label className="label" htmlFor="bank_alias">Alias</label>
            <input id="bank_alias" className="input" value={form.bank_alias} onChange={e=>setForm({...form, bank_alias:e.target.value})} />
          </div>
          <div style={{flex:1}}>
            <label className="label" htmlFor="bank_cbu">CBU</label>
            <input id="bank_cbu" className="input" value={form.bank_cbu} onChange={e=>setForm({...form, bank_cbu:e.target.value})} />
          </div>
        </div>
        <label className="label" htmlFor="mp_access_token">Mercado Pago Access Token (opcional)</label>
        <input id="mp_access_token" className="input" value={form.mp_access_token} onChange={e=>setForm({...form, mp_access_token:e.target.value})} />
        <div className="row" style={{marginTop:8}}>
          <div>
            <label className="label" htmlFor="logo">Logo</label>
            <input id="logo" type="file" onChange={e=>uploadLogo(e.target.files[0])} aria-label="Subir logo" />
          </div>
          <div style={{flex:1}} />
          <button className="btn btn-primary" type="submit">Crear</button>
        </div>
      </form>

      <h3 style={{marginTop:20}}>Marcas</h3>
      <div className="grid">
        {brands.map(b => (
          <div key={b.id} className="card">
            <div className="card-body">
              <div className="row" style={{justifyContent:'space-between'}}>
                <div className="card-title">{b.name}</div>
                <a className="btn" href={`/marcas/${b.slug}`}>Ver</a>
              </div>
              <div style={{color:'var(--muted)'}}>{b.description}</div>
              <div className="row" style={{marginTop:8}}>
                <button className="btn" onClick={()=>assignVendor(b.id)}>Asignar vendedor</button>
                <button className="btn btn-danger" onClick={()=>setConfirm({ open:true, brand:b })}>Eliminar</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={confirm.open}
        title="Eliminar marca"
        description="Esto hará un soft delete (se puede recuperar por DB)."
        onCancel={()=>setConfirm({ open:false, brand:null })}
        onConfirm={()=>removeBrand(confirm.brand)}
      />
    </div>
  );
}

export default withRoleGuard(AdminPage, { requireAdmin:true });