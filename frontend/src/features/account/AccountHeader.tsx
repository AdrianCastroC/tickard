import { useState } from 'react'
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

export function AccountHeader({ profile, workspaceId, query, onQueryChange, onProfile }: Props) {
  const [section, setSection] = useState<AccountSection | null>(null)
  const [notes, setNotes] = useState<{ id: number; body: string }[]>([])

  async function changeAvatar(file: File) {
    const path = workspaceId ? `/me/avatar?workspace_id=${workspaceId}` : '/me/avatar'
    onProfile(await uploadFile<Profile>(path, file, 'avatar'))
  }

  return <>
    <Header profile={profile} query={query} onQueryChange={onQueryChange}
      onOpenProfile={() => setSection('profile')}
      onOpenSettings={() => setSection('settings')}
      onOpenNotifications={() => setSection('notifications')}
      onAvatarChange={changeAvatar} />
    {section && <AccountModal section={section} profile={profile} notes={notes}
      workspaceId={workspaceId} onSection={setSection} onProfile={onProfile}
      onNotes={setNotes} onClose={() => setSection(null)} onAvatar={changeAvatar} />}
  </>
}
