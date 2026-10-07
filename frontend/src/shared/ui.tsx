import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { type Card } from '../api'
import {
  BoldIcon, ItalicIcon, LinkIcon, ListOlIcon, ListUlIcon, UnderlineIcon, UnlinkIcon,
} from './icons'
const priorityLabel = { baja: 'Baja', media: 'Media', alta: 'Alta', urgente: 'Urgente', } satisfies Record<NonNullable<Card['priority']>, string>
const DEFAULT_CARD_STRIPE = '#147a5f'

function cardStripeStyle(color?: string | null): CSSProperties {
  return { ['--card-stripe' as string]: color || DEFAULT_CARD_STRIPE }
}
const projectDots = ['#147a5f', '#52cbb0', '#6a4b12', '#6e3a52', '#0f6e62']

type OpenTab = { boardId: number; projectId: number; title: string }


function avatarUrl(seed: string | number, size = 64) {
  return `https://i.pravatar.cc/${size}?u=${encodeURIComponent(String(seed))}`
}

function Avatar({ id, name, size = 28, className = 'avatar', src }: {
  id?: number | string
  name: string
  size?: number
  className?: string
  src?: string | null
}) {
  return (
    <img
      className={className}
      src={src || avatarUrl(id ?? name, size * 2)}
      alt={name}
      title={name}
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      loading="lazy"
      decoding="async"
    />
  )
}

function autoGrowTextarea(element: HTMLTextAreaElement) {
  element.style.height = 'auto'
  element.style.height = `${Math.max(element.scrollHeight, 24)}px`
}

function formatDate(value?: string | null) {
  if (!value) return ''
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(new Date(value))
}

export function formatDateLong(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

export function formatRelative(value?: string | null) {
  if (!value) return ''
  const diff = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diff)) return ''
  const minutes = Math.max(0, Math.round(diff / 60000))
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 7) return `hace ${days} d`
  return formatDate(value)
}

function sanitizeDescriptionHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, iframe, object, embed').forEach((node) => node.remove())
  doc.querySelectorAll('*').forEach((el) => {
    ;[...el.attributes].forEach((attr) => {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
      if (attr.name === 'href' && /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name)
    })
  })
  doc.querySelectorAll('a[href]').forEach((anchor) => {
    anchor.setAttribute('target', '_blank')
    anchor.setAttribute('rel', 'noopener noreferrer')
  })
  return doc.body.innerHTML
}

function descriptionToEditorHtml(value: string) {
  if (!value.trim()) return ''
  if (/<[a-z][\s\S]*>/i.test(value)) return sanitizeDescriptionHtml(value)
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

function descriptionIsEmpty(html: string) {
  const text = html.replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/gi, ' ').replace(/<[^>]+>/g, '').trim()
  return text.length === 0
}

function selectionAnchor(): HTMLAnchorElement | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const node = selection.anchorNode
  if (!node) return null
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  return el?.closest('a') ?? null
}

