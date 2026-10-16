import { useEffect, useState } from 'react'
import { uploadFile, type Profile } from '../../api'
import { Header } from '../header/Header'
import { AccountModal, type AccountSection } from './AccountModal'

type Props = {
  profile: Profile
  workspaceId: number | null
  query: string
  onQueryChange: (value: string) => void
  onProfile: (profile: Profile) => void
}

export function AccountHeader({ profile, workspaceId, query, onQueryChange, onProfile, breadcrumb, mini = false }: Props & { breadcrumb: string[]; mini?: boolean }) {
  const [section, setSection] = useState<AccountSection | null>(null)
  const [notes, setNotes] = useState<{ id: number; body: string }[]>([])
  useEffect(() => {
    const open = (event: Event) => {
      const section = (event as CustomEvent<AccountSection | undefined>).detail
      setSection(section === 'settings' || section === 'notifications' ? section : 'profile')
    }
    window.addEventListener('tickard:open-account', open)
    return () => window.removeEventListener('tickard:open-account', open)
  }, [])

  async function changeAvatar(file: File) {
    const path = workspaceId ? `/me/avatar?workspace_id=${workspaceId}` : '/me/avatar'
    onProfile(await uploadFile<Profile>(path, file, 'avatar'))
  }

  return <>
    <Header query={query} breadcrumb={breadcrumb} mini={mini} onQueryChange={onQueryChange} onOpenNotifications={() => setSection('notifications')} />
    {section && <AccountModal section={section} profile={profile} notes={notes}
      workspaceId={workspaceId} onSection={setSection} onProfile={onProfile}
      onNotes={setNotes} onClose={() => setSection(null)} onAvatar={changeAvatar} />}
  </>
}
