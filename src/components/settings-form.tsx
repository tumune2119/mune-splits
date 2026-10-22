"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Download, FolderOpen, Loader2, Moon, Plus, Sparkles, Sun, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, NativeSelect, Segmented, inputClass } from "@/components/fields";
import { useApp } from "@/components/app-provider";
import { loadDemo, mutate, patchSettings } from "@/lib/client/api";
import { backend, invalidate } from "@/lib/client/backend";
import { saveText } from "@/lib/client/platform";
import { CURRENCIES, LOCALES, formatMoney } from "@/lib/money";
import { DEFAULT_CATEGORIES, SERIES, SERIES_OVERFLOW } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AppSettings, Category } from "@/lib/types";

export function SettingsForm({ dataPath }: { dataPath: string }) {
  const router = useRouter();
  const { settings, setSettings, theme, info } = useApp();
  const [name, setName] = useState(settings.myName);
  const [categories, setCategories] = useState<Category[]>(settings.categories);
  const [busy, setBusy] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<unknown>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async (patch: Partial<AppSettings>, success = "Saved") => {
    try {
      const next = await patchSettings(patch);
      setSettings(next);
      toast.success(success);
      invalidate();
      return next;
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const catsChanged = JSON.stringify(categories) !== JSON.stringify(settings.categories);
  const move = (i: number, d: number) =>
    setCategories((c) => {
      const next = [...c];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <header className="mb-8">
        <h1 className="text-[1.75rem] font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everything here is stored on this computer.</p>
      </header>

      <div className="space-y-5">
        <Section title="You">
          <div className="flex gap-2">
            <Field label="Your name" hint="shown instead of “You” in reports" className="flex-1">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </Field>
            <Button className="mt-auto h-10 rounded-xl" disabled={!name.trim() || name.trim() === settings.myName} onClick={() => save({ myName: name.trim() })}>
              Save
            </Button>
          </div>
        </Section>

        <Section title="Money">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default currency for new events">
              <NativeSelect value={settings.defaultCurrency} onChange={(e) => save({ defaultCurrency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Number format" hint={<span className="money">{formatMoney(12345678, settings.defaultCurrency, settings.locale)}</span>}>
              <NativeSelect value={settings.locale} onChange={(e) => save({ locale: e.target.value })}>
                {LOCALES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </Section>

        <Section title="Appearance">
          <Segmented
            value={theme}
            onChange={(t) => save({ theme: t }, t === "dark" ? "Dark mode on" : "Light mode on")}
            options={[
              { value: "dark", label: <span className="flex items-center gap-1.5"><Moon className="size-4" /> Dark</span> },
              { value: "light", label: <span className="flex items-center gap-1.5"><Sun className="size-4" /> Light</span> },
            ]}
          />
        </Section>

        <Section title="Categories" description="Their order sets their chart colour. Renaming one doesn't change existing expenses.">
          <ul className="space-y-2">
            {categories.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: SERIES[theme][i] ?? SERIES_OVERFLOW }} />
                <input
                  className={cn(inputClass, "w-14 text-center")}
                  value={c.emoji}
                  onChange={(e) => setCategories((cs) => cs.map((x, j) => (j === i ? { ...x, emoji: e.target.value } : x)))}
                  aria-label="Emoji"
                />
                <input
                  className={inputClass}
                  value={c.name}
                  onChange={(e) => setCategories((cs) => cs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  aria-label="Category name"
                />
                <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                  <ArrowUp />
                </Button>
                <Button variant="ghost" size="icon-sm" disabled={i === categories.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                  <ArrowDown />
                </Button>
                <Button variant="ghost" size="icon-sm" disabled={categories.length <= 1} onClick={() => setCategories((cs) => cs.filter((_, j) => j !== i))} aria-label="Remove">
                  <X />
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setCategories((c) => [...c, { name: "", emoji: "🏷️", color: "" }])}>
              <Plus /> Add category
            </Button>
            <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => setCategories(DEFAULT_CATEGORIES)}>
              Reset to defaults
            </Button>
            <span className="flex-1" />
            {catsChanged && (
              <>
                <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => setCategories(settings.categories)}>
                  Cancel
                </Button>
                <Button size="sm" className="rounded-lg" onClick={() => save({ categories: categories.map((c) => ({ ...c, name: c.name.trim() })) }, "Categories saved")}>
                  Save categories
                </Button>
              </>
            )}
          </div>
        </Section>

        <Section title="Backup & data">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={async () => {
                try {
                  const data = await (await backend()).exportBackup();
                  await saveText(JSON.stringify(data, null, 2), `mune-splits-backup-${new Date().toLocaleDateString("sv-SE")}.json`, "application/json");
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}>
              <Download /> Export all data (JSON)
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => fileRef.current?.click()}>
              <Upload /> Import backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  setImportFile(JSON.parse(await f.text()));
                } catch {
                  toast.error("That file isn't valid JSON.");
                }
              }}
            />
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={busy === "demo"}
              onClick={async () => {
                setBusy("demo");
                try {
                  const id = await loadDemo();
                  router.push(`/event?id=${encodeURIComponent(id)}`);
                } catch (err) {
                  toast.error((err as Error).message);
                  setBusy(null);
                }
              }}
            >
              {busy === "demo" ? <Loader2 className="animate-spin" /> : <Sparkles />} Load demo trip
            </Button>
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <FolderOpen className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {info.platform === "desktop" ? (
                <>
                  Stored in <code className="rounded bg-muted px-1 py-0.5 break-all">{dataPath}</code> (database <code>mune-splits.db</code> +{" "}
                  <code>receipts</code> folder).
                </>
              ) : (
                <>
                  Stored in {dataPath.charAt(0).toLowerCase() + dataPath.slice(1)}. Uninstalling the app (or clearing its data) deletes it, so export a backup now and then.
                  Backups move between your phone and computer.
                </>
              )}{" "}
              A single event can be exported as CSV from its ⋯ menu.
            </span>
          </p>
        </Section>

        <Section title="Danger zone" danger>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Delete every event, person, payment and receipt, and reset settings.</p>
            <Button variant="destructive" className="rounded-xl" onClick={() => (setConfirmText(""), setClearOpen(true))}>
              <Trash2 /> Clear all data
            </Button>
          </div>
        </Section>
      </div>

      <Dialog open={importFile !== null} onOpenChange={(o) => !o && setImportFile(null)}>
        <DialogContent className="rounded-2xl border border-border p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Import backup</DialogTitle>
            <DialogDescription>
              <b>Merge</b> keeps what you have (events with the same id are replaced). <b>Replace everything</b> wipes current data first.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            {(["merge", "replace"] as const).map((mode) => (
              <Button
                key={mode}
                variant={mode === "replace" ? "destructive" : "default"}
                className="h-10 rounded-xl"
                disabled={busy === "import"}
                onClick={async () => {
                  setBusy("import");
                  try {
                    const r = await mutate((b) => b.importBackup(importFile, mode));
                    toast.success(`Imported ${r.events} event${r.events === 1 ? "" : "s"}`);
                    setImportFile(null);
                    window.location.replace(window.location.origin + (process.env.NEXT_PUBLIC_BASE_PATH ?? "") + "/"); // full reload: settings and lists all changed
                  } catch (err) {
                    toast.error((err as Error).message);
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {mode === "merge" ? "Merge" : "Replace everything"}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent className="rounded-2xl border border-border p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Clear all data?</DialogTitle>
            <DialogDescription>This can&apos;t be undone. Export a backup first if you might want it back. Type DELETE to confirm.</DialogDescription>
          </DialogHeader>
          <input className={inputClass} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="h-10 rounded-xl" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="h-10 rounded-xl"
              disabled={confirmText !== "DELETE"}
              onClick={async () => {
                try {
                  await mutate((b) => b.clearAll());
                  toast.success("All data cleared");
                  window.location.replace(window.location.origin + (process.env.NEXT_PUBLIC_BASE_PATH ?? "") + "/"); // full reload: settings and lists all changed
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              Clear everything
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, description, danger, children }: { title: string; description?: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <section className={cn("surface rounded-2xl p-5", danger && "border-destructive/30")}>
      <h2 className={cn("font-semibold", danger && "text-destructive")}>{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
