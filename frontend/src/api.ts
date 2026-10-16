import { clearProjectRequestCache } from './shared/projectRequestCache'
export type Role = 'responsable' | 'editor' | 'lector' | 'cliente'

export type Person = { id: number; name: string; role?: Role; avatar_url?: string | null }

export type Label = { id: number; name: string; tone: string }

export type CommentReactionType = 'like' | 'love' | 'kiss' | 'encantado'

export type Comment = {
  id: number
  parent_id?: number | null
  body: string
  is_internal: boolean
  author_id: number
  author: string
  created_at?: string
  reactions?: {
    like: number
    love: number
    kiss: number
    encantado: number
    mine?: CommentReactionType | null
  }
}

export type TeamRef = { id: number; name: string; member_ids?: number[] }

export type ChecklistItem = {
  id: number
  module_id?: number | null
  body: string
  is_done: boolean
  due_date?: string | null
  completed_at?: string | null
  position: number
  assignees?: Person[]
}

export type Attachment = {
  id: number
  name: string
  url: string
  mime_type?: string | null
  size: number
  is_image: boolean
  user_id?: number | null
}

export type CardProgress = {
  done: number
  total: number
  percent: number
}

export type CardDependency = {
  id: number
  card_id: number
  title: string
  type: 'fs' | 'ss' | 'ff' | 'sf'
  board_id: number
  board_name: string | null
  workflow_state?: WorkflowState | null
  is_done?: boolean
  preview?: CardDependencyPreview | null
}

export type CardDependencyPreview = Pick<Card, 'id' | 'title' | 'color' | 'is_internal' | 'is_milestone' | 'teams' | 'labels' | 'assignees' | 'attachments' | 'progress'>

export type CardDependencies = {
  predecessors: CardDependency[]
  successors: CardDependency[]
}

export type CardModuleType = 'checklist' | 'files' | 'comments'

export type CardModule = {
  id: number
  type: CardModuleType
  title?: string | null
  position: number
  checklist?: ChecklistItem[]
  progress?: CardProgress
}

export type Card = {
  id: number
  column_id: number
  category_id?: number | null
  title: string
  position: number
  is_internal?: boolean
  is_milestone?: boolean
  milestone_auto_complete?: boolean
  milestone_requirements?: { ready: boolean; regressed: boolean }
  description?: string
  start_date?: string | null
  due_date?: string | null
  started_at?: string | null
  completed_at?: string | null
  priority?: 'baja' | 'media' | 'alta' | 'urgente'
  color?: string | null
  creator: Person
  assignees?: Person[]
  teams?: TeamRef[]
  labels?: Label[]
  comments?: Comment[]
  checklist?: ChecklistItem[]
  modules?: CardModule[]
  attachments?: Attachment[]
  progress?: CardProgress
  dependencies?: CardDependencies
}

export type BacklogResolutionCard = {
  id: number
  title: string
  board_id: number
  board_name: string
  column_id: number
  column_name: string
  is_root: boolean
}

export type BacklogResolutionEndpoint = Pick<BacklogResolutionCard, 'id' | 'title' | 'board_id' | 'board_name'>
export type BacklogResolutionDependency = {
  id: number
  type: 'fs' | 'ss' | 'ff' | 'sf'
  scope: 'flow' | 'external'
  predecessor: BacklogResolutionEndpoint
  successor: BacklogResolutionEndpoint
}
export type BacklogResolution = {
  root_card_id: number
  target_backlog: { id: number; board_id: number; name: string }
  cards: BacklogResolutionCard[]
  dependencies: BacklogResolutionDependency[]
  boards: { id: number; name: string; default_backlog_id: number; backlogs: { id: number; name: string; position: number }[] }[]
  summary: { cards: number; flow_dependencies: number; external_dependencies: number; boards: number }
}

export class ApiError extends Error {
  status: number
  code?: string
  data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = typeof data === 'object' && data !== null && 'code' in data && typeof data.code === 'string' ? data.code : undefined
    this.data = data
  }
}

export type BoardCategory = { id: number; name: string; position: number }

export type WorkflowState = 'backlog' | 'pending' | 'in_progress' | 'review' | 'done'

export type Column = { id: number; name: string; color?: string | null; position: number; workflow_state: WorkflowState; cards: Card[] }

export type BoardPayload = {
  revision: number
  role: Role
  board: {
    id: number
    name: string
    project_id: number
    project_name: string
    client_name: string
  }
  visibility: Record<string, boolean>
  members: Person[]
  labels: Label[]
  categories: BoardCategory[]
  teams: { id: number; name: string }[]
  columns: Column[]
}

export type CalendarEvent = {
  id: number
  project_id: number
  created_by: number | null
  kind: 'meeting' | 'appointment' | 'other' | 'birthday'
  title: string
  description: string | null
  location: string | null
  start_date: string
  end_date: string
  all_day: boolean
  start_time: string | null
  end_time: string | null
  birthday_user?: { id: number; name: string; avatar_url: string | null } | null
}

export type Project = {
  id: number
  name: string
  client_name: string
  role: Role
  boards: { id: number; name: string }[]
}

export type WorkspaceRef = {
  id: number
  name: string
  role: 'owner' | 'member'
  plan: 'free' | 'base' | 'pro' | 'business'
  show_birthdays: boolean
}

export type Profile = {
  user: {
    id: number
    name: string
    first_name: string
    last_name: string | null
    handle: string
    email: string
    birthday_month_day: string | null
    share_birthday: boolean
    is_admin: boolean
    plan: 'free' | 'base' | 'pro' | 'business'
    theme: 'light' | 'dark' | 'system'
    avatar_url?: string | null
    notify_in_app: boolean
    notify_email: boolean
    client_company?: string | null
  }
  unread: number
  workspaces: WorkspaceRef[]
  projects: Project[]
}

const tokenKey = 'gestor_token'

export function getToken() {
  return localStorage.getItem(tokenKey)
}

export function setToken(token: string | null) {
  clearProjectRequestCache()
  if (token) localStorage.setItem(tokenKey, token)
  else localStorage.removeItem(tokenKey)
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`/api${path}`, { ...options, headers })
  const isMutation = options.method !== undefined && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())
  if (response.status === 204) {
    if (isMutation) clearProjectRequestCache()
    return undefined as T
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const fromErrors = data?.errors && typeof data.errors === 'object'
      ? (Object.values(data.errors).flat().find((item) => typeof item === 'string') as string | undefined)
      : undefined
    const message = fromErrors || data?.message || 'No se pudo completar la acción.'
    throw new ApiError(message, response.status, data)
  }
  if (isMutation) clearProjectRequestCache()
  return data as T
}

export async function uploadFile<T>(path: string, file: File, field = 'file'): Promise<T> {
  const body = new FormData()
  body.append(field, file)
  return api<T>(path, { method: 'POST', body })
}
