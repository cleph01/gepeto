"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// An in-app stand-in for window.confirm: const ok = await confirm({ ... }).
// Render confirmDialog somewhere in the component that calls it.

export interface ConfirmOptions {
  title: string;
  body: string;
  /** Says what happens, e.g. "Undo check-in", never just "OK". */
  confirmLabel: string;
  /** Says what staying put means, so it can't be mistaken for the action. */
  cancelLabel: string;
  /** Red, for something that stops or takes back work. */
  danger?: boolean;
}

export function useConfirm() {
  const [request, setRequest] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setRequest({ ...options, resolve })),
    []
  );

  const confirmDialog = request ? (
    <ConfirmDialog
      {...request}
      onAnswer={(ok) => {
        request.resolve(ok);
        setRequest(null);
      }}
    />
  ) : null;

  return { confirm, confirmDialog };
}

function ConfirmDialog({ title, body, confirmLabel, cancelLabel, danger, onAnswer }: ConfirmOptions & { onAnswer: (ok: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Starts on the safe choice, so a stray Enter changes nothing. Focus goes back
  // to whatever opened this, and Tab stays between the two buttons.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onAnswer(false);
    } else if (e.key === "Tab") {
      e.preventDefault();
      (document.activeElement === cancelRef.current ? confirmRef : cancelRef).current?.focus();
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onAnswer(false); }}
      onKeyDown={onKeyDown}
      style={{
        position: "fixed", inset: 0, zIndex: 6000, background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", padding: "20px 20px 16px" }}
      >
        <h2 id="confirm-title" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{title}</h2>
        <p id="confirm-body" style={{ margin: "6px 0 18px", fontSize: 13, color: "#5F5E5A", lineHeight: 1.5 }}>{body}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <button
            ref={cancelRef}
            onClick={() => onAnswer(false)}
            style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid rgba(0,0,0,0.14)", background: "#fff", color: "#3a3a3a" }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={() => onAnswer(true)}
            style={{ fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 8, cursor: "pointer", border: "none", background: danger ? "#A32D2D" : "#185FA5", color: "#fff" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
