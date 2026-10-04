import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'

import { DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, horizontalListSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api, type BoardCategory, type BoardPayload, type Card } from '../../api'
import { Avatar, ChevronIcon, CollapseColumnIcon, DotsIcon, EditIcon, ExpandColumnIcon, PaletteIcon, PinIcon, PlusIcon, TrashIcon, UnpinIcon, VisibilityIcon, cardStripeStyle, DEFAULT_CARD_STRIPE, formatDate, formatDateLong, priorityLabel } from '../../shared/ui'

function CalendarPickIcon() {
  return (
    <svg className="side-ico date-pick-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M224 64C241.7 64 256 78.3 256 96L256 128L384 128L384 96C384 78.3 398.3 64 416 64C433.7 64 448 78.3 448 96L448 128L480 128C515.3 128 544 156.7 544 192L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 192C96 156.7 124.7 128 160 128L192 128L192 96C192 78.3 206.3 64 224 64zM224 320C206.3 320 192 334.3 192 352L192 416C192 433.7 206.3 448 224 448L288 448C305.7 448 320 433.7 320 416L320 352C320 334.3 305.7 320 288 320L224 320z" />
    </svg>
  )
}

function CategoryIcon({ className = 'side-ico' }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M64 112C64 85.5 85.5 64 112 64L208 64C234.5 64 256 85.5 256 112L256 480C256 533 213 576 160 576C107 576 64 533 64 480L64 112zM304 473.6L304 202.1L352.1 154C370.8 135.3 401.2 135.3 420 154L487.9 221.9C506.6 240.6 506.6 271 487.9 289.8L304 473.6zM269.5 576L461.5 384L528.1 384C554.6 384 576.1 405.5 576.1 432L576.1 528C576.1 554.5 554.6 576 528.1 576L269.6 576zM144 128C135.2 128 128 135.2 128 144L128 176C128 184.8 135.2 192 144 192L176 192C184.8 192 192 184.8 192 176L192 144C192 135.2 184.8 128 176 128L144 128zM128 272L128 304C128 312.8 135.2 320 144 320L176 320C184.8 320 192 312.8 192 304L192 272C192 263.2 184.8 256 176 256L144 256C135.2 256 128 263.2 128 272zM160 504C173.3 504 184 493.3 184 480C184 466.7 173.3 456 160 456C146.7 456 136 466.7 136 480C136 493.3 146.7 504 160 504z" />
    </svg>
  )
}

