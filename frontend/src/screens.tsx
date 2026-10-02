import { type FormEvent, type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'

import { DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, horizontalListSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api, setToken, uploadFile, type Attachment, type BoardCategory, type BoardPayload, type Card, type CardModule, type CardModuleType, type ChecklistItem, type Comment, type CommentReactionType, type Person, type Profile, type Project } from './api'

const priorityLabel = { baja: 'Baja', media: 'Media', alta: 'Alta', urgente: 'Urgente', } satisfies Record<NonNullable<Card['priority']>, string>
const DEFAULT_CARD_STRIPE = '#147a5f'

function cardStripeStyle(color?: string | null): CSSProperties {
  return { ['--card-stripe' as string]: color || DEFAULT_CARD_STRIPE }
}
const projectDots = ['#147a5f', '#52cbb0', '#6a4b12', '#6e3a52', '#0f6e62']

type OpenTab = { boardId: number; projectId: number; title: string }

function NavIcon({ children }: { children: ReactNode }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">{children}</svg>
}

function DotsIcon() {
  return (
    <svg className="dots" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M320 208C289.1 208 264 182.9 264 152C264 121.1 289.1 96 320 96C350.9 96 376 121.1 376 152C376 182.9 350.9 208 320 208zM320 432C350.9 432 376 457.1 376 488C376 518.9 350.9 544 320 544C289.1 544 264 518.9 264 488C264 457.1 289.1 432 320 432zM376 320C376 350.9 350.9 376 320 376C289.1 376 264 350.9 264 320C264 289.1 289.1 264 320 264C350.9 264 376 289.1 376 320z" />
    </svg>
  )
}

function CollapseColumnIcon() {
  return (
    <svg
      className="collapse-column-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 12 L12 12" />
      <path d="m19 9-3 3 3 3" />
      <path d="M2 12h6" />
      <path d="M22 12h-6" />
      <path d="m5 15 3-3-3-3" />
    </svg>
  )
}

function ExpandColumnIcon() {
  return (
    <svg
      className="collapse-column-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 12 L12 12" />
      <path d="M19 9 L22 12" />
      <path d="M2 12 L5 9" />
      <path d="M2 12 L8 12" />
      <path d="M22 12 L16 12" />
      <path d="M22 12 L19 15" />
      <path d="M5 15 L2 12" />
    </svg>
  )
}

function PlusIcon({ className = 'plus-icon' }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M352 128C352 110.3 337.7 96 320 96C302.3 96 288 110.3 288 128L288 288L128 288C110.3 288 96 302.3 96 320C96 337.7 110.3 352 128 352L288 352L288 512C288 529.7 302.3 544 320 544C337.7 544 352 529.7 352 512L352 352L512 352C529.7 352 544 337.7 544 320C544 302.3 529.7 288 512 288L352 288L352 128z" />
    </svg>
  )
}

function UserPlusIcon({ className = 'plus-icon' }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M285.7 368C384.2 368 464 447.8 464 546.3C464 562.7 450.7 576 434.3 576L77.7 576C61.3 576 48 562.7 48 546.3C48 447.8 127.8 368 226.3 368L285.7 368zM528 144C541.3 144 552 154.7 552 168L552 216L600 216C613.3 216 624 226.7 624 240C624 253.3 613.3 264 600 264L552 264L552 312C552 325.3 541.3 336 528 336C514.7 336 504 325.3 504 312L504 264L456 264C442.7 264 432 253.3 432 240C432 226.7 442.7 216 456 216L504 216L504 168C504 154.7 514.7 144 528 144zM256 312C189.7 312 136 258.3 136 192C136 125.7 189.7 72 256 72C322.3 72 376 125.7 376 192C376 258.3 322.3 312 256 312z" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z" />
    </svg>
  )
}

function ConfigIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M541.4 162.6C549 155 561.7 156.9 565.5 166.9C572.3 184.6 576 203.9 576 224C576 312.4 504.4 384 416 384C398.5 384 381.6 381.2 365.8 376L178.9 562.9C150.8 591 105.2 591 77.1 562.9C49 534.8 49 489.2 77.1 461.1L264 274.2C258.8 258.4 256 241.6 256 224C256 135.6 327.6 64 416 64C436.1 64 455.4 67.7 473.1 74.5C483.1 78.3 484.9 91 477.4 98.6L388.7 187.3C385.7 190.3 384 194.4 384 198.6L384 240C384 248.8 391.2 256 400 256L441.4 256C445.6 256 449.7 254.3 452.7 251.3L541.4 162.6z"/>
    </svg>
  )
}

function PencilIcon({ className = 'menu-icon' }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z" />
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M160 96C124.7 96 96 124.7 96 160L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 237.3C544 220.3 537.3 204 525.3 192L448 114.7C436 102.7 419.7 96 402.7 96L160 96zM192 192C192 174.3 206.3 160 224 160L384 160C401.7 160 416 174.3 416 192L416 256C416 273.7 401.7 288 384 288L224 288C206.3 288 192 273.7 192 256L192 192zM320 352C355.3 352 384 380.7 384 416C384 451.3 355.3 480 320 480C284.7 480 256 451.3 256 416C256 380.7 284.7 352 320 352z" />
    </svg>
  )
}

function FloppyIcon() {
  return (
    <svg className="btn-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
      <path d="M7 3v4a1 1 0 0 0 1 1h7" />
    </svg>
  )
}

function PaletteIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M576 320C576 320.9 576 321.8 576 322.7C575.6 359.2 542.4 384 505.9 384L408 384C381.5 384 360 405.5 360 432C360 435.4 360.4 438.7 361 441.9C363.1 452.1 367.5 461.9 371.8 471.8C377.9 485.6 383.9 499.3 383.9 513.8C383.9 545.6 362.3 574.5 330.5 575.8C327 575.9 323.5 576 319.9 576C178.5 576 63.9 461.4 63.9 320C63.9 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320zM192 352C192 334.3 177.7 320 160 320C142.3 320 128 334.3 128 352C128 369.7 142.3 384 160 384C177.7 384 192 369.7 192 352zM192 256C209.7 256 224 241.7 224 224C224 206.3 209.7 192 192 192C174.3 192 160 206.3 160 224C160 241.7 174.3 256 192 256zM352 160C352 142.3 337.7 128 320 128C302.3 128 288 142.3 288 160C288 177.7 302.3 192 320 192C337.7 192 352 177.7 352 160zM448 256C465.7 256 480 241.7 480 224C480 206.3 465.7 192 448 192C430.3 192 416 206.3 416 224C416 241.7 430.3 256 448 256z" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M160 96C160 78.3 174.3 64 192 64L448 64C465.7 64 480 78.3 480 96C480 113.7 465.7 128 448 128L418.5 128L428.8 262.1C465.9 283.3 494.6 318.5 507 361.8L510.8 375.2C513.6 384.9 511.6 395.2 505.6 403.3C499.6 411.4 490 416 480 416L160 416C150 416 140.5 411.3 134.5 403.3C128.5 395.3 126.5 384.9 129.3 375.2L133 361.8C145.4 318.5 174 283.3 211.2 262.1L221.5 128L192 128C174.3 128 160 113.7 160 96zM288 464L352 464L352 576C352 593.7 337.7 608 320 608C302.3 608 288 593.7 288 576L288 464z" />
    </svg>
  )
}

function UnpinIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M73 39.1C63.6 29.7 48.4 29.7 39.1 39.1C29.8 48.5 29.7 63.7 39 73.1L567 601.1C576.4 610.5 591.6 610.5 600.9 601.1C610.2 591.7 610.3 576.5 600.9 567.2L449.8 416L480 416C490 416 499.5 411.3 505.5 403.3C511.5 395.3 513.5 384.9 510.7 375.2L507 361.8C494.6 318.5 466 283.3 428.8 262.1L418.5 128L448 128C465.7 128 480 113.7 480 96C480 78.3 465.7 64 448 64L192 64C184.6 64 177.9 66.5 172.5 70.6L222.1 120.3L217.3 183.4L73 39.1zM314.2 416L181.7 283.6C159 304.1 141.9 331 133 361.9L129.2 375.3C126.4 385 128.4 395.3 134.4 403.4C140.4 411.5 150 416 160 416L314.2 416zM288 576C288 593.7 302.3 608 320 608C337.7 608 352 593.7 352 576L352 464L288 464L288 576z" />
    </svg>
  )
}

function VisibilityIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M320 96C239.2 96 174.5 132.8 127.4 176.6C80.6 220.1 49.3 272 34.4 307.7C31.1 315.6 31.1 324.4 34.4 332.3C49.3 368 80.6 420 127.4 463.4C174.5 507.1 239.2 544 320 544C400.8 544 465.5 507.2 512.6 463.4C559.4 419.9 590.7 368 605.6 332.3C608.9 324.4 608.9 315.6 605.6 307.7C590.7 272 559.4 220 512.6 176.6C465.5 132.9 400.8 96 320 96zM176 320C176 240.5 240.5 176 320 176C399.5 176 464 240.5 464 320C464 399.5 399.5 464 320 464C240.5 464 176 399.5 176 320zM320 256C320 291.3 291.3 320 256 320C244.5 320 233.7 317 224.3 311.6C223.3 322.5 224.2 333.7 227.2 344.8C240.9 396 293.6 426.4 344.8 412.7C396 399 426.4 346.3 412.7 295.1C400.5 249.4 357.2 220.3 311.6 224.3C316.9 233.6 320 244.4 320 256z" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg className="minus-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M96 320C96 302.3 110.3 288 128 288L512 288C529.7 288 544 302.3 544 320C544 337.7 529.7 352 512 352L128 352C110.3 352 96 337.7 96 320z" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg className="chevron-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M297.4 470.6C309.9 483.1 330.2 483.1 342.7 470.6L534.7 278.6C547.2 266.1 547.2 245.8 534.7 233.3C522.2 220.8 501.9 220.8 489.4 233.3L320 402.7L150.6 233.4C138.1 220.9 117.8 220.9 105.3 233.4C92.8 245.9 92.8 266.2 105.3 278.7L297.3 470.7z" />
    </svg>
  )
}

function ArchiveIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M64 128C64 110.3 78.3 96 96 96L544 96C561.7 96 576 110.3 576 128L576 160C576 177.7 561.7 192 544 192L96 192C78.3 192 64 177.7 64 160L64 128zM96 240L544 240L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 240zM248 304C234.7 304 224 314.7 224 328C224 341.3 234.7 352 248 352L392 352C405.3 352 416 341.3 416 328C416 314.7 405.3 304 392 304L248 304z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M232.7 69.9C237.1 56.7 249.6 48 263.5 48L376.5 48C390.4 48 402.9 56.7 407.3 69.9L416 96L512 96C529.7 96 544 110.3 544 128C544 145.7 529.7 160 512 160L128 160C110.3 160 96 145.7 96 128C96 110.3 110.3 96 128 96L224 96L232.7 69.9zM128 208L512 208L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 208zM216 272C202.7 272 192 282.7 192 296L192 488C192 501.3 202.7 512 216 512C229.3 512 240 501.3 240 488L240 296C240 282.7 229.3 272 216 272zM320 272C306.7 272 296 282.7 296 296L296 488C296 501.3 306.7 512 320 512C333.3 512 344 501.3 344 488L344 296C344 282.7 333.3 272 320 272zM424 272C410.7 272 400 282.7 400 296L400 488C400 501.3 410.7 512 424 512C437.3 512 448 501.3 448 488L448 296C448 282.7 437.3 272 424 272z" />
    </svg>
  )
}

