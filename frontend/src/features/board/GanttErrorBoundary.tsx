import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  onRetry: () => void
  onClose: () => void
}

type State = { error: Error | null }

/** A Gantt rendering failure must not unmount the whole project/workspace UI. */
export class GanttErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error al representar el Gantt del tablero:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return <section className="gantt-failure" role="alert">
        <h2>No se pudo mostrar el Gantt</h2>
        <p>Se ha producido un error al dibujar la línea temporal. Puedes reintentarlo
          o regresar al tablero sin perder los datos.</p>
        <details><summary>Detalle técnico</summary>
          <code>{this.state.error.message}</code>
        </details>
        <div>
          <button type="button" className="primary" onClick={this.props.onRetry}>Reintentar Gantt</button>
          <button type="button" className="ghost" onClick={this.props.onClose}>Volver al tablero</button>
        </div>
      </section>
    }
    return this.props.children
  }
}
