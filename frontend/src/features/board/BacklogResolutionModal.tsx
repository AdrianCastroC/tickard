import { useMemo, useState } from 'react'
import type { BacklogResolution } from '../../api'

type Props = {
  resolution: BacklogResolution
  onCancel: () => void
  onConfirm: (ids: number[], destinations: { board_id: number; column_id: number }[]) => Promise<void>
}

export function BacklogResolutionModal({ resolution, onCancel, onConfirm }: Props) {
  const [selected, setSelected] = useState<number[]>([resolution.root_card_id])
  const [destinations, setDestinations] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedSet = new Set(selected)
  const cards = resolution.cards
  const affected = useMemo(() => resolution.dependencies.filter((dependency) => selectedSet.has(dependency.predecessor.id) || selectedSet.has(dependency.successor.id)), [resolution.dependencies, selected])
  const selectedBoards = resolution.boards.filter((board) => cards.some((card) => card.board_id === board.id && selectedSet.has(card.id)))

  function toggle(id: number) {
    if (id === resolution.root_card_id) return
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  function resetSelection() {
    setSelected([resolution.root_card_id])
  }

  function selectWholeFlow() {
    setSelected(cards.map((card) => card.id))
  }

  async function confirm() {
    setSaving(true)
    setError(null)
    try {
      await onConfirm(selected, selectedBoards.filter((board) => board.id !== resolution.target_backlog.board_id && destinations[board.id]).map((board) => ({ board_id: board.id, column_id: destinations[board.id] })))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo completar el movimiento.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-back" onClick={() => { if (!saving) onCancel() }}>
      <div className="modal backlog-resolution-modal" onClick={(event) => event.stopPropagation()}>
        <h2>Mover Cards a Backlog</h2>
        <p className="muted">La Card tiene dependencias activas. Selecciona qué Cards quieres devolver también a Backlog.</p>
        <div className="backlog-resolution-actions">
          <button type="button" className="secondary" disabled={saving} onClick={resetSelection}>Solo esta</button>
          <button type="button" className="secondary" disabled={saving} onClick={selectWholeFlow}>Toda la cadena</button>
        </div>
        <div className="backlog-resolution-flow">
          {cards.map((card) => (
            <label className="backlog-resolution-card" key={card.id}>
              <input type="checkbox" checked={selectedSet.has(card.id)} disabled={card.id === resolution.root_card_id || saving} onChange={() => toggle(card.id)} />
              <span>{card.is_root ? '↳ ' : '├─ '}{card.title}</span>
              <small>{card.board_name}</small>
            </label>
          ))}
        </div>
        <div className="backlog-resolution-dependencies">
          <strong>Se eliminarán {affected.length} relaciones</strong>
          {affected.map((dependency) => <div key={dependency.id}>{dependency.predecessor.title} ─{dependency.type.toUpperCase()}→ {dependency.successor.title} <small>{dependency.scope === 'external' ? 'Externa' : ''}</small></div>)}
        </div>
        <div className="backlog-resolution-destinations">
          <strong>Destino</strong>
          {selectedBoards.map((board) => board.id === resolution.target_backlog.board_id ? (
            <div key={board.id}>{board.name} → {resolution.target_backlog.name}</div>
          ) : (
            <label key={board.id}>{board.name} → <select disabled={saving} value={destinations[board.id] ?? board.default_backlog_id} onChange={(event) => setDestinations((current) => ({ ...current, [board.id]: Number(event.target.value) }))}>
              {board.backlogs.map((backlog) => <option key={backlog.id} value={backlog.id}>{backlog.name}</option>)}
            </select></label>
          ))}
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary" disabled={saving} onClick={onCancel}>Cancelar</button><button type="button" disabled={saving} onClick={() => { void confirm() }}>{saving ? 'Guardando…' : 'Mover a Backlog'}</button></div>
      </div>
    </div>
  )
}
