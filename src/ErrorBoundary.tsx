import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Cat & Mouse recovered from an application error.', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="shell error-screen" role="alert" aria-live="assertive">
        <p className="eyebrow">Game recovery</p>
        <h1>THE MAZE STUMBLED.</h1>
        <p>The game hit an unexpected error. Your saved progress is stored separately from the current screen.</p>
        <button onClick={() => window.location.reload()}>RELOAD GAME</button>
      </main>
    )
  }
}