export function Filters(props: {
  clientView: boolean
  visibility: Record<string, boolean>
  members: { id: number; name: string }[]
  labels: { id: number; name: string }[]
  assignee: string
  teamId: string
  teams: { id: number; name: string }[]
  label: string
  priority: string
  onAssignee: (value: string) => void
  onTeam: (value: string) => void
  onLabel: (value: string) => void
  onPriority: (value: string) => void
}) {
  const showAssignee = !props.clientView || props.visibility.assignee
  const showPriority = !props.clientView || props.visibility.priority
  const showLabels = !props.clientView || props.visibility.labels
  return (
    <form className="filters" onSubmit={(event) => event.preventDefault()}>
      {showAssignee && (
        <label className="field">Persona
          <select value={props.assignee} onChange={(event) => props.onAssignee(event.target.value)}>
            <option value="">Cualquiera</option>
            {props.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
      )}
      {showAssignee && props.teams.length > 0 && (
        <label className="field">Equipo
          <select value={props.teamId} onChange={(event) => props.onTeam(event.target.value)}>
            <option value="">Cualquiera</option>
            {props.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
      )}
      {showLabels && (
        <label className="field">Etiqueta
          <select value={props.label} onChange={(event) => props.onLabel(event.target.value)}>
            <option value="">Cualquiera</option>
            {props.labels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      )}
      {showPriority && (
        <label className="field">Prioridad
          <select value={props.priority} onChange={(event) => props.onPriority(event.target.value)}>
            <option value="">Cualquiera</option>
            {Object.entries(priorityLabel).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>
      )}
    </form>
  )
}

function assignedTo(card: Card, userId: string) {
  if (card.assignees?.some((person) => String(person.id) === userId)) return true
  return card.teams?.some((team) => team.member_ids?.some((id) => String(id) === userId)) ?? false
}

function matches(card: Card, query: string, assignee: string, teamId: string, label: string, priority: string) {
  if (query && !card.title.toLowerCase().includes(query.toLowerCase())) return false
  if (assignee && !assignedTo(card, assignee)) return false
  if (teamId && !card.teams?.some((team) => String(team.id) === teamId)) return false
  if (label && !card.labels?.some((item) => String(item.id) === label)) return false
  if (priority && card.priority !== priority) return false
  return true
}

function columnSortId(id: number) {
  return `column-${id}`
}

function parseColumnSortId(value: string | number) {
  const match = /^column-(\d+)$/.exec(String(value))
  return match ? Number(match[1]) : null
}

function categoryKey(card: { category_id?: number | null }) {
  return card.category_id == null ? 'none' : String(card.category_id)
}

function sameCategory(a: { category_id?: number | null }, b: { category_id?: number | null }) {
  return (a.category_id ?? null) === (b.category_id ?? null)
}

function groupDropId(columnId: number, key: string) {
  return `group-${columnId}-${key}`
}

function parseGroupDropId(value: string) {
  const match = /^group-(\d+)-(.+)$/.exec(value)
  if (!match) return null
  return { columnId: Number(match[1]), categoryKey: match[2] }
}

function pinnedColumnsKey(boardId: number) {
  return `gestor:pinned-columns:${boardId}`
}

function readPinnedColumns(boardId: number) {
  try {
    const raw = localStorage.getItem(pinnedColumnsKey(boardId))
    if (!raw) return [] as number[]
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : []
  } catch {
    return [] as number[]
  }
}

export function orderedColumnCards(column: { cards: Card[] }, categories: BoardCategory[]) {
  const uncategorized = column.cards.filter((card) => !card.category_id)
  const grouped = categories
    .filter((category) => column.cards.some((card) => card.category_id === category.id))
    .flatMap((category) => column.cards.filter((card) => card.category_id === category.id))
  return [...uncategorized, ...grouped]
}

function insertIndexForCard(
  visual: Card[],
  categories: BoardCategory[],
  card: Card,
  peerIndex: number,
) {
  const firstPeer = visual.findIndex((item) => sameCategory(item, card))
  if (firstPeer >= 0) return firstPeer + peerIndex
  if (!card.category_id) return Math.min(peerIndex, visual.filter((item) => !item.category_id).length)

  const categoryIndex = categories.findIndex((category) => category.id === card.category_id)
  let insertAt = visual.filter((item) => !item.category_id).length
  categories.slice(0, Math.max(categoryIndex, 0)).forEach((category) => {
    insertAt += visual.filter((item) => item.category_id === category.id).length
  })
  return insertAt + peerIndex
}

export function Kanban(props: {
  board: BoardPayload
  canEdit: boolean
  canManage: boolean
  query: string
  assignee: string
  teamId: string
  label: string
  priority: string
  onOpen: (card: Card) => void
  onEdit: (card: Card) => void
  onMove: (cardId: number, columnId: number, position: number) => Promise<void>
  onMoveColumn: (columnId: number, position: number) => Promise<void>
  onAdd: (columnId: number, name: string) => void
  onCreatedColumn: () => Promise<void> | void
  onRefresh: () => Promise<void> | void
  onManageCategories: () => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const dragged = useRef(false)
  const [activeId, setActiveId] = useState<string | number | null>(null)
  const boardId = props.board.board.id
  const [pinnedIds, setPinnedIds] = useState<number[]>(() => readPinnedColumns(boardId))
  const categories = props.board.categories ?? []
  const columns = useMemo(() => props.board.columns.map((column) => ({
    ...column,
    cards: column.cards.filter((card) => matches(card, props.query, props.assignee, props.teamId, props.label, props.priority)),
  })), [props.board, props.query, props.assignee, props.teamId, props.label, props.priority])
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds])
  const pinnedColumns = useMemo(() => {
    const byId = new Map(columns.map((column) => [column.id, column]))
    return pinnedIds
      .map((id) => byId.get(id))
      .filter((column): column is typeof columns[number] => !!column)
  }, [columns, pinnedIds])
  const unpinnedColumns = useMemo(
    () => columns.filter((column) => !pinnedSet.has(column.id)),
    [columns, pinnedSet],
  )
  const allCards = columns.flatMap((column) => column.cards)
  const activeColumnId = activeId == null ? null : parseColumnSortId(activeId)
  const activeCard = activeColumnId == null && activeId != null
    ? allCards.find((card) => card.id === Number(activeId))
    : undefined
  const activeColumn = activeColumnId == null ? undefined : columns.find((column) => column.id === activeColumnId)

  useEffect(() => {
    setPinnedIds(readPinnedColumns(boardId))
  }, [boardId])

  useEffect(() => {
    const valid = new Set(columns.map((column) => column.id))
    setPinnedIds((current) => {
      const next = current.filter((id) => valid.has(id))
      if (next.length === current.length && next.every((id, index) => id === current[index])) return current
      localStorage.setItem(pinnedColumnsKey(boardId), JSON.stringify(next))
      return next
    })
  }, [boardId, columns])

  function togglePinned(columnId: number) {
    setPinnedIds((current) => {
      const isPinned = current.includes(columnId)
      const next = isPinned
        ? current.filter((id) => id !== columnId)
        : [...current, columnId]
      localStorage.setItem(pinnedColumnsKey(boardId), JSON.stringify(next))
      if (!isPinned) {
        void props.onMoveColumn(columnId, next.length - 1)
      }
      return next
    })
  }

  const collisionDetection: CollisionDetection = (args) => {
    const draggingColumn = parseColumnSortId(args.active.id)
    if (draggingColumn != null) {
      const draggingPinned = pinnedSet.has(draggingColumn)
      return closestCorners({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) => {
          if (container.id === args.active.id) return false
          const id = parseColumnSortId(container.id)
          if (id == null) return false
          return pinnedSet.has(id) === draggingPinned
        }),
      })
    }

    const dragging = allCards.find((card) => card.id === Number(args.active.id))
    if (!dragging) return closestCorners(args)
    const key = categoryKey(dragging)
    const preferred = args.droppableContainers.filter((container) => {
      if (container.id === args.active.id) return false
      const id = String(container.id)
      if (parseColumnSortId(id) != null) return false
      const group = parseGroupDropId(id)
      if (group) return group.categoryKey === key
      const overCard = allCards.find((card) => card.id === Number(id))
      return overCard ? sameCategory(dragging, overCard) : false
    })
    const hits = closestCorners({ ...args, droppableContainers: preferred })
    if (hits.length > 0) return hits
    return closestCorners({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) => {
        if (container.id === args.active.id) return false
        return parseColumnSortId(container.id) != null
      }),
    })
  }

  async function onDragEnd(event: DragEndEvent) {
    const draggedId = event.active.id
    setActiveId(null)
    window.setTimeout(() => { dragged.current = false }, 0)
    if (!event.over || draggedId === event.over.id) return

    const movingColumnId = parseColumnSortId(draggedId)
    if (movingColumnId != null) {
      if (!props.canManage) return
      const overColumnId = parseColumnSortId(event.over.id)
      if (overColumnId == null) return
      const movingPinned = pinnedSet.has(movingColumnId)
      const overPinned = pinnedSet.has(overColumnId)
      if (movingPinned !== overPinned) return

      if (movingPinned) {
        const from = pinnedIds.indexOf(movingColumnId)
        const to = pinnedIds.indexOf(overColumnId)
        if (from < 0 || to < 0 || from === to) return
        const nextPinned = arrayMove(pinnedIds, from, to)
        setPinnedIds(nextPinned)
        localStorage.setItem(pinnedColumnsKey(boardId), JSON.stringify(nextPinned))
        await props.onMoveColumn(movingColumnId, to)
        return
      }

      const order = unpinnedColumns.map((column) => column.id).filter((id) => id !== movingColumnId)
      const overIndex = order.indexOf(overColumnId)
      if (overIndex < 0) return
      await props.onMoveColumn(movingColumnId, pinnedColumns.length + overIndex)
      return
    }

    if (!props.canEdit) return
    const draggingCard = allCards.find((card) => card.id === Number(draggedId))
    if (!draggingCard) return
    const cardId = draggingCard.id
    const over = String(event.over.id)
    const group = parseGroupDropId(over)
    const overColumnId = parseColumnSortId(over)
    const overCard = group || overColumnId != null ? null : allCards.find((card) => card.id === Number(over))
    const targetColumnId = group?.columnId ?? overColumnId ?? overCard?.column_id
    if (!targetColumnId) return
    if (group && group.categoryKey !== categoryKey(draggingCard)) return
    if (overCard && !sameCategory(draggingCard, overCard)) return

    const targetColumn = columns.find((column) => column.id === targetColumnId)
    if (!targetColumn) return

    const peers = orderedColumnCards(targetColumn, categories).filter((card) => sameCategory(card, draggingCard) && card.id !== cardId)
    let peerIndex = peers.length
    if (overCard) {
      const index = peers.findIndex((card) => card.id === overCard.id)
      peerIndex = index >= 0 ? index : peers.length
    }

    const visual = orderedColumnCards(
      { cards: targetColumn.cards.filter((card) => card.id !== cardId) },
      categories,
    )
    const insertAt = insertIndexForCard(visual, categories, draggingCard, peerIndex)
    await props.onMove(cardId, targetColumnId, insertAt)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={(event) => {
        dragged.current = true
        setActiveId(event.active.id)
      }}
      onDragCancel={() => {
        setActiveId(null)
        dragged.current = false
      }}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={[...pinnedColumns, ...unpinnedColumns].map((column) => columnSortId(column.id))}
        strategy={horizontalListSortingStrategy}
      >
        <div className="board">
          {pinnedColumns.length > 0 && (
            <aside className="board-pinned" aria-label="Columnas fijadas">
              {pinnedColumns.map((column) => (
                <ColumnView
                  key={column.id}
                  column={column}
                  categories={categories}
                  canEdit={props.canEdit}
                  canManage={props.canManage}
                  pinned
                  onTogglePinned={() => togglePinned(column.id)}
                  onOpen={(card) => { if (!dragged.current) props.onOpen(card) }}
                  onEdit={(card) => { if (!dragged.current) props.onEdit(card) }}
                  onAdd={() => props.onAdd(column.id, column.name)}
                  onRefresh={props.onRefresh}
                  onManageCategories={props.onManageCategories}
                  dropCategoryKey={activeCard ? categoryKey(activeCard) : null}
                />
              ))}
            </aside>
          )}
          <div className="board-scroll">
            {unpinnedColumns.map((column) => (
              <ColumnView
                key={column.id}
                column={column}
                categories={categories}
                canEdit={props.canEdit}
                canManage={props.canManage}
                pinned={false}
                onTogglePinned={() => togglePinned(column.id)}
                onOpen={(card) => { if (!dragged.current) props.onOpen(card) }}
                onEdit={(card) => { if (!dragged.current) props.onEdit(card) }}
                onAdd={() => props.onAdd(column.id, column.name)}
                onRefresh={props.onRefresh}
                onManageCategories={props.onManageCategories}
                dropCategoryKey={activeCard ? categoryKey(activeCard) : null}
              />
            ))}
            {props.canManage && (
              <NewColumnTemplate boardId={props.board.board.id} onCreated={props.onCreatedColumn} />
            )}
          </div>
        </div>
      </SortableContext>
      <DragOverlay>
        {activeCard ? <CardFace card={activeCard} /> : null}
        {activeColumn ? <div className="column-overlay"><strong>{activeColumn.name}</strong></div> : null}
      </DragOverlay>
    </DndContext>
  )
}

