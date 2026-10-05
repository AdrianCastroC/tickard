import styles from './Header.module.css'

export function Brand() {
  return (
    <div className={styles.brand}>
      <img src="/logo-removebg.png" alt="tickard" />
    </div>
  )
}
