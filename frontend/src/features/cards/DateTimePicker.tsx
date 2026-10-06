import { useMemo } from 'react'
import { DateRangePicker } from '../board/DateRangePicker'

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
    <DateRangePicker start={dateKey} end={dateKey} onChange={(date) => { if (date) onChange(localIso(date, time)) }} />
    <input className="side-select-trigger date-time-picker-time" type="time" value={time} onChange={(event) => { if (dateKey && event.target.value) onChange(localIso(dateKey, event.target.value)) }} aria-label="Hora de inicio real" />
    {value && <button
      className="icon-button"
      type="button"
      title="Marcar como no iniciada"
      aria-label="Marcar como no iniciada"
      onClick={() => onChange(null)}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
        <path fill="currentColor" d="M320 128C426 128 512 214 512 320C512 426 426 512 320 512C254.8 512 197.1 479.5 162.4 429.7C152.3 415.2 132.3 411.7 117.8 421.8C103.3 431.9 99.8 451.9 109.9 466.4C156.1 532.6 233 576 320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C234.3 64 158.5 106.1 112 170.7L112 144C112 126.3 97.7 112 80 112C62.3 112 48 126.3 48 144L48 256C48 273.7 62.3 288 80 288L104.6 288C105.1 288 105.6 288 106.1 288L192.1 288C209.8 288 224.1 273.7 224.1 256C224.1 238.3 209.8 224 192.1 224L153.8 224C186.9 166.6 249 128 320 128zM344 216C344 202.7 333.3 192 320 192C306.7 192 296 202.7 296 216L296 320C296 326.4 298.5 332.5 303 337L375 409C384.4 418.4 399.6 418.4 408.9 409C418.2 399.6 418.3 384.4 408.9 375.1L343.9 310.1L343.9 216z" />
      </svg>
    </button>}
  </div>
}
