import type { ReactNode } from 'react'
import type { OpenTab } from '../../shared/ui'
import { TabsBar } from './TabsBar'
import { BoardHeader } from './BoardHeader'
import { FiltersBar } from './FiltersBar'
type Props = { tabs: OpenTab[]; activeBoardId: number | null; onSelectTab: (id: number) => void; onCloseTab: (id: number) => void; showBoard: boolean; title?: string; subtitle?: string; canEdit: boolean; backlog?: { id: number; name: string }; filtersActive: boolean; filtersOpen: boolean; onToggleFilters: () => void; onAdd: (column: { id: number; name: string }) => void; filterProps: React.ComponentProps<typeof FiltersBar>; children: ReactNode }
export function MainContent({ tabs, activeBoardId, onSelectTab, onCloseTab, children, filterProps, showBoard, ...headerProps }: Props) { return <section className="main"><TabsBar tabs={tabs} activeBoardId={activeBoardId} onSelect={onSelectTab} onClose={onCloseTab} /><BoardHeader {...headerProps} show={showBoard} /><FiltersBar {...filterProps} />{children}</section> }