export function NewColumnTemplate({ boardId, onCreated }: { boardId: number; onCreated: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const title = name.trim()
    if (!title || saving) return
    setSaving(true)
    try {
      await api(`/boards/${boardId}/columns`, { method: 'POST', body: JSON.stringify({ name: title }) })
      setName('')
      setOpen(false)
      await onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="column template">
      {open ? (
        <form onSubmit={submit}>
          <input
            autoFocus
            value={name}
            placeholder="Nombre de la columna"
            onChange={(event) => setName(event.target.value)}
          />
          <div className="row">
            <button className="primary" type="submit" disabled={saving || !name.trim()}>Crear</button>
            <button className="ghost" type="button" onClick={() => { setOpen(false); setName('') }}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)}><PlusIcon /> Crear columna nueva</button>
      )}
    </section>
  )
}

export function ColumnView({ column, categories, canEdit, canManage, pinned, onTogglePinned, onOpen, onEdit, onAdd, onRefresh, onManageCategories, dropCategoryKey }: {
  column: BoardPayload['columns'][number]
  categories: BoardCategory[]
  canEdit: boolean
  canManage: boolean
  pinned: boolean
  onTogglePinned: () => void
  onOpen: (card: Card) => void
  onEdit: (card: Card) => void
  onAdd: () => void
  onRefresh: () => Promise<void> | void
  onManageCategories: () => void
  dropCategoryKey: string | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: columnSortId(column.id),
    disabled: !canManage,
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(column.name)
  const [error, setError] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const columnColor = column.color || DEFAULT_CARD_STRIPE
  const canDrag = canManage && !renaming

  useEffect(() => {
    setName(column.name)
  }, [column.name])

  useEffect(() => {
    if (!menuOpen) return
    function close(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
        setError('')
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  async function saveName(event: FormEvent) {
    event.preventDefault()
    const title = name.trim()
    if (!title) return
    await api(`/columns/${column.id}`, { method: 'PATCH', body: JSON.stringify({ name: title }) })
    setRenaming(false)
    setMenuOpen(false)
    await onRefresh()
  }

  async function saveColor(next: string) {
    await api(`/columns/${column.id}`, { method: 'PATCH', body: JSON.stringify({ color: next }) })
    await onRefresh()
  }

  async function removeColumn() {
    setError('')
    try {
      await api(`/columns/${column.id}`, { method: 'DELETE' })
      setMenuOpen(false)
      await onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la columna.')
    }
  }

  const hasCards = column.cards.length > 0
  const uncategorized = column.cards.filter((card) => !card.category_id)

  function renderCard(card: Card) {
    return (
      <SortableCard
        key={card.id}
        card={card}
        disabled={!canEdit}
        canEdit={canEdit}
        onOpen={() => onOpen(card)}
        onEdit={() => onEdit(card)}
      />
    )
  }

  return (
    <section
      className={`column${isDragging ? ' dragging' : ''}${collapsed ? ' is-collapsed' : ''}${column.color ? ' has-color' : ''}${pinned ? ' is-pinned' : ''}`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(column.color ? { ['--column-stripe' as string]: column.color } : {}),
      }}
    >
      <header
        className={canDrag ? 'is-draggable' : undefined}
        {...(canDrag ? { ...attributes, ...listeners } : {})}
      >
        {renaming ? (
          <form className="rename" onSubmit={saveName} onPointerDown={(event) => event.stopPropagation()}>
            <input value={name} autoFocus onChange={(event) => setName(event.target.value)} />
            <div className="row">
              <button className="primary" type="submit">Guardar</button>
              <button className="ghost" type="button" onClick={() => { setRenaming(false); setName(column.name); setMenuOpen(false) }}>Cancelar</button>
            </div>
          </form>
        ) : (
          <>
            {collapsed && (
              <button
                className="more collapse"
                type="button"
                aria-label={`Expandir columna ${column.name}`}
                aria-pressed
                title="Expandir columna"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setCollapsed(false)}
              >
                <ExpandColumnIcon />
              </button>
            )}
            <h2>{column.name}</h2>
            <div
              className="column-tools"
              ref={menuRef}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <span className="count muted">{column.cards.length}</span>
              {!collapsed && (
                <button
                  className="more collapse"
                  type="button"
                  aria-label={`Contraer columna ${column.name}`}
                  aria-pressed={false}
                  title="Contraer columna"
                  onClick={() => {
                    setMenuOpen(false)
                    setCollapsed(true)
                  }}
                >
                  <CollapseColumnIcon />
                </button>
              )}
              {canManage && !collapsed && (
                <>
                  <button
                    className={menuOpen ? 'more on' : 'more'}
                    type="button"
                    aria-label={`Opciones de ${column.name}`}
                    onClick={() => { setMenuOpen(!menuOpen); setError('') }}
                  >
                    <DotsIcon />
                  </button>
                  {menuOpen && (
                    <div className="pop-menu">
                      <button type="button" onClick={() => { setRenaming(true); setMenuOpen(false) }}>
                        <EditIcon /> Cambiar nombre
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          colorInputRef.current?.click()
                        }}
                      >
                        <PaletteIcon /> Cambiar color
                      </button>
                      <button type="button" onClick={() => { setMenuOpen(false); onManageCategories() }}>
                        <CategoryIcon className="menu-icon" /> Gestionar categoría
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          onTogglePinned()
                        }}
                      >
                        {pinned ? <UnpinIcon /> : <PinIcon />}
                        {pinned ? 'Desfijar columna' : 'Fijar columna'}
                      </button>
                      {canEdit && (
                        <button type="button" onClick={() => { setMenuOpen(false); onAdd() }}>
                          <PlusIcon className="menu-icon" /> Añadir tarea
                        </button>
                      )}
                      <span
                        className="pop-menu-tip"
                        title={hasCards ? 'No se puede eliminar una columna con tarjetas. Muévelas o elimínalas antes.' : undefined}
                      >
                        <button
                          className="danger"
                          type="button"
                          disabled={hasCards}
                          onClick={() => {
                            if (hasCards) return
                            void removeColumn()
                          }}
                        >
                          <TrashIcon /> Eliminar
                        </button>
                      </span>
                      {error && <p className="muted">{error}</p>}
                    </div>
                  )}
                  <input
                    ref={colorInputRef}
                    className="color-input"
                    type="color"
                    value={columnColor}
                    onChange={(event) => { void saveColor(event.target.value) }}
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                </>
              )}
            </div>
          </>
        )}
      </header>
      {!collapsed && (
        <>
          <CategoryGroup
            columnId={column.id}
            categoryKey="none"
            cards={uncategorized}
            renderCard={renderCard}
            active={dropCategoryKey === 'none'}
          />
          {categories.map((category) => {
            const cards = column.cards.filter((card) => card.category_id === category.id)
            const key = String(category.id)
            if (cards.length === 0 && dropCategoryKey !== key) return null
            return (
              <CategoryGroup
                key={category.id}
                columnId={column.id}
                categoryKey={key}
                label={cards.length > 0 ? category.name : undefined}
                cards={cards}
                renderCard={renderCard}
                active={dropCategoryKey === key}
              />
            )
          })}
          {canEdit
            ? <button className="add-card" type="button" onClick={onAdd}><PlusIcon /> Añadir tarea</button>
            : column.cards.length === 0 && <p className="muted">Sin tarjetas</p>}
        </>
      )}
    </section>
  )
}

