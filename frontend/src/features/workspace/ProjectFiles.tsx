import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api, uploadFile, type Profile, type Project } from '../../api'
import { Avatar } from '../../shared/ui'
import { NavIcon } from '../../shared/icons'
import { downloadProtectedArchive, downloadProtectedFile, openProtectedFile, useProtectedPreview, useProtectedTextPreview } from '../../shared/protectedFiles'
import { FileActionIcon } from './ProjectFileIcons'
import styles from './ProjectFiles.module.css'

type ProjectFile = {
  key: string
  id: number
  origin: 'general' | 'card'
  name: string
  url: string
  mime_type: string | null
  size: number
  description: string | null
  created_at: string | null
  user_id: number | null
  author: string | null
  avatar_url: string | null
  board_id: number | null
  board_name: string | null
  card_id: number | null
  card_title: string | null
}
type FilesResponse = {
  files: ProjectFile[]
  storage: {
    workspace_id: number
    workspace_name: string
    used_bytes: number
    limit_bytes: number | null
    account_used_bytes: number | null
    account_limit_bytes: number | null
  }
  can_upload: boolean
  can_manage: boolean
}
type Origin = 'all' | 'general' | 'card'
type Kind = 'all' | 'image' | 'pdf' | 'document' | 'text'
const ALLOWED = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'docx', 'xlsx', 'txt']

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB'] as const
  let amount = bytes / 1024
  let unit = 0
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024
    unit += 1
  }
  return `${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(1)} ${units[unit]}`
}
function fileKind(file: ProjectFile): Kind {
  if (['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.mime_type ?? '')
    || /\.svg$/i.test(file.name)) return 'image'
  if (file.mime_type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf'
  if (/\.(txt|md|markdown|json|csv|log|xml|yaml|yml)$/i.test(file.name)) return 'text'
  return 'document'
}
function fileType(file: ProjectFile) {
  const kind = fileKind(file)
  return kind === 'image' ? 'Imagen' : kind === 'pdf' ? 'PDF' : kind === 'text' ? 'Texto' : 'Documento'
}
function fileDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}
function canOpenInBrowser(file: ProjectFile) {
  return file.mime_type === 'application/pdf'
    || ['image/jpeg', 'image/png', 'image/webp', 'text/plain'].includes(file.mime_type ?? '')
      && !/\.(md|markdown|json|csv|log|xml|yaml|yml)$/i.test(file.name)
}

function FileGlyph({ file }: { file: ProjectFile }) {
  const kind = fileKind(file)
  return <span className={`${styles.fileGlyph} ${styles[kind]}`} aria-hidden="true">
    <NavIcon>{kind === 'image'
      ? <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m4 17 5-5 4 4 3-3 4 4" /></>
      : <><path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v6h6M8 13h8M8 17h7" /></>}
    </NavIcon>
    <small>{kind === 'pdf' ? 'PDF' : kind === 'document' ? file.name.split('.').pop()?.toUpperCase() : ''}</small>
  </span>
}
function FilePreview({ file }: { file: ProjectFile }) {
  const kind = fileKind(file)
  const media = kind === 'pdf' || kind === 'image'
  const { src, error: mediaError } = useProtectedPreview(media ? file.url : null)
  const { text, error: textError } = useProtectedTextPreview(kind === 'text' ? file.url : null)
  if (kind === 'document') return <div className={styles.noPreview}><FileGlyph file={file} /><p>Este formato no tiene vista previa integrada. Puedes descargarlo.</p></div>
  if (mediaError || textError) return <p className={styles.previewMessage} role="alert">{mediaError || textError}</p>
  if (kind === 'text') return text === null
    ? <p className={styles.previewMessage}>Preparando vista previa…</p>
    : <pre className={styles.previewText}>{text}</pre>
  if (!src) return <p className={styles.previewMessage}>Preparando vista previa…</p>
  if (kind === 'image') return <img className={styles.previewImage} src={src} alt={file.name} />
  return <iframe className={styles.previewFrame} src={src} title={`Vista previa de ${file.name}`} />
}
function FileTile({ file, selected, onSelect }: { file: ProjectFile; selected: boolean; onSelect: () => void }) {
  const { src } = useProtectedPreview(fileKind(file) === 'image' ? file.url : null)
  return <button type="button" className={`${styles.tile} ${selected ? styles.selected : ''}`} onClick={onSelect} aria-pressed={selected}>
    <span className={styles.tileImage}>{src ? <img src={src} alt="" /> : <FileGlyph file={file} />}</span>
    <strong title={file.name}>{file.name}</strong><small>{sizeLabel(file.size)}</small>
  </button>
}

export function ProjectFiles({ project, profile }: { project: Project; profile: Profile }) {
  const [data, setData] = useState<FilesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [origin, setOrigin] = useState<Origin>('all')
  const [kind, setKind] = useState<Kind>('all')
  const [boardId, setBoardId] = useState<number | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [grid, setGrid] = useState(false)
  const [checkedKeys, setCheckedKeys] = useState<string[]>([])
  const viewportRef = useRef<HTMLElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const result = await api<FilesResponse>(`/projects/${project.id}/files`)
    setData(result)
    setSelectedKey((old) => old && result.files.some((file) => file.key === old) ? old : result.files[0]?.key ?? null)
    setCheckedKeys((old) => old.filter((key) => result.files.some((file) => file.key === key)))
  }, [project.id])

  useEffect(() => {
    let active = true
    setData(null)
    setError(null)
    setSelectedKey(null)
    setCheckedKeys([])
    void api<FilesResponse>(`/projects/${project.id}/files`).then((result) => {
      if (!active) return
      setData(result)
      setSelectedKey(result.files[0]?.key ?? null)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los archivos.')
    })
    return () => { active = false }
  }, [project.id])

  useEffect(() => {
    if (!filtersOpen) return
    const outside = (event: PointerEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setFiltersOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFiltersOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [filtersOpen])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    // Like project Gantt and Calendar: fit beneath the real project header
    // so the file list scrolls, not the entire application.
    const resizeViewport = () => {
      const available = window.innerHeight - viewport.getBoundingClientRect().top - 20
      viewport.style.height = `${Math.max(240, Math.floor(available))}px`
    }
    resizeViewport()
    window.addEventListener('resize', resizeViewport)
    return () => window.removeEventListener('resize', resizeViewport)
  }, [data !== null])

  const files = data?.files ?? []
  const countGeneral = files.filter((file) => file.origin === 'general').length
  const countCard = files.length - countGeneral
  const activeCount = Number(kind !== 'all') + Number(boardId !== null)
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    return files.filter((file) =>
      (origin === 'all' || file.origin === origin)
      && (kind === 'all' || fileKind(file) === kind)
      && (boardId === null || file.board_id === boardId)
      && (!term || [file.name, file.description ?? '', file.card_title ?? '', file.board_name ?? '']
        .some((part) => part.toLocaleLowerCase('es').includes(term)))
    )
  }, [files, search, origin, kind, boardId])
  const allVisibleChecked = filtered.length > 0 && filtered.every((file) => checkedKeys.includes(file.key))
  const partiallyVisibleChecked = !allVisibleChecked && checkedKeys.length > 0
  const checkedFiles = files.filter((file) => checkedKeys.includes(file.key))
  const checkedCount = checkedFiles.length
  function toggleChecked(key: string) {
    setCheckedKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  }
  function toggleAllVisible() {
    // Clicking the header checkbox deselects everything if any file is
    // selected, even when the selected file is hidden by the active filters.
    setCheckedKeys((current) => current.length > 0 ? [] : filtered.map((file) => file.key))
  }
  const selected = files.find((file) => file.key === selectedKey) ?? null
  const canRemove = (file: ProjectFile) =>
    !!data?.can_upload && (data.can_manage || file.user_id === profile.user.id)

  async function upload(filesToAdd: FileList | null) {
    if (!filesToAdd?.length || !data?.can_upload) return
    const list = Array.from(filesToAdd)
    setError(null)
    for (const file of list) {
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (!extension || !ALLOWED.includes(extension) || file.size > 10 * 1024 ** 2) {
        setError('Solo se permiten JPG, PNG, WebP, PDF, DOCX, XLSX y TXT de hasta 10 MB.')
        if (uploadRef.current) uploadRef.current.value = ''
        return
      }
    }
    setUploading(true)
    try {
      for (const file of list) await uploadFile<unknown>(`/projects/${project.id}/files`, file)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo subir el archivo.')
      await refresh().catch(() => {})
    } finally {
      setUploading(false)
      if (uploadRef.current) uploadRef.current.value = ''
    }
  }

  async function remove(file: ProjectFile) {
    if (!canRemove(file) || !window.confirm(`¿Eliminar "${file.name}"? ${file.origin === 'card' ? 'También desaparecerá de la Card.' : ''}`)) return
    setBusy(true)
    setError(null)
    try {
      await api(file.origin === 'general' ? `/project-files/${file.id}` : `/attachments/${file.id}`, { method: 'DELETE' })
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el archivo.')
    } finally {
      setBusy(false)
    }
  }

  async function removeChecked() {
    const removable = checkedFiles.filter(canRemove)
    if (!removable.length || !window.confirm(`¿Eliminar ${removable.length} archivo(s) seleccionado(s)? Los adjuntos también desaparecerán de sus Cards originales.`)) return
    setBusy(true)
    setError(null)
    let removed = 0
    try {
      for (const file of removable) {
        await api(file.origin === 'general' ? `/project-files/${file.id}` : `/attachments/${file.id}`, { method: 'DELETE' })
        removed += 1
      }
    } catch (cause) {
      setError(`Se eliminaron ${removed} de ${removable.length} archivos. ${cause instanceof Error ? cause.message : 'No se pudieron eliminar los restantes.'}`)
    } finally {
      await refresh().catch(() => setError('No se pudo actualizar la lista de archivos.'))
      setBusy(false)
    }
  }

  async function downloadChecked() {
    if (!checkedFiles.length || downloading) return
    setDownloading(true)
    setError(null)
    try {
      if (checkedFiles.length === 1) {
        const file = checkedFiles[0]
        await downloadProtectedFile(file.url, file.name)
      } else {
        await downloadProtectedArchive(
          project.id,
          checkedFiles.map(({ origin, id }) => ({ origin, id })),
        )
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron descargar los archivos seleccionados.')
    } finally {
      setDownloading(false)
    }
  }

  async function download(file: ProjectFile) {
    setError(null)
    try { await downloadProtectedFile(file.url, file.name) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo descargar el archivo.') }
  }
  async function open(file: ProjectFile) {
    setError(null)
    try { await openProtectedFile(file.url) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo abrir el archivo.') }
  }

  if (!data && !error) return <section className={styles.loading} role="status">Cargando archivos del proyecto…</section>
  if (!data) return <section className="project-panel" role="alert">{error} <button type="button" onClick={() => window.location.reload()}>Reintentar</button></section>

  const storage = data.storage
  const percent = storage.limit_bytes === null || storage.limit_bytes <= 0 ? null : Math.min(100, Math.round(storage.used_bytes / storage.limit_bytes * 100))
  return <section ref={viewportRef} className={styles.root} aria-label={`Archivos del proyecto ${project.name}`}>
    <div className={styles.toolbar}>
      <div className={styles.tabs} role="group" aria-label="Origen de los archivos">
        {([{ value: 'all', label: 'Todos', count: files.length }, { value: 'general', label: 'Generales', count: countGeneral }, { value: 'card', label: 'Adjuntos de Cards', count: countCard }] as const).map((tab) =>
          <button type="button" key={tab.value} className={origin === tab.value ? styles.tabActive : ''} onClick={() => setOrigin(tab.value)} aria-pressed={origin === tab.value}>
            {tab.label}<span>{tab.count}</span>
          </button>)}
      </div>
      <label className={styles.search}>
        <NavIcon><circle cx="10.8" cy="10.8" r="7.2" /><path d="m16 16 5 5" /></NavIcon>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar archivos…" aria-label="Buscar archivos" />
      </label>
      <div className={styles.filterAnchor} ref={filterRef}>
        <button type="button" className={`icon-button board-filter-trigger${filtersOpen || activeCount ? ' on' : ''}`}
          aria-label={activeCount ? `Filtros de archivos: ${activeCount} activos` : 'Filtros de archivos'}
          aria-expanded={filtersOpen} aria-haspopup="dialog" onClick={() => setFiltersOpen((value) => !value)}>
          <NavIcon><path d="M4 6h16M7 12h10M10 18h4" /></NavIcon>
          {activeCount > 0 && <span className="board-filter-active-dot" aria-hidden="true" />}
        </button>
        {filtersOpen && <div className={styles.filters} role="dialog" aria-label="Filtros de archivos">
          <div className={styles.filtersHeading}><strong>Filtros</strong><button type="button" onClick={() => { setKind('all'); setBoardId(null) }}>Restablecer</button></div>
          <label>Tipo
            <select value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
              <option value="all">Todos los tipos</option><option value="image">Imágenes</option><option value="pdf">PDF</option>
              <option value="document">Documentos Office</option><option value="text">Texto</option>
            </select>
          </label>
          <label>Tablero
            <select value={boardId ?? ''} onChange={(event) => setBoardId(event.target.value ? Number(event.target.value) : null)}>
              <option value="">Todos los tableros</option>
              {project.boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
            </select>
          </label>
          <button type="button" className={styles.applyFilters} onClick={() => setFiltersOpen(false)}>Aplicar</button>
        </div>}
      </div>
      <div className={styles.viewSwitch}>
        <button type="button" className={!grid ? styles.activeView : ''} onClick={() => setGrid(false)} aria-label="Vista de lista" aria-pressed={!grid}><NavIcon><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h1M3 12h1M3 18h1" /></NavIcon></button>
        <button type="button" className={grid ? styles.activeView : ''} onClick={() => setGrid(true)} aria-label="Vista de cuadrícula" aria-pressed={grid}><NavIcon><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></NavIcon></button>
      </div>
      {data.can_upload && <><button className={styles.uploadButton} type="button" disabled={uploading} onClick={() => uploadRef.current?.click()}>
        <FileActionIcon name="upload" />{uploading ? 'Subiendo…' : 'Subir archivo'}
      </button><input ref={uploadRef} type="file" multiple accept={ALLOWED.map((ext) => '.' + ext).join(',')} hidden onChange={(event) => void upload(event.target.files)} /></>}
    </div>

    {error && <div className={styles.error} role="alert">{error}<button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso">×</button></div>}
    {checkedCount > 0 && <div className={styles.bulkActions} role="region" aria-label="Acciones sobre archivos seleccionados">
      <strong>{checkedCount} seleccionado{checkedCount === 1 ? '' : 's'}</strong>
      <button type="button" className={styles.bulkDownload} disabled={busy || downloading} onClick={() => void downloadChecked()}>
        <FileActionIcon name="download" />
        {downloading ? 'Preparando descarga…' : `Descargar seleccionados (${checkedCount})`}
      </button>
      {checkedFiles.some(canRemove) && <button type="button" className={styles.bulkDelete} disabled={busy} onClick={() => void removeChecked()}>
        {busy ? 'Eliminando…' : `Eliminar permitidos (${checkedFiles.filter(canRemove).length})`}
      </button>}
    </div>}
    <div className={`${styles.body} ${selected ? styles.withPreview : ''}`}>
      <div className={styles.fileSection}>
        {filtered.length === 0 ? <div className={styles.empty}>No hay archivos que coincidan con los filtros.</div>
          : grid ? <div className={styles.gridScroller}><div className={styles.grid}>{filtered.map((file) =>
              <div key={file.key} className={styles.tileContainer}>
                <input className={styles.tileCheckbox} type="checkbox" checked={checkedKeys.includes(file.key)}
                  aria-label={`Seleccionar ${file.name}`} onChange={() => toggleChecked(file.key)} />
                <FileTile file={file} selected={selectedKey === file.key} onSelect={() => setSelectedKey(file.key)} />
              </div>)}</div></div>
            : <div className={styles.listScroller}><table className={styles.table}>
              <thead><tr><th className={styles.checkboxCell}>
                <button type="button" className={styles.selectAllButton}
                  disabled={filtered.length === 0 && checkedCount === 0}
                  aria-pressed={allVisibleChecked}
                  aria-label={checkedCount > 0 ? 'Deseleccionar todos los archivos' : 'Seleccionar todos los archivos visibles'}
                  title={checkedCount > 0 ? 'Deseleccionar todos' : 'Seleccionar todos los visibles'}
                  onClick={toggleAllVisible}>
                  {partiallyVisibleChecked
                    ? <FileActionIcon name="partial" />
                    : allVisibleChecked
                      ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor" /><path d="m6.5 12 3.5 3.5 7.5-8" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="4" fill="none" stroke="currentColor" strokeWidth="2" /></svg>}
                </button>
              </th><th>Nombre</th><th>Origen</th><th>Tipo</th><th>Tamaño</th><th>Modificado</th></tr></thead>
              <tbody>{filtered.map((file) => <tr key={file.key} className={selectedKey === file.key ? styles.selectedRow : ''}>
                <td className={styles.checkboxCell}><input type="checkbox" checked={checkedKeys.includes(file.key)} aria-label={`Seleccionar ${file.name}`} onChange={() => toggleChecked(file.key)} /></td>
                <td><button type="button" className={styles.fileNameButton} onClick={() => setSelectedKey(file.key)}>
                  <FileGlyph file={file} /><span><strong>{file.name}</strong><small>{file.card_title ?? file.description ?? ''}</small></span>
                </button></td>
                <td><span className={`${styles.originPill} ${file.origin === 'card' ? styles.cardOrigin : ''}`}>{file.origin === 'card' ? 'Card' : 'General'}</span></td>
                <td>{fileType(file)}</td><td>{sizeLabel(file.size)}</td>
                <td><div className={styles.dateCell}><span>{fileDate(file.created_at)}</span>{file.author && <small>{file.author}</small>}</div></td>
              </tr>)}</tbody>
            </table></div>}
      </div>

      {selected && <aside className={styles.details} aria-label={`Detalles de ${selected.name}`}>
        <div className={styles.detailHeading}>
          <FileGlyph file={selected} />
          <div><strong title={selected.name}>{selected.name}</strong><small>{sizeLabel(selected.size)} · {fileDate(selected.created_at)}</small></div>
          <button type="button" onClick={() => setSelectedKey(null)} aria-label="Cerrar vista previa">×</button>
        </div>
        <div className={styles.preview}><FilePreview key={selected.key} file={selected} /></div>
        <div className={styles.previewActions}>
          {canOpenInBrowser(selected) && <button className={styles.openButton} type="button" onClick={() => void open(selected)}><FileActionIcon name="external" />Abrir en nueva pestaña</button>}
          <button className={styles.downloadButton} type="button" onClick={() => void download(selected)}><FileActionIcon name="download" />Descargar</button>
        </div>
        <dl className={styles.metadata}>
          <dt>Origen</dt><dd>{selected.origin === 'general' ? 'General' : 'Card'}</dd>
          {selected.board_name && <><dt>Tablero</dt><dd>{selected.board_name}</dd></>}
          {selected.card_title && <><dt>Card</dt><dd>{selected.card_title}</dd></>}
          <dt>Subido por</dt><dd>{selected.user_id && selected.author ? <span className={styles.person}><Avatar id={selected.user_id} name={selected.author} src={selected.avatar_url} size={24}/>{selected.author}</span> : 'Usuario eliminado'}</dd>
          <dt>Fecha</dt><dd>{fileDate(selected.created_at)}</dd>
          <dt>Tamaño</dt><dd>{sizeLabel(selected.size)}</dd>
          <dt>Tipo</dt><dd>{fileType(selected)}</dd>
          {selected.description && <><dt>Descripción</dt><dd>{selected.description}</dd></>}
        </dl>
        {canRemove(selected) && <button type="button" className={styles.deleteButton} disabled={busy} onClick={() => void remove(selected)}>{busy ? 'Eliminando…' : 'Eliminar archivo'}</button>}
      </aside>}
    </div>
    <footer className={styles.storage} aria-label="Almacenamiento del Workspace">
      <div className={styles.storageInfo}>
        <strong>Almacenamiento del Workspace</strong>
        <small>{storage.workspace_name}</small>
        {storage.account_limit_bytes !== null && storage.account_used_bytes !== null && (
          <small className={styles.accountStorage}>
            Cuenta Pro: {sizeLabel(storage.account_used_bytes)} / {sizeLabel(storage.account_limit_bytes)} en todos tus Workspaces
          </small>
        )}
      </div>
      <div className={styles.storageTrack}
        role={percent !== null ? 'progressbar' : undefined}
        aria-valuemin={percent !== null ? 0 : undefined}
        aria-valuemax={percent !== null ? 100 : undefined}
        aria-valuenow={percent !== null ? percent : undefined}
        aria-label={percent !== null ? 'Uso del almacenamiento del Workspace' : 'Cuota de almacenamiento no configurada'}>
        {percent !== null && <span style={{ width: `${percent}%` }} />}
      </div>
      <div className={styles.storageSize}>
        <strong>{sizeLabel(storage.used_bytes)}{storage.limit_bytes !== null ? ` / ${sizeLabel(storage.limit_bytes)}` : ''}</strong>
        <span className={styles.storagePercent}>{percent !== null ? `${percent}% utilizado` : '—% · Sin cuota definida'}</span>
      </div>
    </footer>
  </section>
}
