import type { ReactNode } from 'react'
import styles from './Sidebar.module.css'

type Props = { mini: boolean; children: ReactNode }
export function Sidebar({ mini, children }: Props) {
  return <aside className={`side ${styles.sidebar}${mini ? ` is-mini ${styles.mini}` : ''}`}>{children}</aside>
}