export function CategoryGroup({ columnId, categoryKey: key, label, cards, renderCard, active }: {
  columnId: number
  categoryKey: string
  label?: string
  cards: Card[]
  renderCard: (card: Card) => ReactNode
  active?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: groupDropId(columnId, key) })
  return (
    <div
      className={[
        'category-group',
        label ? '' : 'plain',
        cards.length === 0 ? 'empty' : '',
        active ? 'active-drop' : '',
        isOver ? 'over' : '',
      ].filter(Boolean).join(' ')}
      ref={setNodeRef}
    >
      {label && <p className="category-label">{label}</p>}
      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        {cards.map(renderCard)}
      </SortableContext>
    </div>
  )
}

function columnShares(counts: number[]) {
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (total === 0) return counts.map(() => 0)
  const exact = counts.map((count) => (count / total) * 100)
  const shares = exact.map((value) => Math.floor(value))
  let leftover = 100 - shares.reduce((sum, value) => sum + value, 0)
  exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)
    .forEach((item) => {
      if (leftover <= 0) return
      shares[item.index] += 1
      leftover -= 1
    })
  return shares
}

export function BoardPulse({ columns }: { columns: BoardPayload['columns'] }) {
  const shares = columnShares(columns.map((column) => column.cards.length))
  return (
    <div className="pulse">
      {columns.map((column, index) => (
        <article key={column.id}>
          <p className="muted">{column.name}</p>
          <strong>{column.cards.length}</strong>
          <span>{shares[index]}% del tablero</span>
        </article>
      ))}
    </div>
  )
}

