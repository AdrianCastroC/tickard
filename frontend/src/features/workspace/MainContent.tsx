import type { ReactNode } from 'react'
import type { OpenTab } from '../../shared/ui'
import { TabsBar } from './TabsBar'

type Props = {
  tabs: OpenTab[]
  activeBoardId: number | null
  onSelectTab: (id: number) => void
  onCloseTab: (id: number) => void
  children: ReactNode
}
export function MainContent({ tabs, activeBoardId, onSelectTab, onCloseTab, children }: Props) {
  return <section className="main">
    <TabsBar tabs={tabs} activeBoardId={activeBoardId} onSelect={onSelectTab} onClose={onCloseTab} />
    {children}
  </section>
}
