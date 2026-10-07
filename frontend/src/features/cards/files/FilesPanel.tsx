import { useRef, useState } from 'react'
import { api, uploadFile, type Attachment, type Card } from '../../../api'
import { AttachmentIcon, PlusIcon, TrashIcon } from '../../../shared/icons'
import { SectionToggle } from '../cardSectionUi'

function formatFileSize(bytes: number) {
  if (!bytes || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}



export function FilesPanel({ card, editing, canEdit, dragProps, onChange, onRemove }: {
  card: Card
  editing: boolean
  canEdit: boolean
  dragProps?: Record<string, unknown>
  onChange: () => Promise<void>
  onRemove?: () => Promise<void>
}) {
  const attachments = card.attachments ?? []
  void attachments
  const canUpload = canEdit && !editing
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const dropSpan = attachments.length % 3 === 0 ? 3 : 3 - (attachments.length % 3)

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (!list.length || !canUpload) return
    setUploading(true)
    setError(null)
    try {
      for (const file of list) {
        await uploadFile<Attachment>(`/cards/${card.id}/attachments`, file)
      }
      await onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el archivo.')
    } finally {
      setUploading(false)
      setDragging(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function removeAttachment(id: number) {
    await api(`/attachments/${id}`, { method: 'DELETE' })
    await onChange()
  }

  return (
    <section className={`card-modal-section${collapsed ? ' is-collapsed' : ''}`}>
      <div className={`section-head${dragProps ? ' is-module-drag' : ''}`} {...dragProps}>
        <h3>
          <SectionToggle
            icon={<AttachmentIcon />}
            label="Archivos"
            collapsed={collapsed}
            onToggle={() => setCollapsed((open) => !open)}
          />
          Archivos
          {attachments.length > 0 && <span className="checklist-progress">({attachments.length})</span>}
        </h3>
        {editing && onRemove && (
          <div className="module-head-actions">
            <button
              type="button"
              className="ghost icon-btn module-remove-btn"
              aria-label="Eliminar módulo"
              title="Eliminar módulo"
              onClick={() => { void onRemove() }}
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          {(attachments.length > 0 || canUpload) ? (
            <div className="files-grid">
              {attachments.map((file) => (
                <article className="file-card" key={file.id}>
                  <a className="file-thumb" href={file.url} target="_blank" rel="noreferrer">
                    {file.is_image ? (
                      <img src={file.url} alt="" />
                    ) : (
                      <span className="file-thumb-fallback"><AttachmentIcon /></span>
                    )}
                  </a>
                  <div className="file-meta">
                    <a href={file.url} target="_blank" rel="noreferrer" title={file.name}>{file.name}</a>
                    <span className="muted">{formatFileSize(file.size)}</span>
                  </div>
                  {canEdit && (
                    <div className="file-menu">
                      <button
                        type="button"
                        className="ghost icon-btn file-delete-btn"
                        aria-label="Eliminar archivo"
                        title="Eliminar archivo"
                        onClick={() => { void removeAttachment(file.id) }}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )}
                </article>
              ))}

              {canUpload && (
                <button
                  type="button"
                  className={`files-dropzone${dragging ? ' dragging' : ''}${uploading ? ' busy' : ''}`}
                  style={{ ['--files-drop-span' as string]: dropSpan }}
                  disabled={uploading}
                  onClick={() => inputRef.current?.click()}
                  onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
                  onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
                  onDragLeave={(event) => {
                    event.preventDefault()
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    void uploadFiles(event.dataTransfer.files)
                  }}
                >
                  <PlusIcon className="files-drop-plus" />
                  <span>{uploading ? 'Subiendo…' : 'Subir archivos (arrastra o selecciona)'}</span>
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    hidden
                    onChange={(event) => {
                      if (event.target.files) void uploadFiles(event.target.files)
                    }}
                  />
                </button>
              )}
            </div>
          ) : (
            <div className="files-empty muted">Todavía no hay archivos adjuntos.</div>
          )}
          {error && <p className="muted" style={{ color: '#8a2b2b' }}>{error}</p>}
        </>
      )}
    </section>
  )
}




