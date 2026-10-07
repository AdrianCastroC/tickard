import { NavIcon } from '../../shared/icons'
export type BoardViewMode = 'summary' | 'board' | 'list' | 'table' | 'gantt'
type Props = { value: BoardViewMode; onChange: (value: BoardViewMode) => void }

export function BoardViews({ value, onChange }: Props) {
  return <>
    <button className={value === 'summary' ? 'primary' : undefined} type="button" onClick={() => onChange('summary')} aria-pressed={value === 'summary'}>Resumen</button>
    <button className={value === 'board' ? 'primary' : undefined} type="button" onClick={() => onChange('board')} aria-pressed={value === 'board'}><NavIcon><path d="M5 3v14" /><path d="M12 3v8" /><path d="M19 3v18" /></NavIcon>Tablero</button>
    <button className={value === 'list' ? 'primary' : undefined} type="button" onClick={() => onChange('list')} aria-pressed={value === 'list'}><NavIcon><path d="M21 5H3" /><path d="M15 12H3" /><path d="M17 19H3" /></NavIcon>Lista</button>
    <button className={value === 'table' ? 'primary' : undefined} type="button" onClick={() => onChange('table')} aria-pressed={value === 'table'}><NavIcon><path d="M12 3v18" /><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" /></NavIcon>Tabla</button>
    <button className={value === 'gantt' ? 'primary' : undefined} type="button" onClick={() => onChange('gantt')} aria-pressed={value === 'gantt'}><NavIcon><path d="M6 5h12" /><path d="M4 12h10" /><path d="M12 19h8" /></NavIcon>Gantt</button>
  </>
}
