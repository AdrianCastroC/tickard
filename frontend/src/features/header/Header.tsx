import styles from './Header.module.css'
import { SearchBar } from './SearchBar'
import { BellIcon, HelpCircleIcon } from '../../shared/ui'
import { Brand } from './Brand'

type HeaderProps = {
  query: string
  onQueryChange: (value: string) => void
  onOpenNotifications: () => void
  breadcrumb: string[]
  mini?: boolean
}

export function Header({
  query,
  onQueryChange,
  onOpenNotifications,
  breadcrumb,
  mini = false,
}: HeaderProps) {
  return (
    <header className={styles.topbar}>
      <aside className={`${styles.headerBrand}${mini ? ` ${styles.headerBrandMini}` : ''}`}><Brand /></aside>
      <div className={styles.headerBody}>
        <div className={styles.breadcrumb}>{breadcrumb.map((item, index) => <span key={`${item}-${index}`}>{index > 0 && <b>›</b>}{item}</span>)}</div>
        <div className={styles.topMain}>
        <SearchBar value={query} onChange={onQueryChange} />
        <button className={styles.topAction} type="button" title="Notificaciones" aria-label="Notificaciones" onClick={onOpenNotifications}><BellIcon /></button>
        <button className={styles.topAction} type="button" title="Ayuda" aria-label="Ayuda"><HelpCircleIcon /></button>
        </div>
      </div>
    </header>
  )
}