export function PriorityMark({ priority }: { priority?: Card['priority'] }) {
  if (!priority) return null
  const level = { baja: 1, media: 2, alta: 3, urgente: 4 }[priority]
  return (
    <span className={`prio-signal prio-${priority}`} title={`Prioridad ${priorityLabel[priority]}`} aria-label={`Prioridad ${priorityLabel[priority]}`}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path className={level >= 1 ? 'on' : undefined} d="M3 20h.01" />
        <path className={level >= 2 ? 'on' : undefined} d="M9 20v-4" />
        <path className={level >= 3 ? 'on' : undefined} d="M15 20v-8" />
        <path className={level >= 4 ? 'on' : undefined} d="M21 20V8" />
      </svg>
    </span>
  )
}

export function PriorityPicker({ value, onChange }: {
  value?: Card['priority']
  onChange: (priority: Card['priority']) => void
}) {
  const current = value ?? 'media'
  return (
    <div className="prio-picker" role="radiogroup" aria-label="Prioridad">
      {(Object.keys(priorityLabel) as Array<keyof typeof priorityLabel>).map((priority) => {
        const selected = current === priority
        return (
          <button
            key={priority}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`prio-option prio-${priority}${selected ? ' on' : ''}`}
            onClick={() => onChange(priority)}
          >
            <PriorityMark priority={priority} />
            <span>{priorityLabel[priority]}</span>
          </button>
        )
      })}
    </div>
  )
}

