import { useRef, useState } from 'react'
import { api, uploadFile, type Attachment, type Card } from '../../../api'
import { PlusIcon, TrashIcon } from '../../../shared/ui'
import { SectionToggle } from '../cardSectionUi'

function formatFileSize(bytes: number) {
  if (!bytes || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}


function AttachmentIcon() {
  return (
    <svg className="section-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M288.6 76.8C344.8 20.6 436 20.6 492.2 76.8C548.4 133 548.4 224.2 492.2 280.4L328.2 444.4C293.8 478.8 238.1 478.8 203.7 444.4C169.3 410 169.3 354.3 203.7 319.9L356.5 167.3C369 154.8 389.3 154.8 401.8 167.3C414.3 179.8 414.3 200.1 401.8 212.6L249 365.3C239.6 374.7 239.6 389.9 249 399.2C258.4 408.5 273.6 408.6 282.9 399.2L446.9 235.2C478.1 204 478.1 153.3 446.9 122.1C415.7 90.9 365 90.9 333.8 122.1L169.8 286.1C116.7 339.2 116.7 425.3 169.8 478.4C222.9 531.5 309 531.5 362.1 478.4L492.3 348.3C504.8 335.8 525.1 335.8 537.6 348.3C550.1 360.8 550.1 381.1 537.6 393.6L407.4 523.6C329.3 601.7 202.7 601.7 124.6 523.6C46.5 445.5 46.5 318.9 124.6 240.8L288.6 76.8z" />
    </svg>
  )
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




