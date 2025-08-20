import Head from "next/head";
import { withRoleGuard } from "@/utils/roleGuards";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { money, yyyyMm } from "@/utils/formatters";

function AdminMetrics(){
  const [kpi, setKpi] = useState({ total:0, orders:0, top:[] });
  const [month, setMonth] = useState(yyyyMm());

  useEffect(() => {
    (async () => {
      const { data: orders } = await supabase.from('orders').select('id, total, created_at').gte('created_at', `${month}-01`).lte('created_at', `${month}-31`);
      const total = (orders||[]).reduce((s,o)=>s+Number(o.total||0),0);
      const ordersCount = (orders||[]).length;
      setKpi({ total, orders: ordersCount, top: [] });
    })();
  }, [month]);

  return (
    <div className="container">
      <Head><title>Métricas — Admin</title></Head>
      <h1>Métricas</h1>
      <div className="row">
        <div>
          <label className="label" htmlFor="month">Mes</label>
          <input id="month" className="input" type="month" value={month} onChange={e=>setMonth(e.target.value)} />
        </div>
      </div>
      <div className="row" style={{marginTop:12}}>
        <div className="kpi"><div className="value">{money(kpi.total)}</div><div className="desc">Total vendido</div></div>
        <div className="kpi"><div className="value">{kpi.orders}</div><div className="desc">Pedidos</div></div>
      </div>
    </div>
  );
}
export default withRoleGuard(AdminMetrics, { requireAdmin:true });