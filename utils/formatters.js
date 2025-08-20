export const money = (n) => {
  if (n === null || n === undefined || isNaN(Number(n))) return "-";
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(n));
};

export const yyyyMm = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

export const downloadCSV = (rows, filename='export.csv') => {
  if (!Array.isArray(rows) || rows.length===0) return;
  const headers = Object.keys(rows[0]);
  const esc = (v) => String(v ?? '').replace(/"/g,'""');
  const csv = [headers.join(",")].concat(rows.map(r => headers.map(h => `"${esc(r[h])}"`).join(","))).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};