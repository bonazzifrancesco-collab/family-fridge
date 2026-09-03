import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import webpush from "web-push";

function adminDb() {
  if (!getApps().length) {
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
  return getFirestore();
}

export async function POST(req: NextRequest) {
  try {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:admin@family-fridge.app";

    if (!publicKey || !privateKey) {
      return NextResponse.json(
        { error: "VAPID keys non configurate (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)" },
        { status: 500 }
      );
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const body = await req.json();
    const familyId = body?.familyId as string | undefined;
    const excludeUserId = body?.excludeUserId as string | undefined;
    const title = (body?.title as string) || "Family Fridge";
    const message = (body?.body as string) || "Hai una novità";
    const url = (body?.url as string) || "/dashboard";

    if (!familyId) {
      return NextResponse.json({ error: "familyId obbligatorio" }, { status: 400 });
    }

    const db = adminDb();
    const fam = await db.collection("families").doc(familyId).get();
    const members: string[] = fam.data()?.members || [];
    const targetUsers = members.filter((uid) => uid !== excludeUserId);

    if (targetUsers.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    const snap = await db.collection("pushSubscriptions").get();
    const payload = JSON.stringify({ title, body: message, url });

    let sent = 0;
    const errors: string[] = [];

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      if (!targetUsers.includes(data.userId)) continue;
      const sub = data.subscription;
      if (!sub?.endpoint) continue;
      try {
        await webpush.sendNotification(sub, payload);
        sent++;
      } catch (e: any) {
        // subscription scaduta
        if (e.statusCode === 404 || e.statusCode === 410) {
          await docSnap.ref.delete().catch(() => {});
        } else {
          errors.push(String(e.message || e));
        }
      }
    }

    return NextResponse.json({ ok: true, sent, errors: errors.length ? errors : undefined });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
