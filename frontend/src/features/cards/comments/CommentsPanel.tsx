import { type Dispatch, type FormEvent, useEffect, useRef, useState, type SetStateAction } from 'react'
import { api, type BoardPayload, type Card, type Comment, type CommentReactionType } from '../../../api'
import { Avatar, autoGrowTextarea, formatRelative } from '../../../shared/ui'
import { CommentsIcon, CommentTrashIcon, EncantadoIcon, EyeIcon, EyeSlashIcon, KissIcon, LikeIcon, LoveIcon, SendIcon, SmileIcon, ThumbsUpIcon, TrashIcon } from '../../../shared/icons'
import { SectionToggle } from '../cardSectionUi'

const MAX_COMMENT_NESTING = 5
type Props = { card: Card; board: BoardPayload; currentUser: { id: number; name: string; avatar_url?: string | null }; editing: boolean; comments: Comment[]; onCommentsChange: Dispatch<SetStateAction<Comment[]>>; onChange: () => Promise<void>; dragProps?: Record<string, unknown>; onRemove: () => Promise<void> }

type CommentNode = {
  comment: Comment
  depth: number
  children: CommentNode[]
}

function buildCommentForest(comments: Comment[]): CommentNode[] {
  const byParent = new Map<number, Comment[]>()
  for (const comment of comments) {
    if (!comment.parent_id) continue
    const list = byParent.get(comment.parent_id) ?? []
    list.push(comment)
    byParent.set(comment.parent_id, list)
  }

  function nodeFor(comment: Comment, depth: number): CommentNode {
    return {
      comment,
      depth,
      children: (byParent.get(comment.id) ?? []).map((child) => nodeFor(child, depth + 1)),
    }
  }

  return comments.filter((comment) => !comment.parent_id).map((comment) => nodeFor(comment, 0))
}

function commentDescendantIds(comments: Comment[], rootId: number) {
  const ids = new Set<number>([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const comment of comments) {
      if (comment.parent_id && ids.has(comment.parent_id) && !ids.has(comment.id)) {
        ids.add(comment.id)
        grew = true
      }
    }
  }
  return ids
}


function reactionIcon(type: CommentReactionType | null | undefined) {
  if (type === 'like') return <LikeIcon />
  if (type === 'love') return <LoveIcon />
  if (type === 'kiss') return <KissIcon />
  if (type === 'encantado') return <EncantadoIcon />
  return <ThumbsUpIcon />
}

