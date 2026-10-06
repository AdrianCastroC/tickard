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
}

export type CardProgress = {
  done: number
  total: number
  percent: number
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
  description?: string
  start_date?: string | null
  due_date?: string | null
  started_at?: string | null
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
}

export type BoardCategory = { id: number; name: string; position: number }

export type Column = { id: number; name: string; color?: string | null; position: number; is_backlog: boolean; cards: Card[] }

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
}

export type Profile = {
  user: {
    id: number
    name: string
    email: string
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
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const fromErrors = data?.errors && typeof data.errors === 'object'
      ? (Object.values(data.errors).flat().find((item) => typeof item === 'string') as string | undefined)
      : undefined
    const message = fromErrors || data?.message || 'No se pudo completar la acción.'
    throw new Error(message)
  }
  return data as T
}

export async function uploadFile<T>(path: string, file: File, field = 'file'): Promise<T> {
  const body = new FormData()
  body.append(field, file)
  return api<T>(path, { method: 'POST', body })
}
