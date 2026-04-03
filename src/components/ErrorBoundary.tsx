import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    /** Optional label shown in the fallback UI, e.g. "Editor" */
    label?: string;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("[ErrorBoundary]", error, info.componentStack);
    }

    handleReset = () => {
        this.setState({ error: null });
    };

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        const { fallback, label } = this.props;
        if (fallback) return fallback;

        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-player-bg p-8 text-player-text">
                <p className="text-lg font-semibold">
                    {label ? `${label} encountered an error` : "Something went wrong"}
                </p>
                <p className="max-w-md text-center text-sm text-player-text-muted">{error.message}</p>
                <button
                    className="mt-2 rounded bg-player-accent px-4 py-2 text-sm text-white hover:opacity-80"
                    onClick={this.handleReset}
                >
                    Try again
                </button>
            </div>
        );
    }
}
