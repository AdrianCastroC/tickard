import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { type Card } from '../api'

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
  priorityLabel, DEFAULT_CARD_STRIPE, cardStripeStyle, projectDots,
  NavIcon, DotsIcon, CollapseColumnIcon, ExpandColumnIcon, PlusIcon, UserPlusIcon,
  EditIcon, ConfigIcon, PencilIcon, SaveIcon, FloppyIcon, PaletteIcon, PinIcon,
  UnpinIcon, VisibilityIcon, MinusIcon, ChevronIcon, ArchiveIcon, TrashIcon,
  AccountIco, ProfileUserIcon, SettingsIcon, BellIcon, MoonIcon, SunIcon, ComputerIcon,
  GlobeIcon, HelpCircleIcon, SparklesIcon, LogoutIcon, ChevronRightIcon, Avatar,
  autoGrowTextarea, formatDate, sanitizeDescriptionHtml, descriptionToEditorHtml,
  descriptionIsEmpty, selectionAnchor, DescriptionEditor,
}
export type { OpenTab }


function BoldIcon() {   return (     <svg className="desc-tool-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">       <path fill="currentColor" d="M160 96C142.3 96 128 110.3 128 128C128 145.7 142.3 160 160 160L192 160L192 480L160 480C142.3 480 128 494.3 128 512C128 529.7 142.3 544 160 544L384 544C454.7 544 512 486.7 512 416C512 369.5 487.2 328.7 450 306.3C468.7 284 480 255.3 480 224C480 153.3 422.7 96 352 96L160 96zM416 224C416 259.3 387.3 288 352 288L256 288L256 160L352 160C387.3 160 416 188.7 416 224zM256 480L256 352L384 352C419.3 352 448 380.7 448 416C448 451.3 419.3 480 384 480L256 480z" />     </svg>   ) }  function ItalicIcon() {   return (     <svg className="desc-tool-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">       <path fill="currentColor" d="M256 128C256 110.3 270.3 96 288 96L480 96C497.7 96 512 110.3 512 128C512 145.7 497.7 160 480 160L421.3 160L288 480L352 480C369.7 480 384 494.3 384 512C384 529.7 369.7 544 352 544L160 544C142.3 544 128 529.7 128 512C128 494.3 142.3 480 160 480L218.7 480L352 160L288 160C270.3 160 256 145.7 256 128z" />     </svg>   ) }  function UnderlineIcon() {   return (     <svg className="desc-tool-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">       <path fill="currentColor" d="M128 96C128 78.3 142.3 64 160 64L224 64C241.7 64 256 78.3 256 96C256 113.7 241.7 128 224 128L224 288C224 341 267 384 320 384C373 384 416 341 416 288L416 128C398.3 128 384 113.7 384 96C384 78.3 398.3 64 416 64L480 64C497.7 64 512 78.3 512 96C512 113.7 497.7 128 480 128L480 288C480 376.4 408.4 448 320 448C231.6 448 160 376.4 160 288L160 128C142.3 128 128 113.7 128 96zM128 544C128 526.3 142.3 512 160 512L480 512C497.7 512 512 526.3 512 544C512 561.7 497.7 576 480 576L160 576C142.3 576 128 561.7 128 544z" />     </svg>   ) }  function ListUlIcon() {   return (     <svg className="desc-tool-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">       <path fill="currentColor" d="M112 208C138.5 208 160 186.5 160 160C160 133.5 138.5 112 112 112C85.5 112 64 133.5 64 160C64 186.5 85.5 208 112 208zM256 128C238.3 128 224 142.3 224 160C224 177.7 238.3 192 256 192L544 192C561.7 192 576 177.7 576 160C576 142.3 561.7 128 544 128L256 128zM256 288C238.3 288 224 302.3 224 320C224 337.7 238.3 352 256 352L544 352C561.7 352 576 337.7 576 320C576 302.3 561.7 288 544 288L256 288zM256 448C238.3 448 224 462.3 224 480C224 497.7 238.3 512 256 512L544 512C561.7 512 576 497.7 576 480C576 462.3 561.7 448 544 448L256 448zM112 528C138.5 528 160 506.5 160 480C160 453.5 138.5 432 112 432C85.5 432 64 453.5 64 480C64 506.5 85.5 528 112 528zM160 320C160 293.5 138.5 272 112 272C85.5 272 64 293.5 64 320C64 346.5 85.5 368 112 368C138.5 368 160 346.5 160 320z" />     </svg>   ) }  function ListOlIcon() {   return (     <svg className="desc-tool-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">       <path fill="currentColor" d="M64 136C64 122.8 74.7 112 88 112L136 112C149.3 112 160 122.7 160 136L160 240L184 240C197.3 240 208 250.7 208 264C208 277.3 197.3 288 184 288L88 288C74.7 288 64 277.3 64 264C64 250.7 74.7 240 88 240L112 240L112 160L88 160C74.7 160 64 149.3 64 136zM94.4 365.2C105.8 356.6 119.7 352 134 352L138.9 352C172.6 352 200 379.4 200 413.1C200 432.7 190.6 451 174.8 462.5L150.8 480L184 480C197.3 480 208 490.7 208 504C208 517.3 197.3 528 184 528L93.3 528C77.1 528 64 514.9 64 498.7C64 489.3 68.5 480.5 76.1 475L146.6 423.7C150 421.2 152 417.3 152 413.1C152 405.9 146.1 400 138.9 400L134 400C130.1 400 126.3 401.3 123.2 403.6L102.4 419.2C91.8 427.2 76.8 425 68.8 414.4C60.8 403.8 63 388.8 73.6 380.8L94.4 365.2zM288 128L544 128C561.7 128 576 142.3 576 160C576 177.7 561.7 192 544 192L288 192C270.3 192 256 177.7 256 160C256 142.3 270.3 128 288 128zM288 288L544 288C561.7 288 576 302.3 576 320C576 337.7 561.7 352 544 352L288 352C270.3 352 256 337.7 256 320C256 302.3 270.3 288 288 288zM288 448L544 448C561.7 448 576 462.3 576 480C576 497.7 561.7 512 544 512L288 512C270.3 512 256 497.7 256 480C256 462.3 270.3 448 288 448z" />     </svg>   ) }  function LinkIcon() {   return (     <svg className="desc-tool-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">       <path fill="currentColor" d="M451.5 160C434.9 160 418.8 164.5 404.7 172.7C388.9 156.7 370.5 143.3 350.2 133.2C378.4 109.2 414.3 96 451.5 96C537.9 96 608 166 608 252.5C608 294 591.5 333.8 562.2 363.1L491.1 434.2C461.8 463.5 422 480 380.5 480C294.1 480 224 410 224 323.5C224 322 224 320.5 224.1 319C224.6 301.3 239.3 287.4 257 287.9C274.7 288.4 288.6 303.1 288.1 320.8C288.1 321.7 288.1 322.6 288.1 323.4C288.1 374.5 329.5 415.9 380.6 415.9C405.1 415.9 428.6 406.2 446 388.8L517.1 317.7C534.4 300.4 544.2 276.8 544.2 252.3C544.2 201.2 502.8 159.8 451.7 159.8zM307.2 237.3C305.3 236.5 303.4 235.4 301.7 234.2C289.1 227.7 274.7 224 259.6 224C235.1 224 211.6 233.7 194.2 251.1L123.1 322.2C105.8 339.5 96 363.1 96 387.6C96 438.7 137.4 480.1 188.5 480.1C205 480.1 221.1 475.7 235.2 467.5C251 483.5 269.4 496.9 289.8 507C261.6 530.9 225.8 544.2 188.5 544.2C102.1 544.2 32 474.2 32 387.7C32 346.2 48.5 306.4 77.8 277.1L148.9 206C178.2 176.7 218 160.2 259.5 160.2C346.1 160.2 416 230.8 416 317.1C416 318.4 416 319.7 416 321C415.6 338.7 400.9 352.6 383.2 352.2C365.5 351.8 351.6 337.1 352 319.4C352 318.6 352 317.9 352 317.1C352 283.4 334 253.8 307.2 237.5z" />     </svg>   ) }  function UnlinkIcon() {   return (     <svg className="desc-tool-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">       <path fill="currentColor" d="M73 39.1C63.6 29.7 48.4 29.7 39.1 39.1C29.8 48.5 29.7 63.7 39 73.1L567 601.1C576.4 610.5 591.6 610.5 600.9 601.1C610.2 591.7 610.3 576.5 600.9 567.2L478.9 445.2C483.1 441.8 487.2 438.1 491 434.3L562.1 363.2C591.4 333.9 607.9 294.1 607.9 252.6C607.9 166.2 537.9 96.1 451.4 96.1C414.1 96.1 378.3 109.4 350.1 133.3C370.4 143.4 388.8 156.8 404.6 172.8C418.7 164.5 434.8 160.1 451.4 160.1C502.5 160.1 543.9 201.5 543.9 252.6C543.9 277.1 534.2 300.6 516.8 318L445.7 389.1C441.8 393 437.6 396.5 433.1 399.6L385.6 352.1C402.1 351.2 415.3 337.7 415.8 321C415.8 319.7 415.8 318.4 415.8 317.1C415.8 230.8 345.9 160.2 259.3 160.2C240.1 160.2 221.4 163.7 203.8 170.4L73 39.1zM257.9 224C258.5 224 259 224 259.6 224C274.7 224 289.1 227.7 301.7 234.2C303.5 235.4 305.3 236.5 307.2 237.3C334 253.6 352 283.2 352 316.9C352 317.3 352 317.7 352 318.1L257.9 224zM378.2 480L224 325.8C225.2 410.4 293.6 478.7 378.1 479.9zM171.7 273.5L126.4 228.2L77.8 276.8C48.5 306.1 32 345.9 32 387.4C32 473.8 102 543.9 188.5 543.9C225.7 543.9 261.6 530.6 289.8 506.7C269.5 496.6 251 483.2 235.2 467.2C221.2 475.4 205.1 479.8 188.5 479.8C137.4 479.8 96 438.4 96 387.3C96 362.8 105.7 339.3 123.1 321.9L171.7 273.3z" />     </svg>   ) } 

export { BoldIcon, ItalicIcon, UnderlineIcon, ListUlIcon, ListOlIcon, LinkIcon, UnlinkIcon }
