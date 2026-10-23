"use client";

import { Fragment, useState, useSyncExternalStore } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmButton } from "@/components/confirm-button";
import { cn } from "@/lib/utils";

export interface MenuAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  /** Starts a new group (a divider above it). */
  group?: boolean;
  /** Ask before running (delete, leave…). */
  confirm?: { title: string; description: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void | Promise<void> };
}

const PHONE = "(max-width: 639px)";
function usePhone() {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(PHONE);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(PHONE).matches,
    () => false,
  );
}

/**
 * A "more actions" menu: a dropdown on larger screens, and on phones an action sheet that slides up
 * from the bottom with large rows and a separate Cancel button (Android bottom sheet / iOS action sheet).
 */
export function ActionMenu({ trigger, actions, title }: { trigger: React.ReactElement; actions: MenuAction[]; title?: string }) {
  const phone = usePhone();
  const [sheet, setSheet] = useState(false);
  const [confirming, setConfirming] = useState<MenuAction | null>(null);

  const run = (a: MenuAction) => {
    if (a.confirm) setConfirming(a);
    else a.onSelect?.();
  };

  const confirm = confirming?.confirm && (
    <ConfirmButton
      open
      onOpenChange={(o) => !o && setConfirming(null)}
      title={confirming.confirm.title}
      description={confirming.confirm.description}
      confirmLabel={confirming.confirm.confirmLabel}
      destructive={confirming.confirm.destructive}
      onConfirm={confirming.confirm.onConfirm}
    />
  );

  if (!phone) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {actions.map((a) => (
              <Fragment key={a.key}>
                {a.group && <DropdownMenuSeparator />}
                <DropdownMenuItem disabled={a.disabled} variant={a.destructive ? "destructive" : "default"} onSelect={() => run(a)}>
                  {a.icon} {a.label}
                </DropdownMenuItem>
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {confirm}
      </>
    );
  }

  return (
    <>
      <span onClick={() => setSheet(true)} className="contents">
        {trigger}
      </span>
      <Dialog open={sheet} onOpenChange={setSheet}>
        <DialogContent showCloseButton={false} className="gap-0 border-0 bg-transparent p-0 ring-0 max-sm:px-3 max-sm:pt-0 max-sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <DialogTitle className="sr-only">{title ?? "Actions"}</DialogTitle>
          <DialogDescription className="sr-only">Choose an action</DialogDescription>
          <div className="overflow-hidden rounded-[22px] border border-border bg-popover">
            {title && <p className="truncate px-5 pt-4 pb-2 text-center text-xs font-medium text-muted-foreground">{title}</p>}
            {actions.map((a, i) => (
              <button
                key={a.key}
                type="button"
                disabled={a.disabled}
                onClick={() => {
                  setSheet(false);
                  // Let the sheet close before a confirmation opens on top.
                  setTimeout(() => run(a), a.confirm ? 180 : 0);
                }}
                className={cn(
                  "flex min-h-14 w-full items-center gap-4 px-5 text-left text-base font-medium transition-colors active:bg-accent disabled:opacity-40",
                  (i > 0 || title) && "border-t border-border/60",
                  a.group && i > 0 && "border-t-[6px] border-t-background/70",
                  a.destructive ? "text-destructive" : "text-foreground",
                  "[&_svg]:size-5 [&_svg]:shrink-0",
                  a.destructive ? "[&_svg]:text-destructive" : "[&_svg]:text-muted-foreground",
                )}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSheet(false)}
            className="mt-2 min-h-14 w-full rounded-[22px] border border-border bg-popover text-base font-semibold text-brand active:bg-accent"
          >
            Cancel
          </button>
        </DialogContent>
      </Dialog>
      {confirm}
    </>
  );
}
