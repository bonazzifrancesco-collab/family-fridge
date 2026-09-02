import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer"; // note: add to package.json if needed

// This route is meant to be called by Vercel Cron every hour (or 15 min).
// Protect it with CRON_SECRET.

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Init admin if needed
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
    }
    const adminDb = getFirestore();

    const now = Date.now();
    // Find deadlines that need reminder: dueDate - remindBefore <= now && !reminded
    const snap = await adminDb
      .collection("deadlines")
      .where("reminded", "==", false)
      .get();

    const toRemind = snap.docs.filter((d) => {
      const data = d.data();
      return data.dueDate - data.remindBefore * 60 * 1000 <= now;
    });

    // For each, send email. In production use proper transporter with Gmail App Password.
    // Here we log and mark as reminded. Wire nodemailer or the Gmail API.
    let sent = 0;
    for (const docSnap of toRemind) {
      const data = docSnap.data();
      // TODO: send email to family members or a configured list using GMAIL_USER + APP_PASSWORD
      console.log(`Reminder for: ${data.title} due ${new Date(data.dueDate).toISOString()}`);
      await docSnap.ref.update({ reminded: true });
      sent++;
    }

    return NextResponse.json({ ok: true, checked: snap.size, sent });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
