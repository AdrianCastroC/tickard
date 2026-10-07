import { CloseIcon } from '../../shared/icons'
import type { OpenProjectTab } from './useProjectTabs'
type Props = { tabs: OpenProjectTab[]; activeProjectId: number | null; onSelect: (id: number) => void; onClose: (id: number) => void }
export function TabsBar({ tabs, activeProjectId, onSelect, onClose }: Props) { if (!tabs.length) return null; return <div className="tabs">{tabs.map((tab) => <button key={tab.projectId} className={tab.projectId === activeProjectId ? 'on' : ''} type="button" onClick={() => onSelect(tab.projectId)}>{tab.title}<span className="tab-x" onClick={(event) => { event.stopPropagation(); onClose(tab.projectId) }} aria-label="Cerrar pestaña" role="button"><CloseIcon /></span></button>)}</div> }
