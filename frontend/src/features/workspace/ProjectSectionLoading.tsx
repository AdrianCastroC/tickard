import { ProjectContentLoading } from './ProjectContentLoading'
import styles from './ProjectSectionLoading.module.css'

type Section = 'files' | 'personnel'
const ROWS = Array.from({ length: 11 }, (_, index) => index)
const STATS = Array.from({ length: 6 }, (_, index) => index)

export function ProjectSectionLoading({ section }: { section: Section }) {
  const personnel = section === 'personnel'
  return <ProjectContentLoading
    title={personnel ? 'Cargando Personal' : 'Cargando archivos'}
    description={personnel
      ? 'Preparando miembros, equipos y carga de trabajo del proyecto…'
      : 'Preparando documentos, adjuntos y almacenamiento del proyecto…'}
  >
    <div className={styles.skeleton}>
      {personnel && <div className={styles.stats}>
        {STATS.map((i) => <div key={i} className={styles.stat}>
          <span className={styles.statIcon} /><div className={styles.statLines}><i /><i /><i /></div>
        </div>)}
      </div>}
      <div className={styles.toolbar}>
        {!personnel && <><i className={styles.pill} /><i className={styles.pill} /><i className={styles.pillLong} /></>}
        <i className={styles.search} />
        <i className={styles.filter} />
        <i className={styles.filter} />
        <i className={styles.action} />
      </div>
      <div className={styles.body}>
        <div className={styles.left}>
          <div className={styles.head}>
            <i className={styles.name} /><i /><i /><i />
          </div>
          <div className={styles.rows}>
            {ROWS.map((i) => <div key={i} className={styles.row}>
              <span className={styles.rowName}><b /><i style={{ width: `${58 + i % 4 * 10}%` }} /></span>
              <i /><i /><i className={styles.line} />
            </div>)}
          </div>
          {personnel && <div className={styles.chart}>
            <i className={styles.chartTitle} />
            {STATS.slice(0,4).map((i) => <div key={i} className={styles.chartRow}><i /><span style={{ width: `${70 - i * 10}%` }} /></div>)}
          </div>}
        </div>
        <div className={styles.details}>
          <div className={styles.detailHead}><b /><span><i /><i /></span></div>
          <div className={styles.detailTabs}><i /><i /><i /></div>
          <div className={styles.preview}>
            {personnel ? <><div className={styles.detailStats}>{STATS.slice(0,4).map((i) => <i key={i} />)}</div>
              {ROWS.slice(0,6).map((i) => <i key={i} className={styles.previewLine} />)}</>
              : <><div className={styles.fileShape} /><i className={styles.previewLine} /><i className={styles.previewLine} /></>}
          </div>
          <i className={styles.detailAction} />
        </div>
      </div>
      {!personnel && <div className={styles.footer}><i /><span /><i /></div>}
    </div>
  </ProjectContentLoading>
}
