import { useState } from 'react'
import { TrashIcon } from '../../../shared/ui'
import type { Project } from '../../../api'

export function DeleteProjectModal({ project, onClose, onConfirm }: {
  project: Project
  onClose: () => void
  onConfirm: (confirmationName: string) => Promise<void>
}) {
  const [confirmationName, setConfirmationName] = useState('')

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
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="ghost danger"
            disabled={confirmationName !== project.name}
            onClick={() => void onConfirm(confirmationName)}
          >
            <TrashIcon /> Eliminar proyecto
          </button>
        </div>
      </div>
    </div>
  )
}
