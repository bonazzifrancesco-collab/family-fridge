import { NextRequest, NextResponse } from "next/server";
import { createClient } from "webdav";

export const runtime = "nodejs";
export const maxDuration = 60;

async function compressImageIfNeeded(
  input: Buffer,
  mime: string
): Promise<{ data: Buffer; mime: string }> {
  if (!mime.startsWith("image/") || mime === "image/gif" || mime === "image/svg+xml") {
    return { data: input, mime };
  }

  try {
    const sharpMod = await import("sharp");
    const sharp = sharpMod.default;
    const pipeline = sharp(input).rotate();

    if (mime === "image/png") {
      const out = await pipeline.png({ compressionLevel: 8, palette: false }).toBuffer();
      return { data: Buffer.from(out), mime: "image/png" };
    }

    const out = await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    return { data: Buffer.from(out), mime: "image/jpeg" };
  } catch {
    return { data: input, mime };
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const categoryPath = (form.get("path") as string) || "";
    const familyId = form.get("familyId") as string;

    if (!file || !familyId) {
      return NextResponse.json({ error: "file e familyId obbligatori" }, { status: 400 });
    }

    const url = process.env.NEXTCLOUD_URL;
    const username = process.env.NEXTCLOUD_USERNAME;
    const password = process.env.NEXTCLOUD_PASSWORD;
    const basePath = process.env.NEXTCLOUD_BASE_PATH || "/FamilyFridge";

    if (!url || !username || !password) {
      return NextResponse.json(
        { error: "Nextcloud non configurato (NEXTCLOUD_* env)" },
        { status: 500 }
      );
    }

    const arrayBuf = await file.arrayBuffer();
    const original = Buffer.from(new Uint8Array(arrayBuf));
    let mime = file.type || "application/octet-stream";

    const compressed = await compressImageIfNeeded(original, mime);
    // Usa una variabile nuova per evitare mismatch Buffer<ArrayBuffer> vs Buffer<ArrayBufferLike>
    const payload: Buffer = Buffer.from(compressed.data);
    mime = compressed.mime;

    const safeName = file.name.replace(/[^a-zA-Z0-9._\- \u00C0-\u024F]/g, "_");
    const remoteDir = (
      categoryPath
        ? `${basePath}/${familyId}/${categoryPath}`
        : `${basePath}/${familyId}`
    ).replace(/\/+/g, "/");
    const remotePath = `${remoteDir}/${safeName}`.replace(/\/+/g, "/");

    const client = createClient(url, { username, password });

    try {
      const exists = await client.exists(remoteDir);
      if (!exists) {
        await client.createDirectory(remoteDir, { recursive: true });
      }
    } catch (e) {
      console.warn("createDirectory", e);
    }

    await client.putFileContents(remotePath, payload, {
      overwrite: true,
      contentLength: payload.length,
    });

    return NextResponse.json({
      ok: true,
      path: remotePath,
      name: safeName,
      size: payload.length,
      originalSize: arrayBuf.byteLength,
      mime,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload fallito";
    console.error("Upload error", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
