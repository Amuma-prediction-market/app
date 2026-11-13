import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ToastProvider } from "./components/Toasts";
import { WalletProvider } from "./near/wallet";
import "./styles.css";

/** Catches an error thrown while rendering, so the page shows a message and a way back instead of going blank. */
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="page">
        <div className="card empty">
          Something went wrong while showing this page.{" "}
          <a
            href={window.location.href}
            onClick={(e) => {
              e.preventDefault();
              window.location.reload();
            }}
          >
            Reload it
          </a>
          .
        </div>
      </main>
    );
  }
}

const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 2_000, refetchOnWindowFocus: true, retry: 2 } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <WalletProvider>
            <App />
          </WalletProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
