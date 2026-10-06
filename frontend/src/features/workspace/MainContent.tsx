import type { ReactNode } from 'react'
import type { OpenProjectTab } from './useProjectTabs'
import { TabsBar } from './TabsBar'
type Props = { tabs: OpenProjectTab[]; activeProjectId: number | null; onSelectTab: (id: number) => void; onCloseTab: (id: number) => void; showWorkspaceNavigation?: boolean; contextBar?: ReactNode; children: ReactNode }
export function MainContent({ tabs, activeProjectId, onSelectTab, onCloseTab, showWorkspaceNavigation = true, contextBar, children }: Props) { return <section className="main">{showWorkspaceNavigation && contextBar && <><TabsBar tabs={tabs} activeProjectId={activeProjectId} onSelect={onSelectTab} onClose={onCloseTab} />{contextBar}</>}{children}</section> }
