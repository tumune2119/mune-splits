"use client";

import { createContext, useContext } from "react";
import { backend } from "@/lib/client/backend";
import { uploadReceipt as uploadLocal } from "@/lib/client/api";

/** Where the open event keeps its receipts: this device (local events) or the cloud (shared events). */
export interface EventData {
  uploadReceipt(file: File): Promise<string>;
  receiptUrl(name: string): Promise<string | null>;
}

const local: EventData = {
  uploadReceipt: uploadLocal,
  receiptUrl: async (name) => (await backend()).receiptUrl(name),
};

const Ctx = createContext<EventData>(local);
export const EventDataProvider = Ctx.Provider;
export const useEventData = () => useContext(Ctx);
