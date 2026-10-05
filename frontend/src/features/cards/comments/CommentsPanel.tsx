import { type Dispatch, type FormEvent, useEffect, useRef, useState, type SetStateAction } from 'react'
import { api, type BoardPayload, type Card, type Comment, type CommentReactionType } from '../../../api'
import { Avatar, TrashIcon, autoGrowTextarea, formatRelative } from '../../../shared/ui'
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

function CommentsIcon() {
  return (
    <svg className="section-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M568.4 37.7C578.2 34.2 589 36.7 596.4 44C603.8 51.3 606.2 62.2 602.7 72L424.7 568.9C419.7 582.8 406.6 592 391.9 592C377.7 592 364.9 583.4 359.6 570.3L295.4 412.3C290.9 401.3 292.9 388.7 300.6 379.7L395.1 267.3C400.2 261.2 399.8 252.3 394.2 246.7C388.6 241.1 379.6 240.7 373.6 245.8L261.2 340.1C252.1 347.7 239.6 349.7 228.6 345.3L70.1 280.8C57 275.5 48.4 262.7 48.4 248.5C48.4 233.8 57.6 220.7 71.5 215.7L568.4 37.7z" />
    </svg>
  )
}

function SmileIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM229.4 385.9C249.8 413.9 282.8 432 320 432C357.2 432 390.2 413.9 410.6 385.9C418.4 375.2 433.4 372.8 444.1 380.6C454.8 388.4 457.2 403.4 449.4 414.1C420.3 454 373.2 480 320 480C266.8 480 219.7 454 190.6 414.1C182.8 403.4 185.2 388.4 195.9 380.6C206.6 372.8 221.6 375.2 229.4 385.9zM208 272C208 254.3 222.3 240 240 240C257.7 240 272 254.3 272 272C272 289.7 257.7 304 240 304C222.3 304 208 289.7 208 272zM400 240C417.7 240 432 254.3 432 272C432 289.7 417.7 304 400 304C382.3 304 368 289.7 368 272C368 254.3 382.3 240 400 240z" />
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

function EyeIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M320 96C239.2 96 174.5 132.8 127.4 176.6C80.6 220.1 49.3 272 34.4 307.7C31.1 315.6 31.1 324.4 34.4 332.3C49.3 368 80.6 420 127.4 463.4C174.5 507.1 239.2 544 320 544C400.8 544 465.5 507.2 512.6 463.4C559.4 419.9 590.7 368 605.6 332.3C608.9 324.4 608.9 315.6 605.6 307.7C590.7 272 559.4 220 512.6 176.6C465.5 132.9 400.8 96 320 96zM176 320C176 240.5 240.5 176 320 176C399.5 176 464 240.5 464 320C464 399.5 399.5 464 320 464C240.5 464 176 399.5 176 320zM320 256C320 291.3 291.3 320 256 320C244.5 320 233.7 317 224.3 311.6C223.3 322.5 224.2 333.7 227.2 344.8C240.9 396 293.6 426.4 344.8 412.7C396 399 426.4 346.3 412.7 295.1C400.5 249.4 357.2 220.3 311.6 224.3C316.9 233.6 320 244.4 320 256z" />
    </svg>
  )
}

function CommentTrashIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M232.7 69.9C237.1 56.8 249.3 48 263.1 48L377 48C390.8 48 403 56.8 407.4 69.9L416 96L512 96C529.7 96 544 110.3 544 128C544 145.7 529.7 160 512 160L128 160C110.3 160 96 145.7 96 128C96 110.3 110.3 96 128 96L224 96L232.7 69.9zM128 208L512 208L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 208zM216 272C202.7 272 192 282.7 192 296L192 488C192 501.3 202.7 512 216 512C229.3 512 240 501.3 240 488L240 296C240 282.7 229.3 272 216 272zM320 272C306.7 272 296 282.7 296 296L296 488C296 501.3 306.7 512 320 512C333.3 512 344 501.3 344 488L344 296C344 282.7 333.3 272 320 272zM424 272C410.7 272 400 282.7 400 296L400 488C400 501.3 410.7 512 424 512C437.3 512 448 501.3 448 488L448 296C448 282.7 437.3 272 424 272z" />
    </svg>
  )
}

function ThumbsUpIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M235.5 102.8C256.3 68 300.5 54 338 71.6L345.2 75.4C380 96.3 394 140.5 376.4 178L376.4 178L362.3 208L472 208L479.4 208.4C515.7 212.1 544 242.8 544 280C544 293.2 540.4 305.4 534.2 316C540.3 326.6 543.9 338.8 544 352C544 370.3 537.1 386.8 526 399.5C527.3 404.8 528 410.3 528 416C528 441.1 515.1 463 495.8 475.9C493.9 511.4 466.4 540.1 431.4 543.6L424 544L319.9 544C301.9 544 284 540.6 267.3 534.1L260.2 531.1L259.5 530.8L252.9 527.6L252.2 527.3L240 520.8C227.7 514.3 216.7 506.1 207.1 496.7C203 523.6 179.8 544.1 151.8 544.1L119.8 544.1C88.9 544.1 63.8 519 63.8 488.1L64 264C64 233.1 89.1 208 120 208L152 208C162.8 208 172.9 211.1 181.5 216.5L231.6 110L232.2 108.8L234.9 103.8L235.5 102.9zM120 256C115.6 256 112 259.6 112 264L112 488C112 492.4 115.6 496 120 496L152 496C156.4 496 160 492.4 160 488L160 264C160 259.6 156.4 256 152 256L120 256zM317.6 115C302.8 108.1 285.3 113.4 276.9 127L274.7 131L217.9 251.9C214.4 259.4 212.4 267.4 211.9 275.6L211.8 279.8L211.8 392.7L212 400.6C214.4 433.3 233.4 462.7 262.7 478.3L274.2 484.4L280.5 487.5C292.9 493.1 306.3 496 319.9 496L424 496L426.4 495.9C438.5 494.7 448 484.4 448 472L447.8 469.4C447.7 468.5 447.6 467.7 447.4 466.8C444.7 454.7 451.7 442.6 463.4 438.8C473.1 435.7 480 426.6 480 416C480 411.7 478.9 407.8 476.9 404.2C470.6 393.1 474.1 379 484.9 372.2C491.7 367.9 496.1 360.4 496.1 352C496.1 344.9 493 338.5 487.9 334C482.7 329.4 479.7 322.9 479.7 316C479.7 309.1 482.7 302.6 487.9 298C493 293.5 496.1 287.1 496.1 280L496 277.6C494.9 266.3 485.9 257.3 474.6 256.2L472.2 256.1L324.7 256.1C316.5 256.1 308.9 251.9 304.5 245C300.1 238.1 299.5 229.3 303 221.9L333 157.6C340 142.6 334.4 124.9 320.5 116.6L317.6 115z" />
    </svg>
  )
}

function LikeIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M144 224C161.7 224 176 238.3 176 256L176 512C176 529.7 161.7 544 144 544L96 544C78.3 544 64 529.7 64 512L64 256C64 238.3 78.3 224 96 224L144 224zM334.6 80C361.9 80 384 102.1 384 129.4L384 133.6C384 140.4 382.7 147.2 380.2 153.5L352 224L512 224C538.5 224 560 245.5 560 272C560 291.7 548.1 308.6 531.1 316C548.1 323.4 560 340.3 560 360C560 383.4 543.2 402.9 521 407.1C525.4 414.4 528 422.9 528 432C528 454.2 513 472.8 492.6 478.3C494.8 483.8 496 489.8 496 496C496 522.5 474.5 544 448 544L360.1 544C323.8 544 288.5 531.6 260.2 508.9L248 499.2C232.8 487.1 224 468.7 224 449.2L224 262.6C224 247.7 227.5 233 234.1 219.7L290.3 107.3C298.7 90.6 315.8 80 334.6 80z" />
    </svg>
  )
}

function LoveIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M305 151.1L320 171.8L335 151.1C360 116.5 400.2 96 442.9 96C516.4 96 576 155.6 576 229.1L576 231.7C576 343.9 436.1 474.2 363.1 529.9C350.7 539.3 335.5 544 320 544C304.5 544 289.2 539.4 276.9 529.9C203.9 474.2 64 343.9 64 231.7L64 229.1C64 155.6 123.6 96 197.1 96C239.8 96 280 116.5 305 151.1z" />
    </svg>
  )
}

function KissIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M543.7 332.3C543.9 328.2 544 324.1 544 320C544 178.6 429.4 64 288 64C146.6 64 32 178.6 32 320C32 461.4 146.6 576 288 576C329.4 576 368.5 566.2 403.1 548.7C395.5 531.6 387 509.9 381.3 487C373.6 456.5 367.2 410.8 389.5 372.3L392.2 367.7C421.7 316.7 486.9 299.2 537.9 328.7C539.9 329.9 541.9 331.1 543.8 332.4zM240 368C240 359.2 247.2 352 256 352L288 352C314.5 352 336 373.5 336 400C336 412.3 331.4 423.5 323.8 432C331.4 440.5 336 451.7 336 464C336 490.5 314.5 512 288 512L256 512C247.2 512 240 504.8 240 496C240 487.2 247.2 480 256 480L272 480C280.8 480 288 472.8 288 464C288 455.2 280.8 448 272 448L256 448C247.2 448 240 440.8 240 432C240 423.2 247.2 416 256 416L272 416C280.8 416 288 408.8 288 400C288 391.2 280.8 384 272 384L256 384C247.2 384 240 376.8 240 368zM208 240C225.7 240 240 254.3 240 272C240 289.7 225.7 304 208 304C190.3 304 176 289.7 176 272C176 254.3 190.3 240 208 240zM360 260C349 260 340 269 340 280C340 291 331 300 320 300C309 300 300 291 300 280C300 246.9 326.9 220 360 220L376 220C409.1 220 436 246.9 436 280C436 291 427 300 416 300C405 300 396 291 396 280C396 269 387 260 376 260L360 260zM542.8 414C540.6 395.7 529.9 379.4 513.9 370.2C485.8 354 450 363.6 433.8 391.7L431.1 396.3C406.6 438.8 439 514.2 455.5 547.1C460.6 557.2 471 563.2 482.3 562.6C519 560.4 600.5 550.9 625.1 508.4L627.8 503.8C644 475.7 634.4 439.9 606.3 423.7C590.3 414.5 570.9 413.3 553.9 420.6L544.1 424.8L542.8 414.2z" />
    </svg>
  )
}

function EncantadoIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 296.7 572.9 274.1 567.1 252.7C572.6 239.2 576 224.3 576 208C576 155 533 112 480 112L477.1 112C474.6 112 472.1 112.1 469.7 112.3C427.6 81.9 375.9 64 320 64C264.1 64 212.4 81.9 170.3 112.3C167.8 112.1 165.4 112 162.9 112L160 112C107 112 64 155 64 208C64 224.3 67.5 239.2 72.9 252.7C67.1 274.1 64 296.7 64 320C64 461.4 178.6 576 320 576zM450.7 388.9C462.6 385.2 474.6 395.2 470.3 407C447.9 468.3 389 512.1 320 512.1C251 512.1 192.1 468.2 169.7 406.9C165.4 395.1 177.4 385.1 189.3 388.8C228.5 401 273 407.9 320 407.9C367 407.9 411.5 401 450.7 388.8zM386.9 160C400.4 160 413.4 165.4 422.9 174.9L432 184L441.1 174.9C450.6 165.4 463.6 160 477.1 160L480 160C506.5 160 528 181.5 528 208C528 261.4 461.1 303.7 439 316.2C434.6 318.7 429.4 318.7 425 316.2C402.9 303.7 336 261.4 336 208C336 181.5 357.5 160 384 160L386.9 160zM198.9 174.9L208 184L217.1 174.9C226.6 165.4 239.6 160 253.1 160L256 160C282.5 160 304 181.5 304 208C304 261.4 237.1 303.7 215 316.2C210.6 318.7 205.4 318.7 201 316.2C178.9 303.7 112 261.4 112 208C112 181.5 133.5 160 160 160L162.9 160C176.4 160 189.4 165.4 198.9 174.9z" />
    </svg>
  )
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
                                    aria-label="Eliminar mÃ³dulo"
                                    title="Eliminar mÃ³dulo"
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
                      placeholder="Escribe un comentarioâ€¦"
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
                            placeholder={`Responder a ${authorName}â€¦`}
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
                                    title={item.is_internal ? 'Interno â€” hacer visible para el cliente' : 'Visible para el cliente â€” marcar interno'}
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
                {commentCount === 0 && <p className="muted">TodavÃ­a no hay comentarios.</p>}
              </div>
                </>
              )}
    </section>
  )
}









