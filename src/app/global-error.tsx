"use client";

// global-error replaces the entire root layout on a catastrophic error, so
// it renders its own <html>/<body> and can't rely on globals.css or the
// data-theme toggle reaching it — everything here is inlined on purpose.

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#08090d",
          color: "#e6e9ef",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "1rem",
        }}
      >
        <div
          style={{
            maxWidth: 380,
            width: "100%",
            textAlign: "center",
            border: "1px solid #20242e",
            background: "#0e1016",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h1 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>
            NetTwin failed to load
          </h1>
          <p style={{ fontSize: 12, color: "#9aa1af", lineHeight: 1.5, margin: "0 0 20px" }}>
            A critical error stopped the app from rendering. Reloading usually fixes it.
            Simulation only — no real devices were involved.
          </p>
          <button
            onClick={() => retry()}
            style={{
              width: "100%",
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: "#4f7cff",
              color: "#fff",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p style={{ fontSize: 10, color: "#6b7280", marginTop: 16, fontFamily: "monospace" }}>
              Error ref: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
