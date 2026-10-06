import { useEffect, useMemo, useRef, useState } from 'react'

import { DndContext, PointerSensor, closestCorners, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { api, type BoardPayload, type Card, type CardModule, type CardModuleType, type Comment, type Profile } from '../../api'
import { ArchiveIcon, Avatar, CloseIcon, DescriptionEditor, EditIcon, MinusIcon, PaletteIcon, PlusIcon, SaveIcon, TrashIcon, UserPlusIcon, VisibilityIcon,  formatDateLong, cardStripeStyle, DEFAULT_CARD_STRIPE, descriptionToEditorHtml, priorityLabel, sanitizeDescriptionHtml } from '../../shared/ui'
import { DateRangePicker, PriorityMark, PriorityPicker, SideSelect, formatDateRange } from '../board'
import { CalendarIcon, SectionToggle } from './cardSectionUi'
import { FilesPanel } from './files/FilesPanel'
import { CommentsPanel } from './comments/CommentsPanel'
import { ChecklistPanel } from './checklist/ChecklistPanel'
import { SortableModuleShell } from './modules/SortableModuleShell'
import { DateTimePicker, formatStartedAt } from './DateTimePicker'

function DescriptionIcon() {
  return (
    <svg className="section-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h10" />
    </svg>
  )
}










function EyeSlashIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M73 39.1C63.6 29.7 48.4 29.7 39.1 39.1C29.8 48.5 29.7 63.7 39 73.1L567 601.1C576.4 610.5 591.6 610.5 600.9 601.1C610.2 591.7 610.3 576.5 600.9 567.2L504.5 470.8C507.2 468.4 509.9 466 512.5 463.6C559.3 420.1 590.6 368.2 605.5 332.5C608.8 324.6 608.8 315.8 605.5 307.9C590.6 272.2 559.3 220.2 512.5 176.8C465.4 133.1 400.7 96.2 319.9 96.2C263.1 96.2 214.3 114.4 173.9 140.4L73 39.1zM236.5 202.7C260 185.9 288.9 176 320 176C399.5 176 464 240.5 464 320C464 351.1 454.1 379.9 437.3 403.5L402.6 368.8C415.3 347.4 419.6 321.1 412.7 295.1C399 243.9 346.3 213.5 295.1 227.2C286.5 229.5 278.4 232.9 271.1 237.2L236.4 202.5zM357.3 459.1C345.4 462.3 332.9 464 320 464C240.5 464 176 399.5 176 320C176 307.1 177.7 294.6 180.9 282.7L101.4 203.2C68.8 240 46.4 279 34.5 307.7C31.2 315.6 31.2 324.4 34.5 332.3C49.4 368 80.7 420 127.5 463.4C174.6 507.1 239.3 544 320.1 544C357.4 544 391.3 536.1 421.6 523.4L357.4 459.2z" />
    </svg>
  )
}
function DotIcon({ color = '#3b82f6' }: { color?: string }) {
  return <i className="status-dot" style={{ background: color }} aria-hidden="true" />
}

