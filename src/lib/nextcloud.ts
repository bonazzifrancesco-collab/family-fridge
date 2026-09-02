import { createClient, type WebDAVClient } from "webdav";

let client: WebDAVClient | null = null;

export function getNextcloudClient() {
  if (client) return client;

  const url = process.env.NEXTCLOUD_URL;
  const username = process.env.NEXTCLOUD_USERNAME;
  const password = process.env.NEXTCLOUD_PASSWORD;

  if (!url || !username || !password) {
    throw new Error("Nextcloud credentials missing in env");
  }

  client = createClient(url, {
    username,
    password,
  });

  return client;
}

export async function ensureBaseFolder() {
  const dav = getNextcloudClient();
  const base = process.env.NEXTCLOUD_BASE_PATH || "/FamilyFridge";
  try {
    const exists = await dav.exists(base);
    if (!exists) {
      await dav.createDirectory(base, { recursive: true });
    }
  } catch (e) {
    console.error("Error ensuring base folder", e);
  }
  return base;
}

export async function listFolder(path: string) {
  const dav = getNextcloudClient();
  return dav.getDirectoryContents(path);
}

export async function createFolder(path: string) {
  const dav = getNextcloudClient();
  return dav.createDirectory(path, { recursive: true });
}

export async function deleteItem(path: string) {
  const dav = getNextcloudClient();
  return dav.deleteFile(path);
}

export async function uploadFile(path: string, data: Buffer | string, contentType?: string) {
  const dav = getNextcloudClient();
  return dav.putFileContents(path, data, {
    overwrite: true,
    contentLength: typeof data === "string" ? Buffer.byteLength(data) : data.length,
  });
}

export async function downloadFile(path: string) {
  const dav = getNextcloudClient();
  return dav.getFileContents(path, { format: "binary" });
}
