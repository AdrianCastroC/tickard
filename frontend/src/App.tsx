import { useEffect, useState } from 'react'
import { getToken } from './api'
import { Invite, Login, Workspace } from './screens'

export default function App() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const invite = path.match(/^\/invitar\/([^/]+)/)
  if (invite) return <Invite token={invite[1]} />
  if (!getToken() || path === '/login') return <Login />
  return <Workspace />
}
