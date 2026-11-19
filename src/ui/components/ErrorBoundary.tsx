import { Component, type ComponentChildren } from 'preact';

/** Instead of a blank screen, show what happened and a way back. */
export class ErrorBoundary extends Component<{ children: ComponentChildren }, { error: Error | null }> {
  state = { error: null as Error | null };

  componentDidCatch(error: Error) {
    console.error(error);
    this.setState({ error });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main class="screen">
        <h1>Something went wrong</h1>
        <p>Your data is safe: it is stored on this phone and was not changed by this error.</p>
        <p class="muted small">{error.message}</p>
        <div class="row">
          <button
            type="button"
            class="primary grow"
            onClick={() => {
              location.hash = '#/train';
              location.reload();
            }}
          >
            Restart the app
          </button>
        </div>
      </main>
    );
  }
}