function CommentReactionButton({ comment, disabled, onReacted }: {
  comment: Comment
  disabled?: boolean
  onReacted: (next: Comment) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const reactions = comment.reactions ?? { like: 0, love: 0, kiss: 0, encantado: 0, mine: null }
  const total = reactions.like + reactions.love + reactions.kiss + reactions.encantado
  const mine = reactions.mine ?? null

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  async function pick(type: CommentReactionType) {
    const next = await api<Comment>(`/comments/${comment.id}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    })
    onReacted(next)
    setOpen(false)
  }

  return (
    <div className="comment-reaction-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`comment-reaction-btn${mine ? ` on ${mine}` : ''}`}
        disabled={disabled}
        aria-label="Dar feedback"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {reactionIcon(mine)}
        {total > 0 && <span>{total}</span>}
      </button>
      {open && (
        <div className="comment-reaction-pop" role="listbox" aria-label="Reacciones">
          <button type="button" role="option" className={mine === 'like' ? 'on like' : ''} aria-label="Me gusta" onClick={() => void pick('like')}>
            <LikeIcon />
          </button>
          <button type="button" role="option" className={mine === 'love' ? 'on love' : ''} aria-label="Amor" onClick={() => void pick('love')}>
            <LoveIcon />
          </button>
          <button type="button" role="option" className={mine === 'kiss' ? 'on kiss' : ''} aria-label="Beso" onClick={() => void pick('kiss')}>
            <KissIcon />
          </button>
          <button type="button" role="option" className={mine === 'encantado' ? 'on encantado' : ''} aria-label="Me encanta" onClick={() => void pick('encantado')}>
            <EncantadoIcon />
          </button>
        </div>
      )}
    </div>
  )
}

const COMMENT_EMOJIS = ['😀', '😊', '😂', '😍', '👍', '👏', '❤️', '🎉', '👀', '🔥', '✅', '🙌']

function CommentEmojiButton({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  return (
    <div className="comment-emoji-wrap" ref={wrapRef}>
      <button
        type="button"
        className="comment-tool"
        aria-label="Añadir emoji"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <SmileIcon />
      </button>
      {open && (
        <div className="comment-emoji-pop" role="listbox" aria-label="Emojis">
          {COMMENT_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="option"
              onClick={() => {
                onPick(emoji)
                setOpen(false)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function CommentsPanel({ card, board, currentUser, editing, comments, onCommentsChange, onChange, dragProps, onRemove }: Props) {
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const replyInputRef = useRef<HTMLTextAreaElement>(null)
  const [commentsCollapsed, setCommentsCollapsed] = useState(false)
  const commentCount = comments.length
  const setComments = onCommentsChange
  function insertCommentEmoji(value: string, emoji: string, area: HTMLTextAreaElement | null) {
    if (!area) return value + emoji
    const start = area.selectionStart; const end = area.selectionEnd; const next = value.slice(0, start) + emoji + value.slice(end); const cursor = start + emoji.length
    requestAnimationFrame(() => { area.focus(); area.setSelectionRange(cursor, cursor); autoGrowTextarea(area) })
    return next
  }
  return (
    <section className={`card-modal-section${commentsCollapsed ? ' is-collapsed' : ''}`}>
                            <div className={`section-head${dragProps ? ' is-module-drag' : ''}`} {...dragProps}>
                              <h3>
                                <SectionToggle
                                  icon={<CommentsIcon />}
                                  label="Comentarios"
                                  collapsed={commentsCollapsed}
                                  onToggle={() => setCommentsCollapsed((open) => !open)}
                                />
                                Comentarios
                                {commentCount > 0 && <span className="checklist-progress">({commentCount})</span>}
                              </h3>
                              {editing && (
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


              {!commentsCollapsed && (
                <>
              {!editing && (
                <div className="comment-compose">
                  <Avatar id={currentUser.id} name={currentUser.name} size={40} className="face" src={currentUser.avatar_url} />
                  <form
                    className="comment-box"
                    onSubmit={async (event) => {
                      event.preventDefault()
                      if (!body.trim()) return
                      const created = await api<Comment>(`/cards/${card.id}/comments`, {
                        method: 'POST',
                        body: JSON.stringify({ body: body.trim() }),
                      })
                      setBody('')
                      const area = event.currentTarget.querySelector('textarea')
                      if (area) area.style.height = 'auto'
                      setComments((current) => [...current, created])
                      await onChange()
                    }}
                  >
                    <textarea
                      ref={commentInputRef}
                      value={body}
                      onChange={(event) => {
                        setBody(event.target.value)
                        autoGrowTextarea(event.target)
                      }}
                      onInput={(event) => autoGrowTextarea(event.currentTarget)}
                      placeholder="Escribe un comentario…"
                      rows={1}
                    />
                    <div className="comment-box-actions">
                      <CommentEmojiButton
                        onPick={(emoji) => setBody((current) => insertCommentEmoji(current, emoji, commentInputRef.current))}
                      />
                      <button className="comment-tool send" type="submit" aria-label="Enviar comentario" disabled={!body.trim()}>
                        <SendIcon />
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="comment-thread">
                {buildCommentForest(comments).map((rootNode) => {
                  const root = rootNode.comment
                  const canToggle = !editing
                    && board.role !== 'cliente'
                    && root.author_id === currentUser.id
                  async function toggleVisibility() {
                    if (!canToggle) return
                    const nextInternal = !root.is_internal
                    await api(`/comments/${root.id}/visibility`, {
                      method: 'PATCH',
                      body: JSON.stringify({ is_internal: nextInternal }),
                    })
                    const affected = commentDescendantIds(comments, root.id)
                    setComments((current) => current.map((item) => (
                      affected.has(item.id) ? { ...item, is_internal: nextInternal } : item
                    )))
                    await onChange()
                  }
                  async function submitReply(event: FormEvent, parentId: number) {
                    event.preventDefault()
                    if (!replyBody.trim()) return
                    const created = await api<Comment>(`/cards/${card.id}/comments`, {
                      method: 'POST',
                      body: JSON.stringify({ body: replyBody.trim(), parent_id: parentId }),
                    })
                    setReplyBody('')
                    setReplyTo(null)
                    const area = (event.currentTarget as HTMLFormElement).querySelector('textarea')
                    if (area) area.style.height = 'auto'
                    setComments((current) => [...current, created])
                    await onChange()
                  }
                  function replyComposer(parentId: number, authorName: string) {
                    if (editing || replyTo !== parentId) return null
                    return (
                      <div className="comment-compose reply">
                        <Avatar id={currentUser.id} name={currentUser.name} size={32} className="face" src={currentUser.avatar_url} />
                        <form className="comment-box" onSubmit={(event) => void submitReply(event, parentId)}>
                          <textarea
                            ref={replyInputRef}
                            value={replyBody}
                            onChange={(event) => {
                              setReplyBody(event.target.value)
                              autoGrowTextarea(event.target)
                            }}
                            onInput={(event) => autoGrowTextarea(event.currentTarget)}
                            placeholder={`Responder a ${authorName}…`}
                            rows={1}
                            autoFocus
                          />
                          <div className="comment-box-actions">
                            <CommentEmojiButton
                              onPick={(emoji) => setReplyBody((current) => insertCommentEmoji(current, emoji, replyInputRef.current))}
                            />
                            <button className="comment-tool send" type="submit" aria-label="Enviar respuesta" disabled={!replyBody.trim()}>
                              <SendIcon />
                            </button>
                          </div>
                        </form>
                        <button className="ghost linkish" type="button" onClick={() => setReplyTo(null)}>Cancelar</button>
                      </div>
                    )
                  }
                  function renderNode(node: CommentNode) {
                    const item = node.comment
                    const author = board.members.find((member) => member.id === item.author_id)
                      ?? board.members.find((member) => member.name === item.author)
                    const canReply = !editing && node.depth < MAX_COMMENT_NESTING
                    const canDelete = !editing
                      && item.author_id === currentUser.id
                      && node.children.length === 0
                    const isRoot = node.depth === 0
                    return (
                      <div key={item.id} className={node.depth > 0 ? 'comment-nest' : undefined}>
                        <article className={`comment-item${isRoot ? '' : ' reply'}`}>
                          <Avatar
                            id={author?.id ?? item.author_id}
                            name={item.author}
                            size={isRoot ? 40 : 32}
                            className="face"
                          />
                          <div className="comment-bubble">
                            <header className="comment-meta">
                              <strong>{item.author}</strong>
                              {item.created_at && <time className="muted">{formatRelative(item.created_at)}</time>}
                              <span className="comment-meta-tools">
                                {isRoot && board.role !== 'cliente' && card.is_internal === false && (
                                  <button
                                    type="button"
                                    className={`comment-visibility-btn${item.is_internal ? ' internal' : ' visible'}`}
                                    disabled={!canToggle}
                                    title={item.is_internal ? 'Interno — hacer visible para el cliente' : 'Visible para el cliente — marcar interno'}
                                    aria-label={item.is_internal ? 'Hacer visible para el cliente' : 'Marcar como interno'}
                                    onClick={() => void toggleVisibility()}
                                  >
                                    {item.is_internal ? <EyeSlashIcon /> : <EyeIcon />}
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    className="comment-visibility-btn comment-delete-btn"
                                    title="Eliminar comentario"
                                    aria-label="Eliminar comentario"
                                    onClick={() => {
                                      void (async () => {
                                        await api(`/comments/${item.id}`, { method: 'DELETE' })
                                        setComments((current) => current.filter((entry) => entry.id !== item.id))
                                        if (replyTo === item.id) setReplyTo(null)
                                        await onChange()
                                      })()
                                    }}
                                  >
                                    <CommentTrashIcon />
                                  </button>
                                )}
                              </span>
                            </header>
                            <p>{item.body}</p>
                            <div className="comment-actions">
                              {!editing && (
                                <CommentReactionButton
                                  comment={item}
                                  onReacted={(next) => {
                                    setComments((current) => current.map((entry) => (entry.id === next.id ? next : entry)))
                                    void onChange()
                                  }}
                                />
                              )}
                              {canReply && (
                                <button
                                  type="button"
                                  className="ghost linkish"
                                  onClick={() => {
                                    setReplyTo(item.id)
                                    setReplyBody('')
                                  }}
                                >
                                  Responder
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                        {replyComposer(item.id, item.author)}
                        {node.children.map((child) => renderNode(child))}
                      </div>
                    )
                  }
                  return (
                    <div className="comment-thread-item" key={root.id}>
                      {renderNode(rootNode)}
                    </div>
                  )
                })}
                {commentCount === 0 && <p className="muted">Todavía no hay comentarios.</p>}
              </div>
                </>
              )}
    </section>
  )
}









