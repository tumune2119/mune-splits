import { handle } from "@/lib/api";
import { UserError, saveReceipt } from "@/lib/store";

/** Stores an uploaded receipt in data/receipts and returns its file name. */
export async function POST(request: Request) {
  return handle(async () => {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new UserError("No file uploaded.");
    return { name: saveReceipt(Buffer.from(await file.arrayBuffer()), file.type) };
  });
}
