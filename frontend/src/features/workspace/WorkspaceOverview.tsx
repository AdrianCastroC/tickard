import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { Profile } from '../../api'

type Props = { profile: Profile; workspaceId: number | null; onProfileRefresh: () => Promise<unknown>; onOpenMembers: () => void }

export function WorkspaceOverview({ profile, workspaceId, onProfileRefresh, onOpenMembers }: Props) {
  const workspace = profile.workspaces.find((item) => item.id === workspaceId) ?? profile.workspaces[0]
  const [showBirthdays, setShowBirthdays] = useState(workspace?.show_birthdays ?? true)
  const [birthdayBusy, setBirthdayBusy] = useState(false)
  const [showClients, setShowClients] = useState(workspace?.show_clients ?? true)
  const [clientsBusy, setClientsBusy] = useState(false)
  const [clientsError, setClientsError] = useState('')
  const [birthdayError, setBirthdayError] = useState('')
  useEffect(() => { setShowBirthdays(workspace?.show_birthdays ?? true); setBirthdayError('') }, [workspace?.id, workspace?.show_birthdays])
  useEffect(() => { setShowClients(workspace?.show_clients ?? true); setClientsError('') }, [workspace?.id, workspace?.show_clients])

  async function changeBirthdaySetting(enabled: boolean) {
    if (!workspace || workspace.role !== 'owner' || birthdayBusy) return
    setBirthdayBusy(true); setBirthdayError('')
    try {
      await api('/workspaces/' + workspace.id + '/birthday-settings', {
        method: 'PATCH', body: JSON.stringify({ show_birthdays: enabled }),
      })
      setShowBirthdays(enabled)
      await onProfileRefresh()
    } catch (cause) {
      setBirthdayError(cause instanceof Error ? cause.message : 'No se pudo guardar la configuración.')
    } finally { setBirthdayBusy(false) }
  }

  async function changeClients(enabled: boolean) {
    if (!workspace || workspace.role !== 'owner' || clientsBusy) return
    setClientsBusy(true); setClientsError('')
    try {
      await api('/workspaces/' + workspace.id + '/client-settings', {
        method: 'PATCH', body: JSON.stringify({ show_clients: enabled }),
      })
      setShowClients(enabled)
      await onProfileRefresh()
    } catch (cause) {
      setClientsError(cause instanceof Error ? cause.message : 'No se pudo cambiar el módulo Clientes.')
    } finally { setClientsBusy(false) }
  }

  if (!workspace) return <section className="workspace-overview"><h1>Sin Workspace</h1></section>

  return <section className="workspace-overview">
          <h1>{workspace.name}</h1>
          <p className="subtitle">Vista general del Workspace</p>
          <div className="workspace-overview-card"><strong>Proyectos</strong><span>{profile.projects.length}</span></div>
          {workspace.role === 'owner' && <>
            <div style={{ marginTop: 16 }}>
              <button type="button" className="primary" onClick={onOpenMembers}>Miembros e invitaciones</button>
            </div>
            <section className="workspace-birthday-settings" aria-label="Configuración del Workspace">
              <h2>Configuración del Workspace</h2>
              <label className="workspace-birthday-toggle">
                <span><strong>Mostrar cumpleaños</strong><small>Mostrar en los calendarios de este Workspace los cumpleaños que sus miembros decidan compartir.</small></span>
                <input type="checkbox" checked={showBirthdays} disabled={birthdayBusy}
                  onChange={event => void changeBirthdaySetting(event.target.checked)}/>
              </label>
              {birthdayError && <p role="alert" className="error">{birthdayError}</p>}
              <label className="workspace-birthday-toggle" style={{ marginTop: 16 }}>
                <span><strong>Habilitar Clientes</strong>
                  <small>Mostrar la gestión de empresas cliente. Desactivarlo no borra clientes ni proyectos existentes.</small></span>
                <input type="checkbox" checked={showClients} disabled={clientsBusy}
                  onChange={event => void changeClients(event.target.checked)}/>
              </label>
              {clientsError && <p role="alert" className="error">{clientsError}</p>}
            </section>
          </>}
  </section>
}
