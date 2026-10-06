import type { Metadata } from "next";
import { dataDir } from "@/lib/db";
import { SettingsForm } from "@/components/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <SettingsForm dataPath={dataDir()} />;
}
