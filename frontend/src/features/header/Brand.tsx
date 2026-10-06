import styles from './Header.module.css'

export function Brand({ mini = false }: { mini?: boolean }) {
  return (
    <div className={styles.brand}>
      <img src={mini ? '/imagologo.png' : '/logo-removebg.png'} alt="tickard" />
    </div>
  )
}
