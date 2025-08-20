export default async function handler(req, res){
  // Placeholder: documentado en README para conectar y verificar con MP. 
  // Por ahora registramos y devolvemos 200.
  console.log('MP webhook:', req.method, req.query, req.body);
  return res.status(200).json({ ok:true });
}