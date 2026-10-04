import { type FormEvent, type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'

import { DndContext, PointerSensor, closestCorners, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api, uploadFile, type Attachment, type BoardPayload, type Card, type CardModule, type CardModuleType, type ChecklistItem, type Comment, type CommentReactionType, type Person, type Profile } from '../../api'
import { ArchiveIcon, Avatar, DescriptionEditor, DotsIcon, EditIcon, MinusIcon, PaletteIcon, PlusIcon, SaveIcon, TrashIcon, UserPlusIcon, VisibilityIcon, autoGrowTextarea, formatDate, formatDateLong, formatRelative, cardStripeStyle, DEFAULT_CARD_STRIPE, descriptionToEditorHtml, priorityLabel, sanitizeDescriptionHtml } from '../../shared/ui'
import { PriorityMark, PriorityPicker, SideDatePicker, SideSelect, parseDateKey, toDateKey } from '../board/Board'

const MAX_COMMENT_NESTING = 5

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

function formatFileSize(bytes: number) {
  if (!bytes || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CloseIcon() {
  return (
    <svg className="close-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
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

function CalendarIcon() {
  return (
    <svg className="side-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M224 64C241.7 64 256 78.3 256 96L256 128L384 128L384 96C384 78.3 398.3 64 416 64C433.7 64 448 78.3 448 96L448 128L480 128C515.3 128 544 156.7 544 192L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 192C96 156.7 124.7 128 160 128L192 128L192 96C192 78.3 206.3 64 224 64zM160 304L160 336C160 344.8 167.2 352 176 352L208 352C216.8 352 224 344.8 224 336L224 304C224 295.2 216.8 288 208 288L176 288C167.2 288 160 295.2 160 304zM288 304L288 336C288 344.8 295.2 352 304 352L336 352C344.8 352 352 344.8 352 336L352 304C352 295.2 344.8 288 336 288L304 288C295.2 288 288 295.2 288 304zM432 288C423.2 288 416 295.2 416 304L416 336C416 344.8 423.2 352 432 352L464 352C472.8 352 480 344.8 480 336L480 304C480 295.2 472.8 288 464 288L432 288zM160 432L160 464C160 472.8 167.2 480 176 480L208 480C216.8 480 224 472.8 224 464L224 432C224 423.2 216.8 416 208 416L176 416C167.2 416 160 423.2 160 432zM304 416C295.2 416 288 423.2 288 432L288 464C288 472.8 295.2 480 304 480L336 480C344.8 480 352 472.8 352 464L352 432C352 423.2 344.8 416 336 416L304 416zM416 432L416 464C416 472.8 423.2 480 432 480L464 480C472.8 480 480 472.8 480 464L480 432C480 423.2 472.8 416 464 416L432 416C423.2 416 416 423.2 416 432z" />
    </svg>
  )
}

function CommentsIcon() {
  return (
    <svg className="section-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function DescriptionIcon() {
  return (
    <svg className="section-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h10" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg className="section-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M297.4 470.6C309.9 483.1 330.2 483.1 342.7 470.6L534.7 278.6C547.2 266.1 547.2 245.8 534.7 233.3C522.2 220.8 501.9 220.8 489.4 233.3L320 402.7L150.6 233.4C138.1 220.9 117.8 220.9 105.3 233.4C92.8 245.9 92.8 266.2 105.3 278.7L297.3 470.7z" />
    </svg>
  )
}

function SectionToggle({ icon, label, collapsed, onToggle }: {
  icon: ReactNode
  label: string
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`section-toggle${collapsed ? ' is-collapsed' : ''}`}
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? `Expandir ${label}` : `Colapsar ${label}`}
      title={collapsed ? 'Expandir' : 'Colapsar'}
    >
      <span className="section-toggle-face section-toggle-icon">{icon}</span>
      <span className="section-toggle-face section-toggle-chevron"><ChevronDownIcon /></span>
    </button>
  )
}

function AttachmentIcon() {
  return (
    <svg className="section-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M288.6 76.8C344.8 20.6 436 20.6 492.2 76.8C548.4 133 548.4 224.2 492.2 280.4L328.2 444.4C293.8 478.8 238.1 478.8 203.7 444.4C169.3 410 169.3 354.3 203.7 319.9L356.5 167.3C369 154.8 389.3 154.8 401.8 167.3C414.3 179.8 414.3 200.1 401.8 212.6L249 365.3C239.6 374.7 239.6 389.9 249 399.2C258.4 408.5 273.6 408.6 282.9 399.2L446.9 235.2C478.1 204 478.1 153.3 446.9 122.1C415.7 90.9 365 90.9 333.8 122.1L169.8 286.1C116.7 339.2 116.7 425.3 169.8 478.4C222.9 531.5 309 531.5 362.1 478.4L492.3 348.3C504.8 335.8 525.1 335.8 537.6 348.3C550.1 360.8 550.1 381.1 537.6 393.6L407.4 523.6C329.3 601.7 202.7 601.7 124.6 523.6C46.5 445.5 46.5 318.9 124.6 240.8L288.6 76.8z" />
    </svg>
  )
}

function ChecklistIcon() {
  return (
    <svg className="section-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M 21 10.656 L 21 19" />
      <path d="M 21 19 A2 2 0 0 1 19 21" />
      <path d="M 19 21 L 5 21" />
      <path d="M 5 21 A2 2 0 0 1 3 19" />
      <path d="M 3 19 L 3 5" />
      <path d="M 3 5 A2 2 0 0 1 5 3" />
      <path d="M 5 3 L 17.344 3" />
      <path d="M 9 11 L 12 14" />
      <path d="M 12 14 L 22 4" />
    </svg>
  )
}

function GripIcon() {
  return (
    <svg className="grip-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M152 160C174.1 160 192 177.9 192 200L192 248C192 270.1 174.1 288 152 288L104 288C81.9 288 64 270.1 64 248L64 200C64 177.9 81.9 160 104 160L152 160zM344 288L296 288C273.9 288 256 270.1 256 248L256 200C256 177.9 273.9 160 296 160L344 160C366.1 160 384 177.9 384 200L384 248C384 270.1 366.1 288 344 288zM536 288L488 288C465.9 288 448 270.1 448 248L448 200C448 177.9 465.9 160 488 160L536 160C558.1 160 576 177.9 576 200L576 248C576 270.1 558.1 288 536 288zM536 480L488 480C465.9 480 448 462.1 448 440L448 392C448 369.9 465.9 352 488 352L536 352C558.1 352 576 369.9 576 392L576 440C576 462.1 558.1 480 536 480zM344 352C366.1 352 384 369.9 384 392L384 440C384 462.1 366.1 480 344 480L296 480C273.9 480 256 462.1 256 440L256 392C256 369.9 273.9 352 296 352L344 352zM152 480L104 480C81.9 480 64 462.1 64 440L64 392C64 369.9 81.9 352 104 352L152 352C174.1 352 192 369.9 192 392L192 440C192 462.1 174.1 480 152 480z" />
    </svg>
  )
}

function CheckOnIcon() {
  return (
    <svg className="check-box-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M480 96C515.3 96 544 124.7 544 160L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 160C96 124.7 124.7 96 160 96L480 96zM438 209.7C427.3 201.9 412.3 204.3 404.5 215L285.1 379.2L233 327.1C223.6 317.7 208.4 317.7 199.1 327.1C189.8 336.5 189.7 351.7 199.1 361L271.1 433C276.1 438 283 440.5 289.9 440C296.8 439.5 303.3 435.9 307.4 430.2L443.3 243.2C451.1 232.5 448.7 217.5 438 209.7z" />
    </svg>
  )
}

function CheckOffIcon() {
  return (
    <svg className="check-box-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M480 144C488.8 144 496 151.2 496 160L496 480C496 488.8 488.8 496 480 496L160 496C151.2 496 144 488.8 144 480L144 160C144 151.2 151.2 144 160 144L480 144zM160 96C124.7 96 96 124.7 96 160L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 160C544 124.7 515.3 96 480 96L160 96z" />
    </svg>
  )
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

function insertCommentEmoji(value: string, emoji: string, area: HTMLTextAreaElement | null) {
  if (!area) return value + emoji
  const start = area.selectionStart
  const end = area.selectionEnd
  const next = value.slice(0, start) + emoji + value.slice(end)
  const cursor = start + emoji.length
  requestAnimationFrame(() => {
    area.focus()
    area.setSelectionRange(cursor, cursor)
    autoGrowTextarea(area)
  })
  return next
}

function CheckItemDateMenu({ value, onChange, onClose, minDate, maxDate }: {
  value?: string | null
  onChange: (value: string | null) => void
  onClose: () => void
  minDate: string
  maxDate?: string | null
}) {
  const selected = parseDateKey(value)
  const [cursor, setCursor] = useState(() => selected ?? parseDateKey(minDate) ?? new Date())
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
  const todayAllowed = todayKey >= minDate && (!maxDate || todayKey <= maxDate)

  function isDisabled(key: string) {
    if (key < minDate) return true
    if (maxDate && key > maxDate) return true
    return false
  }

  return (
    <div className="check-pop check-date-pop" role="dialog" aria-label="Fecha del elemento">
      <div className="side-date-head">
        <button type="button" className="icon-close" aria-label="Mes anterior" onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button>
        <strong>{monthLabel}</strong>
        <button type="button" className="icon-close" aria-label="Mes siguiente" onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button>
      </div>
      <div className="side-date-week">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="side-date-grid">
        {cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} className="side-date-empty" />
          const key = toDateKey(new Date(year, month, day))
          const disabled = isDisabled(key)
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              className={[
                'side-date-day',
                key === selectedKey ? 'on' : '',
                key === todayKey ? 'today' : '',
                disabled ? 'disabled' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => {
                if (disabled) return
                onChange(key)
                onClose()
              }}
            >
              {day}
            </button>
          )
        })}
      </div>
      <div className="side-date-actions">
        <button type="button" className="ghost" onClick={() => { onChange(null); onClose() }}>Quitar fecha</button>
        <button
          type="button"
          className="ghost"
          disabled={!todayAllowed}
          onClick={() => {
            if (!todayAllowed) return
            onChange(todayKey)
            onClose()
          }}
        >
          Hoy
        </button>
      </div>
    </div>
  )
}

function SortableCheckItem({ item, editing, canEdit, members, cardDueDate, onToggle, onPatch, onRemove }: {
  item: ChecklistItem
  editing: boolean
  canEdit: boolean
  members: Person[]
  cardDueDate?: string | null
  onToggle: () => void
  onPatch: (patch: Record<string, unknown>) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !editing,
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickingPeople, setPickingPeople] = useState(false)
  const [pickingDate, setPickingDate] = useState(false)
  const assignees = item.assignees ?? []
  const minDate = toDateKey(new Date())

  function togglePerson(id: number) {
    const current = assignees.map((person) => person.id)
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    void onPatch({ assignee_ids: next })
  }

  return (
    <li
      ref={setNodeRef}
      className={[item.is_done ? 'done' : '', isDragging ? 'dragging' : ''].filter(Boolean).join(' ')}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {editing && (
        <button type="button" className="check-grip" aria-label="Reordenar" {...attributes} {...listeners}>
          <GripIcon />
        </button>
      )}
      <div className="check-main">
        <button
          type="button"
          className={`check-toggle${item.is_done ? ' on' : ''}`}
          disabled={!canEdit}
          aria-pressed={item.is_done}
          aria-label={item.is_done ? 'Marcar como pendiente' : 'Marcar como hecho'}
          onClick={onToggle}
        >
          {item.is_done ? <CheckOnIcon /> : <CheckOffIcon />}
        </button>
        <span className="check-body">{item.body}</span>
      </div>
      <div className="check-meta">
        <div className={`check-assignees${pickingPeople ? ' open' : ''}`}>
          <button
            type="button"
            className="check-faces"
            disabled={!editing}
            aria-label="Asignar miembros"
            aria-expanded={pickingPeople}
            onClick={() => {
              if (!editing) return
              setPickingPeople((open) => !open)
              setPickingDate(false)
              setMenuOpen(false)
            }}
          >
            {assignees.length === 0 ? (
              editing ? (
                <span className="check-add-face" aria-hidden="true">
                  <UserPlusIcon className="check-user-plus" />
                </span>
              ) : null
            ) : (
              assignees.map((person) => (
                <Avatar key={person.id} id={person.id} name={person.name} size={32} className="face" />
              ))
            )}
          </button>
          {pickingPeople && (
            <div className="check-pop people-pop">
              {members.map((person) => {
                const on = assignees.some((item) => item.id === person.id)
                return (
                  <button key={person.id} type="button" className={on ? 'on' : ''} onClick={() => togglePerson(person.id)}>
                    <Avatar id={person.id} name={person.name} size={28} className="face" />
                    <span>{person.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className={`check-date${pickingDate ? ' open' : ''}`}>
          {(editing || item.due_date) && (
            <button
              type="button"
              className="check-date-btn"
              disabled={!editing}
              aria-label="Fecha de vencimiento"
              aria-expanded={pickingDate}
              onClick={() => {
                if (!editing) return
                setPickingDate((open) => !open)
                setPickingPeople(false)
                setMenuOpen(false)
              }}
            >
              <span className="check-date-ico" aria-hidden="true"><CalendarIcon /></span>
              <span>{item.due_date ? formatDate(item.due_date) : 'Fecha'}</span>
            </button>
          )}
          {pickingDate && (
            <CheckItemDateMenu
              value={item.due_date}
              minDate={minDate}
              maxDate={cardDueDate}
              onChange={(due_date) => { void onPatch({ due_date }) }}
              onClose={() => setPickingDate(false)}
            />
          )}
        </div>
        {editing && (
          <div className={`check-menu${menuOpen ? ' open' : ''}`}>
            <button
              type="button"
              className="icon-close"
              aria-label="Más opciones"
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuOpen((open) => !open)
                setPickingPeople(false)
                setPickingDate(false)
              }}
            >
              <DotsIcon />
            </button>
            {menuOpen && (
              <div className="check-pop menu-pop">
                <button type="button" className="danger" onClick={() => { setMenuOpen(false); void onRemove() }}>
                  Eliminar elemento
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

function ChecklistPanel({ card, module, editing, canEdit, members, dragProps, onChange, onRemove }: {
  card: Card
  module: CardModule
  editing: boolean
  canEdit: boolean
  members: Person[]
  dragProps?: Record<string, unknown>
  onChange: () => Promise<void>
  onRemove?: () => Promise<void>
}) {
  const checklist = useMemo(
    () => [...(module.checklist ?? [])].sort((a, b) => a.position - b.position),
    [module.checklist],
  )
  const progress = module.progress
  const done = progress?.done ?? checklist.filter((item) => item.is_done).length
  const total = progress?.total ?? checklist.length
  const [adding, setAdding] = useState(false)
  const [checkBody, setCheckBody] = useState('')
  const [items, setItems] = useState(checklist)
  const [collapsed, setCollapsed] = useState(false)
  const [title, setTitle] = useState(module.title || 'Checklist')
  const [renaming, setRenaming] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    setItems(checklist)
  }, [checklist])

  useEffect(() => {
    setTitle(module.title || 'Checklist')
  }, [module.title])

  useEffect(() => {
    if (!renaming) return
    const id = window.setTimeout(() => {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }, 0)
    return () => window.clearTimeout(id)
  }, [renaming])

  async function saveTitle() {
    const next = title.trim() || 'Checklist'
    setTitle(next)
    setRenaming(false)
    if (next === (module.title || 'Checklist')) return
    await api(`/modules/${module.id}`, { method: 'PATCH', body: JSON.stringify({ title: next }) })
    await onChange()
  }

  async function addCheckItem(event: FormEvent) {
    event.preventDefault()
    if (!checkBody.trim()) return
    await api(`/cards/${card.id}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ body: checkBody.trim(), module_id: module.id }),
    })
    setCheckBody('')
    setAdding(false)
    await onChange()
  }

  async function patchItem(id: number, patch: Record<string, unknown>) {
    await api(`/checklist/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    await onChange()
  }

  async function removeItem(id: number) {
    await api(`/checklist/${id}`, { method: 'DELETE' })
    await onChange()
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(items, oldIndex, newIndex).map((item, index) => ({ ...item, position: index + 1 }))
    setItems(next)
    await api(`/cards/${card.id}/checklist/reorder`, {
      method: 'POST',
      body: JSON.stringify({ module_id: module.id, ordered_ids: next.map((item) => item.id) }),
    })
    await onChange()
  }

  return (
    <section className={`card-modal-section checklist${collapsed ? ' is-collapsed' : ''}`}>
      <div className={`section-head checklist-head${dragProps ? ' is-module-drag' : ''}`} {...dragProps}>
        <h3>
          <SectionToggle
            icon={<ChecklistIcon />}
            label={title}
            collapsed={collapsed}
            onToggle={() => setCollapsed((open) => !open)}
          />
          {renaming ? (
            <input
              ref={titleInputRef}
              className="module-title-input"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => { void saveTitle() }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void saveTitle()
                }
                if (event.key === 'Escape') {
                  setTitle(module.title || 'Checklist')
                  setRenaming(false)
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="module-title-btn"
              disabled={!editing}
              onClick={() => editing && setRenaming(true)}
            >
              {title}
            </button>
          )}
          {' '}
          {editing && (
            <span className="checklist-progress">({done}/{total})</span>
          )}
        </h3>
        {!editing && total > 0 && (
          <div className="checklist-meter">
            <span className="checklist-meter-count">{done}/{total}</span>
            <div
              className="checklist-bar"
              role="progressbar"
              aria-label="Progreso del checklist"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
              title={`${done} de ${total} completados`}
            >
              <span style={{ width: `${Math.round((done / total) * 100)}%` }} />
            </div>
          </div>
        )}
        {editing && (
          <div className="module-head-actions">
            <button type="button" className="ghost check-add-btn" onClick={() => setAdding((open) => !open)}>
              <PlusIcon className="plus-icon" /> Añadir elemento
            </button>
            {onRemove && (
              <button
                type="button"
                className="ghost icon-btn module-remove-btn"
                aria-label="Eliminar módulo"
                title="Eliminar módulo"
                onClick={() => { void onRemove() }}
              >
                <TrashIcon />
              </button>
            )}
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <ul className="check-list">
                {items.map((item) => (
                  <SortableCheckItem
                    key={item.id}
                    item={item}
                    editing={editing}
                    canEdit={canEdit}
                    members={members}
                    cardDueDate={card.due_date}
                    onToggle={() => { void patchItem(item.id, { is_done: !item.is_done }) }}
                    onPatch={(patch) => patchItem(item.id, patch)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          {editing && adding && (
            <form className="check-add" onSubmit={addCheckItem}>
              <input
                autoFocus
                id={`check-add-${module.id}`}
                value={checkBody}
                onChange={(event) => setCheckBody(event.target.value)}
                placeholder="Nuevo elemento"
                maxLength={240}
              />
              <button className="primary" type="submit" disabled={!checkBody.trim()}>Añadir</button>
              <button className="ghost" type="button" onClick={() => { setAdding(false); setCheckBody('') }}>Cancelar</button>
            </form>
          )}
        </>
      )}
    </section>
  )
}

function FilesPanel({ card, editing, canEdit, dragProps, onChange, onRemove }: {
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

function SortableModuleShell({ id, disabled, children }: {
  id: number
  disabled?: boolean
  children: (drag?: Record<string, unknown>) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={`module-shell${isDragging ? ' dragging' : ''}`}>
      {children(disabled ? undefined : { ...attributes, ...listeners })}
    </div>
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
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [comments, setComments] = useState<Comment[]>(card.comments ?? [])
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const replyInputRef = useRef<HTMLTextAreaElement>(null)
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description ?? '')
  const [saving, setSaving] = useState(false)
  const [pickingAssignees, setPickingAssignees] = useState(false)
  const [pickingLabels, setPickingLabels] = useState(false)
  const [pickingTeams, setPickingTeams] = useState(false)
  const [visibilityOpen, setVisibilityOpen] = useState(false)
  const [descCollapsed, setDescCollapsed] = useState(false)
  const [commentsCollapsed, setCommentsCollapsed] = useState(false)
  const [modules, setModules] = useState<CardModule[]>(() => [...(card.modules ?? [])].sort((a, b) => a.position - b.position))
  const [addModuleOpen, setAddModuleOpen] = useState(false)
  const modulesCreatedInEdit = useRef<number[]>([])
  const colorInputRef = useRef<HTMLInputElement>(null)
  const editing = mode === 'edit' && canEdit
  const team = board.members.filter((member) => member.role !== 'cliente')
  const columnName = board.columns.find((column) => column.id === card.column_id)?.name ?? '—'
  const categoryName = board.categories?.find((category) => category.id === card.category_id)?.name
  const commentCount = comments.length
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
                                    onClick={() => { void removeModule(module.id) }}
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
              <span className="side-label"><CalendarIcon /> Fecha de vencimiento</span>
              {editing ? (
                <SideDatePicker
                  value={card.due_date}
                  onChange={(next) => save({ due_date: next })}
                />
              ) : (
                <div className="side-value"><strong>{formatDateLong(card.due_date)}</strong></div>
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

