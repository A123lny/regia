// Confirm dialog Regìa (Fase 3 design system).
// Sostituisce window.confirm/prompt. Rendering via Radix, chiamabile come
// `await confirm({...})` tramite useConfirm(). Il provider si monta in AppShell.

"use client";

import * as React from "react";
import { Dialog } from "radix-ui";
import { X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Se presente, l'utente deve inserire un testo prima di confermare (sostituisce window.prompt). */
  prompt?: {
    label: string;
    placeholder?: string;
    required?: boolean;
    multiline?: boolean;
  };
};

export type ConfirmResult = { confirmed: boolean; value: string };

type ConfirmFn = (opts: ConfirmOptions) => Promise<ConfirmResult>;

const ConfirmCtx = React.createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const fn = React.useContext(ConfirmCtx);
  if (!fn) {
    throw new Error("useConfirm fuori da <ConfirmProvider>");
  }
  return fn;
}

type PendingRequest = {
  opts: ConfirmOptions;
  resolve: (r: ConfirmResult) => void;
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<PendingRequest | null>(null);
  const [value, setValue] = React.useState("");

  const confirm = React.useCallback<ConfirmFn>((opts) => {
    setValue("");
    return new Promise<ConfirmResult>((resolve) => {
      setPending({ opts, resolve });
    });
  }, []);

  const close = (confirmed: boolean) => {
    if (!pending) return;
    pending.resolve({ confirmed, value: value.trim() });
    setPending(null);
    setValue("");
  };

  const opts = pending?.opts;
  const canConfirm = !opts?.prompt?.required || value.trim().length > 0;
  const destructive = opts?.destructive ?? false;

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog.Root
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) close(false);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-5 shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            <div className="flex items-start gap-3">
              {destructive && (
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Dialog.Title
                  className="text-base font-semibold text-text"
                  style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
                >
                  {opts?.title ?? ""}
                </Dialog.Title>
                {opts?.message && (
                  <Dialog.Description className="mt-1 text-sm text-text-muted">
                    {opts.message}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close
                className="rounded-md p-1 text-text-muted hover:bg-surface-muted"
                aria-label="Chiudi"
              >
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            {opts?.prompt && (
              <label className="mt-4 block">
                <span className="text-xs font-medium text-text-muted">{opts.prompt.label}</span>
                {opts.prompt.multiline ? (
                  <textarea
                    autoFocus
                    rows={3}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={opts.prompt.placeholder}
                    className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
                  />
                ) : (
                  <input
                    autoFocus
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={opts.prompt.placeholder}
                    className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canConfirm) close(true);
                    }}
                  />
                )}
              </label>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outline" size="default" onClick={() => close(false)}>
                {opts?.cancelLabel ?? "Annulla"}
              </Button>
              <Button
                variant={destructive ? "destructive" : "default"}
                size="default"
                disabled={!canConfirm}
                onClick={() => close(true)}
                className={cn(destructive && "bg-danger text-white hover:bg-danger/90")}
              >
                {opts?.confirmLabel ?? "Conferma"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ConfirmCtx.Provider>
  );
}
