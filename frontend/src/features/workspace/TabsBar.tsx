import { CloseIcon } from '../cards/CardDetail'
import type { OpenTab } from '../../shared/ui'
type Props = { tabs: OpenTab[]; activeBoardId: number | null; onSelect: (id: number) => void; onClose: (id: number) => void }
export function TabsBar({ tabs, activeBoardId, onSelect, onClose }: Props) { if (!tabs.length) return null; return <div className="tabs">{tabs.map((tab) => <button key={tab.boardId} className={tab.boardId === activeBoardId ? 'on' : ''} type="button" onClick={() => onSelect(tab.boardId)}>{tab.title}<span className="tab-x" onClick={(event) => { event.stopPropagation(); onClose(tab.boardId) }} aria-label="Cerrar pestaña" role="button"><CloseIcon /></span></button>)}</div> }
