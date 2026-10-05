import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, PointerSensor, closestCorners, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api, type Card, type CardModule, type ChecklistItem, type Person } from '../../../api'
import { Avatar, DotsIcon, PlusIcon, TrashIcon, UserPlusIcon, formatDate } from '../../../shared/ui'
import { parseDateKey, toDateKey } from '../../board'
import { CalendarIcon, SectionToggle } from '../cardSectionUi'

function ChecklistIcon() {
  return (
    <svg className="section-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M 21 10.656 L 21 19" />
      <path d="M 21 19 A2 2 0 0 1 19 21" />
      <path d="M 19 21 L 5 21" />
      <path d="M 5 21 A2 2 0 0 1 3 19" />
      <path d="M 3 19 L 3 5" />
      <path d="M 3 5 A2 2 0 0 1 5 3" />
      <path d="M 5 3 L 17.344 3" />
      <path d="M 9 11 L 12 14" />
      <path d="M 12 14 L 22 4" />
    </svg>
  )
}

function GripIcon() {
  return (
    <svg className="grip-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M152 160C174.1 160 192 177.9 192 200L192 248C192 270.1 174.1 288 152 288L104 288C81.9 288 64 270.1 64 248L64 200C64 177.9 81.9 160 104 160L152 160zM344 288L296 288C273.9 288 256 270.1 256 248L256 200C256 177.9 273.9 160 296 160L344 160C366.1 160 384 177.9 384 200L384 248C384 270.1 366.1 288 344 288zM536 288L488 288C465.9 288 448 270.1 448 248L448 200C448 177.9 465.9 160 488 160L536 160C558.1 160 576 177.9 576 200L576 248C576 270.1 558.1 288 536 288zM536 480L488 480C465.9 480 448 462.1 448 440L448 392C448 369.9 465.9 352 488 352L536 352C558.1 352 576 369.9 576 392L576 440C576 462.1 558.1 480 536 480zM344 352C366.1 352 384 369.9 384 392L384 440C384 462.1 366.1 480 344 480L296 480C273.9 480 256 462.1 256 440L256 392C256 369.9 273.9 352 296 352L344 352zM152 480L104 480C81.9 480 64 462.1 64 440L64 392C64 369.9 81.9 352 104 352L152 352C174.1 352 192 369.9 192 392L192 440C192 462.1 174.1 480 152 480z" />
    </svg>
  )
}

function CheckOnIcon() {
  return (
    <svg className="check-box-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M480 96C515.3 96 544 124.7 544 160L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 160C96 124.7 124.7 96 160 96L480 96zM438 209.7C427.3 201.9 412.3 204.3 404.5 215L285.1 379.2L233 327.1C223.6 317.7 208.4 317.7 199.1 327.1C189.8 336.5 189.7 351.7 199.1 361L271.1 433C276.1 438 283 440.5 289.9 440C296.8 439.5 303.3 435.9 307.4 430.2L443.3 243.2C451.1 232.5 448.7 217.5 438 209.7z" />
    </svg>
  )
}

function CheckOffIcon() {
  return (
    <svg className="check-box-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M480 144C488.8 144 496 151.2 496 160L496 480C496 488.8 488.8 496 480 496L160 496C151.2 496 144 488.8 144 480L144 160C144 151.2 151.2 144 160 144L480 144zM160 96C124.7 96 96 124.7 96 160L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 160C544 124.7 515.3 96 480 96L160 96z" />
    </svg>
  )
}

function CheckItemDateMenu({ value, onChange, onClose, minDate, maxDate }: {
  value?: string | null
  onChange: (value: string | null) => void
  onClose: () => void
  minDate: string
  maxDate?: string | null
}) {
  const selected = parseDateKey(value)
  const [cursor, setCursor] = useState(() => selected ?? parseDateKey(minDate) ?? new Date())
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayKey = toDateKey(new Date())
  const selectedKey = selected ? toDateKey(selected) : null
  const monthLabel = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(cursor)
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - startOffset + 1
    if (day < 1 || day > daysInMonth) return null
    return day
  })
  const todayAllowed = todayKey >= minDate && (!maxDate || todayKey <= maxDate)

  function isDisabled(key: string) {
    if (key < minDate) return true
    if (maxDate && key > maxDate) return true
    return false
  }

  return (
    <div className="check-pop check-date-pop" role="dialog" aria-label="Fecha del elemento">
      <div className="side-date-head">
        <button type="button" className="icon-close" aria-label="Mes anterior" onClick={() => setCursor(new Date(year, month - 1, 1))}>â€¹</button>
        <strong>{monthLabel}</strong>
        <button type="button" className="icon-close" aria-label="Mes siguiente" onClick={() => setCursor(new Date(year, month + 1, 1))}>â€º</button>
      </div>
      <div className="side-date-week">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="side-date-grid">
        {cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} className="side-date-empty" />
          const key = toDateKey(new Date(year, month, day))
          const disabled = isDisabled(key)
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              className={[
                'side-date-day',
                key === selectedKey ? 'on' : '',
                key === todayKey ? 'today' : '',
                disabled ? 'disabled' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => {
                if (disabled) return
                onChange(key)
                onClose()
              }}
            >
              {day}
            </button>
          )
        })}
      </div>
      <div className="side-date-actions">
        <button type="button" className="ghost" onClick={() => { onChange(null); onClose() }}>Quitar fecha</button>
        <button
          type="button"
          className="ghost"
          disabled={!todayAllowed}
          onClick={() => {
            if (!todayAllowed) return
            onChange(todayKey)
            onClose()
          }}
        >
          Hoy
        </button>
      </div>
    </div>
  )
}