function DescriptionEditor({ value, onChange }: {
  value: string
  onChange: (html: string) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)
  const savedRange = useRef<Range | null>(null)
  const skipSync = useRef(false)
  const [empty, setEmpty] = useState(() => descriptionIsEmpty(value))
  const [toolsOpen, setToolsOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('https://')
  const [active, setActive] = useState({ bold: false, italic: false, underline: false, link: false })

  useEffect(() => {
    const el = editorRef.current
    if (!el || skipSync.current) {
      skipSync.current = false
      return
    }
    const next = descriptionToEditorHtml(value)
    if (el.innerHTML !== next) el.innerHTML = next
    setEmpty(descriptionIsEmpty(value))
  }, [value])

  useEffect(() => {
    if (!linkOpen) return
    const id = window.setTimeout(() => linkInputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [linkOpen])

  function refreshActive() {
    setActive({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      link: Boolean(selectionAnchor()),
    })
  }

  function emitChange() {
    const el = editorRef.current
    if (!el) return
    skipSync.current = true
    const html = sanitizeDescriptionHtml(el.innerHTML)
    const next = descriptionIsEmpty(html) ? '' : html
    setEmpty(descriptionIsEmpty(next))
    onChange(next)
    refreshActive()
  }

  function runFormat(command: string, arg?: string) {
    editorRef.current?.focus()
    if (savedRange.current) {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(savedRange.current)
    }
    document.execCommand(command, false, arg)
    savedRange.current = null
    emitChange()
  }

  function rememberSelection() {
    const selection = window.getSelection()
    savedRange.current = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null
  }

  function openLinkPrompt() {
    rememberSelection()
    const anchor = selectionAnchor()
    if (anchor) {
      runFormat('unlink')
      setLinkOpen(false)
      return
    }
    const selected = window.getSelection()?.toString() ?? ''
    setLinkUrl(selected.startsWith('http') ? selected : 'https://')
    setLinkOpen(true)
  }

  function confirmLink() {
    const url = linkUrl.trim()
    if (!url) {
      setLinkOpen(false)
      return
    }
    const selection = window.getSelection()
    const hasText = Boolean(selection?.toString().trim()) || Boolean(savedRange.current && !savedRange.current.collapsed)
    const safe = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
    if (!hasText && savedRange.current) {
      editorRef.current?.focus()
      selection?.removeAllRanges()
      selection?.addRange(savedRange.current)
      document.execCommand('insertHTML', false, `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`)
      savedRange.current = null
      setLinkOpen(false)
      emitChange()
      return
    }
    runFormat('createLink', url)
    editorRef.current?.querySelectorAll('a[href]').forEach((anchor) => {
      anchor.setAttribute('target', '_blank')
      anchor.setAttribute('rel', 'noopener noreferrer')
    })
    emitChange()
    setLinkOpen(false)
  }

  return (
    <div
      className={`description-editor${toolsOpen ? ' is-active' : ''}`}
      onFocus={() => setToolsOpen(true)}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        setToolsOpen(false)
        setLinkOpen(false)
        emitChange()
      }}
    >
      {toolsOpen && (
        <>
          <div className="description-toolbar" role="toolbar" aria-label="Formato">
            <button type="button" className={`desc-tool${active.bold ? ' on' : ''}`} title="Negrita" aria-label="Negrita" aria-pressed={active.bold} onMouseDown={(event) => event.preventDefault()} onClick={() => runFormat('bold')}>
              <BoldIcon />
            </button>
            <button type="button" className={`desc-tool${active.italic ? ' on' : ''}`} title="Cursiva" aria-label="Cursiva" aria-pressed={active.italic} onMouseDown={(event) => event.preventDefault()} onClick={() => runFormat('italic')}>
              <ItalicIcon />
            </button>
            <button type="button" className={`desc-tool${active.underline ? ' on' : ''}`} title="Subrayado" aria-label="Subrayado" aria-pressed={active.underline} onMouseDown={(event) => event.preventDefault()} onClick={() => runFormat('underline')}>
              <UnderlineIcon />
            </button>
            <span className="desc-tool-sep" />
            <button type="button" className="desc-tool" title="Lista" aria-label="Lista" onMouseDown={(event) => event.preventDefault()} onClick={() => runFormat('insertUnorderedList')}>
              <ListUlIcon />
            </button>
            <button type="button" className="desc-tool" title="Lista numerada" aria-label="Lista numerada" onMouseDown={(event) => event.preventDefault()} onClick={() => runFormat('insertOrderedList')}>
              <ListOlIcon />
            </button>
            <span className="desc-tool-sep" />
            <button
              type="button"
              className={`desc-tool${active.link ? ' on' : ''}`}
              title={active.link ? 'Quitar enlace' : 'Enlace'}
              aria-label={active.link ? 'Quitar enlace' : 'Enlace'}
              aria-pressed={active.link}
              onMouseDown={(event) => event.preventDefault()}
              onClick={openLinkPrompt}
            >
              {active.link ? <UnlinkIcon /> : <LinkIcon />}
            </button>
          </div>
          {linkOpen && (
            <form
              className="description-link-form"
              onSubmit={(event) => {
                event.preventDefault()
                confirmLink()
              }}
            >
              <input
                ref={linkInputRef}
                type="url"
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="https://"
                aria-label="URL del enlace"
              />
              <button type="submit" className="ghost">Aplicar</button>
              <button type="button" className="ghost" onClick={() => setLinkOpen(false)}>Cancelar</button>
            </form>
          )}
        </>
      )}
      <div
        ref={editorRef}
        className={`card-modal-description${empty ? ' is-empty' : ''}`}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Descripción"
        data-placeholder="Añade una descripción…"
        onInput={emitChange}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        suppressContentEditableWarning
      />
    </div>
  )
}


export {
  priorityLabel, DEFAULT_CARD_STRIPE, cardStripeStyle, projectDots, Avatar,
  autoGrowTextarea, formatDate, sanitizeDescriptionHtml, descriptionToEditorHtml,
  descriptionIsEmpty, selectionAnchor, DescriptionEditor,
}
export type { OpenTab }
