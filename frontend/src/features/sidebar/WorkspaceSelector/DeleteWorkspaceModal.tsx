import type { WorkspaceRef } from '../../../api'
import { TrashIcon } from '../../../shared/icons'

type Props = {
  workspace: WorkspaceRef
  confirmation: string
  onChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
  busy?: boolean
  error?: string
}

export function DeleteWorkspaceModal({
  workspace, confirmation, onChange, onClose, onConfirm, busy = false, error = '',
}: Props) {
  return <div className="modal-back" onClick={() => { if (!busy) onClose() }}>
    <div className="modal" role="alertdialog" aria-modal="true"
      aria-labelledby="delete-workspace-title"
      aria-describedby="delete-workspace-description"
      onClick={event => event.stopPropagation()}>
      <h2 id="delete-workspace-title">Eliminar Workspace</h2>
      <p id="delete-workspace-description">
        Se eliminarán permanentemente todos los proyectos, tableros, tarjetas y datos
        contenidos en <strong>{workspace.name}</strong>.
      </p>
      <p>Escribe <strong>{workspace.name}</strong> para confirmar.</p>
      <input type="text" placeholder={workspace.name} value={confirmation} autoFocus
        disabled={busy} onChange={event => onChange(event.target.value)}/>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="ghost" disabled={busy} onClick={onClose}>Cancelar</button>
        <button type="button" className="ghost danger"
          disabled={busy || confirmation !== workspace.name} onClick={onConfirm}>
          <TrashIcon/> {busy ? 'Eliminando…' : 'Eliminar Workspace'}
        </button>
      </div>
    </div>
  </div>
}