function SortableCheckItem({ item, editing, canEdit, members, cardDueDate, onToggle, onPatch, onRemove }: {
  item: ChecklistItem
  editing: boolean
  canEdit: boolean
  members: Person[]
  cardDueDate?: string | null
  onToggle: () => void
  onPatch: (patch: Record<string, unknown>) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !editing,
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickingPeople, setPickingPeople] = useState(false)
  const [pickingDate, setPickingDate] = useState(false)
  const assignees = item.assignees ?? []
  const minDate = toDateKey(new Date())

  function togglePerson(id: number) {
    const current = assignees.map((person) => person.id)
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    void onPatch({ assignee_ids: next })
  }

  return (
    <li
      ref={setNodeRef}
      className={[item.is_done ? 'done' : '', isDragging ? 'dragging' : ''].filter(Boolean).join(' ')}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {editing && (
        <button type="button" className="check-grip" aria-label="Reordenar" {...attributes} {...listeners}>
          <GripIcon />
        </button>
      )}
      <div className="check-main">
        <button
          type="button"
          className={`check-toggle${item.is_done ? ' on' : ''}`}
          disabled={!canEdit}
          aria-pressed={item.is_done}
          aria-label={item.is_done ? 'Marcar como pendiente' : 'Marcar como hecho'}
          onClick={onToggle}
        >
          {item.is_done ? <CheckOnIcon /> : <CheckOffIcon />}
        </button>
        <span className="check-body">{item.body}</span>
      </div>
      <div className="check-meta">
        <div className={`check-assignees${pickingPeople ? ' open' : ''}`}>
          <button
            type="button"
            className="check-faces"
            disabled={!editing}
            aria-label="Asignar miembros"
            aria-expanded={pickingPeople}
            onClick={() => {
              if (!editing) return
              setPickingPeople((open) => !open)
              setPickingDate(false)
              setMenuOpen(false)
            }}
          >
            {assignees.length === 0 ? (
              editing ? (
                <span className="check-add-face" aria-hidden="true">
                  <UserPlusIcon className="check-user-plus" />
                </span>
              ) : null
            ) : (
              assignees.map((person) => (
                <Avatar key={person.id} id={person.id} name={person.name} size={32} className="face" />
              ))
            )}
          </button>
          {pickingPeople && (
            <div className="check-pop people-pop">
              {members.map((person) => {
                const on = assignees.some((item) => item.id === person.id)
                return (
                  <button key={person.id} type="button" className={on ? 'on' : ''} onClick={() => togglePerson(person.id)}>
                    <Avatar id={person.id} name={person.name} size={28} className="face" />
                    <span>{person.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className={`check-date${pickingDate ? ' open' : ''}`}>
          {(editing || item.due_date) && (
            <button
              type="button"
              className="check-date-btn"
              disabled={!editing}
              aria-label="Fecha de vencimiento"
              aria-expanded={pickingDate}
              onClick={() => {
                if (!editing) return
                setPickingDate((open) => !open)
                setPickingPeople(false)
                setMenuOpen(false)
              }}
            >
              <span className="check-date-ico" aria-hidden="true"><CalendarIcon /></span>
              <span>{item.due_date ? formatDate(item.due_date) : 'Fecha'}</span>
            </button>
          )}
          {pickingDate && (
            <CheckItemDateMenu
              value={item.due_date}
              minDate={minDate}
              maxDate={cardDueDate}
              onChange={(due_date) => { void onPatch({ due_date }) }}
              onClose={() => setPickingDate(false)}
            />
          )}
        </div>
        {editing && (
          <div className={`check-menu${menuOpen ? ' open' : ''}`}>
            <button
              type="button"
              className="icon-close"
              aria-label="MÃ¡s opciones"
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuOpen((open) => !open)
                setPickingPeople(false)
                setPickingDate(false)
              }}
            >
              <DotsIcon />
            </button>
            {menuOpen && (
              <div className="check-pop menu-pop">
                <button type="button" className="danger" onClick={() => { setMenuOpen(false); void onRemove() }}>
                  Eliminar elemento
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

export function ChecklistPanel({ card, module, editing, canEdit, members, dragProps, onChange, onRemove }: {
  card: Card
  module: CardModule
  editing: boolean
  canEdit: boolean
  members: Person[]
  dragProps?: Record<string, unknown>
  onChange: () => Promise<void>
  onRemove?: () => Promise<void>
}) {
  const checklist = useMemo(
    () => [...(module.checklist ?? [])].sort((a, b) => a.position - b.position),
    [module.checklist],
  )
  const progress = module.progress
  const done = progress?.done ?? checklist.filter((item) => item.is_done).length
  const total = progress?.total ?? checklist.length
  const [adding, setAdding] = useState(false)
  const [checkBody, setCheckBody] = useState('')
  const [items, setItems] = useState(checklist)
  const [collapsed, setCollapsed] = useState(false)
  const [title, setTitle] = useState(module.title || 'Checklist')
  const [renaming, setRenaming] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    setItems(checklist)
  }, [checklist])

  useEffect(() => {
    setTitle(module.title || 'Checklist')
  }, [module.title])

  useEffect(() => {
    if (!renaming) return
    const id = window.setTimeout(() => {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }, 0)
    return () => window.clearTimeout(id)
  }, [renaming])

  async function saveTitle() {
    const next = title.trim() || 'Checklist'
    setTitle(next)
    setRenaming(false)
    if (next === (module.title || 'Checklist')) return
    await api(`/modules/${module.id}`, { method: 'PATCH', body: JSON.stringify({ title: next }) })
    await onChange()
  }

  async function addCheckItem(event: FormEvent) {
    event.preventDefault()
    if (!checkBody.trim()) return
    await api(`/cards/${card.id}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ body: checkBody.trim(), module_id: module.id }),
    })
    setCheckBody('')
    setAdding(false)
    await onChange()
  }

  async function patchItem(id: number, patch: Record<string, unknown>) {
    await api(`/checklist/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    await onChange()
  }

  async function removeItem(id: number) {
    await api(`/checklist/${id}`, { method: 'DELETE' })
    await onChange()
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(items, oldIndex, newIndex).map((item, index) => ({ ...item, position: index + 1 }))
    setItems(next)
    await api(`/cards/${card.id}/checklist/reorder`, {
      method: 'POST',
      body: JSON.stringify({ module_id: module.id, ordered_ids: next.map((item) => item.id) }),
    })
    await onChange()
  }

  return (
    <section className={`card-modal-section checklist${collapsed ? ' is-collapsed' : ''}`}>
      <div className={`section-head checklist-head${dragProps ? ' is-module-drag' : ''}`} {...dragProps}>
        <h3>
          <SectionToggle
            icon={<ChecklistIcon />}
            label={title}
            collapsed={collapsed}
            onToggle={() => setCollapsed((open) => !open)}
          />
          {renaming ? (
            <input
              ref={titleInputRef}
              className="module-title-input"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => { void saveTitle() }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void saveTitle()
                }
                if (event.key === 'Escape') {
                  setTitle(module.title || 'Checklist')
                  setRenaming(false)
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="module-title-btn"
              disabled={!editing}
              onClick={() => editing && setRenaming(true)}
            >
              {title}
            </button>
          )}
          {' '}
          {editing && (
            <span className="checklist-progress">({done}/{total})</span>
          )}
        </h3>
        {!editing && total > 0 && (
          <div className="checklist-meter">
            <span className="checklist-meter-count">{done}/{total}</span>
            <div
              className="checklist-bar"
              role="progressbar"
              aria-label="Progreso del checklist"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
              title={`${done} de ${total} completados`}
            >
              <span style={{ width: `${Math.round((done / total) * 100)}%` }} />
            </div>
          </div>
        )}
        {editing && (
          <div className="module-head-actions">
            <button type="button" className="ghost check-add-btn" onClick={() => setAdding((open) => !open)}>
              <PlusIcon className="plus-icon" /> AÃ±adir elemento
            </button>
            {onRemove && (
              <button
                type="button"
                className="ghost icon-btn module-remove-btn"
                aria-label="Eliminar mÃ³dulo"
                title="Eliminar mÃ³dulo"
                onClick={() => { void onRemove() }}
              >
                <TrashIcon />
              </button>
            )}
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <ul className="check-list">
                {items.map((item) => (
                  <SortableCheckItem
                    key={item.id}
                    item={item}
                    editing={editing}
                    canEdit={canEdit}
                    members={members}
                    cardDueDate={card.due_date}
                    onToggle={() => { void patchItem(item.id, { is_done: !item.is_done }) }}
                    onPatch={(patch) => patchItem(item.id, patch)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          {editing && adding && (
            <form className="check-add" onSubmit={addCheckItem}>
              <input
                autoFocus
                id={`check-add-${module.id}`}
                value={checkBody}
                onChange={(event) => setCheckBody(event.target.value)}
                placeholder="Nuevo elemento"
                maxLength={240}
              />
              <button className="primary" type="submit" disabled={!checkBody.trim()}>AÃ±adir</button>
              <button className="ghost" type="button" onClick={() => { setAdding(false); setCheckBody('') }}>Cancelar</button>
            </form>
          )}
        </>
      )}
    </section>
  )
}