export function SideSelect<T extends string | number>({
  value,
  options,
  onChange,
  leading,
}: {
  value: T
  options: { value: T; label: string; leading?: ReactNode }[]
  onChange: (value: T) => void
  leading?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((option) => option.value === value)
  return (
    <div className={`side-select${open ? ' open' : ''}`}>
      <button
        type="button"
        className="side-select-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="side-select-main">
          {leading ?? current?.leading}
          <strong>{current?.label ?? '—'}</strong>
        </span>
        <ChevronIcon />
      </button>
      {open && (
        <div className="side-select-menu" role="listbox">
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? 'on' : ''}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              {option.leading}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateKey(value?: string | null) {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function SideDatePicker({ value, onChange }: {
  value?: string | null
  onChange: (value: string | null) => void
}) {
  const selected = parseDateKey(value)
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => selected ?? new Date())

  useEffect(() => {
    if (selected) setCursor(selected)
  }, [value])

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

  return (
    <div className={`side-select side-date${open ? ' open' : ''}`}>
      <button
        type="button"
        className="side-select-trigger"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="side-select-main">
          <CalendarPickIcon />
          <strong>{formatDateLong(value)}</strong>
        </span>
        <ChevronIcon />
      </button>
      {open && (
        <div className="side-date-menu" role="dialog" aria-label="Elegir fecha">
          <div className="side-date-head">
            <button type="button" className="icon-close" aria-label="Mes anterior" onClick={() => setCursor(new Date(year, month - 1, 1))}>
              ‹
            </button>
            <strong>{monthLabel}</strong>
            <button type="button" className="icon-close" aria-label="Mes siguiente" onClick={() => setCursor(new Date(year, month + 1, 1))}>
              ›
            </button>
          </div>
          <div className="side-date-week">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label) => <span key={label}>{label}</span>)}
          </div>
          <div className="side-date-grid">
            {cells.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} className="side-date-empty" />
              const key = toDateKey(new Date(year, month, day))
              return (
                <button
                  key={key}
                  type="button"
                  className={[
                    'side-date-day',
                    key === selectedKey ? 'on' : '',
                    key === todayKey ? 'today' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    onChange(key)
                    setOpen(false)
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <div className="side-date-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
            >
              Quitar fecha
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                const next = toDateKey(new Date())
                onChange(next)
                setCursor(new Date())
                setOpen(false)
              }}
            >
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function CardProgressBar({ progress }: { progress?: Card['progress'] }) {
  if (!progress || progress.total < 1) return null
  return (
    <div className="card-progress" title={`${progress.done} de ${progress.total} completados`}>
      <div className="card-progress-track" aria-hidden="true">
        <span style={{ width: `${progress.percent}%` }} />
      </div>
      <span className="card-progress-label">{progress.done}/{progress.total}</span>
    </div>
  )
}

export function CardFace({ card }: { card: Card }) {
  return (
    <article className="card overlay" style={cardStripeStyle(card.color)}>
      <strong>{card.title}</strong>
      <div className="meta">
        {card.teams?.map((team) => <span key={team.id} className="chip equipo">{team.name}</span>)}
        {card.labels?.map((item) => <span key={item.id} className={`chip ${item.tone}`}>{item.name}</span>)}
      </div>
      <footer>
        <div className="card-foot-top">
          <span className="faces">{card.assignees?.map((person) => <Avatar key={person.id} id={person.id} name={person.name} className="face" src={person.avatar_url} />)}</span>
        </div>
        <CardProgressBar progress={card.progress} />
      </footer>
    </article>
  )
}

export function SortableCard({ card, disabled, canEdit, onOpen, onEdit }: {
  card: Card
  disabled: boolean
  canEdit: boolean
  onOpen: () => void
  onEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, disabled })

  return (
    <article
      ref={setNodeRef}
      className={`card${isDragging ? ' dragging' : ''}${disabled ? '' : ' is-draggable'}`}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1, ...cardStripeStyle(card.color) }}
      onClick={() => onOpen()}
      {...(disabled ? {} : { ...attributes, ...listeners })}
    >
      {(canEdit || card.is_internal === false) && (
        <div className="card-tools" onPointerDown={(event) => event.stopPropagation()}>
          {card.is_internal === false && (
            <span className="card-public" title="No interna" aria-label="Tarjeta no interna">
              <VisibilityIcon />
            </span>
          )}
          {canEdit && (
            <button
              className="more"
              type="button"
              aria-label={`Editar ${card.title}`}
              onClick={(event) => {
                event.stopPropagation()
                onEdit()
              }}
            >
              <EditIcon />
            </button>
          )}
        </div>
      )}
      <strong>{card.title}</strong>
      <div className="meta">
        {card.teams?.map((team) => <span key={team.id} className="chip equipo">{team.name}</span>)}
        {card.labels?.map((item) => <span key={item.id} className={`chip ${item.tone}`}>{item.name}</span>)}
      </div>
      <footer>
        <div className="card-foot-top">
          <span className="card-status">
            <PriorityMark priority={card.priority} />
            <time className="muted">{formatDate(card.due_date)}</time>
          </span>
          <span className="faces">{card.assignees?.map((person) => <Avatar key={person.id} id={person.id} name={person.name} className="face" src={person.avatar_url} />)}</span>
        </div>
        <CardProgressBar progress={card.progress} />
      </footer>
    </article>
  )
}

export function CreateCardModal({ board, column, onClose, onCreated }: {
  board: BoardPayload
  column: { id: number; name: string }
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [due, setDue] = useState('')
  const [priority, setPriority] = useState('media')
  const [assignees, setAssignees] = useState<string[]>([])
  const [teams, setTeams] = useState<string[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [error, setError] = useState('')
  const team = board.members.filter((member) => member.role !== 'cliente')
  const categories = board.categories ?? []

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setError('Escribe un título.')
      return
    }
    try {
      await api(`/boards/${board.board.id}/cards`, {
        method: 'POST',
        body: JSON.stringify({
          column_id: column.id,
          category_id: categoryId ? Number(categoryId) : null,
          title: title.trim(),
          description,
          due_date: due || null,
          priority,
          assignee_ids: assignees.map(Number),
          team_ids: teams.map(Number),
        }),
      })
      await onCreated()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear la tarjeta.')
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <h2>Nueva tarjeta</h2>
        <p className="muted">Se añade a {column.name}.</p>
        <label className="field">Título<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="field">Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label>
        {categories.length > 0 && (
          <label className="field">Categoría
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Sin categoría</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        )}
        <label className="field">Fecha límite<input type="date" value={due} onChange={(event) => setDue(event.target.value)} /></label>
        <label className="field">Prioridad
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            {Object.entries(priorityLabel).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>
        <label className="field">Personas
          <select multiple value={assignees} onChange={(event) => setAssignees([...event.target.selectedOptions].map((option) => option.value))}>
            {team.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
        {(board.teams ?? []).length > 0 && (
          <label className="field">Equipos
            <select multiple value={teams} onChange={(event) => setTeams([...event.target.selectedOptions].map((option) => option.value))}>
              {(board.teams ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="primary" type="submit">Añadir tarea</button>
          <button className="ghost" type="button" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

