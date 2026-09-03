import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
    const body = await req.json();
    const userId = body?.userId as string | undefined;
    const subscription = body?.subscription;
    if (!userId || !subscription?.endpoint) {
      return NextResponse.json({ error: "userId e subscription obbligatori" }, { status: 400 });
    }

    const db = adminDb();
    // endpoint come id stabile
    const id = Buffer.from(subscription.endpoint).toString("base64url").slice(0, 40);
    await db.collection("pushSubscriptions").doc(id).set(
      {
        userId,
        subscription,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