function AccountIco({ children }: { children: ReactNode }) {
  return (
    <svg className="account-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

function ProfileUserIcon() {
  return (
    <AccountIco>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </AccountIco>
  )
}

function SettingsIcon() {
  return (
    <AccountIco>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </AccountIco>
  )
}



function BellIcon() {
  return (
    <AccountIco>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </AccountIco>
  )
}

function MoonIcon() {
  return (
    <AccountIco>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </AccountIco>
  )
}

function SunIcon() {
  return (
    <AccountIco>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </AccountIco>
  )
}

function ComputerIcon() {
  return (
    <svg className="account-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M128 96C92.7 96 64 124.7 64 160L64 416C64 451.3 92.7 480 128 480L272 480L256 528L184 528C170.7 528 160 538.7 160 552C160 565.3 170.7 576 184 576L456 576C469.3 576 480 565.3 480 552C480 538.7 469.3 528 456 528L384 528L368 480L512 480C547.3 480 576 451.3 576 416L576 160C576 124.7 547.3 96 512 96L128 96zM160 160L480 160C497.7 160 512 174.3 512 192L512 352C512 369.7 497.7 384 480 384L160 384C142.3 384 128 369.7 128 352L128 192C128 174.3 142.3 160 160 160z" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <AccountIco>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </AccountIco>
  )
}

function HelpCircleIcon() {
  return (
    <AccountIco>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </AccountIco>
  )
}

function SparklesIcon() {
  return (
    <AccountIco>
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
    </AccountIco>
  )
}

function LogoutIcon() {
  return (
    <AccountIco>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </AccountIco>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="account-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

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

export function Login() {
  const [email, setEmail] = useState('ana@gestor.test')
  const [password, setPassword] = useState('password')
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const result = await api<{ token: string; user: Profile }>('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setToken(result.token)
      window.location.href = '/'
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo entrar.')
    }
  }

  return (
    <main className="login">
      <form onSubmit={submit}>
        <div className="brand"><img src="/logo-removebg.png" alt="tickard" /></div>
        <p>Entra con el correo de tu empresa.</p>
        <label className="field">Correo<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></label>
        <label className="field">Contraseña<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit">Entrar</button>
      </form>
    </main>
  )
}

export function Invite({ token }: { token: string }) {
  const [info, setInfo] = useState<{ project: string; client: string; email: string } | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ project: string; client: string; email: string; name?: string }>(`/invitations/${token}`)
      .then((data) => {
        setInfo(data)
        setName(data.name ?? '')
      })
      .catch(() => setError('Esta invitación ya no está disponible.'))
  }, [token])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const result = await api<{ token: string }>(`/invitations/${token}/accept`, {
      method: 'POST',
      body: JSON.stringify({ name, password }),
    })
    setToken(result.token)
    window.location.href = '/'
  }

  return (
    <main className="login">
      <form onSubmit={submit}>
        <h1>Aceptar invitación</h1>
        {info && <p>{info.project} · {info.client}</p>}
        <label className="field">Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="field">Contraseña<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit">Crear acceso</button>
      </form>
    </main>
  )
}

