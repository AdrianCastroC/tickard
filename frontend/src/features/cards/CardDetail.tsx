import { useEffect, useMemo, useRef, useState } from 'react'

import { DndContext, PointerSensor, closestCorners, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { api, type BoardPayload, type Card, type CardModule, type CardModuleType, type Comment, type Profile } from '../../api'
import { Avatar, DescriptionEditor, cardStripeStyle, DEFAULT_CARD_STRIPE, descriptionToEditorHtml, priorityLabel, sanitizeDescriptionHtml } from '../../shared/ui'
import { ArchiveIcon, AssigneesIcon, AuthorIcon, CategoryIcon, CloseIcon, DescriptionIcon, EditIcon, EyeSlashIcon, LabelsIcon, MinusIcon, PaletteIcon, PlusIcon, PriorityIcon, ProgressStatusIcon, SaveIcon, StatusIcon, TeamsIcon, TrashIcon, UserPlusIcon, VisibilityIcon } from '../../shared/icons'
import { DateRangePicker, PriorityMark, PriorityPicker, SideSelect, formatDateRange } from '../board'
import { CalendarIcon, SectionToggle } from './cardSectionUi'
import { FilesPanel } from './files/FilesPanel'
import { CommentsPanel } from './comments/CommentsPanel'
import { ChecklistPanel } from './checklist/ChecklistPanel'
import { MilestoneDependencyList } from './MilestoneDependencyList'
import { SortableModuleShell } from './modules/SortableModuleShell'
import { DateTimePicker, formatStartedAt } from './DateTimePicker'










function DotIcon({ color = '#3b82f6' }: { color?: string }) {
  return <i className="status-dot" style={{ background: color }} aria-hidden="true" />
}


function ColumnStatusIcon({ name, color = '#3b82f6' }: { name?: string; color?: string }) {
  if (name === 'En progreso') return <ProgressStatusIcon color={color} />
  return <DotIcon color={color} />
}























export function CardDrawer({ card, mode, board, currentUser, canEdit, onClose, onEdit, onView, onChange, onMove, onOpenRelatedCard }: {
  card: Card
  mode: 'view' | 'edit'
  board: BoardPayload
  currentUser: Profile['user']
  canEdit: boolean
  onClose: () => void
  onEdit: () => void
  onView: () => void
  onChange: () => Promise<void>
  onMove: (cardId: number, columnId: number, position: number) => Promise<void>
  onOpenRelatedCard: (cardId: number, boardId: number, dependencyId: number) => void
}) {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description ?? '')
  const [saving, setSaving] = useState(false)
  const [milestoneDate, setMilestoneDate] = useState(card.due_date ?? '')
  const [milestoneError, setMilestoneError] = useState('')
  const [pickingAssignees, setPickingAssignees] = useState(false)
  const [pickingLabels, setPickingLabels] = useState(false)
  const [pickingTeams, setPickingTeams] = useState(false)
  const [visibilityOpen, setVisibilityOpen] = useState(false)
  const [descCollapsed, setDescCollapsed] = useState(false)
  const [comments, setComments] = useState<Comment[]>(card.comments ?? [])
  const [modules, setModules] = useState<CardModule[]>(() => [...(card.modules ?? [])].sort((a, b) => a.position - b.position))
  const [addModuleOpen, setAddModuleOpen] = useState(false)
  const modulesCreatedInEdit = useRef<number[]>([])
  const colorInputRef = useRef<HTMLInputElement>(null)
  const editing = mode === 'edit' && canEdit
  const team = board.members.filter((member) => member.role !== 'cliente')
  const columnName = board.columns.find((column) => column.id === card.column_id)?.name ?? '—'
  const isBacklog = board.columns.find((column) => column.id === card.column_id)?.workflow_state === 'backlog'
  const categoryName = board.categories?.find((category) => category.id === card.category_id)?.name
  const attachments = card.attachments ?? []
  void attachments
  const stripe = card.color || DEFAULT_CARD_STRIPE
  const moduleSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const hasFilesModule = modules.some((module) => module.type === 'files')
  const hasCommentsModule = modules.some((module) => module.type === 'comments')
  const visibleModules = useMemo(() => {
    if (editing) return modules
    return modules.filter((module) => (
      module.type !== 'checklist' || (module.checklist?.length ?? 0) > 0
    ))
  }, [modules, editing])
  const descriptionHtml = useMemo(
    () => (card.description ? sanitizeDescriptionHtml(descriptionToEditorHtml(card.description)) : ''),
    [card.description],
  )

  useEffect(() => {
    setTitle(card.title)
    setDescription(card.description ?? '')
  }, [card.id, card.title, card.description])

  useEffect(() => {
    setMilestoneDate(card.due_date ?? '')
    setMilestoneError('')
  }, [card.id, card.due_date])

  useEffect(() => {
    setComments(card.comments ?? [])
  }, [card.id, card.comments])

  useEffect(() => {
    setModules([...(card.modules ?? [])].sort((a, b) => a.position - b.position))
  }, [card.modules])

  useEffect(() => {
    if (!editing) {
      setPickingAssignees(false)
      setPickingLabels(false)
      setPickingTeams(false)
      setVisibilityOpen(false)
      setAddModuleOpen(false)
    } else {
      modulesCreatedInEdit.current = []
    }
  }, [editing])

  async function save(patch: Record<string, unknown>) {
    await api(`/cards/${card.id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    await onChange()
  }

  async function toggleMilestone(next: boolean) {
    setMilestoneError('')
    if (next && !milestoneDate) {
      setMilestoneError('Selecciona una fecha objetivo.')
      return
    }
    try {
      await save(next ? { is_milestone: true, due_date: milestoneDate } : { is_milestone: false })
    } catch (error) {
      setMilestoneError(error instanceof Error ? error.message : 'No se pudo modificar el hito.')
    }
  }

  async function discardUnsavedModules() {
    const created = modulesCreatedInEdit.current
    if (!created.length) return
    modulesCreatedInEdit.current = []
    await Promise.all(created.map((id) => api(`/modules/${id}`, { method: 'DELETE' }).catch(() => null)))
    await onChange()
  }

  async function handleClose() {
    if (editing) await discardUnsavedModules()
    onClose()
  }

  async function saveAll() {
    const nextTitle = title.trim()
    if (!nextTitle) return
    setSaving(true)
    try {
      modulesCreatedInEdit.current = []
      await save({ title: nextTitle, description })
      onView()
    } finally {
      setSaving(false)
    }
  }

  async function archiveCard() {
    await api(`/cards/${card.id}/archive`, { method: 'POST' })
    onClose()
    await onChange()
  }

  async function deleteCard() {
    if (!window.confirm(`¿Eliminar «${card.title}»? Esta acción no se puede deshacer.`)) return
    await api(`/cards/${card.id}`, { method: 'DELETE' })
    onClose()
    await onChange()
  }

  async function changeColumn(columnId: number) {
    if (columnId === card.column_id) return
    const target = board.columns.find((column) => column.id === columnId)
    const position = target?.cards.length ?? 0
    await onMove(card.id, columnId, position)
  }

  function toggleAssignee(id: number) {
    const current = card.assignees?.map((person) => person.id) ?? []
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    save({ assignee_ids: next })
  }

  function toggleLabel(id: number) {
    const current = card.labels?.map((item) => item.id) ?? []
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    save({ label_ids: next })
  }

  function toggleTeam(id: number) {
    const current = card.teams?.map((item) => item.id) ?? []
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    save({ team_ids: next })
  }

  async function addModule(type: CardModuleType) {
    setAddModuleOpen(false)
    const created = await api<CardModule>(`/cards/${card.id}/modules`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    })
    modulesCreatedInEdit.current = [...modulesCreatedInEdit.current, created.id]
    await onChange()
  }

  async function removeModule(moduleId: number) {
    modulesCreatedInEdit.current = modulesCreatedInEdit.current.filter((id) => id !== moduleId)
    await api(`/modules/${moduleId}`, { method: 'DELETE' })
    await onChange()
  }

  async function onModuleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = modules.findIndex((module) => module.id === active.id)
    const newIndex = modules.findIndex((module) => module.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(modules, oldIndex, newIndex).map((module, index) => ({ ...module, position: index + 1 }))
    setModules(next)
    await api(`/cards/${card.id}/modules/reorder`, {
      method: 'POST',
      body: JSON.stringify({ ordered_ids: next.map((module) => module.id) }),
    })
    await onChange()
  }

  return (
    <div className="modal-back" onClick={() => { void handleClose() }}>
      <div className={`modal card-modal ${mode}`} style={cardStripeStyle(card.color)} onClick={(event) => event.stopPropagation()}>
        <div className="card-modal-body">
          <div className="card-modal-main">
            <div className="card-modal-main-header">
              {editing ? (
                <input
                  className="card-modal-title-input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Título de la tarea"
                />
              ) : (
                <div className="card-modal-title-row">
                  <h2>{card.title}</h2>
                  {card.is_internal === false && (
                    <span className="card-public" title="No interna" aria-label="Tarjeta no interna">
                      <VisibilityIcon />
                    </span>
                  )}
                </div>
              )}
              {editing && (
                <div className="card-modal-tools">
                  <button
                    className={`icon-close${card.is_internal === false ? ' is-public' : ''}`}
                    type="button"
                    aria-label="Visibilidad"
                    title={card.is_internal === false ? 'Visible para el cliente' : 'Visibilidad'}
                    onClick={() => setVisibilityOpen(true)}
                  >
                    <EyeSlashIcon />
                  </button>
                  <button
                    className="icon-close color"
                    type="button"
                    aria-label="Color del borde"
                    onClick={() => colorInputRef.current?.click()}
                  >
                    <PaletteIcon />
                  </button>
                  <input
                    ref={colorInputRef}
                    className="color-input"
                    type="color"
                    value={stripe}
                    onChange={(event) => save({ color: event.target.value })}
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                </div>
              )}
            </div>
            <div className="card-modal-main-scroll">
            <section className={`card-modal-section${descCollapsed ? ' is-collapsed' : ''}`}>
              <div className="section-head">
                <h3>
                  <SectionToggle
                    icon={<DescriptionIcon />}
                    label="Descripción"
                    collapsed={descCollapsed}
                    onToggle={() => setDescCollapsed((open) => !open)}
                  />
                  <button type="button" className="module-section-title-btn" aria-expanded={!descCollapsed} onClick={() => setDescCollapsed((open) => !open)}>
                    Descripción
                  </button>
                </h3>
              </div>
              {!descCollapsed && (
                editing ? (
                  <DescriptionEditor value={description} onChange={setDescription} />
                ) : descriptionHtml ? (
                  <div className="card-modal-copy rich" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
                ) : (
                  <p className="card-modal-copy">Sin descripción.</p>
                )
              )}
            </section>

            <DndContext sensors={moduleSensors} collisionDetection={closestCorners} onDragEnd={onModuleDragEnd}>
              <SortableContext items={visibleModules.map((module) => module.id)} strategy={verticalListSortingStrategy}>
                <div className="card-modules">
                  {card.is_milestone && card.dependencies && (
                    <MilestoneDependencyList
                      predecessors={card.dependencies?.predecessors ?? []}
                      onOpenCard={onOpenRelatedCard}
                    />
                  )}
                  {visibleModules.map((module) => (
                    <SortableModuleShell key={module.id} id={module.id} disabled={!editing}>
                      {(dragProps) => {
                        if (module.type === 'checklist') {
                          return (
                            <ChecklistPanel
                              card={card}
                              module={module}
                              editing={editing}
                              canEdit={canEdit}
                              members={team}
                              dragProps={dragProps}
                              onChange={onChange}
                              onRemove={() => removeModule(module.id)}
                            />
                          )
                        }
                        if (module.type === 'files') {
                          return (
                            <FilesPanel
                              card={card}
                              editing={editing}
                              canEdit={canEdit}
                               canManage={board.role === 'responsable'}
                               currentUserId={currentUser.id}
                              dragProps={dragProps}
                              onChange={onChange}
                              onRemove={() => removeModule(module.id)}
                            />
                          )
                        }
                        return (
                          <CommentsPanel card={card} board={board} currentUser={currentUser} editing={editing} comments={comments} onCommentsChange={setComments} onChange={onChange} dragProps={dragProps} onRemove={() => removeModule(module.id)} />
                        )
                      }}
                    </SortableModuleShell>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            </div>

            {editing && (
              <div className="card-modal-footer">
                <div className="module-add">
                  <button
                    type="button"
                    className="module-add-btn"
                    onClick={() => setAddModuleOpen((open) => !open)}
                  >
                    <PlusIcon className="plus-icon" /> Añadir módulo
                  </button>
                  {addModuleOpen && (
                    <div className="module-add-menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => void addModule('checklist')}>Checklist</button>
                      {!hasFilesModule && (
                        <button type="button" role="menuitem" onClick={() => void addModule('files')}>Archivos</button>
                      )}
                      {!hasCommentsModule && (
                        <button type="button" role="menuitem" onClick={() => void addModule('comments')}>Comentarios</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          <aside className="card-modal-side">
            <div className="card-modal-side-header">
              <div className={`side-toolbar${editing ? ' editing' : ''}`}>
                {editing ? (
                  <button
                    className="icon-close save"
                    type="button"
                    aria-label="Guardar"
                    disabled={saving || !title.trim()}
                    onClick={saveAll}
                  >
                    <SaveIcon />
                  </button>
                ) : (
                  canEdit && (
                    <button className="icon-close" type="button" aria-label="Editar" onClick={onEdit}>
                      <EditIcon />
                    </button>
                  )
                )}
                <button className="icon-close" type="button" aria-label="Cerrar" onClick={() => { void handleClose() }}>
                  <CloseIcon />
                </button>
              </div>
            </div>
            <div className="card-modal-side-scroll">
            <div className="side-field">
              <span className="side-label"><StatusIcon /> Estado</span>
              {editing ? (
                <SideSelect
                  value={card.column_id}
                  onChange={changeColumn}
                  leading={<ColumnStatusIcon name={columnName} />}
                  options={board.columns.map((column) => ({
                    value: column.id,
                    label: column.name,
                    leading: <ColumnStatusIcon name={column.name} />,
                  }))}
                />
              ) : (
                <div className="side-value"><ColumnStatusIcon name={columnName} /> <strong>{columnName}</strong></div>
              )}
            </div>

            <div className="side-field">
              <span className="side-label">◆ Hito</span>
              {editing ? (
                <>
                  <label className="row"><input type="checkbox" checked={Boolean(card.is_milestone)} onChange={(event) => { void toggleMilestone(event.target.checked) }} /> Es un hito</label>
                  {!card.is_milestone && !card.due_date && (
                    <label className="field">Fecha objetivo<input type="date" value={milestoneDate} onChange={(event) => setMilestoneDate(event.target.value)} /></label>
                  )}
                  {card.is_milestone && (
                    <label className="row"><input type="checkbox" checked={card.milestone_auto_complete !== false} onChange={(event) => { void save({ milestone_auto_complete: event.target.checked }) }} /> Completar automáticamente al cumplir los requisitos</label>
                  )}
                  {milestoneError && <span className="error">{milestoneError}</span>}
                </>
              ) : <div className="side-value"><strong>{card.is_milestone ? 'Sí' : 'No'}</strong></div>}
              {card.is_milestone && card.milestone_requirements?.regressed && (
                <p className="error" role="status">
                  El hito ya se alcanzó, pero algunas dependencias o checklists han dejado de cumplirse. No se reabre automáticamente.
                </p>
              )}
              {card.is_milestone && card.milestone_auto_complete === false && card.milestone_requirements?.ready && board.columns.find((column) => column.id === card.column_id)?.workflow_state !== 'done' && (
                <p className="muted" role="status">Requisitos cumplidos. Pendiente de confirmación manual.</p>
              )}
            </div>
            <div className="side-field">
              <span className="side-label"><PriorityIcon /> Prioridad</span>
              {editing ? (
                <PriorityPicker
                  value={card.priority}
                  onChange={(priority) => save({ priority })}
                />
              ) : (
                <div className="side-value">
                  <PriorityMark priority={card.priority} />
                  <strong>{priorityLabel[card.priority ?? 'media']}</strong>
                </div>
              )}
            </div>

            <div className="side-field">
              <span className="side-label"><AuthorIcon /> Autor</span>
              <div className="side-value side-author">
                <span title={card.creator.name}>
                  <Avatar
                    id={card.creator.id}
                    name={card.creator.name}
                    size={40}
                    className="face"
                  />
                </span>
              </div>
            </div>

            <div className="side-field">
              <span className="side-label"><AssigneesIcon /> Asignados</span>
              <div className="side-assignees">
                <span className="faces">
                  {(card.assignees?.length ?? 0) === 0 && <span className="muted">Sin asignar</span>}
                  {card.assignees?.map((person) => (
                    editing ? (
                      <button
                        key={person.id}
                        type="button"
                        className="face-chip"
                        title={person.name}
                        aria-label={`Quitar a ${person.name}`}
                        onClick={() => toggleAssignee(person.id)}
                      >
                        <Avatar id={person.id} name={person.name} size={40} className="face" src={person.avatar_url} />
                        <span className="face-remove" aria-hidden="true"><MinusIcon /></span>
                      </button>
                    ) : (
                      <Avatar key={person.id} id={person.id} name={person.name} size={40} className="face" src={person.avatar_url} />
                    )
                  ))}
                </span>
                {editing && (
                  <button
                    className="add-face"
                    type="button"
                    aria-label="Añadir asignados"
                    aria-expanded={pickingAssignees}
                    onClick={() => setPickingAssignees((open) => !open)}
                  >
                    <UserPlusIcon />
                  </button>
                )}
              </div>
              {editing && pickingAssignees && (
                <div className="assignee-list">
                  {team.map((member) => {
                    const on = card.assignees?.some((person) => person.id === member.id)
                    return (
                      <label key={member.id} className="row">
                        <input type="checkbox" checked={!!on} onChange={() => toggleAssignee(member.id)} />
                        <Avatar id={member.id} name={member.name} size={22} className="face" />
                        <span>{member.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="side-field">
              <span className="side-label"><CalendarIcon /> Inicio</span>
              {editing ? (
                <DateTimePicker value={card.started_at} onChange={(value) => save({ started_at: value })} />
              ) : (
                <div className="side-value"><strong>{formatStartedAt(card.started_at)}</strong></div>
              )}
            </div>

            <div className="side-field">
              <span className="side-label"><CalendarIcon /> {card.is_milestone ? 'Fecha objetivo' : 'Periodo'}</span>
              {editing ? (
                isBacklog ? <span className="muted">Disponible cuando la tarea salga de backlog.</span> : card.is_milestone ? (
                  <input type="date" aria-label="Fecha objetivo del hito" value={card.due_date ?? ''} onChange={(event) => { if (event.target.value) void save({ due_date: event.target.value }) }} />
                ) : <DateRangePicker start={card.start_date} end={card.due_date} onChange={(start, due) => save({ start_date: start, due_date: due })} />
              ) : (
                <div className="side-value"><strong>{isBacklog ? 'Disponible al salir de backlog' : formatDateRange(card.start_date, card.due_date)}</strong></div>
              )}
            </div>

            {(editing || categoryName) && (
              <div className="side-field">
                <span className="side-label"><CategoryIcon /> Categoría</span>
                {editing && (board.categories ?? []).length > 0 ? (
                  <SideSelect
                    value={card.category_id ? String(card.category_id) : ''}
                    onChange={(next) => save({ category_id: next ? Number(next) : null })}
                    options={[
                      { value: '', label: 'Sin categoría' },
                      ...(board.categories ?? []).map((category) => ({
                        value: String(category.id),
                        label: category.name,
                      })),
                    ]}
                  />
                ) : (
                  <div className="side-value"><strong>{categoryName || '—'}</strong></div>
                )}
              </div>
            )}

            <div className="side-field">
              <span className="side-label"><LabelsIcon /> Etiquetas</span>
              <div className="side-tags">
                {(card.labels?.length ?? 0) === 0 && <span className="muted">Sin etiquetas</span>}
                {card.labels?.map((item) => (
                  editing ? (
                    <button
                      key={item.id}
                      type="button"
                      className={`chip-chip chip ${item.tone}`}
                      title={item.name}
                      aria-label={`Quitar etiqueta ${item.name}`}
                      onClick={() => toggleLabel(item.id)}
                    >
                      <span className="chip-label">{item.name}</span>
                      <span className="face-remove" aria-hidden="true"><MinusIcon /></span>
                    </button>
                  ) : (
                    <span key={item.id} className={`chip ${item.tone}`}>{item.name}</span>
                  )
                ))}
                {editing && (
                  <button
                    className="add-face"
                    type="button"
                    aria-label="Añadir etiquetas"
                    aria-expanded={pickingLabels}
                    onClick={() => setPickingLabels((open) => !open)}
                  >
                    <PlusIcon />
                  </button>
                )}
              </div>
              {editing && pickingLabels && (
                <div className="assignee-list">
                  {(board.labels ?? []).length === 0 && <span className="muted">No hay etiquetas en el proyecto.</span>}
                  {(board.labels ?? []).map((item) => {
                    const on = card.labels?.some((label) => label.id === item.id)
                    return (
                      <label key={item.id} className="row">
                        <input type="checkbox" checked={!!on} onChange={() => toggleLabel(item.id)} />
                        <span className={`chip ${item.tone}`}>{item.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {(editing || (board.teams ?? []).length > 0 || (card.teams?.length ?? 0) > 0) && (
              <div className="side-field">
                <span className="side-label"><TeamsIcon /> Equipos</span>
                <div className="side-tags">
                  {(card.teams?.length ?? 0) === 0 && <span className="muted">Sin equipos</span>}
                  {card.teams?.map((item) => (
                    editing ? (
                      <button
                        key={item.id}
                        type="button"
                        className="chip-chip chip equipo"
                        title={item.name}
                        aria-label={`Quitar equipo ${item.name}`}
                        onClick={() => toggleTeam(item.id)}
                      >
                        <span className="chip-label">{item.name}</span>
                        <span className="face-remove" aria-hidden="true"><MinusIcon /></span>
                      </button>
                    ) : (
                      <span key={item.id} className="chip equipo">{item.name}</span>
                    )
                  ))}
                  {editing && (board.teams ?? []).length > 0 && (
                    <button
                      className="add-face"
                      type="button"
                      aria-label="Añadir equipos"
                      aria-expanded={pickingTeams}
                      onClick={() => setPickingTeams((open) => !open)}
                    >
                      <PlusIcon />
                    </button>
                  )}
                </div>
                {editing && pickingTeams && (
                  <div className="assignee-list">
                    {(board.teams ?? []).map((item) => {
                      const on = card.teams?.some((team) => team.id === item.id)
                      return (
                        <label key={item.id} className="row">
                          <input type="checkbox" checked={!!on} onChange={() => toggleTeam(item.id)} />
                          <span className="chip equipo">{item.name}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            </div>

            {editing && (
              <div className="card-modal-footer side-actions">
                <button className="ghost" type="button" onClick={archiveCard}>
                  <ArchiveIcon /> Archivar
                </button>
                <button className="ghost danger" type="button" onClick={deleteCard}>
                  <TrashIcon /> Eliminar
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
      {visibilityOpen && (
        <div
          className="modal-back nested"
          onClick={(event) => {
            event.stopPropagation()
            setVisibilityOpen(false)
          }}
        >
          <div className="modal visibility-modal" onClick={(event) => event.stopPropagation()}>
            <div className="visibility-modal-row">
              <h2>Visibilidad</h2>
              <button className="icon-close" type="button" aria-label="Cerrar" onClick={() => setVisibilityOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <p className="muted">
              Por defecto solo la ven los asignados y quienes tengan un rol del proyecto con permiso (responsable, editor o lector).
            </p>
            <div className="visibility-list">
              <label className="visibility-row locked">
                <input type="checkbox" checked disabled />
                <span>
                  <strong>Asignados</strong>
                  <small>Siempre pueden ver esta tarjeta</small>
                </span>
              </label>
              <label className="visibility-row locked">
                <input type="checkbox" checked disabled />
                <span>
                  <strong>Roles del proyecto</strong>
                  <small>Responsable, editor y lector</small>
                </span>
              </label>
              <label className="visibility-row">
                <input
                  type="checkbox"
                  checked={!card.is_internal}
                  onChange={(event) => save({ is_internal: !event.target.checked })}
                />
                <span>
                  <strong>Cliente</strong>
                  <small>{card.is_internal ? 'No puede ver esta tarjeta' : 'Puede ver esta tarjeta'}</small>
                </span>
              </label>
            </div>
            {(card.assignees?.length ?? 0) > 0 && (
              <div className="visibility-assignees">
                <span className="side-label">Asignados actuales</span>
                <span className="faces">
                  {card.assignees?.map((person) => (
                    <Avatar key={person.id} id={person.id} name={person.name} size={32} className="face" />
                  ))}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

