import Head from "next/head";
import { useEffect, useState } from "react";
import { withRoleGuard } from "@/utils/roleGuards";
import { supabase } from "@/lib/supabaseClient";
import ChatBox from "@/components/ChatBox";

function AdminSupport(){
  const [threads, setThreads] = useState([]);
  const [sel, setSel] = useState(null);

  const list = async () => {
    const { data } = await supabase.from('support_threads').select('id, status, created_at, brand_id, user_id').order('status', { ascending:true }).order('created_at', { ascending:false });
    setThreads(data || []);
  };
  useEffect(()=>{ list(); },[]);

  const closeThread = async () => {
    if (!sel) return;
    await supabase.from('support_threads').update({ status:'closed' }).eq('id', sel.id);
    setSel(null);
    list();
  };

  return (
    <div className="container">
      <Head><title>Soporte — Admin</title></Head>
      <h1>Tickets</h1>
      <div className="row" style={{alignItems:'flex-start'}}>
        <div style={{width:360}}>
          <div className="card">
            <div className="card-body">
              <ul style={{listStyle:'none', padding:0, margin:0}}>
                {threads.map(t => (
                  <li key={t.id} style={{padding:'8px 0', borderBottom:'1px solid #1f2937'}}>
                    <button className="btn btn-ghost" onClick={()=>setSel(t)}>
                      #{t.id.slice(0,8)} — {t.status}
                    </button>
                  </li>
                ))}
                {threads.length===0 && <div className="status-empty">No hay tickets.</div>}
              </ul>
            </div>
          </div>
        </div>
        <div style={{flex:1}}>
          {sel ? <ChatBox threadId={sel.id} adminView onCloseThread={closeThread} /> : <div className="status-empty">Seleccioná un ticket.</div>}
        </div>
      </div>
    </div>
  );
}
export default withRoleGuard(AdminSupport, { requireAdmin:true });