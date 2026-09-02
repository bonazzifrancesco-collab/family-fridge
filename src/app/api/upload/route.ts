/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "webdav";

export const runtime = "nodejs";
export const maxDuration = 60;

async function compressImageIfNeeded(
  input: Uint8Array,
  mime: string
): Promise<{ data: Uint8Array; mime: string }> {
  if (!mime.startsWith("image/") || mime === "image/gif" || mime === "image/svg+xml") {
    return { data: input, mime };
  }

  try {
    const sharpMod = await import("sharp");
    const sharp = sharpMod.default;
    const pipeline = sharp(Buffer.from(input)).rotate();

    if (mime === "image/png") {
      const out = await pipeline.png({ compressionLevel: 8, palette: false }).toBuffer();
      return { data: new Uint8Array(out), mime: "image/png" };
    }

    const out = await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    return { data: new Uint8Array(out), mime: "image/jpeg" };
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
        {
          error:
            "Nextcloud non configurato. Imposta NEXTCLOUD_URL, NEXTCLOUD_USERNAME, NEXTCLOUD_PASSWORD su Vercel.",
        },
        { status: 500 }
      );
    }

    const arrayBuf = await file.arrayBuffer();
    const original = new Uint8Array(arrayBuf);
    let mime = file.type || "application/octet-stream";

    const compressed = await compressImageIfNeeded(original, mime);
    const payload = compressed.data;
    mime = compressed.mime;

    const safeName = file.name.replace(/[^a-zA-Z0-9._\- \u00C0-\u024F]/g, "_");
    const remoteDir = (
      categoryPath
        ? basePath + "/" + familyId + "/" + categoryPath
        : basePath + "/" + familyId
    ).replace(/\/+/g, "/");
    const remotePath = (remoteDir + "/" + safeName).replace(/\/+/g, "/");

    const client = createClient(url, { username, password });

    // Crea cartella base e intermedie
    const parts = remoteDir.split("/").filter(Boolean);
    let built = "";
    for (const part of parts) {
      built += "/" + part;
      try {
        const exists = await client.exists(built);
        if (!exists) {
          await client.createDirectory(built);
        }
      } catch (e) {
        console.warn("mkdir", built, e);
      }
    }

    await client.putFileContents(remotePath, Buffer.from(payload), {
      overwrite: true,
    });

    return NextResponse.json({
      ok: true,
      path: remotePath,
      name: safeName,
      size: payload.length,
      originalSize: arrayBuf.byteLength,
      mime,
    });
  } catch (e: any) {
    console.error("Upload error", e);
    const message =
      e?.message ||
      (typeof e === "string" ? e : "Upload fallito");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
