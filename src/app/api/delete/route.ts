import { NextRequest, NextResponse } from "next/server";
import { createClient } from "webdav";

export const runtime = "nodejs";
export const maxDuration = 60;

function getClient() {
  const url = process.env.NEXTCLOUD_URL;
  const username = process.env.NEXTCLOUD_USERNAME;
  const password = process.env.NEXTCLOUD_PASSWORD;
  if (!url || !username || !password) {
    throw new Error("Nextcloud non configurato (NEXTCLOUD_* env)");
  }
  return createClient(url, { username, password });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const path = body?.path as string | undefined;

    if (!path || typeof path !== "string") {
      return NextResponse.json({ error: "path obbligatorio" }, { status: 400 });
    }

    // Sicurezza: solo path sotto FamilyFridge / base path
    const base = process.env.NEXTCLOUD_BASE_PATH || "/FamilyFridge";
    if (!path.startsWith(base) && !path.includes("FamilyFridge")) {
      return NextResponse.json({ error: "Path non consentito" }, { status: 403 });
    }

    const client = getClient();

    try {
      const exists = await client.exists(path);
      if (!exists) {
        // Già assente sul NAS → ok
        return NextResponse.json({ ok: true, skipped: true });
      }
    } catch {
      /* prosegui comunque con delete */
    }

    await client.deleteFile(path);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Cancellazione fallita";
    console.error("Delete error", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
