import { useEffect, useState } from 'react'
import { ChevronIcon, formatDateLong } from '../../shared/ui'
import { parseDateKey, toDateKey } from './Kanban'

export function formatDateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return 'Sin fechas'
  if (start && end && start !== end) return `${formatDateLong(start)} — ${formatDateLong(end)}`
  return formatDateLong(start || end)
}

export function DateRangePicker({ start, end, onChange, single = false }: { start?: string | null; end?: string | null; onChange: (start: string | null, end: string | null) => void; single?: boolean }) {
  const [open, setOpen] = useState(false); const [cursor, setCursor] = useState(() => parseDateKey(start || end) ?? new Date()); const [pending, setPending] = useState<string | null>(null)
  useEffect(() => { const d = parseDateKey(start || end); if (d) setCursor(d) }, [start, end])
  const year = cursor.getFullYear(); const month = cursor.getMonth(); const first = new Date(year, month, 1); const offset = (first.getDay() + 6) % 7; const days = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: 42 }, (_, i) => { const d = i - offset + 1; return d < 1 || d > days ? null : d })
  return <div className={`side-select side-date${open ? ' open' : ''}`}><button type="button" className="side-select-trigger" onClick={() => setOpen(!open)}><span className="side-select-main"><strong>{formatDateRange(start, end)}</strong></span><ChevronIcon /></button>{open && <div className="side-date-menu"><div className="side-date-head"><button type="button" className="icon-close" onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button><strong>{new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(cursor)}</strong><button type="button" className="icon-close" onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button></div><div className="side-date-grid">{cells.map((day, i) => day === null ? <span key={i} className="side-date-empty" /> : (() => { const key = toDateKey(new Date(year, month, day)); const selected = key === start || key === end || key === pending; const range = !!start && !!end && key >= start && key <= end; const rangeStart = range && key === start; const rangeEnd = range && key === end; return <button key={key} type="button" className={['side-date-day', selected ? 'on' : '', range ? 'range' : '', rangeStart ? 'range-start' : '', rangeEnd ? 'range-end' : ''].filter(Boolean).join(' ')} onClick={() => { if (single) { onChange(key, key); setPending(null); setOpen(false); return } if (!pending) setPending(key); else { const a = pending < key ? pending : key; const b = pending < key ? key : pending; onChange(a, b); setPending(null); setOpen(false) } }}>{day}</button> })())}</div>{!single && <div className="side-date-actions"><button type="button" className="ghost" onClick={() => { onChange(null, null); setPending(null); setOpen(false) }}>Quitar fechas</button></div>}</div>}</div>
}
