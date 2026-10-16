import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../../api'
import styles from './DepartmentsDashboard.module.css'

export type EntityKind = 'departments' | 'teams' | 'clients'

export function EntityVisual({ url, children, large = false }: {
  url: string | null | undefined
  children: ReactNode
  large?: boolean
}) {
  return <span className={large ? styles.entityVisualLarge : styles.entityVisual}>
    {url ? <img src={url} alt="" loading="lazy"/> : children}
  </span>
}

export function EntityAppearanceEditor({
  kind, id, workspaceId, imageUrl, icon, icons, renderIcon, onIconChange, onImageChanged,
  pendingImage, onPendingImageChange, error, onError, busy, onBusy,
}: {
  kind: EntityKind; id: number | null; workspaceId: number; imageUrl: string | null
  icon: string; icons: { id: string; label: string }[]
  renderIcon: (id: string) => ReactNode; onIconChange: (icon: string) => void
  onImageChanged: () => Promise<void>
  pendingImage: File | null; onPendingImageChange: (file: File | null) => void
  error: string; onError: (error: string) => void
  busy: boolean; onBusy: (busy: boolean) => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!pendingImage) { setPreview(null); return }
    const url = URL.createObjectURL(pendingImage)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingImage])
  async function selectFile(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      onError('Elige un JPG, PNG o WebP de hasta 2 MB.')
      return
    }
    onError('')
    if (!id) { onPendingImageChange(file); return }
    const body = new FormData()
    body.append('workspace_id', String(workspaceId))
    body.append('image', file)
    onBusy(true)
    try {
      await api('/' + kind + '/' + id + '/image', { method: 'POST', body })
      await onImageChanged()
    } catch (cause) { onError(cause instanceof Error ? cause.message : 'No se pudo subir la imagen.') }
    finally { onBusy(false) }
  }
  async function remove() {
    if (!id) { onPendingImageChange(null); return }
    onBusy(true); onError('')
    try {
      await api('/' + kind + '/' + id + '/image', {
        method: 'DELETE', body: JSON.stringify({ workspace_id: workspaceId }),
      })
      await onImageChanged()
    } catch (cause) { onError(cause instanceof Error ? cause.message : 'No se pudo eliminar la imagen.') }
    finally { onBusy(false) }
  }
  return <section className={styles.appearanceEditor}>
    <strong>Imagen e icono</strong>
    <div className={styles.appearancePreview}>
      <EntityVisual url={preview || imageUrl} large>{renderIcon(icon)}</EntityVisual>
      <div className={styles.appearanceActions}>
        <label className={styles.imageUploadButton}>
          Subir imagen
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
            onChange={event => { void selectFile(event.currentTarget.files?.[0]); event.currentTarget.value = '' }}/>
        </label>
        {(imageUrl || pendingImage) && <button type="button" disabled={busy} onClick={() => void remove()}>
          Quitar imagen</button>}
        <small>JPG, PNG o WebP · máximo 2 MB. La imagen tiene prioridad sobre el icono.</small>
      </div>
    </div>
    {error && <p role="alert" className={styles.formError}>{error}</p>}
    <span className={styles.appearanceCaption}>Icono alternativo</span>
    <div className={styles.iconChooser} role="group" aria-label="Icono alternativo">
      {icons.map(option => <button key={option.id} type="button"
        aria-label={option.label} title={option.label} aria-pressed={icon === option.id}
        className={icon === option.id ? styles.chosenIcon : undefined}
        onClick={() => onIconChange(option.id)}>{renderIcon(option.id)}</button>)}
    </div>
  </section>
}