export function Workspace() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const openRef = useRef<number | null>(null)
  const [board, setBoard] = useState<BoardPayload | null>(null)
  const [selected, setSelected] = useState<{ card: Card; mode: 'view' | 'edit' } | null>(null)
  const [showProject, setShowProject] = useState(false)
  const [notes, setNotes] = useState<{ id: number; body: string }[]>([])
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountModal, setAccountModal] = useState<'profile' | 'settings' | 'notifications' | null>(null)
  const accountRef = useRef<HTMLDivElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [createColumn, setCreateColumn] = useState<{ id: number; name: string } | null>(null)
  const [newProject, setNewProject] = useState(false)
  const [projectMenu, setProjectMenu] = useState<number | null>(null)
  const [boardMenu, setBoardMenu] = useState<number | null>(null)
  const [namingBoard, setNamingBoard] = useState(false)
  const [boardName, setBoardName] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [assignee, setAssignee] = useState('')
  const [teamId, setTeamId] = useState('')
  const [personal, setPersonal] = useState<'departments' | 'teams' | 'clients' | null>(null)
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [label, setLabel] = useState('')
  const [priority, setPriority] = useState('')
  const [showCategories, setShowCategories] = useState(false)
  const [sideMini, setSideMini] = useState(() => {
    try {
      return localStorage.getItem('gestor:side-mini') === '1'
    } catch {
      return false
    }
  })
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [deleteProjectConfirmation, setDeleteProjectConfirmation] = useState('')
  const [boardToDelete, setBoardToDelete] = useState<{id: number; name: string} | null>(null)
  const [deleteBoardConfirmation, setDeleteBoardConfirmation] = useState('')

  function toggleSideMini() {
    setSideMini((current) => {
      const next = !current
      try {
        localStorage.setItem('gestor:side-mini', next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  async function loadProfile() {
    const data = await api<Profile>('/me')
    setProfile(data)
    document.documentElement.dataset.theme = resolveTheme(data.user.theme)
    return data
  }

  function chooseBoard(id: number | null) {
    openRef.current = id
    setOpenId(id)
  }

  async function loadBoard(id: number) {
    const data = await api<BoardPayload>(`/boards/${id}`)
    if (openRef.current !== id) return data
    setBoard(data)
    setSelected((current) => {
      if (!current) return null
      const next = data.columns.flatMap((column) => column.cards).find((card) => card.id === current.card.id)
      return next ? { card: next, mode: current.mode } : null
    })
    return data
  }

  useEffect(() => {
    loadProfile().then((data) => {
      const first = data.projects[0]
      const boardId = first?.boards[0]?.id ?? null
      if (first && boardId) {
        setTabs([{ boardId, projectId: first.id, title: first.boards[0].name }])
        chooseBoard(boardId)
        loadBoard(boardId)
      }
    }).catch(() => {
      setToken(null)
      window.location.href = '/login'
    })
  }, [])

  useEffect(() => {
    if (!profile || profile.user.theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    function sync() {
      document.documentElement.dataset.theme = resolveTheme('system')
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [profile?.user.theme])

  useEffect(() => {
    if (!accountOpen) return
    function close(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [accountOpen])

  useEffect(() => {
    if (projectMenu === null && boardMenu === null) return
    function close(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setProjectMenu(null)
        setBoardMenu(null)
        setNamingBoard(false)
        setBoardName('')
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [projectMenu, boardMenu])

  useEffect(() => {
    if (!openId) return
    const timer = window.setInterval(() => {
      api<BoardPayload>(`/boards/${openId}`).then((data) => {
        if (openRef.current !== openId || data.board.id !== openId) return
        setBoard((current) => {
          if (current && current.board.id === openId && data.revision <= current.revision) return current
          return data
        })
      }).catch(() => undefined)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [openId])

  function openBoardTab(item: Project, boardRef: { id: number; name: string }) {
    setTabs((current) => current.some((tab) => tab.boardId === boardRef.id)
      ? current
      : [...current, { boardId: boardRef.id, projectId: item.id, title: boardRef.name }])
    chooseBoard(boardRef.id)
    setAssignee('')
    setTeamId('')
    setSelected(null)
    loadBoard(boardRef.id)
  }

  function focusProject(item: Project) {
    const boardRef = item.boards[0]
    if (!boardRef) return
    openBoardTab(item, boardRef)
  }

  async function manageProject(item: Project) {
    setProjectMenu(null)
    setBoardMenu(null)
    setNamingBoard(false)
    const boardRef = item.boards.find((entry) => entry.id === openId) ?? item.boards[0]
    if (!boardRef) return
    if (openId !== boardRef.id) openBoardTab(item, boardRef)
    setShowProject(true)
  }

  async function manageBoardCategories(item: Project, boardRef: { id: number; name: string }) {
    setProjectMenu(null)
    setBoardMenu(null)
    if (openId !== boardRef.id) openBoardTab(item, boardRef)
    await loadBoard(boardRef.id)
    setShowCategories(true)
  }

  async function createBoard(event: FormEvent, item: Project) {
    event.preventDefault()
    const name = boardName.trim()
    if (!name) return
    const created = await api<{ id: number; name: string }>(`/projects/${item.id}/boards`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    await loadProfile()
    setProjectMenu(null)
    setNamingBoard(false)
    setBoardName('')
    openBoardTab(item, created)
  }

  async function deleteBoard(boardId: number, confirmationName: string) {
    await api(`/boards/${boardId}`, { 
      method: 'DELETE', 
      body: JSON.stringify({ confirmation_name: confirmationName })
    })

    setBoardToDelete(null)
    setDeleteBoardConfirmation('')
    await loadProfile()
    setBoardMenu(null)
    setNamingBoard(false)
    setBoardName('')
    closeTab(boardId)
  }

  function closeTab(boardId: number) {
    const next = tabs.filter((tab) => tab.boardId !== boardId)
    setTabs(next)
    if (openId !== boardId) return
    const fallback = next.at(-1)?.boardId ?? null
    chooseBoard(fallback)
    setSelected(null)
    if (fallback) loadBoard(fallback)
    else setBoard(null)
  }

  const project = profile?.projects.find((item) => item.boards.some((itemBoard) => itemBoard.id === openId))
  const view = board && board.board.id === openId ? board : null
  const canEdit = view?.role === 'responsable' || view?.role === 'editor'
  const canManage = view?.role === 'responsable'
  const clientView = view?.role === 'cliente'
  const openCard = selected && view
    ? view.columns.flatMap((column) => column.cards).find((card) => card.id === selected.card.id) ?? selected.card
    : selected?.card ?? null

  async function move(cardId: number, columnId: number, position: number) {
    setBoard((current) => {
      if (!current) return current
      const card = current.columns.flatMap((column) => column.cards).find((item) => item.id === cardId)
      if (!card) return current
      const categories = current.categories ?? []
      const columns = current.columns.map((column) => ({
        ...column,
        cards: column.cards.filter((item) => item.id !== cardId),
      }))
      const target = columns.find((column) => column.id === columnId)
      if (!target) return current
      const visual = orderedColumnCards(target, categories)
      const next = [...visual]
      next.splice(Math.min(position, next.length), 0, { ...card, column_id: columnId })
      return {
        ...current,
        columns: columns.map((column) => column.id === columnId
          ? { ...column, cards: next.map((item, index) => ({ ...item, position: index })) }
          : column),
      }
    })
    try {
      await api(`/cards/${cardId}/move`, { method: 'POST', body: JSON.stringify({ column_id: columnId, position }) })
      if (openId) await loadBoard(openId)
    } catch {
      if (openId) await loadBoard(openId)
    }
  }

  async function moveColumn(columnId: number, position: number) {
    setBoard((current) => {
      if (!current) return current
      const ordered = [...current.columns].sort((a, b) => a.position - b.position)
      const moving = ordered.find((column) => column.id === columnId)
      if (!moving) return current
      const rest = ordered.filter((column) => column.id !== columnId)
      rest.splice(Math.min(position, rest.length), 0, moving)
      return {
        ...current,
        columns: rest.map((column, index) => ({ ...column, position: index })),
      }
    })
    try {
      await api(`/columns/${columnId}/move`, { method: 'POST', body: JSON.stringify({ position }) })
      if (openId) await loadBoard(openId)
    } catch {
      if (openId) await loadBoard(openId)
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    const clientName = String(form.get('client_name') || '').trim()
    if (!name || !clientName) return
    const created = await api<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, client_name: clientName }),
    })
    const data = await loadProfile()
    setNewProject(false)
    const owner = data.projects.find((item) => item.id === created.id) ?? created
    const boardRef = owner.boards[0]
    if (boardRef) openBoardTab(owner, boardRef)
  }

  async function deleteProject(projectId: number, confirmationName: string) {
    await api(`/projects/${projectId}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmation_name: confirmationName })
    })
    setProjectToDelete(null)
    setDeleteProjectConfirmation('')
    
    const data = await loadProfile()
    const remainigTabs = tabs.filter((tab) => tab.projectId !== projectId)
    setTabs(remainigTabs)
    if (project?.id === projectId) {
      const fallback = remainigTabs.at(-1)?.boardId 
        ?? data.projects.at(-1)?.boards.at(0)?.id 
        ?? null
      chooseBoard(fallback)
      setSelected(null)
      if (fallback) await loadBoard(fallback)
      else setBoard(null)
    }

    setProjectMenu(null)
  }

  if (!profile) return <main className="login"><p>Cargando…</p></main>

  const filtersActive = Boolean(assignee || teamId || label || priority)
  const backlog = view?.columns.find((column) => column.name === 'Backlog') ?? view?.columns[0]

  async function openAccount() {
    setAccountOpen(true)
    const items = await api<{ id: number; body: string }[]>('/notifications')
    setNotes(items)
  }

  function openAccountModal(section: 'profile' | 'settings' | 'notifications') {
    setAccountOpen(false)
    setAccountModal(section)
  }

  async function openNotificationsModal() {
    setAccountOpen(false)
    setAccountModal('notifications')
    const items = await api<{ id: number; body: string }[]>('/notifications')
    setNotes(items)
    if (profile && profile.unread > 0) {
      await api('/notifications/read', { method: 'POST' })
      setProfile({ ...profile, unread: 0 })
    }
  }

  async function changeAvatar(file: File) {
    const next = await uploadFile<Profile>('/me/avatar', file, 'avatar')
    setProfile(next)
  }

  return (
    <div className={`frame${sideMini ? ' is-side-mini' : ''}`}>
      <header className="topbar">
        <aside className="side">
          <div className="brand"><img src="/logo-removebg.png" alt="tickard" /></div>
        </aside>
        <div className="top-main">
          <div className="top-half">
            <label className="search">
              <NavIcon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></NavIcon>
              <input value={query} placeholder="Buscar tareas, proyectos..." onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>
          <div className="top-half profile">
            <div className="account" ref={accountRef}>
              <button
                className={`avatar-button${accountOpen ? ' on' : ''}`}
                type="button"
                aria-expanded={accountOpen}
                aria-label="Cuenta"
                onClick={() => {
                  if (accountOpen) {
                    setAccountOpen(false)
                  } else {
                    void openAccount()
                  }
                }}
              >
                <Avatar id={profile.user.id} name={profile.user.name} size={80} className="avatar" src={profile.user.avatar_url} />
                {profile.unread > 0 && <i className="badge">{profile.unread}</i>}
              </button>
              {accountOpen && (
                <div className="account-menu">
                  <div className="account-head">
                    <button
                      type="button"
                      className="account-avatar"
                      aria-label="Cambiar foto de perfil"
                      title="Cambiar foto de perfil"
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <Avatar id={profile.user.id} name={profile.user.name} size={52} className="avatar" src={profile.user.avatar_url} />
                      <span className="account-avatar-edit">
                        <PencilIcon className="account-avatar-pencil" />
                      </span>
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (file) void changeAvatar(file)
                      }}
                    />
                    <div className="account-head-text">
                      <strong>{profile.user.name}</strong>
                      <span>{profile.user.email}</span>
                      {profile.user.is_admin
                        ? <em className="account-plan">Administrador</em>
                        : profile.user.client_company
                          ? <em className="account-plan">Cliente</em>
                          : <em className="account-plan">Miembro</em>}
                    </div>
                  </div>

                  <div className="account-section">
                    <button type="button" className="account-item" onClick={() => openAccountModal('profile')}>
                      <ProfileUserIcon /> Mi perfil
                    </button>
                    <button type="button" className="account-item" onClick={() => openAccountModal('settings')}>
                      <SettingsIcon /> Configuración
                    </button>
                    <button type="button" className="account-item" onClick={() => { void openNotificationsModal() }}>
                      <BellIcon /> Notificaciones
                      {profile.unread > 0 && <i className="account-badge">{profile.unread}</i>}
                    </button>
                    <button type="button" className="account-item" disabled>
                      <GlobeIcon /> Idioma
                      <span className="account-meta">Español</span>
                    </button>
                  </div>

                  <div className="account-section">
                    <button type="button" className="account-item" disabled>
                      <HelpCircleIcon /> Ayuda y soporte
                    </button>
                    <button type="button" className="account-item" disabled>
                      <SparklesIcon /> Novedades
                    </button>
                  </div>

                  <div className="account-section">
                    <button
                      type="button"
                      className="account-item danger"
                      onClick={async () => {
                        await api('/logout', { method: 'POST' })
                        setToken(null)
                        window.location.href = '/login'
                      }}
                    >
                      <LogoutIcon /> Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      {accountModal && (
        <AccountModal
          section={accountModal}
          profile={profile}
          notes={notes}
          onSection={setAccountModal}
          onProfile={setProfile}
          onNotes={setNotes}
          onClose={() => setAccountModal(null)}
          onAvatar={changeAvatar}
        />
      )}
      <div className="body">
      <aside className={`side${sideMini ? ' is-mini' : ''}`}>
        <div className="side-tools">
          <button
            className="side-toggle"
            type="button"
            aria-label={sideMini ? 'Maximizar panel' : 'Minimizar panel'}
            title={sideMini ? 'Maximizar panel' : 'Minimizar panel'}
            aria-pressed={sideMini}
            onClick={toggleSideMini}
          >
            <NavIcon>
              {sideMini ? (
                <>
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                  <path d="m14 9 3 3-3 3" />
                </>
              ) : (
                <>
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                  <path d="m16 15-3-3 3-3" />
                </>
              )}
            </NavIcon>
          </button>
        </div>
        <nav className="nav">
          <button className="nav-item" type="button" title="Inicio" onClick={() => { setAssignee(''); setTeamId(''); setPersonal(null) }}>
            <NavIcon><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" /></NavIcon>
            <span className="side-label-text">Inicio</span>
          </button>
          {view?.role !== 'cliente' && (
            <button
              className={assignee === String(profile.user.id) ? 'nav-item on' : 'nav-item'}
              type="button"
              title="Mis tareas"
              onClick={() => { setAssignee(String(profile.user.id)); setTeamId(''); setPersonal(null); setShowFilters(true) }}
            >
              <NavIcon>
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
                <path d="M14 4h7" />
                <path d="M14 9h7" />
                <path d="M14 15h7" />
                <path d="M14 20h7" />
              </NavIcon>
              <span className="side-label-text">Mis tareas</span>
            </button>
          )}
          <p className="kicker kicker-icon" title="Tableros">
            <NavIcon>
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M8 7v7"/>
              <path d="M12 7v4"/>
              <path d="M16 7v9"/>
            </NavIcon>
            <span className="side-label-text">Tableros</span>
          </p>
          <button
            className={!assignee && !personal ? 'nav-item sub on' : 'nav-item sub'}
            type="button"
            title="Tablero"
            onClick={() => { setPersonal(null); setAssignee(''); setTeamId('') }}
          >
            <NavIcon>
              <path d="M5 3v14" />
              <path d="M12 3v8" />
              <path d="M19 3v18" />
            </NavIcon>
            <span className="side-label-text">Tablero</span>
          </button>
          {profile.user.is_admin && (
            <>
              <p className="kicker kicker-icon" title="Personal">
                <NavIcon>
                  <path d="M17 21v-1a2 2 0 00-2-2H9a2 2 0 00-2 2v1"/>
                  <path d="M19 10h1a2 2 0 012 2v1"/>
                  <path d="M5 10H4a2 2 0 00-2 2v1"/>
                  <circle cx="12" cy="11" r="3"/>
                  <circle cx="18" cy="4" r="2"/>
                  <circle cx="6" cy="4" r="2"/>
                </NavIcon>
                <span className="side-label-text">Personal</span>
              </p>
              <button className={personal === 'departments' ? 'nav-item sub on' : 'nav-item sub'} type="button" title="Departamentos" onClick={() => setPersonal('departments')}>
                <NavIcon>
                  <path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/>
                  <path d="m7 16.5-4.74-2.85"/>
                  <path d="m7 16.5 5-3"/>
                  <path d="M7 16.5v5.17"/>
                  <path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/>
                  <path d="m17 16.5-5-3"/>
                  <path d="m17 16.5 4.74-2.85"/>
                  <path d="M17 16.5v5.17"/>
                  <path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/>
                  <path d="M12 8 7.26 5.15"/>
                  <path d="m12 8 4.74-2.85"/>
                  <path d="M12 13.5V8"/>
                </NavIcon>
                <span className="side-label-text">Departamentos</span>
              </button>
              <button className={personal === 'teams' ? 'nav-item sub on' : 'nav-item sub'} type="button" title="Equipos" onClick={() => setPersonal('teams')}>
                <NavIcon>
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <path d="M16 3.128a4 4 0 0 1 0 7.744"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                  <circle cx="9" cy="7" r="4"/>
                </NavIcon>
                <span className="side-label-text">Equipos</span>
              </button>
              <button className={personal === 'clients' ? 'nav-item sub on' : 'nav-item sub'} type="button" title="Clientes" onClick={() => setPersonal('clients')}>
                <NavIcon>
                  <path d="M16.051 12.616a1 1 0 0 1 1.909.024l.737 1.452a1 1 0 0 0 .737.535l1.634.256a1 1 0 0 1 .588 1.806l-1.172 1.168a1 1 0 0 0-.282.866l.259 1.613a1 1 0 0 1-1.541 1.134l-1.465-.75a1 1 0 0 0-.912 0l-1.465.75a1 1 0 0 1-1.539-1.133l.258-1.613a1 1 0 0 0-.282-.866l-1.156-1.153a1 1 0 0 1 .572-1.822l1.633-.256a1 1 0 0 0 .737-.535z"/>
                  <path d="M8 15H7a4 4 0 0 0-4 4v2"/>
                  <circle cx="10" cy="7" r="4"/>
                </NavIcon>
                <span className="side-label-text">Clientes</span>
              </button>
            </>
          )}
        </nav>
        <p className="kicker kicker-icon" title="Proyectos">
          <NavIcon>
            <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
            <circle cx="14" cy="15" r="1" />
          </NavIcon>
          <span className="side-label-text">Proyectos</span>
        </p>
        <div className="projects">
          {profile.projects.map((item, index) => (
            <div key={item.id} className="project">
              <div className="project-row" ref={projectMenu === item.id ? menuRef : undefined}>
                <button
                  type="button"
                  title={item.name}
                  onClick={() => focusProject(item)}
                >
                  <NavIcon>
                    <path d="M2 6h4"/>
                    <path d="M2 10h4"/>
                    <path d="M2 14h4"/>
                    <path d="M2 18h4"/>
                    <rect width="16" height="20" x="4" y="2" rx="2"/>
                    <path d="M15 2v20"/>
                    <path d="M15 7h5"/>
                    <path d="M15 12h5"/>
                    <path d="M15 17h5"/>
                  </NavIcon>
                  <span className="side-label-text">{item.name}</span>
                </button>
                {item.role === 'responsable' && (
                  <button
                    className={projectMenu === item.id ? 'more on' : 'more'}
                    type="button"
                    aria-label={`Opciones de ${item.name}`}
                    onClick={() => {
                      setProjectMenu(projectMenu === item.id ? null : item.id)
                      setBoardMenu(null)
                      setNamingBoard(false)
                      setBoardName('')
                    }}
                  >
                    <DotsIcon />
                  </button>
                )}
                {projectMenu === item.id && (
                  <div className="project-menu">
                    {namingBoard ? (
                      <form onSubmit={(event) => createBoard(event, item)}>
                        <input value={boardName} placeholder="Nombre del tablero" onChange={(event) => setBoardName(event.target.value)} autoFocus />
                        <button className="primary" type="submit">Crear tablero</button>
                      </form>
                    ) : (
                      <>
                        <button type="button" onClick={() => setNamingBoard(true)}><PlusIcon /> Nuevo tablero</button>
                        <button type="button" onClick={() => manageProject(item)}><ConfigIcon /> Gestionar proyecto</button>
                        <button type="button" className="danger" onClick={() => {
                          setProjectToDelete(item)
                          setDeleteProjectConfirmation('')
                        }}><TrashIcon /> Eliminar</button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {item.boards.map((boardItem) => (
                <div
                  key={boardItem.id}
                  className={boardItem.id === openId ? 'board-row on' : 'board-row'}
                  ref={boardMenu === boardItem.id ? menuRef : undefined}
                >
                  <button
                    className="board-link"
                    type="button"
                    onClick={() => openBoardTab(item, boardItem)}
                  >
                    {boardItem.name}
                  </button>
                  {item.role === 'responsable' && (
                    <button
                      className={boardMenu === boardItem.id ? 'more on' : 'more'}
                      type="button"
                      aria-label={`Opciones de ${boardItem.name}`}
                      onClick={() => {
                        setBoardMenu(boardMenu === boardItem.id ? null : boardItem.id)
                        setProjectMenu(null)
                        setNamingBoard(false)
                      }}
                    >
                      <DotsIcon />
                    </button>
                  )}
                  {boardMenu === boardItem.id && (
                    <div className="project-menu">
                      <button type="button" onClick={() => manageBoardCategories(item, boardItem)}>Categorías</button>
                      <button type="button" className="danger" onClick={() => {setBoardToDelete(boardItem); setDeleteBoardConfirmation('')}}><TrashIcon /> Eliminar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          {profile.projects.length === 0 && <p className="muted side-label-text">Todavía no hay proyectos.</p>}
          {profile.user.is_admin && !newProject && (
            <button className="add-project" type="button" title="Nuevo proyecto" onClick={() => setNewProject(true)}>
              <PlusIcon />
              <span className="side-label-text">Nuevo proyecto</span>
            </button>
          )}
        </div>
        {profile.user.is_admin && newProject && !sideMini && (
          <form onSubmit={createProject} className="field" noValidate>
            <input name="name" placeholder="Nombre del proyecto" />
            <input name="client_name" placeholder="Empresa cliente" />
            <div className="row">
              <button className="primary" type="submit">Crear</button>
              <button className="ghost" type="button" onClick={() => setNewProject(false)}>Cancelar</button>
            </div>
          </form>
        )}
      </aside>
      {boardToDelete && (
        <div className="modal-back" onClick={() => {
          setBoardToDelete(null)
          setDeleteBoardConfirmation('')
        }}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>Eliminar tablero</h2>
            <p>¿Estás seguro de querer eliminar el tablero {''} <strong>{boardToDelete.name}</strong>?</p>
            <p>Se eliminaran permanentemente todas las tarjetas y datos contenidos en este tablero.</p>
            <p>Escribe <strong>{boardToDelete.name}</strong> para confirmar.</p>
            <input type="text" placeholder={boardToDelete.name} value={deleteBoardConfirmation} onChange={(event) => setDeleteBoardConfirmation(event.target.value)} autoFocus />

            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => {setBoardToDelete(null); setDeleteBoardConfirmation('')}}>Cancelar</button>
              <button type="button" className="ghost danger" disabled={deleteBoardConfirmation !== boardToDelete.name} onClick={() => deleteBoard(boardToDelete.id, deleteBoardConfirmation)}><TrashIcon />Eliminar tablero</button>
            </div>
          </div>
        </div>
      )}
      <section className="main">
        {tabs.length > 0 && (
          <div className="tabs">
            {tabs.map((tab) => (
              <button
                key={tab.boardId}
                className={tab.boardId === openId ? 'on' : ''}
                type="button"
                onClick={() => { chooseBoard(tab.boardId); setAssignee(''); setTeamId(''); setSelected(null); loadBoard(tab.boardId) }}
              >
                {tab.title}
                <span className="tab-x" onClick={(event) => { event.stopPropagation(); closeTab(tab.boardId) }} aria-label="Cerrar pestaña" role="button">
                  <CloseIcon />
                </span>
              </button>
            ))}
          </div>
        )}
        {!view && !openId && (
          <div className="empty-board">
            <div>
              <h2>{profile.user.is_admin ? 'Inicia un proyecto' : 'Espera a que te asignen un proyecto'}</h2>
              <p className="muted">
                {profile.user.is_admin
                  ? 'Crea el primer proyecto desde el lateral y abre su tablero.'
                  : 'Cuando un responsable te añada, el proyecto saldrá en el lateral.'}
              </p>
            </div>
          </div>
        )}
        {(view || openId) && (
          <div className="board-head">
            <h1>{view?.board.name || project?.boards.find((item) => item.id === openId)?.name}</h1>
            {(view?.board.project_name || project?.name) && (
              <p className="subtitle">{view?.board.project_name || project?.name}</p>
            )}
            {view && (
              <div className="views">
                <button className="primary" type="button">
                  <NavIcon>
                    <path d="M5 3v14" />
                    <path d="M12 3v8" />
                    <path d="M19 3v18" />
                  </NavIcon>
                  Tablero
                </button>
                <button type="button" disabled>
                  <NavIcon>
                    <path d="M21 5H3" />
                    <path d="M15 12H3" />
                    <path d="M17 19H3" />
                  </NavIcon>
                  Lista
                </button>
                <button type="button" disabled>
                  <NavIcon>
                    <path d="M12 3v18" />
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M3 9h18" />
                    <path d="M3 15h18" />
                  </NavIcon>
                  Tabla
                </button>
                <button type="button" disabled>
                  <NavIcon>
                    <path d="M6 5h12" />
                    <path d="M4 12h10" />
                    <path d="M12 19h8" />
                  </NavIcon>
                  Gantt
                </button>
                <div className="task-actions">
                  <button className={showFilters || filtersActive ? 'icon-button on' : 'icon-button'} type="button" aria-label="Filtros" onClick={() => setShowFilters((current) => !current)}>
                    <NavIcon><path d="M4 6h16M7 12h10M10 18h4" /></NavIcon>
                  </button>
                  {canEdit && backlog && (
                    <button className="primary" type="button" onClick={() => setCreateColumn({ id: backlog.id, name: backlog.name })}><PlusIcon /> Nueva tarea</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {openId && !view && <div className="empty-board"><p className="muted">Cargando el tablero…</p></div>}
        {view && (
          <>
            {showFilters && (
              <Filters
                clientView={clientView}
                visibility={view.visibility}
                members={view.members}
                labels={view.labels}
                assignee={assignee}
                teamId={teamId}
                teams={view.teams ?? []}
                label={label}
                priority={priority}
                onAssignee={setAssignee}
                onTeam={setTeamId}
                onLabel={setLabel}
                onPriority={setPriority}
              />
            )}
            <div className="workspace">
              <Kanban
                board={view}
                canEdit={canEdit}
                canManage={canManage}
                query={query}
                assignee={assignee}
                teamId={teamId}
                label={label}
                priority={priority}
                onOpen={(card) => setSelected({ card, mode: 'view' })}
                onEdit={(card) => setSelected({ card, mode: 'edit' })}
                onMove={move}
                onMoveColumn={moveColumn}
                onAdd={(id, name) => setCreateColumn({ id, name })}
                onCreatedColumn={() => void loadBoard(view.board.id)}
                onRefresh={() => void loadBoard(view.board.id)}
                onManageCategories={() => setShowCategories(true)}
              />
              <BoardPulse columns={view.columns} />
            </div>
          </>
        )}
      </section>
      {selected && view && openCard && (
        <CardDrawer
          card={openCard}
          mode={selected.mode}
          board={view}
          currentUser={profile.user}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
          onEdit={() => setSelected({ card: openCard, mode: 'edit' })}
          onView={() => setSelected({ card: openCard, mode: 'view' })}
          onChange={async () => { if (openId) await loadBoard(openId) }}
        />
      )}
      {showProject && view && <ProjectDrawer board={view} onClose={() => setShowProject(false)} onChange={async () => { if (openId) await loadBoard(openId) }} />}
      {showCategories && view && (
        <CategoriesDrawer
          board={view}
          onClose={() => setShowCategories(false)}
          onChange={async () => { if (openId) await loadBoard(openId) }}
        />
      )}
      {personal === 'departments' && <RosterDrawer title="Departamentos" hint="Un departamento es la estructura de la empresa. Agrupa personas y no asigna la tarea." path="departments" noun="departamento" onClose={() => setPersonal(null)} />}
      {personal === 'teams' && <RosterDrawer title="Equipos" hint="Un equipo es un grupo de trabajo. En una tarea se asigna a personas, a un equipo, o a los dos." path="teams" noun="equipo" onClose={() => { setPersonal(null); if (openId) loadBoard(openId) }} />}
      {personal === 'clients' && <ClientsDrawer onClose={() => setPersonal(null)} />}
      {createColumn && view && (
        <CreateCardModal
          board={view}
          column={createColumn}
          onClose={() => setCreateColumn(null)}
          onCreated={async () => {
            setCreateColumn(null)
            await loadBoard(view.board.id)
          }}
        />
      )}
      </div>
    </div>
  )
}

type UserTheme = Profile['user']['theme']

function resolveTheme(theme: UserTheme): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

async function setTheme(profile: Profile, setProfile: (value: Profile) => void, theme: UserTheme) {
  document.documentElement.dataset.theme = resolveTheme(theme)
  const next = await api<Profile>('/me', { method: 'PATCH', body: JSON.stringify({ theme }) })
  setProfile(next)
}

function AccountModal({ section, profile, notes, onSection, onProfile, onNotes, onClose, onAvatar }: {
  section: 'profile' | 'settings' | 'notifications'
  profile: Profile
  notes: { id: number; body: string }[]
  onSection: (section: 'profile' | 'settings' | 'notifications') => void
  onProfile: (value: Profile) => void
  onNotes: (value: { id: number; body: string }[]) => void
  onClose: () => void
  onAvatar: (file: File) => Promise<void>
}) {
  const avatarRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(profile.user.name)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(profile.user.name)
  }, [profile.user.name])

  useEffect(() => {
    if (section !== 'notifications') return
    let cancelled = false
    void (async () => {
      const items = await api<{ id: number; body: string }[]>('/notifications')
      if (cancelled) return
      onNotes(items)
      if (profile.unread > 0) {
        await api('/notifications/read', { method: 'POST' })
        if (!cancelled) onProfile({ ...profile, unread: 0 })
      }
    })()
    return () => { cancelled = true }
  }, [section])

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    setError('')
    setInfo('')
    const nextName = name.trim()
    if (!nextName) {
      setError('El nombre no puede estar vacío.')
      return
    }
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        setError('Indica tu contraseña actual.')
        return
      }
      if (newPassword.length < 8) {
        setError('La nueva contraseña debe tener al menos 8 caracteres.')
        return
      }
      if (newPassword !== confirmPassword) {
        setError('Las contraseñas nuevas no coinciden.')
        return
      }
    }
    setSaving(true)
    try {
      const body: Record<string, string> = { name: nextName }
      if (newPassword) {
        body.current_password = currentPassword
        body.password = newPassword
        body.password_confirmation = confirmPassword
      }
      const next = await api<Profile>('/me', { method: 'PATCH', body: JSON.stringify(body) })
      onProfile(next)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setInfo(newPassword ? 'Perfil y contraseña actualizados.' : 'Perfil actualizado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el perfil.')
    } finally {
      setSaving(false)
    }
  }

  async function saveNotify(field: 'notify_in_app' | 'notify_email', value: boolean) {
    setError('')
    try {
      const next = await api<Profile>('/me', { method: 'PATCH', body: JSON.stringify({ [field]: value }) })
      onProfile(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la configuración.')
    }
  }

  const nameChanged = name.trim() !== profile.user.name
  const passwordTouched = Boolean(currentPassword || newPassword || confirmPassword)
  const hasChanges = nameChanged || passwordTouched

  const titles = {
    profile: 'Mi perfil',
    settings: 'Configuración',
    notifications: 'Notificaciones',
  } as const

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal account-modal" onClick={(event) => event.stopPropagation()}>
        <div className="account-modal-nav">
          <button type="button" className={section === 'profile' ? 'on' : undefined} onClick={() => onSection('profile')}>
            <ProfileUserIcon /> Mi perfil
          </button>
          <button type="button" className={section === 'settings' ? 'on' : undefined} onClick={() => onSection('settings')}>
            <SettingsIcon /> Configuración
          </button>
          <button type="button" className={section === 'notifications' ? 'on' : undefined} onClick={() => onSection('notifications')}>
            <BellIcon /> Notificaciones
            {profile.unread > 0 && <i className="account-badge">{profile.unread}</i>}
          </button>
        </div>
        <div className="account-modal-main">
          <div className="row account-modal-head">
            <h2>{titles[section]}</h2>
            <button className="icon-close" type="button" aria-label="Cerrar" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>

          {section === 'profile' && (
            <form className="account-modal-body" onSubmit={saveProfile}>
              <div className="account-modal-identity">
                <button
                  type="button"
                  className="account-avatar account-avatar-lg"
                  aria-label="Cambiar foto de perfil"
                  title="Cambiar foto de perfil"
                  onClick={() => avatarRef.current?.click()}
                >
                  <Avatar id={profile.user.id} name={profile.user.name} size={72} className="avatar" src={profile.user.avatar_url} />
                  <span className="account-avatar-edit">
                    <PencilIcon className="account-avatar-pencil" />
                  </span>
                </button>
                <input
                  ref={avatarRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void onAvatar(file)
                  }}
                />
                <div>
                  <strong>{profile.user.name}</strong>
                  <p className="muted">{profile.user.email}</p>
                  {profile.user.is_admin
                    ? <em className="account-plan">Administrador</em>
                    : profile.user.client_company
                      ? <em className="account-plan">Cliente</em>
                      : <em className="account-plan">Miembro</em>}
                </div>
              </div>
              <label className="field">
                Nombre
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
              </label>
              <label className="field">
                Correo
                <input value={profile.user.email} disabled readOnly />
              </label>
              <p className="account-panel-kicker">Cambiar contraseña</p>
              <label className="field">
                Contraseña actual
                <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
              </label>
              <label className="field">
                Nueva contraseña
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
              </label>
              <label className="field">
                Repetir contraseña
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
              </label>
              {error && <p className="error">{error}</p>}
              {info && <p className="account-ok">{info}</p>}
              <button className="primary account-save" type="submit" disabled={saving || !hasChanges}>
                <FloppyIcon />
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          )}

          {section === 'settings' && (
            <div className="account-modal-body">
              <p className="account-panel-kicker">Tema</p>
              <div className="account-theme-switch" role="group" aria-label="Tema">
                <button
                  type="button"
                  className={profile.user.theme === 'system' ? 'on' : undefined}
                  aria-label="Ordenador"
                  title="Ordenador"
                  aria-pressed={profile.user.theme === 'system'}
                  onClick={() => { void setTheme(profile, onProfile, 'system') }}
                >
                  <ComputerIcon />
                </button>
                <button
                  type="button"
                  className={profile.user.theme === 'light' ? 'on' : undefined}
                  aria-label="Claro"
                  title="Claro"
                  aria-pressed={profile.user.theme === 'light'}
                  onClick={() => { void setTheme(profile, onProfile, 'light') }}
                >
                  <SunIcon />
                </button>
                <button
                  type="button"
                  className={profile.user.theme === 'dark' ? 'on' : undefined}
                  aria-label="Oscuro"
                  title="Oscuro"
                  aria-pressed={profile.user.theme === 'dark'}
                  onClick={() => { void setTheme(profile, onProfile, 'dark') }}
                >
                  <MoonIcon />
                </button>
              </div>
              <p className="account-panel-kicker">Avisos</p>
              <label className="account-toggle">
                <span>
                  <strong>Avisos en la app</strong>
                  <small>Asignaciones y comentarios dentro de tickard</small>
                </span>
                <input
                  type="checkbox"
                  checked={profile.user.notify_in_app}
                  onChange={(event) => { void saveNotify('notify_in_app', event.target.checked) }}
                />
              </label>
              <label className="account-toggle">
                <span>
                  <strong>Avisos por correo</strong>
                  <small>Asignaciones y comentarios de cliente</small>
                </span>
                <input
                  type="checkbox"
                  checked={profile.user.notify_email}
                  onChange={(event) => { void saveNotify('notify_email', event.target.checked) }}
                />
              </label>
              {error && <p className="error">{error}</p>}
            </div>
          )}

          {section === 'notifications' && (
            <div className="account-modal-body">
              <ul className="account-notes account-notes-modal">
                {notes.length === 0 && <li className="muted">No hay avisos.</li>}
                {notes.map((note) => <li key={note.id}>{note.body}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Filters(props: {
  clientView: boolean
  visibility: Record<string, boolean>
  members: { id: number; name: string }[]
  labels: { id: number; name: string }[]
  assignee: string
  teamId: string
  teams: { id: number; name: string }[]
  label: string
  priority: string
  onAssignee: (value: string) => void
  onTeam: (value: string) => void
  onLabel: (value: string) => void
  onPriority: (value: string) => void
}) {
  const showAssignee = !props.clientView || props.visibility.assignee
  const showPriority = !props.clientView || props.visibility.priority
  const showLabels = !props.clientView || props.visibility.labels
  return (
    <form className="filters" onSubmit={(event) => event.preventDefault()}>
      {showAssignee && (
        <label className="field">Persona
          <select value={props.assignee} onChange={(event) => props.onAssignee(event.target.value)}>
            <option value="">Cualquiera</option>
            {props.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
      )}
      {showAssignee && props.teams.length > 0 && (
        <label className="field">Equipo
          <select value={props.teamId} onChange={(event) => props.onTeam(event.target.value)}>
            <option value="">Cualquiera</option>
            {props.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
      )}
      {showLabels && (
        <label className="field">Etiqueta
          <select value={props.label} onChange={(event) => props.onLabel(event.target.value)}>
            <option value="">Cualquiera</option>
            {props.labels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      )}
      {showPriority && (
        <label className="field">Prioridad
          <select value={props.priority} onChange={(event) => props.onPriority(event.target.value)}>
            <option value="">Cualquiera</option>
            {Object.entries(priorityLabel).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>
      )}
    </form>
  )
}

function assignedTo(card: Card, userId: string) {
  if (card.assignees?.some((person) => String(person.id) === userId)) return true
  return card.teams?.some((team) => team.member_ids?.some((id) => String(id) === userId)) ?? false
}

function matches(card: Card, query: string, assignee: string, teamId: string, label: string, priority: string) {
  if (query && !card.title.toLowerCase().includes(query.toLowerCase())) return false
  if (assignee && !assignedTo(card, assignee)) return false
  if (teamId && !card.teams?.some((team) => String(team.id) === teamId)) return false
  if (label && !card.labels?.some((item) => String(item.id) === label)) return false
  if (priority && card.priority !== priority) return false
  return true
}

function columnSortId(id: number) {
  return `column-${id}`
}

function parseColumnSortId(value: string | number) {
  const match = /^column-(\d+)$/.exec(String(value))
  return match ? Number(match[1]) : null
}

function categoryKey(card: { category_id?: number | null }) {
  return card.category_id == null ? 'none' : String(card.category_id)
}

function sameCategory(a: { category_id?: number | null }, b: { category_id?: number | null }) {
  return (a.category_id ?? null) === (b.category_id ?? null)
}

function groupDropId(columnId: number, key: string) {
  return `group-${columnId}-${key}`
}

function parseGroupDropId(value: string) {
  const match = /^group-(\d+)-(.+)$/.exec(value)
  if (!match) return null
  return { columnId: Number(match[1]), categoryKey: match[2] }
}

function pinnedColumnsKey(boardId: number) {
  return `gestor:pinned-columns:${boardId}`
}

function readPinnedColumns(boardId: number) {
  try {
    const raw = localStorage.getItem(pinnedColumnsKey(boardId))
    if (!raw) return [] as number[]
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : []
  } catch {
    return [] as number[]
  }
}

function orderedColumnCards(column: { cards: Card[] }, categories: BoardCategory[]) {
  const uncategorized = column.cards.filter((card) => !card.category_id)
  const grouped = categories
    .filter((category) => column.cards.some((card) => card.category_id === category.id))
    .flatMap((category) => column.cards.filter((card) => card.category_id === category.id))
  return [...uncategorized, ...grouped]
}

function insertIndexForCard(
  visual: Card[],
  categories: BoardCategory[],
  card: Card,
  peerIndex: number,
) {
  const firstPeer = visual.findIndex((item) => sameCategory(item, card))
  if (firstPeer >= 0) return firstPeer + peerIndex
  if (!card.category_id) return Math.min(peerIndex, visual.filter((item) => !item.category_id).length)

  const categoryIndex = categories.findIndex((category) => category.id === card.category_id)
  let insertAt = visual.filter((item) => !item.category_id).length
  categories.slice(0, Math.max(categoryIndex, 0)).forEach((category) => {
    insertAt += visual.filter((item) => item.category_id === category.id).length
  })
  return insertAt + peerIndex
}

function Kanban(props: {
  board: BoardPayload
  canEdit: boolean
  canManage: boolean
  query: string
  assignee: string
  teamId: string
  label: string
  priority: string
  onOpen: (card: Card) => void
  onEdit: (card: Card) => void
  onMove: (cardId: number, columnId: number, position: number) => Promise<void>
  onMoveColumn: (columnId: number, position: number) => Promise<void>
  onAdd: (columnId: number, name: string) => void
  onCreatedColumn: () => Promise<void> | void
  onRefresh: () => Promise<void> | void
  onManageCategories: () => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const dragged = useRef(false)
  const [activeId, setActiveId] = useState<string | number | null>(null)
  const boardId = props.board.board.id
  const [pinnedIds, setPinnedIds] = useState<number[]>(() => readPinnedColumns(boardId))
  const categories = props.board.categories ?? []
  const columns = useMemo(() => props.board.columns.map((column) => ({
    ...column,
    cards: column.cards.filter((card) => matches(card, props.query, props.assignee, props.teamId, props.label, props.priority)),
  })), [props.board, props.query, props.assignee, props.teamId, props.label, props.priority])
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds])
  const pinnedColumns = useMemo(() => {
    const byId = new Map(columns.map((column) => [column.id, column]))
    return pinnedIds
      .map((id) => byId.get(id))
      .filter((column): column is typeof columns[number] => !!column)
  }, [columns, pinnedIds])
  const unpinnedColumns = useMemo(
    () => columns.filter((column) => !pinnedSet.has(column.id)),
    [columns, pinnedSet],
  )
  const allCards = columns.flatMap((column) => column.cards)
  const activeColumnId = activeId == null ? null : parseColumnSortId(activeId)
  const activeCard = activeColumnId == null && activeId != null
    ? allCards.find((card) => card.id === Number(activeId))
    : undefined
  const activeColumn = activeColumnId == null ? undefined : columns.find((column) => column.id === activeColumnId)

  useEffect(() => {
    setPinnedIds(readPinnedColumns(boardId))
  }, [boardId])

  useEffect(() => {
    const valid = new Set(columns.map((column) => column.id))
    setPinnedIds((current) => {
      const next = current.filter((id) => valid.has(id))
      if (next.length === current.length && next.every((id, index) => id === current[index])) return current
      localStorage.setItem(pinnedColumnsKey(boardId), JSON.stringify(next))
      return next
    })
  }, [boardId, columns])

  function togglePinned(columnId: number) {
    setPinnedIds((current) => {
      const isPinned = current.includes(columnId)
      const next = isPinned
        ? current.filter((id) => id !== columnId)
        : [...current, columnId]
      localStorage.setItem(pinnedColumnsKey(boardId), JSON.stringify(next))
      if (!isPinned) {
        void props.onMoveColumn(columnId, next.length - 1)
      }
      return next
    })
  }

  const collisionDetection: CollisionDetection = (args) => {
    const draggingColumn = parseColumnSortId(args.active.id)
    if (draggingColumn != null) {
      const draggingPinned = pinnedSet.has(draggingColumn)
      return closestCorners({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) => {
          if (container.id === args.active.id) return false
          const id = parseColumnSortId(container.id)
          if (id == null) return false
          return pinnedSet.has(id) === draggingPinned
        }),
      })
    }

    const dragging = allCards.find((card) => card.id === Number(args.active.id))
    if (!dragging) return closestCorners(args)
    const key = categoryKey(dragging)
    const preferred = args.droppableContainers.filter((container) => {
      if (container.id === args.active.id) return false
      const id = String(container.id)
      if (parseColumnSortId(id) != null) return false
      const group = parseGroupDropId(id)
      if (group) return group.categoryKey === key
      const overCard = allCards.find((card) => card.id === Number(id))
      return overCard ? sameCategory(dragging, overCard) : false
    })
    const hits = closestCorners({ ...args, droppableContainers: preferred })
    if (hits.length > 0) return hits
    return closestCorners({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) => {
        if (container.id === args.active.id) return false
        return parseColumnSortId(container.id) != null
      }),
    })
  }

  async function onDragEnd(event: DragEndEvent) {
    const draggedId = event.active.id
    setActiveId(null)
    window.setTimeout(() => { dragged.current = false }, 0)
    if (!event.over || draggedId === event.over.id) return

    const movingColumnId = parseColumnSortId(draggedId)
    if (movingColumnId != null) {
      if (!props.canManage) return
      const overColumnId = parseColumnSortId(event.over.id)
      if (overColumnId == null) return
      const movingPinned = pinnedSet.has(movingColumnId)
      const overPinned = pinnedSet.has(overColumnId)
      if (movingPinned !== overPinned) return

      if (movingPinned) {
        const from = pinnedIds.indexOf(movingColumnId)
        const to = pinnedIds.indexOf(overColumnId)
        if (from < 0 || to < 0 || from === to) return
        const nextPinned = arrayMove(pinnedIds, from, to)
        setPinnedIds(nextPinned)
        localStorage.setItem(pinnedColumnsKey(boardId), JSON.stringify(nextPinned))
        await props.onMoveColumn(movingColumnId, to)
        return
      }

      const order = unpinnedColumns.map((column) => column.id).filter((id) => id !== movingColumnId)
      const overIndex = order.indexOf(overColumnId)
      if (overIndex < 0) return
      await props.onMoveColumn(movingColumnId, pinnedColumns.length + overIndex)
      return
    }

    if (!props.canEdit) return
    const draggingCard = allCards.find((card) => card.id === Number(draggedId))
    if (!draggingCard) return
    const cardId = draggingCard.id
    const over = String(event.over.id)
    const group = parseGroupDropId(over)
    const overColumnId = parseColumnSortId(over)
    const overCard = group || overColumnId != null ? null : allCards.find((card) => card.id === Number(over))
    const targetColumnId = group?.columnId ?? overColumnId ?? overCard?.column_id
    if (!targetColumnId) return
    if (group && group.categoryKey !== categoryKey(draggingCard)) return
    if (overCard && !sameCategory(draggingCard, overCard)) return

    const targetColumn = columns.find((column) => column.id === targetColumnId)
    if (!targetColumn) return

    const peers = orderedColumnCards(targetColumn, categories).filter((card) => sameCategory(card, draggingCard) && card.id !== cardId)
    let peerIndex = peers.length
    if (overCard) {
      const index = peers.findIndex((card) => card.id === overCard.id)
      peerIndex = index >= 0 ? index : peers.length
    }

    const visual = orderedColumnCards(
      { cards: targetColumn.cards.filter((card) => card.id !== cardId) },
      categories,
    )
    const insertAt = insertIndexForCard(visual, categories, draggingCard, peerIndex)
    await props.onMove(cardId, targetColumnId, insertAt)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={(event) => {
        dragged.current = true
        setActiveId(event.active.id)
      }}
      onDragCancel={() => {
        setActiveId(null)
        dragged.current = false
      }}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={[...pinnedColumns, ...unpinnedColumns].map((column) => columnSortId(column.id))}
        strategy={horizontalListSortingStrategy}
      >
        <div className="board">
          {pinnedColumns.length > 0 && (
            <aside className="board-pinned" aria-label="Columnas fijadas">
              {pinnedColumns.map((column) => (
                <ColumnView
                  key={column.id}
                  column={column}
                  categories={categories}
                  canEdit={props.canEdit}
                  canManage={props.canManage}
                  pinned
                  onTogglePinned={() => togglePinned(column.id)}
                  onOpen={(card) => { if (!dragged.current) props.onOpen(card) }}
                  onEdit={(card) => { if (!dragged.current) props.onEdit(card) }}
                  onAdd={() => props.onAdd(column.id, column.name)}
                  onRefresh={props.onRefresh}
                  onManageCategories={props.onManageCategories}
                  dropCategoryKey={activeCard ? categoryKey(activeCard) : null}
                />
              ))}
            </aside>
          )}
          <div className="board-scroll">
            {unpinnedColumns.map((column) => (
              <ColumnView
                key={column.id}
                column={column}
                categories={categories}
                canEdit={props.canEdit}
                canManage={props.canManage}
                pinned={false}
                onTogglePinned={() => togglePinned(column.id)}
                onOpen={(card) => { if (!dragged.current) props.onOpen(card) }}
                onEdit={(card) => { if (!dragged.current) props.onEdit(card) }}
                onAdd={() => props.onAdd(column.id, column.name)}
                onRefresh={props.onRefresh}
                onManageCategories={props.onManageCategories}
                dropCategoryKey={activeCard ? categoryKey(activeCard) : null}
              />
            ))}
            {props.canManage && (
              <NewColumnTemplate boardId={props.board.board.id} onCreated={props.onCreatedColumn} />
            )}
          </div>
        </div>
      </SortableContext>
      <DragOverlay>
        {activeCard ? <CardFace card={activeCard} /> : null}
        {activeColumn ? <div className="column-overlay"><strong>{activeColumn.name}</strong></div> : null}
      </DragOverlay>
    </DndContext>
  )
}

function NewColumnTemplate({ boardId, onCreated }: { boardId: number; onCreated: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const title = name.trim()
    if (!title || saving) return
    setSaving(true)
    try {
      await api(`/boards/${boardId}/columns`, { method: 'POST', body: JSON.stringify({ name: title }) })
      setName('')
      setOpen(false)
      await onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="column template">
      {open ? (
        <form onSubmit={submit}>
          <input
            autoFocus
            value={name}
            placeholder="Nombre de la columna"
            onChange={(event) => setName(event.target.value)}
          />
          <div className="row">
            <button className="primary" type="submit" disabled={saving || !name.trim()}>Crear</button>
            <button className="ghost" type="button" onClick={() => { setOpen(false); setName('') }}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)}><PlusIcon /> Crear columna nueva</button>
      )}
    </section>
  )
}

function ColumnView({ column, categories, canEdit, canManage, pinned, onTogglePinned, onOpen, onEdit, onAdd, onRefresh, onManageCategories, dropCategoryKey }: {
  column: BoardPayload['columns'][number]
  categories: BoardCategory[]
  canEdit: boolean
  canManage: boolean
  pinned: boolean
  onTogglePinned: () => void
  onOpen: (card: Card) => void
  onEdit: (card: Card) => void
  onAdd: () => void
  onRefresh: () => Promise<void> | void
  onManageCategories: () => void
  dropCategoryKey: string | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: columnSortId(column.id),
    disabled: !canManage,
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(column.name)
  const [error, setError] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const columnColor = column.color || DEFAULT_CARD_STRIPE
  const canDrag = canManage && !renaming

  useEffect(() => {
    setName(column.name)
  }, [column.name])

  useEffect(() => {
    if (!menuOpen) return
    function close(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
        setError('')
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  async function saveName(event: FormEvent) {
    event.preventDefault()
    const title = name.trim()
    if (!title) return
    await api(`/columns/${column.id}`, { method: 'PATCH', body: JSON.stringify({ name: title }) })
    setRenaming(false)
    setMenuOpen(false)
    await onRefresh()
  }

  async function saveColor(next: string) {
    await api(`/columns/${column.id}`, { method: 'PATCH', body: JSON.stringify({ color: next }) })
    await onRefresh()
  }

  async function removeColumn() {
    setError('')
    try {
      await api(`/columns/${column.id}`, { method: 'DELETE' })
      setMenuOpen(false)
      await onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la columna.')
    }
  }

  const hasCards = column.cards.length > 0
  const uncategorized = column.cards.filter((card) => !card.category_id)

  function renderCard(card: Card) {
    return (
      <SortableCard
        key={card.id}
        card={card}
        disabled={!canEdit}
        canEdit={canEdit}
        onOpen={() => onOpen(card)}
        onEdit={() => onEdit(card)}
      />
    )
  }

  return (
    <section
      className={`column${isDragging ? ' dragging' : ''}${collapsed ? ' is-collapsed' : ''}${column.color ? ' has-color' : ''}${pinned ? ' is-pinned' : ''}`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(column.color ? { ['--column-stripe' as string]: column.color } : {}),
      }}
    >
      <header
        className={canDrag ? 'is-draggable' : undefined}
        {...(canDrag ? { ...attributes, ...listeners } : {})}
      >
        {renaming ? (
          <form className="rename" onSubmit={saveName} onPointerDown={(event) => event.stopPropagation()}>
            <input value={name} autoFocus onChange={(event) => setName(event.target.value)} />
            <div className="row">
              <button className="primary" type="submit">Guardar</button>
              <button className="ghost" type="button" onClick={() => { setRenaming(false); setName(column.name); setMenuOpen(false) }}>Cancelar</button>
            </div>
          </form>
        ) : (
          <>
            {collapsed && (
              <button
                className="more collapse"
                type="button"
                aria-label={`Expandir columna ${column.name}`}
                aria-pressed
                title="Expandir columna"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setCollapsed(false)}
              >
                <ExpandColumnIcon />
              </button>
            )}
            <h2>{column.name}</h2>
            <div
              className="column-tools"
              ref={menuRef}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <span className="count muted">{column.cards.length}</span>
              {!collapsed && (
                <button
                  className="more collapse"
                  type="button"
                  aria-label={`Contraer columna ${column.name}`}
                  aria-pressed={false}
                  title="Contraer columna"
                  onClick={() => {
                    setMenuOpen(false)
                    setCollapsed(true)
                  }}
                >
                  <CollapseColumnIcon />
                </button>
              )}
              {canManage && !collapsed && (
                <>
                  <button
                    className={menuOpen ? 'more on' : 'more'}
                    type="button"
                    aria-label={`Opciones de ${column.name}`}
                    onClick={() => { setMenuOpen(!menuOpen); setError('') }}
                  >
                    <DotsIcon />
                  </button>
                  {menuOpen && (
                    <div className="pop-menu">
                      <button type="button" onClick={() => { setRenaming(true); setMenuOpen(false) }}>
                        <EditIcon /> Cambiar nombre
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          colorInputRef.current?.click()
                        }}
                      >
                        <PaletteIcon /> Cambiar color
                      </button>
                      <button type="button" onClick={() => { setMenuOpen(false); onManageCategories() }}>
                        <CategoryIcon className="menu-icon" /> Gestionar categoría
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          onTogglePinned()
                        }}
                      >
                        {pinned ? <UnpinIcon /> : <PinIcon />}
                        {pinned ? 'Desfijar columna' : 'Fijar columna'}
                      </button>
                      {canEdit && (
                        <button type="button" onClick={() => { setMenuOpen(false); onAdd() }}>
                          <PlusIcon className="menu-icon" /> Añadir tarea
                        </button>
                      )}
                      <span
                        className="pop-menu-tip"
                        title={hasCards ? 'No se puede eliminar una columna con tarjetas. Muévelas o elimínalas antes.' : undefined}
                      >
                        <button
                          className="danger"
                          type="button"
                          disabled={hasCards}
                          onClick={() => {
                            if (hasCards) return
                            void removeColumn()
                          }}
                        >
                          <TrashIcon /> Eliminar
                        </button>
                      </span>
                      {error && <p className="muted">{error}</p>}
                    </div>
                  )}
                  <input
                    ref={colorInputRef}
                    className="color-input"
                    type="color"
                    value={columnColor}
                    onChange={(event) => { void saveColor(event.target.value) }}
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                </>
              )}
            </div>
          </>
        )}
      </header>
      {!collapsed && (
        <>
          <CategoryGroup
            columnId={column.id}
            categoryKey="none"
            cards={uncategorized}
            renderCard={renderCard}
            active={dropCategoryKey === 'none'}
          />
          {categories.map((category) => {
            const cards = column.cards.filter((card) => card.category_id === category.id)
            const key = String(category.id)
            if (cards.length === 0 && dropCategoryKey !== key) return null
            return (
              <CategoryGroup
                key={category.id}
                columnId={column.id}
                categoryKey={key}
                label={cards.length > 0 ? category.name : undefined}
                cards={cards}
                renderCard={renderCard}
                active={dropCategoryKey === key}
              />
            )
          })}
          {canEdit
            ? <button className="add-card" type="button" onClick={onAdd}><PlusIcon /> Añadir tarea</button>
            : column.cards.length === 0 && <p className="muted">Sin tarjetas</p>}
        </>
      )}
    </section>
  )
}

function CategoryGroup({ columnId, categoryKey: key, label, cards, renderCard, active }: {
  columnId: number
  categoryKey: string
  label?: string
  cards: Card[]
  renderCard: (card: Card) => ReactNode
  active?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: groupDropId(columnId, key) })
  return (
    <div
      className={[
        'category-group',
        label ? '' : 'plain',
        cards.length === 0 ? 'empty' : '',
        active ? 'active-drop' : '',
        isOver ? 'over' : '',
      ].filter(Boolean).join(' ')}
      ref={setNodeRef}
    >
      {label && <p className="category-label">{label}</p>}
      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        {cards.map(renderCard)}
      </SortableContext>
    </div>
  )
}

function columnShares(counts: number[]) {
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (total === 0) return counts.map(() => 0)
  const exact = counts.map((count) => (count / total) * 100)
  const shares = exact.map((value) => Math.floor(value))
  let leftover = 100 - shares.reduce((sum, value) => sum + value, 0)
  exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)
    .forEach((item) => {
      if (leftover <= 0) return
      shares[item.index] += 1
      leftover -= 1
    })
  return shares
}

function BoardPulse({ columns }: { columns: BoardPayload['columns'] }) {
  const shares = columnShares(columns.map((column) => column.cards.length))
  return (
    <div className="pulse">
      {columns.map((column, index) => (
        <article key={column.id}>
          <p className="muted">{column.name}</p>
          <strong>{column.cards.length}</strong>
          <span>{shares[index]}% del tablero</span>
        </article>
      ))}
    </div>
  )
}

function PriorityMark({ priority }: { priority?: Card['priority'] }) {
  if (!priority) return null
  const level = { baja: 1, media: 2, alta: 3, urgente: 4 }[priority]
  return (
    <span className={`prio-signal prio-${priority}`} title={`Prioridad ${priorityLabel[priority]}`} aria-label={`Prioridad ${priorityLabel[priority]}`}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path className={level >= 1 ? 'on' : undefined} d="M3 20h.01" />
        <path className={level >= 2 ? 'on' : undefined} d="M9 20v-4" />
        <path className={level >= 3 ? 'on' : undefined} d="M15 20v-8" />
        <path className={level >= 4 ? 'on' : undefined} d="M21 20V8" />
      </svg>
    </span>
  )
}

function PriorityPicker({ value, onChange }: {
  value?: Card['priority']
  onChange: (priority: Card['priority']) => void
}) {
  const current = value ?? 'media'
  return (
    <div className="prio-picker" role="radiogroup" aria-label="Prioridad">
      {(Object.keys(priorityLabel) as Array<keyof typeof priorityLabel>).map((priority) => {
        const selected = current === priority
        return (
          <button
            key={priority}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`prio-option prio-${priority}${selected ? ' on' : ''}`}
            onClick={() => onChange(priority)}
          >
            <PriorityMark priority={priority} />
            <span>{priorityLabel[priority]}</span>
          </button>
        )
      })}
    </div>
  )
}

function SideSelect<T extends string | number>({
  value,
  options,
  onChange,
  leading,
}: {
  value: T
  options: { value: T; label: string; leading?: ReactNode }[]
  onChange: (value: T) => void
  leading?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((option) => option.value === value)
  return (
    <div className={`side-select${open ? ' open' : ''}`}>
      <button
        type="button"
        className="side-select-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="side-select-main">
          {leading ?? current?.leading}
          <strong>{current?.label ?? '—'}</strong>
        </span>
        <ChevronIcon />
      </button>
      {open && (
        <div className="side-select-menu" role="listbox">
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? 'on' : ''}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              {option.leading}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKey(value?: string | null) {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function SideDatePicker({ value, onChange }: {
  value?: string | null
  onChange: (value: string | null) => void
}) {
  const selected = parseDateKey(value)
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => selected ?? new Date())

  useEffect(() => {
    if (selected) setCursor(selected)
  }, [value])

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

  return (
    <div className={`side-select side-date${open ? ' open' : ''}`}>
      <button
        type="button"
        className="side-select-trigger"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="side-select-main">
          <CalendarPickIcon />
          <strong>{formatDateLong(value)}</strong>
        </span>
        <ChevronIcon />
      </button>
      {open && (
        <div className="side-date-menu" role="dialog" aria-label="Elegir fecha">
          <div className="side-date-head">
            <button type="button" className="icon-close" aria-label="Mes anterior" onClick={() => setCursor(new Date(year, month - 1, 1))}>
              ‹
            </button>
            <strong>{monthLabel}</strong>
            <button type="button" className="icon-close" aria-label="Mes siguiente" onClick={() => setCursor(new Date(year, month + 1, 1))}>
              ›
            </button>
          </div>
          <div className="side-date-week">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label) => <span key={label}>{label}</span>)}
          </div>
          <div className="side-date-grid">
            {cells.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} className="side-date-empty" />
              const key = toDateKey(new Date(year, month, day))
              return (
                <button
                  key={key}
                  type="button"
                  className={[
                    'side-date-day',
                    key === selectedKey ? 'on' : '',
                    key === todayKey ? 'today' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    onChange(key)
                    setOpen(false)
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <div className="side-date-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
            >
              Quitar fecha
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                const next = toDateKey(new Date())
                onChange(next)
                setCursor(new Date())
                setOpen(false)
              }}
            >
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CardProgressBar({ progress }: { progress?: Card['progress'] }) {
  if (!progress || progress.total < 1) return null
  return (
    <div className="card-progress" title={`${progress.done} de ${progress.total} completados`}>
      <div className="card-progress-track" aria-hidden="true">
        <span style={{ width: `${progress.percent}%` }} />
      </div>
      <span className="card-progress-label">{progress.done}/{progress.total}</span>
    </div>
  )
}

function CardFace({ card }: { card: Card }) {
  return (
    <article className="card overlay" style={cardStripeStyle(card.color)}>
      <strong>{card.title}</strong>
      <div className="meta">
        {card.teams?.map((team) => <span key={team.id} className="chip equipo">{team.name}</span>)}
        {card.labels?.map((item) => <span key={item.id} className={`chip ${item.tone}`}>{item.name}</span>)}
      </div>
      <footer>
        <div className="card-foot-top">
          <span className="faces">{card.assignees?.map((person) => <Avatar key={person.id} id={person.id} name={person.name} className="face" src={person.avatar_url} />)}</span>
        </div>
        <CardProgressBar progress={card.progress} />
      </footer>
    </article>
  )
}

function SortableCard({ card, disabled, canEdit, onOpen, onEdit }: {
  card: Card
  disabled: boolean
  canEdit: boolean
  onOpen: () => void
  onEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, disabled })

  return (
    <article
      ref={setNodeRef}
      className={`card${isDragging ? ' dragging' : ''}${disabled ? '' : ' is-draggable'}`}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1, ...cardStripeStyle(card.color) }}
      onClick={() => onOpen()}
      {...(disabled ? {} : { ...attributes, ...listeners })}
    >
      {(canEdit || card.is_internal === false) && (
        <div className="card-tools" onPointerDown={(event) => event.stopPropagation()}>
          {card.is_internal === false && (
            <span className="card-public" title="No interna" aria-label="Tarjeta no interna">
              <VisibilityIcon />
            </span>
          )}
          {canEdit && (
            <button
              className="more"
              type="button"
              aria-label={`Editar ${card.title}`}
              onClick={(event) => {
                event.stopPropagation()
                onEdit()
              }}
            >
              <EditIcon />
            </button>
          )}
        </div>
      )}
      <strong>{card.title}</strong>
      <div className="meta">
        {card.teams?.map((team) => <span key={team.id} className="chip equipo">{team.name}</span>)}
        {card.labels?.map((item) => <span key={item.id} className={`chip ${item.tone}`}>{item.name}</span>)}
      </div>
      <footer>
        <div className="card-foot-top">
          <span className="card-status">
            <PriorityMark priority={card.priority} />
            <time className="muted">{formatDate(card.due_date)}</time>
          </span>
          <span className="faces">{card.assignees?.map((person) => <Avatar key={person.id} id={person.id} name={person.name} className="face" src={person.avatar_url} />)}</span>
        </div>
        <CardProgressBar progress={card.progress} />
      </footer>
    </article>
  )
}

function CreateCardModal({ board, column, onClose, onCreated }: {
  board: BoardPayload
  column: { id: number; name: string }
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [due, setDue] = useState('')
  const [priority, setPriority] = useState('media')
  const [assignees, setAssignees] = useState<string[]>([])
  const [teams, setTeams] = useState<string[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [error, setError] = useState('')
  const team = board.members.filter((member) => member.role !== 'cliente')
  const categories = board.categories ?? []

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setError('Escribe un título.')
      return
    }
    try {
      await api(`/boards/${board.board.id}/cards`, {
        method: 'POST',
        body: JSON.stringify({
          column_id: column.id,
          category_id: categoryId ? Number(categoryId) : null,
          title: title.trim(),
          description,
          due_date: due || null,
          priority,
          assignee_ids: assignees.map(Number),
          team_ids: teams.map(Number),
        }),
      })
      await onCreated()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear la tarjeta.')
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <h2>Nueva tarjeta</h2>
        <p className="muted">Se añade a {column.name}.</p>
        <label className="field">Título<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="field">Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label>
        {categories.length > 0 && (
          <label className="field">Categoría
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Sin categoría</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        )}
        <label className="field">Fecha límite<input type="date" value={due} onChange={(event) => setDue(event.target.value)} /></label>
        <label className="field">Prioridad
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            {Object.entries(priorityLabel).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>
        <label className="field">Personas
          <select multiple value={assignees} onChange={(event) => setAssignees([...event.target.selectedOptions].map((option) => option.value))}>
            {team.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
        {(board.teams ?? []).length > 0 && (
          <label className="field">Equipos
            <select multiple value={teams} onChange={(event) => setTeams([...event.target.selectedOptions].map((option) => option.value))}>
              {(board.teams ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="primary" type="submit">Añadir tarea</button>
          <button className="ghost" type="button" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

function formatDateLong(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function formatRelative(value?: string | null) {
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

function CloseIcon() {
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

function CalendarPickIcon() {
  return (
    <svg className="side-ico date-pick-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M224 64C241.7 64 256 78.3 256 96L256 128L384 128L384 96C384 78.3 398.3 64 416 64C433.7 64 448 78.3 448 96L448 128L480 128C515.3 128 544 156.7 544 192L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 192C96 156.7 124.7 128 160 128L192 128L192 96C192 78.3 206.3 64 224 64zM224 320C206.3 320 192 334.3 192 352L192 416C192 433.7 206.3 448 224 448L288 448C305.7 448 320 433.7 320 416L320 352C320 334.3 305.7 320 288 320L224 320z" />
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

function BoldIcon() {
  return (
    <svg className="desc-tool-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M160 96C142.3 96 128 110.3 128 128C128 145.7 142.3 160 160 160L192 160L192 480L160 480C142.3 480 128 494.3 128 512C128 529.7 142.3 544 160 544L384 544C454.7 544 512 486.7 512 416C512 369.5 487.2 328.7 450 306.3C468.7 284 480 255.3 480 224C480 153.3 422.7 96 352 96L160 96zM416 224C416 259.3 387.3 288 352 288L256 288L256 160L352 160C387.3 160 416 188.7 416 224zM256 480L256 352L384 352C419.3 352 448 380.7 448 416C448 451.3 419.3 480 384 480L256 480z" />
    </svg>
  )
}

function ItalicIcon() {
  return (
    <svg className="desc-tool-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M256 128C256 110.3 270.3 96 288 96L480 96C497.7 96 512 110.3 512 128C512 145.7 497.7 160 480 160L421.3 160L288 480L352 480C369.7 480 384 494.3 384 512C384 529.7 369.7 544 352 544L160 544C142.3 544 128 529.7 128 512C128 494.3 142.3 480 160 480L218.7 480L352 160L288 160C270.3 160 256 145.7 256 128z" />
    </svg>
  )
}

function UnderlineIcon() {
  return (
    <svg className="desc-tool-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M128 96C128 78.3 142.3 64 160 64L224 64C241.7 64 256 78.3 256 96C256 113.7 241.7 128 224 128L224 288C224 341 267 384 320 384C373 384 416 341 416 288L416 128C398.3 128 384 113.7 384 96C384 78.3 398.3 64 416 64L480 64C497.7 64 512 78.3 512 96C512 113.7 497.7 128 480 128L480 288C480 376.4 408.4 448 320 448C231.6 448 160 376.4 160 288L160 128C142.3 128 128 113.7 128 96zM128 544C128 526.3 142.3 512 160 512L480 512C497.7 512 512 526.3 512 544C512 561.7 497.7 576 480 576L160 576C142.3 576 128 561.7 128 544z" />
    </svg>
  )
}

function ListUlIcon() {
  return (
    <svg className="desc-tool-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M112 208C138.5 208 160 186.5 160 160C160 133.5 138.5 112 112 112C85.5 112 64 133.5 64 160C64 186.5 85.5 208 112 208zM256 128C238.3 128 224 142.3 224 160C224 177.7 238.3 192 256 192L544 192C561.7 192 576 177.7 576 160C576 142.3 561.7 128 544 128L256 128zM256 288C238.3 288 224 302.3 224 320C224 337.7 238.3 352 256 352L544 352C561.7 352 576 337.7 576 320C576 302.3 561.7 288 544 288L256 288zM256 448C238.3 448 224 462.3 224 480C224 497.7 238.3 512 256 512L544 512C561.7 512 576 497.7 576 480C576 462.3 561.7 448 544 448L256 448zM112 528C138.5 528 160 506.5 160 480C160 453.5 138.5 432 112 432C85.5 432 64 453.5 64 480C64 506.5 85.5 528 112 528zM160 320C160 293.5 138.5 272 112 272C85.5 272 64 293.5 64 320C64 346.5 85.5 368 112 368C138.5 368 160 346.5 160 320z" />
    </svg>
  )
}

function ListOlIcon() {
  return (
    <svg className="desc-tool-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M64 136C64 122.8 74.7 112 88 112L136 112C149.3 112 160 122.7 160 136L160 240L184 240C197.3 240 208 250.7 208 264C208 277.3 197.3 288 184 288L88 288C74.7 288 64 277.3 64 264C64 250.7 74.7 240 88 240L112 240L112 160L88 160C74.7 160 64 149.3 64 136zM94.4 365.2C105.8 356.6 119.7 352 134 352L138.9 352C172.6 352 200 379.4 200 413.1C200 432.7 190.6 451 174.8 462.5L150.8 480L184 480C197.3 480 208 490.7 208 504C208 517.3 197.3 528 184 528L93.3 528C77.1 528 64 514.9 64 498.7C64 489.3 68.5 480.5 76.1 475L146.6 423.7C150 421.2 152 417.3 152 413.1C152 405.9 146.1 400 138.9 400L134 400C130.1 400 126.3 401.3 123.2 403.6L102.4 419.2C91.8 427.2 76.8 425 68.8 414.4C60.8 403.8 63 388.8 73.6 380.8L94.4 365.2zM288 128L544 128C561.7 128 576 142.3 576 160C576 177.7 561.7 192 544 192L288 192C270.3 192 256 177.7 256 160C256 142.3 270.3 128 288 128zM288 288L544 288C561.7 288 576 302.3 576 320C576 337.7 561.7 352 544 352L288 352C270.3 352 256 337.7 256 320C256 302.3 270.3 288 288 288zM288 448L544 448C561.7 448 576 462.3 576 480C576 497.7 561.7 512 544 512L288 512C270.3 512 256 497.7 256 480C256 462.3 270.3 448 288 448z" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg className="desc-tool-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M451.5 160C434.9 160 418.8 164.5 404.7 172.7C388.9 156.7 370.5 143.3 350.2 133.2C378.4 109.2 414.3 96 451.5 96C537.9 96 608 166 608 252.5C608 294 591.5 333.8 562.2 363.1L491.1 434.2C461.8 463.5 422 480 380.5 480C294.1 480 224 410 224 323.5C224 322 224 320.5 224.1 319C224.6 301.3 239.3 287.4 257 287.9C274.7 288.4 288.6 303.1 288.1 320.8C288.1 321.7 288.1 322.6 288.1 323.4C288.1 374.5 329.5 415.9 380.6 415.9C405.1 415.9 428.6 406.2 446 388.8L517.1 317.7C534.4 300.4 544.2 276.8 544.2 252.3C544.2 201.2 502.8 159.8 451.7 159.8zM307.2 237.3C305.3 236.5 303.4 235.4 301.7 234.2C289.1 227.7 274.7 224 259.6 224C235.1 224 211.6 233.7 194.2 251.1L123.1 322.2C105.8 339.5 96 363.1 96 387.6C96 438.7 137.4 480.1 188.5 480.1C205 480.1 221.1 475.7 235.2 467.5C251 483.5 269.4 496.9 289.8 507C261.6 530.9 225.8 544.2 188.5 544.2C102.1 544.2 32 474.2 32 387.7C32 346.2 48.5 306.4 77.8 277.1L148.9 206C178.2 176.7 218 160.2 259.5 160.2C346.1 160.2 416 230.8 416 317.1C416 318.4 416 319.7 416 321C415.6 338.7 400.9 352.6 383.2 352.2C365.5 351.8 351.6 337.1 352 319.4C352 318.6 352 317.9 352 317.1C352 283.4 334 253.8 307.2 237.5z" />
    </svg>
  )
}

function UnlinkIcon() {
  return (
    <svg className="desc-tool-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
      <path fill="currentColor" d="M73 39.1C63.6 29.7 48.4 29.7 39.1 39.1C29.8 48.5 29.7 63.7 39 73.1L567 601.1C576.4 610.5 591.6 610.5 600.9 601.1C610.2 591.7 610.3 576.5 600.9 567.2L478.9 445.2C483.1 441.8 487.2 438.1 491 434.3L562.1 363.2C591.4 333.9 607.9 294.1 607.9 252.6C607.9 166.2 537.9 96.1 451.4 96.1C414.1 96.1 378.3 109.4 350.1 133.3C370.4 143.4 388.8 156.8 404.6 172.8C418.7 164.5 434.8 160.1 451.4 160.1C502.5 160.1 543.9 201.5 543.9 252.6C543.9 277.1 534.2 300.6 516.8 318L445.7 389.1C441.8 393 437.6 396.5 433.1 399.6L385.6 352.1C402.1 351.2 415.3 337.7 415.8 321C415.8 319.7 415.8 318.4 415.8 317.1C415.8 230.8 345.9 160.2 259.3 160.2C240.1 160.2 221.4 163.7 203.8 170.4L73 39.1zM257.9 224C258.5 224 259 224 259.6 224C274.7 224 289.1 227.7 301.7 234.2C303.5 235.4 305.3 236.5 307.2 237.3C334 253.6 352 283.2 352 316.9C352 317.3 352 317.7 352 318.1L257.9 224zM378.2 480L224 325.8C225.2 410.4 293.6 478.7 378.1 479.9zM171.7 273.5L126.4 228.2L77.8 276.8C48.5 306.1 32 345.9 32 387.4C32 473.8 102 543.9 188.5 543.9C225.7 543.9 261.6 530.6 289.8 506.7C269.5 496.6 251 483.2 235.2 467.2C221.2 475.4 205.1 479.8 188.5 479.8C137.4 479.8 96 438.4 96 387.3C96 362.8 105.7 339.3 123.1 321.9L171.7 273.3z" />
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

function CardDrawer({ card, mode, board, currentUser, canEdit, onClose, onEdit, onView, onChange }: {
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

function RosterDrawer({ title, hint, path, noun, onClose }: {
  title: string
  hint: string
  path: 'teams' | 'departments'
  noun: string
  onClose: () => void
}) {
  type Item = { id: number; name: string; members: { id: number; name: string }[] }
  const [items, setItems] = useState<Item[]>([])
  const [people, setPeople] = useState<{ id: number; name: string }[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [error, setError] = useState('')

  async function load() {
    const data = await api<Record<string, Item[] | { id: number; name: string }[]>>(`/${path}`)
    setItems(data[path] as Item[])
    setPeople(data.people as { id: number; name: string }[])
  }

  useEffect(() => { load().catch((caught) => setError(caught instanceof Error ? caught.message : 'No se pudo cargar.')) }, [path])

  function edit(item: Item) {
    setEditing(item.id)
    setName(item.name)
    setMembers(item.members.map((member) => String(member.id)))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    const body = JSON.stringify({ name: name.trim(), member_ids: members.map(Number) })
    if (editing) await api(`/${path}/${editing}`, { method: 'PATCH', body })
    else await api(`/${path}`, { method: 'POST', body })
    setEditing(null)
    setName('')
    setMembers([])
    await load()
  }

  return (
    <div className="drawer-back" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="row">
          <h2>{title}</h2>
          <button className="ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>
        <p className="muted">{hint}</p>
        <ul className="notes">
          {items.length === 0 && <li>Todavía no hay nada.</li>}
          {items.map((item) => (
            <li key={item.id}>
              <div className="row">
                <strong>{item.name}</strong>
                <button className="ghost" type="button" onClick={() => edit(item)}>Editar</button>
                <button className="ghost" type="button" onClick={async () => { await api(`/${path}/${item.id}`, { method: 'DELETE' }); if (editing === item.id) { setEditing(null); setName(''); setMembers([]) }; await load() }}>Quitar</button>
              </div>
              <p className="muted">{item.members.map((member) => member.name).join(', ') || 'Sin personas'}</p>
            </li>
          ))}
        </ul>
        <form className="composer" onSubmit={save}>
          <h3>{editing ? `Editar ${noun}` : `Nuevo ${noun}`}</h3>
          <label className="field">Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field">Personas
            <select multiple value={members} onChange={(event) => setMembers([...event.target.selectedOptions].map((option) => option.value))}>
              {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </label>
          {error && <p className="error">{error}</p>}
          <div className="row">
            <button className="primary" type="submit">{editing ? 'Guardar' : `Crear ${noun}`}</button>
            {editing && <button className="ghost" type="button" onClick={() => { setEditing(null); setName(''); setMembers([]) }}>Cancelar</button>}
          </div>
        </form>
      </aside>
    </div>
  )
}

function ClientsDrawer({ onClose }: { onClose: () => void }) {
  const [clients, setClients] = useState<{ id: number; name: string; projects_count: number; people_count: number }[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setClients(await api<typeof clients>('/clients'))
  }

  useEffect(() => { load().catch((caught) => setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los clientes.')) }, [])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    await api('/clients', { method: 'POST', body: JSON.stringify({ name: name.trim() }) })
    setName('')
    await load()
  }

  return (
    <div className="drawer-back" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="row">
          <h2>Clientes</h2>
          <button className="ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>
        <p className="muted">Cada proyecto pertenece a una empresa cliente.</p>
        <ul className="notes">
          {clients.map((client) => (
            <li key={client.id}>
              <strong>{client.name}</strong>
              <p className="muted">{client.projects_count} {client.projects_count === 1 ? 'proyecto' : 'proyectos'} · {client.people_count} {client.people_count === 1 ? 'persona' : 'personas'}</p>
            </li>
          ))}
        </ul>
        <form className="composer" onSubmit={save}>
          <h3>Nuevo cliente</h3>
          <label className="field">Empresa<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">Crear cliente</button>
        </form>
      </aside>
    </div>
  )
}

function CategoriesDrawer({ board, onClose, onChange }: {
  board: BoardPayload
  onClose: () => void
  onChange: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')
  const categories = board.categories ?? []

  async function create(event: FormEvent) {
    event.preventDefault()
    const title = name.trim()
    if (!title) return
    setError('')
    try {
      await api(`/boards/${board.board.id}/categories`, { method: 'POST', body: JSON.stringify({ name: title }) })
      setName('')
      await onChange()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear la categoría.')
    }
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault()
    if (editing === null) return
    const title = editName.trim()
    if (!title) return
    await api(`/categories/${editing}`, { method: 'PATCH', body: JSON.stringify({ name: title }) })
    setEditing(null)
    await onChange()
  }

  async function remove(id: number) {
    await api(`/categories/${id}`, { method: 'DELETE' })
    await onChange()
  }

  return (
    <div className="drawer-back" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="row">
          <h2>Categorías del tablero</h2>
          <button className="ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>
        <p className="muted">
          Las categorías son del tablero y se comparten entre columnas. Al mover una tarjeta se mantiene la categoría.
          En el tablero solo se muestran si hay alguna tarjeta asignada a ellas.
        </p>
        <ul className="notes">
          {categories.length === 0 && <li className="muted">Todavía no hay categorías.</li>}
          {categories.map((category) => (
            <li key={category.id}>
              {editing === category.id ? (
                <form className="row" onSubmit={saveEdit}>
                  <input value={editName} onChange={(event) => setEditName(event.target.value)} autoFocus />
                  <button className="primary" type="submit">Guardar</button>
                  <button className="ghost" type="button" onClick={() => setEditing(null)}>Cancelar</button>
                </form>
              ) : (
                <div className="row">
                  <strong>{category.name}</strong>
                  <button className="ghost" type="button" onClick={() => { setEditing(category.id); setEditName(category.name) }}>Editar</button>
                  <button className="ghost" type="button" onClick={() => remove(category.id)}>Borrar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <form className="composer" onSubmit={create}>
          <h3>Nueva categoría</h3>
          <label className="field">Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">Crear categoría</button>
        </form>
      </aside>
    </div>
  )
}

function ProjectDrawer({ board, onClose, onChange }: { board: BoardPayload; onClose: () => void; onChange: () => Promise<void> }) {
  const [visibility, setVisibility] = useState(board.visibility)
  const fields = [
    ['description', 'Descripción'],
    ['assignee', 'Asignación'],
    ['due_date', 'Fecha límite'],
    ['priority', 'Prioridad'],
    ['labels', 'Etiquetas'],
    ['comments', 'Comentarios'],
  ] as const

  return (
    <div className="drawer-back" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <h2>Qué ve el cliente</h2>
        {fields.map(([key, label]) => (
          <label key={key} className="row">
            <input type="checkbox" checked={Boolean(visibility[key])} onChange={async (event) => {
              const next = { ...visibility, [key]: event.target.checked }
              setVisibility(next)
              await api(`/projects/${board.board.project_id}`, { method: 'PATCH', body: JSON.stringify({ [`show_${key}`]: event.target.checked }) })
              await onChange()
            }} />
            {label}
          </label>
        ))}
        <h2>Personas</h2>
        <ul className="notes">
          {board.members.map((member) => <li key={member.id}>{member.name} · {member.role}</li>)}
        </ul>
        <InviteForm projectId={board.board.project_id} />
      </aside>
    </div>
  )
}

function InviteForm({ projectId }: { projectId: number }) {
  const [link, setLink] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const result = await api<{ link: string }>(`/projects/${projectId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), name: form.get('name'), role: form.get('role') }),
    })
    setLink(result.link)
  }
  return (
    <form onSubmit={submit} className="field">
      <h2>Invitar</h2>
      <input name="name" placeholder="Nombre" />
      <input name="email" type="email" placeholder="Correo" required />
      <select name="role" defaultValue="editor">
        <option value="responsable">Responsable</option>
        <option value="editor">Editor</option>
        <option value="lector">Lector</option>
        <option value="cliente">Cliente</option>
      </select>
      <button className="primary" type="submit">Enviar invitación</button>
      {link && <p>Enlace: {link}</p>}
    </form>
  )
}
