import type { BoardPayload } from '../../api'

export function BoardSummary({ board, projectName, onConfigure }: { board: BoardPayload; projectName?: string; onConfigure: () => void }) {
  const cards = board.columns.reduce((total, column) => total + column.cards.length, 0)
  return <div className="board-summary"><div><p className="eyebrow">{projectName}</p><h1>{board.board.name}</h1><p className="subtitle">Resumen del tablero</p></div><button className="primary" type="button" onClick={onConfigure}>Configurar</button><div className="project-summary"><span>{board.columns.length} columnas</span><span>{cards} tarjetas</span><span>{board.labels.length} categorías</span></div></div>
}
