import type { CSSProperties, ReactNode } from 'react'
import styles from './ProjectContentLoading.module.css'

type Props = {
  title: string
  description: string
  children: ReactNode
}

const DOTS = Array.from({ length: 12 }, (_, index) => index)

export function ProjectContentLoading({ title, description, children }: Props) {
  return (
    <section className={styles.root} role="status" aria-live="polite" aria-label={title}>
      <div className={styles.preview} aria-hidden="true">{children}</div>
      <div className={styles.veil} aria-hidden="true" />
      <div className={styles.content}>
        <div className={styles.dots} aria-hidden="true">
          {DOTS.map((index) => (
            <span
              key={index}
              className={styles.dotPosition}
              style={{ '--dot-index': index } as CSSProperties}
            >
              <span className={styles.dot} />
            </span>
          ))}
        </div>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
      </div>
    </section>
  )
}
