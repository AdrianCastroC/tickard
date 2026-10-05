import styles from './AccountModal.module.css'
type Props = { notes: { id: number; body: string }[] }
export function NotificationsSection({ notes }: Props) { return <div className={styles.modalBody}><ul className={styles.notes}>{notes.length === 0 && <li className="muted">No hay avisos.</li>}{notes.map((note) => <li key={note.id}>{note.body}</li>)}</ul></div> }
