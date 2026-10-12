import { Component, type ReactNode } from 'react'

interface Props {
  fallback: ReactNode
  children: ReactNode
  /** Changing this resets the boundary (e.g. a new model url). */
  resetKey?: string
}

interface State {
  failed: boolean
  key: string | undefined
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, key: this.props.resetKey }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null
  }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) console.warn('Doll model failed, using placeholder:', error.message)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
