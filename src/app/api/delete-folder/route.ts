import { NextRequest, NextResponse } from "next/server";
import { createClient } from "webdav";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const familyId = body?.familyId as string | undefined;
    const relativePath = (body?.relativePath as string | undefined) || "";

    if (!familyId) {
      return NextResponse.json({ error: "familyId obbligatorio" }, { status: 400 });
    }

    const url = process.env.NEXTCLOUD_URL;
    const username = process.env.NEXTCLOUD_USERNAME;
    const password = process.env.NEXTCLOUD_PASSWORD;
    const basePath = process.env.NEXTCLOUD_BASE_PATH || "/FamilyFridge";

    if (!url || !username || !password) {
      return NextResponse.json({ error: "Nextcloud non configurato" }, { status: 500 });
    }

    const remoteDir = (
      relativePath
        ? `${basePath}/${familyId}/${relativePath}`
        : `${basePath}/${familyId}`
    ).replace(/\/+/g, "/");

    // Non cancellare l'intera root FamilyFridge per sbaglio
    if (remoteDir === basePath || remoteDir === basePath + "/") {
      return NextResponse.json({ error: "Path root non cancellabile" }, { status: 403 });
    }

    const client = createClient(url, { username, password });

    try {
      const exists = await client.exists(remoteDir);
      if (!exists) {
        return NextResponse.json({ ok: true, skipped: true });
      }
    } catch {
      /* continua */
    }

    await client.deleteFile(remoteDir);

    return NextResponse.json({ ok: true, path: remoteDir });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Cancellazione cartella fallita";
    console.error("delete-folder", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
