import type { ReactNode } from 'react'
import type { OpenProjectTab } from './useProjectTabs'
import { TabsBar } from './TabsBar'
type Props = { tabs: OpenProjectTab[]; activeProjectId: number | null; onSelectTab: (id: number) => void; onCloseTab: (id: number) => void; showWorkspaceNavigation?: boolean; showProjectTabs?: boolean; contextBar?: ReactNode; children: ReactNode }
export function MainContent({ tabs, activeProjectId, onSelectTab, onCloseTab, showWorkspaceNavigation = true, showProjectTabs = true, contextBar, children }: Props) { return <section className="main">{showWorkspaceNavigation && showProjectTabs && tabs.length > 0 && <TabsBar tabs={tabs} activeProjectId={activeProjectId} onSelect={onSelectTab} onClose={onCloseTab} />}{showWorkspaceNavigation && contextBar}{children}</section> }
