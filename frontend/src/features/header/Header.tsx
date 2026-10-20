import styles from './Header.module.css'
import { SearchBar } from './SearchBar'
import { BellIcon } from '../../shared/icons'
import { Brand } from './Brand'
import { AccountFooter } from '../account/AccountFooter'
import type { Profile } from '../../api'

export type BreadcrumbItem = { label: string; onClick?: () => void }

type HeaderProps = {
  profile: Profile
  query: string
  onQueryChange: (value: string) => void
  onOpenNotifications: () => void
  breadcrumb: BreadcrumbItem[]
  mini?: boolean
}

export function Header({
  profile,
  query,
  onQueryChange,
  onOpenNotifications,
  breadcrumb,
  mini = false,
}: HeaderProps) {
  return (
    <header className={styles.topbar}>
      <aside className={`${styles.headerBrand}${mini ? ` ${styles.headerBrandMini}` : ''}`}><Brand mini={mini} /></aside>
      <div className={styles.headerBody}>
        <nav className={styles.breadcrumb} aria-label="Ruta de navegación">{breadcrumb.map((item, index) =>
          <span key={`${item.label}-${index}`}>
            {index > 0 && <b aria-hidden="true">›</b>}
            {item.onClick
              ? <button type="button" className={styles.breadcrumbLink} onClick={item.onClick}
                  title={`Ir a ${item.label}`}>{item.label}</button>
              : <span className={styles.breadcrumbCurrent} aria-current="page">{item.label}</span>}
          </span>
        )}</nav>
        <div className={styles.topMain}>
        <SearchBar value={query} onChange={onQueryChange} />
        <button className={styles.topAction} type="button" title="Notificaciones" aria-label="Notificaciones" onClick={onOpenNotifications}><BellIcon /></button>
        <AccountFooter profile={profile} mini={true} placement="header" />
        </div>
      </div>
    </header>
  )
}