function ProgressStatusIcon({ color = '#3b82f6' }: { color?: string }) {
  return (
    <svg className="side-ico status-progress" style={{ color }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM320 224C373 224 416 267 416 320C416 373 373 416 320 416C267 416 224 373 224 320C224 267 267 224 320 224z" />
    </svg>
  )
}

function ColumnStatusIcon({ name, color = '#3b82f6' }: { name?: string; color?: string }) {
  if (name === 'En progreso') return <ProgressStatusIcon color={color} />
  return <DotIcon color={color} />
}

function AssigneesIcon() {
  return (
    <svg className="side-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M96 192C96 130.1 146.1 80 208 80C269.9 80 320 130.1 320 192C320 253.9 269.9 304 208 304C146.1 304 96 253.9 96 192zM32 528C32 430.8 110.8 352 208 352C305.2 352 384 430.8 384 528L384 534C384 557.2 365.2 576 342 576L74 576C50.8 576 32 557.2 32 534L32 528zM464 128C517 128 560 171 560 224C560 277 517 320 464 320C411 320 368 277 368 224C368 171 411 128 464 128zM464 368C543.5 368 608 432.5 608 512L608 534.4C608 557.4 589.4 576 566.4 576L421.6 576C428.2 563.5 432 549.2 432 534L432 528C432 476.5 414.6 429.1 385.5 391.3C408.1 376.6 435.1 368 464 368z" />
    </svg>
  )
}

function AuthorIcon() {
  return (
    <svg className="side-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M432.5 82.3L382.4 132.4L507.7 257.7L557.8 207.6C579.7 185.7 579.7 150.3 557.8 128.4L511.7 82.3C489.8 60.4 454.4 60.4 432.5 82.3zM343.3 161.2L342.8 161.3L198.7 204.5C178.8 210.5 163 225.7 156.4 245.5L67.8 509.8C64.9 518.5 65.9 528 70.3 535.8L225.7 380.4C224.6 376.4 224.1 372.3 224.1 368C224.1 341.5 245.6 320 272.1 320C298.6 320 320.1 341.5 320.1 368C320.1 394.5 298.6 416 272.1 416C267.8 416 263.6 415.4 259.7 414.4L104.3 569.7C112.1 574.1 121.5 575.1 130.3 572.2L394.6 483.6C414.3 477 429.6 461.2 435.6 441.3L478.8 297.2L478.9 296.7L343.4 161.2z" />
    </svg>
  )
}

function TeamsIcon() {
  return (
    <svg className="side-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M320 64C355.3 64 384 92.7 384 128C384 163.3 355.3 192 320 192C284.7 192 256 163.3 256 128C256 92.7 284.7 64 320 64zM416 376C416 401 403.3 423 384 435.9L384 528C384 554.5 362.5 576 336 576L304 576C277.5 576 256 554.5 256 528L256 435.9C236.7 423 224 401 224 376L224 336C224 283 267 240 320 240C373 240 416 283 416 336L416 376zM160 96C190.9 96 216 121.1 216 152C216 182.9 190.9 208 160 208C129.1 208 104 182.9 104 152C104 121.1 129.1 96 160 96zM176 336L176 368C176 400.5 188.1 430.1 208 452.7L208 528C208 529.2 208 530.5 208.1 531.7C199.6 539.3 188.4 544 176 544L144 544C117.5 544 96 522.5 96 496L96 439.4C76.9 428.4 64 407.7 64 384L64 352C64 299 107 256 160 256C172.7 256 184.8 258.5 195.9 262.9C183.3 284.3 176 309.3 176 336zM432 528L432 452.7C451.9 430.2 464 400.5 464 368L464 336C464 309.3 456.7 284.4 444.1 262.9C455.2 258.4 467.3 256 480 256C533 256 576 299 576 352L576 384C576 407.7 563.1 428.4 544 439.4L544 496C544 522.5 522.5 544 496 544L464 544C451.7 544 440.4 539.4 431.9 531.7C431.9 530.5 432 529.2 432 528zM480 96C510.9 96 536 121.1 536 152C536 182.9 510.9 208 480 208C449.1 208 424 182.9 424 152C424 121.1 449.1 96 480 96z" />
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

function LabelsIcon() {
  return (
    <svg className="side-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M433.2 103.1L581.4 253.4C609.1 281.5 609.1 326.5 581.4 354.6L425 512.9C415.7 522.3 400.5 522.4 391.1 513.1C381.7 503.8 381.6 488.6 390.9 479.2L547.3 320.8C556.5 311.5 556.5 296.4 547.3 287.1L399 136.9C389.7 127.5 389.8 112.3 399.2 103C408.6 93.7 423.8 93.8 433.1 103.2zM64.1 293.5L64.1 160C64.1 124.7 92.8 96 128.1 96L261.6 96C278.6 96 294.9 102.7 306.9 114.7L450.9 258.7C475.9 283.7 475.9 324.2 450.9 349.2L317.4 482.7C292.4 507.7 251.9 507.7 226.9 482.7L82.9 338.7C70.9 326.7 64.2 310.4 64.2 293.4zM208.1 208C208.1 190.3 193.8 176 176.1 176C158.4 176 144.1 190.3 144.1 208C144.1 225.7 158.4 240 176.1 240C193.8 240 208.1 225.7 208.1 208z" />
    </svg>
  )
}

function PriorityIcon() {
  return (
    <svg className="side-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M320 64C334.7 64 348.2 72.1 355.2 85L571.2 485C577.9 497.4 577.6 512.4 570.4 524.5C563.2 536.6 550.1 544 536 544L104 544C89.9 544 76.8 536.6 69.6 524.5C62.4 512.4 62.1 497.4 68.8 485L284.8 85C291.8 72.1 305.3 64 320 64zM320 416C302.3 416 288 430.3 288 448C288 465.7 302.3 480 320 480C337.7 480 352 465.7 352 448C352 430.3 337.7 416 320 416zM320 224C301.8 224 287.3 239.5 288.6 257.7L296 361.7C296.9 374.2 307.4 384 319.9 384C332.5 384 342.9 374.3 343.8 361.7L351.2 257.7C352.5 239.5 338.1 224 319.8 224z" />
    </svg>
  )
}

function StatusIcon() {
  return (
    <svg className="side-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320zM384 416C384 389.1 367.5 366.1 344 356.7L344 184C344 170.7 333.3 160 320 160C306.7 160 296 170.7 296 184L296 356.7C272.5 366.2 256 389.2 256 416C256 451.3 284.7 480 320 480C355.3 480 384 451.3 384 416zM208 240C225.7 240 240 225.7 240 208C240 190.3 225.7 176 208 176C190.3 176 176 190.3 176 208C176 225.7 190.3 240 208 240zM192 320C192 302.3 177.7 288 160 288C142.3 288 128 302.3 128 320C128 337.7 142.3 352 160 352C177.7 352 192 337.7 192 320zM480 352C497.7 352 512 337.7 512 320C512 302.3 497.7 288 480 288C462.3 288 448 302.3 448 320C448 337.7 462.3 352 480 352zM464 208C464 190.3 449.7 176 432 176C414.3 176 400 190.3 400 208C400 225.7 414.3 240 432 240C449.7 240 464 225.7 464 208z" />
    </svg>
  )
}

















export function CardDrawer({ card, mode, board, currentUser, canEdit, onClose, onEdit, onView, onChange }: {
  card: Card
  mode: 'view' | 'edit'
  board: BoardPayload
  currentUser: Profile['user']
  canEdit: boolean
  onClose: () => void
  onEdit: () => void
  onView: () => void
  onChange: () => Promise<void>
}) {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description ?? '')
  const [saving, setSaving] = useState(false)
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
    await api(`/cards/${card.id}/move`, {
      method: 'POST',
      body: JSON.stringify({ column_id: columnId, position }),
    })
    await onChange()
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
            <div className="card-modal-main-scroll">
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

            <section className={`card-modal-section${descCollapsed ? ' is-collapsed' : ''}`}>
              <div className="section-head">
                <h3>
                  <SectionToggle
                    icon={<DescriptionIcon />}
                    label="Descripción"
                    collapsed={descCollapsed}
                    onToggle={() => setDescCollapsed((open) => !open)}
                  />
                  Descripción
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
            <div className="card-modal-side-scroll">
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
              <span className="side-label"><CalendarIcon /> Periodo</span>
              {editing ? (
                <DateRangePicker start={card.start_date} end={card.due_date} onChange={(start, due) => save({ start_date: start, due_date: due })} />
              ) : (
                <div className="side-value"><strong>{formatDateRange(card.start_date, card.due_date)}</strong></div>
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

