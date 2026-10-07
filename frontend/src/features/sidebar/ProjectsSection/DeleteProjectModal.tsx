import { useState } from 'react'
import { TrashIcon } from '../../../shared/icons'
import type { Project } from '../../../api'

export function DeleteProjectModal({ project, onClose, onConfirm }: {
  project: Project
  onClose: () => void
  onConfirm: (confirmationName: string) => Promise<void>
}) {
  const [confirmationName, setConfirmationName] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function confirm() {
    if (saving) return
    setSaving(true); setError('')
    try { await onConfirm(confirmationName) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo completar la acción.') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>Eliminar proyecto</h2>
        <p>
          ¿Estás seguro de querer eliminar el proyecto{' '}
          <strong>{project.name}</strong>?
        </p>
        <p>
          Se eliminarán permanentemente todos los tableros, tarjetas y datos contenidos en este proyecto.
        </p>
        <p>Escribe <strong>{project.name}</strong> para confirmar.</p>
        <input
          type="text"
          placeholder={project.name}
          value={confirmationName}
          onChange={(event) => setConfirmationName(event.target.value)}
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="ghost danger"
            disabled={saving || confirmationName !== project.name}
            onClick={() => void confirm()}
          >
            <TrashIcon /> Eliminar proyecto
          </button>
        </div>
      </div>
    </div>
  )
}
