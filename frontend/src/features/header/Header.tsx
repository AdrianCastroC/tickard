import type { Profile } from '../../api'
import styles from './Header.module.css'
import { Brand } from './Brand'
import { SearchBar } from './SearchBar'
import { ProfileMenu } from './ProfileMenu'

type HeaderProps = {
  profile: Profile
  query: string
  onQueryChange: (value: string) => void
  onOpenProfile: () => void
  onOpenSettings: () => void
  onOpenNotifications: () => void
  onAvatarChange: (file: File) => void | Promise<void>
}

export function Header({
  profile,
  query,
  onQueryChange,
  onOpenProfile,
  onOpenSettings,
  onOpenNotifications,
  onAvatarChange,
}: HeaderProps) {
  return (
    <header className={styles.topbar}>
      <aside className="side">
        <Brand />
      </aside>
      <div className={styles.topMain}>
        <div className={styles.topHalf}>
          <SearchBar value={query} onChange={onQueryChange} />
        </div>
        <div className={`${styles.topHalf} ${styles.profile}`}>
          <ProfileMenu
            profile={profile}
            onOpenProfile={onOpenProfile}
            onOpenSettings={onOpenSettings}
            onOpenNotifications={onOpenNotifications}
            onAvatarChange={onAvatarChange}
          />
        </div>
      </div>
    </header>
  )
}
