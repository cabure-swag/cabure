export default function ConfirmModal({ open, title='Confirmar', description='¿Seguro?', onConfirm, onCancel }){
  if(!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal">
        <h3 style={{marginTop:0}}>{title}</h3>
        <p style={{color:'var(--muted)'}}>{description}</p>
        <div className="row" style={{justifyContent:'flex-end'}}>
          <button className="btn btn-ghost" onClick={onCancel} aria-label="Cancelar">Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm} aria-label="Confirmar">Eliminar</button>
        </div>
      </div>
    </div>
  );
}