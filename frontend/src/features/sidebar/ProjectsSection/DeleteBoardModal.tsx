import { useState } from 'react'
import { TrashIcon } from '../../../shared/ui'

export function DeleteBoardModal({ board, onClose, onConfirm }: {
  board: { id: number; name: string }
  onClose: () => void
  onConfirm: (confirmationName: string) => Promise<void>
}) {
  const [confirmationName, setConfirmationName] = useState('')

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>Eliminar tablero</h2>
        <p>¿Estás seguro de querer eliminar el tablero <strong>{board.name}</strong>?</p>
        <p>Se eliminaran permanentemente todas las tarjetas y datos contenidos en este tablero.</p>
        <p>Escribe <strong>{board.name}</strong> para confirmar.</p>
        <input
          type="text"
          placeholder={board.name}
          value={confirmationName}
          onChange={(event) => setConfirmationName(event.target.value)}
          autoFocus
        />
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="ghost danger"
            disabled={confirmationName !== board.name}
            onClick={() => void onConfirm(confirmationName)}
          >
            <TrashIcon />Eliminar tablero
          </button>
        </div>
      </div>
    </div>
  )
}
