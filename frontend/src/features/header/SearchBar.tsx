import { NavIcon } from '../../shared/icons'
import styles from './Header.module.css'

type SearchBarProps = {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <label className={styles.search}>
      <NavIcon>
        <circle cx="11" cy="11" r="6" />
        <path d="m16 16 4 4" />
      </NavIcon>
      <input
        value={value}
        placeholder="Buscar tareas, proyectos..."
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
