import { useState } from 'react'

export function useSidebarState() {
  const [mini, setMini] = useState(() => {
    try { return localStorage.getItem('gestor:side-mini') === '1' }
    catch { return false }
  })
  function toggle() {
    setMini((current) => {
      const next = !current
      try { localStorage.setItem('gestor:side-mini', next ? '1' : '0') }
      catch { /* Storage may be unavailable. */ }
      return next
    })
  }
  return { mini, toggle }
}
