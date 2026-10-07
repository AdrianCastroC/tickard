import { useMemo } from 'react'
import { DateRangePicker } from '../board/DateRangePicker'
import { ResetStartedAtIcon } from '../../shared/icons'

function localParts(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return {
    date,
    dateKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  }
}

function localIso(dateKey: string, time: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes).toISOString()
}

export function formatStartedAt(value?: string | null) {
  const parts = localParts(value)
  if (!parts) return '—'
  const date = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(parts.date)
  const get = (type: Intl.DateTimeFormatPartTypes) => date.find((part) => part.type === type)?.value ?? ''
  return `${get('day')} ${get('month').replace('.', '')} ${get('year')} · ${get('hour')}:${get('minute')}`
}

export function DateTimePicker({ value, onChange }: { value?: string | null; onChange: (value: string | null) => void }) {
  const parts = useMemo(() => localParts(value), [value])
  const dateKey = parts?.dateKey ?? null
  const time = parts?.time ?? '09:00'
  return <div className="date-time-picker">
    <DateRangePicker single triggerAriaLabel="Fecha de inicio" start={dateKey} end={dateKey} onChange={(date) => { if (date) onChange(localIso(date, time)) }} />
    <input className="side-select-trigger date-time-picker-time" type="time" value={time} onChange={(event) => { if (dateKey && event.target.value) onChange(localIso(dateKey, event.target.value)) }} aria-label="Hora de inicio" />
    {value && <button
      className="icon-button"
      type="button"
      title="Marcar como no iniciada"
      aria-label="Marcar como no iniciada"
      onClick={() => onChange(null)}
    >
      <ResetStartedAtIcon />
    </button>}
  </div>
}
