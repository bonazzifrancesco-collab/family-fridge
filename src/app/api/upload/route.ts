import { NextRequest, NextResponse } from "next/server";
import { createClient } from "webdav";

export const runtime = "nodejs";
export const maxDuration = 60;

async function compressImageIfNeeded(buffer: Buffer, mime: string): Promise<{ buffer: Buffer; mime: string }> {
  // Solo immagini JPEG/PNG/WebP — compressione ad alta qualità (quasi lossless percepito)
  if (!mime.startsWith("image/") || mime === "image/gif" || mime === "image/svg+xml") {
    return { buffer, mime };
  }

  try {
    // Usa sharp se disponibile; altrimenti ritorna originale
    const sharp = (await import("sharp")).default;
    let pipeline = sharp(buffer).rotate(); // rispetta EXIF orientation

    if (mime === "image/png") {
      // PNG: compressione lossless
      const out = await pipeline.png({ compressionLevel: 8, palette: false }).toBuffer();
      return { buffer: out, mime: "image/png" };
    }

    // JPEG / altro → JPEG qualità 92 (ottimo compromesso, quasi indistinguibile)
    const out = await pipeline
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
    return { buffer: out, mime: "image/jpeg" };
  } catch {
    // sharp non installato o errore → file originale
    return { buffer, mime };
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
    let buffer = Buffer.from(arrayBuf);
    let mime = file.type || "application/octet-stream";

    // Compressione automatica immagini ad alta qualità
    const compressed = await compressImageIfNeeded(buffer, mime);
    buffer = compressed.buffer;
    mime = compressed.mime;

    const safeName = file.name.replace(/[^a-zA-Z0-9._\- \u00C0-\u024F]/g, "_");
    const remoteDir = categoryPath
      ? `${basePath}/${familyId}/${categoryPath}`.
          replace(/\/+/g, "/")
      : `${basePath}/${familyId}`;
    const remotePath = `${remoteDir}/${safeName}`.replace(/\/+/g, "/");

    const client = createClient(url, { username, password });

    // Crea cartelle se mancano
    try {
      const exists = await client.exists(remoteDir);
      if (!exists) {
        await client.createDirectory(remoteDir, { recursive: true });
      }
    } catch (e) {
      console.warn("createDirectory", e);
    }

    await client.putFileContents(remotePath, buffer, {
      overwrite: true,
      contentLength: buffer.length,
    });

    return NextResponse.json({
      ok: true,
      path: remotePath,
      name: safeName,
      size: buffer.length,
      originalSize: arrayBuf.byteLength,
      mime,
    });
  } catch (e: any) {
    console.error("Upload error", e);
    return NextResponse.json({ error: e.message || "Upload fallito" }, { status: 500 });
  }
}
