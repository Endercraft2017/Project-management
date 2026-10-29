import { useRef, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import "./access.css";
import "./console.css";

export function ConsoleDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
  busy = false,
  layer = 0,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
  busy?: boolean;
  layer?: number;
}) {
  const content = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!busy || next) onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="ez-console-dialog-overlay"
          style={{ zIndex: 10000 + layer * 2 }}
        />
        <Dialog.Content
          ref={content}
          style={{ zIndex: 10001 + layer * 2 }}
          className={`ez-access ez-console-dialog${wide ? " ez-console-dialog--wide" : ""}`}
          {...(!description ? { "aria-describedby": undefined } : {})}
          onOpenAutoFocus={(event) => {
            const firstField = Array.from(
              content.current?.querySelectorAll<HTMLElement>(
                "input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])",
              ) || [],
            ).find((field) => field.getClientRects().length > 0);
            if (firstField) {
              event.preventDefault();
              firstField.focus();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <div className="ez-console-dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && (
                <Dialog.Description>{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="ez-console-dialog-close"
              aria-label="Close dialog"
              disabled={busy}
            >
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
