import { useState } from 'react'
import { NavIcon } from '../../../shared/icons'

type Section = 'departments' | 'teams' | 'clients'
type Props = { active: Section | null; onOpen: (section: Section) => void; showClients: boolean }

export function PersonalSection({ active, onOpen, showClients }: Props) {
  const [open, setOpen] = useState(true)
  return <>
    <button type="button" className="nav-item side-section-toggle" title="Personal" onClick={() => setOpen((current) => !current)}>
      <NavIcon><path d="M17 21v-1a2 2 0 00-2-2H9a2 2 0 00-2 2v1"/><path d="M19 10h1a2 2 0 012 2v1"/><path d="M5 10H4a2 2 0 00-2 2v1"/><circle cx="12" cy="11" r="3"/><circle cx="18" cy="4" r="2"/><circle cx="6" cy="4" r="2"/></NavIcon>
      <span className="side-label-text">Personal</span>
      <span className={`side-section-chevron${open ? ' open' : ''}`}>›</span>
    </button>
    {open && <><span className="mini-section-indicator" aria-hidden="true" />
      <button className={active === 'departments' ? 'nav-item sub on' : 'nav-item sub'} type="button" title="Departamentos" onClick={() => onOpen('departments')}>
        <NavIcon><path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/><path d="m7 16.5-4.74-2.85"/><path d="m7 16.5 5-3"/><path d="M7 16.5v5.17"/><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/><path d="m17 16.5-5-3"/><path d="m17 16.5 4.74-2.85"/><path d="M17 16.5v5.17"/><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/><path d="M12 8 7.26 5.15"/><path d="m12 8 4.74-2.85"/><path d="M12 13.5V8"/></NavIcon><span className="side-label-text">Departamentos</span>
      </button>
      <button className={active === 'teams' ? 'nav-item sub on' : 'nav-item sub'} type="button" title="Equipos" onClick={() => onOpen('teams')}>
        <NavIcon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></NavIcon><span className="side-label-text">Equipos</span>
      </button>
      {showClients && <button className={active === 'clients' ? 'nav-item sub on' : 'nav-item sub'} type="button" title="Clientes" onClick={() => onOpen('clients')}>
        <NavIcon><path d="M16.051 12.616a1 1 0 0 1 1.909.024l.737 1.452a1 1 0 0 0 .737.535l1.634.256a1 1 0 0 1 .588 1.806l-1.172 1.168a1 1 0 0 0-.282.866l.259 1.613a1 1 0 0 1-1.541 1.134l-1.465-.75a1 1 0 0 0-.912 0l-1.465.75a1 1 0 0 1-1.539-1.133l.258-1.613a1 1 0 0 0-.282-.866l-1.156-1.153a1 1 0 0 1 .572-1.822l1.633-.256a1 1 0 0 0 .737-.535z"/><path d="M8 15H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/></NavIcon><span className="side-label-text">Clientes</span>
      </button>}
    </>}
  </>
}
