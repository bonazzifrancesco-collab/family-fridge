import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
    const adminDb = getFirestore();

    const now = Date.now();
    const snap = await adminDb
      .collection("deadlines")
      .where("reminded", "==", false)
      .get();

    const toRemind = snap.docs.filter((d) => {
      const data = d.data();
      let msBefore = 24 * 60 * 60 * 1000;
      if (typeof data.remindDays === "number") {
        msBefore = data.remindDays * 24 * 60 * 60 * 1000;
      } else if (typeof data.remindBefore === "number") {
        msBefore = data.remindBefore * 60 * 1000;
      }
      return data.dueDate - msBefore <= now;
    });

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;

    let transporter: nodemailer.Transporter | null = null;
    if (gmailUser && gmailPass) {
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
      });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const docSnap of toRemind) {
      const data = docSnap.data();
      const dueStr = new Date(data.dueDate).toLocaleString("it-IT", {
        dateStyle: "full",
        timeStyle: "short",
      });

      // Raccogli email destinatari: autore + tutti i membri della famiglia
      const recipients = new Set<string>();

      // 1) email dell'autore della scadenza
      if (data.authorId) {
        try {
          const userSnap = await adminDb.collection("users").doc(data.authorId).get();
          const email = userSnap.data()?.email;
          if (email) recipients.add(String(email).toLowerCase());
        } catch (e) {
          console.warn("author lookup", e);
        }
      }

      // 2) tutti i membri della famiglia
      if (data.familyId) {
        try {
          const famSnap = await adminDb.collection("families").doc(data.familyId).get();
          const members: string[] = famSnap.data()?.members || [];
          for (const uid of members) {
            try {
              const uSnap = await adminDb.collection("users").doc(uid).get();
              const email = uSnap.data()?.email;
              if (email) recipients.add(String(email).toLowerCase());
            } catch {
              /* skip */
            }
          }
        } catch (e) {
          console.warn("family lookup", e);
        }
      }

      // Fallback: GMAIL_USER / REMINDER_TO se nessun membro ha email
      if (recipients.size === 0) {
        if (process.env.REMINDER_TO) recipients.add(process.env.REMINDER_TO.toLowerCase());
        if (gmailUser) recipients.add(gmailUser.toLowerCase());
      }

      const toList = Array.from(recipients);

      if (transporter && gmailUser && toList.length > 0) {
        try {
          await transporter.sendMail({
            from: `"Family Fridge" <${gmailUser}>`,
            to: toList.join(", "),
            subject: `⏰ Promemoria: ${data.title}`,
            text: [
              `Ciao!`,
              ``,
              `Ti ricordo la scadenza:`,
              ``,
              `📌 ${data.title}`,
              data.description ? `Note: ${data.description}` : null,
              `📅 Scade il: ${dueStr}`,
              data.authorName ? `Creata da: ${data.authorName}` : null,
              ``,
              `— Family Fridge`,
            ]
              .filter(Boolean)
              .join("\n"),
            html: `
              <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #FFFBF5; border-radius: 16px;">
                <h2 style="color: #92400E; margin-top: 0;">⏰ Promemoria Family Fridge</h2>
                <p style="font-size: 18px; color: #451A03;"><strong>${escapeHtml(data.title)}</strong></p>
                ${data.description ? `<p style="color: #78350F;">${escapeHtml(data.description)}</p>` : ""}
                <p style="color: #92400E;">📅 Scade il: <strong>${escapeHtml(dueStr)}</strong></p>
                ${data.authorName ? `<p style="color: #A16207; font-size: 13px;">Creata da: ${escapeHtml(data.authorName)}</p>` : ""}
                <hr style="border: none; border-top: 1px solid #FED7AA; margin: 20px 0;" />
                <p style="font-size: 12px; color: #A16207;">Family Fridge — il frigo digitale di famiglia</p>
              </div>
            `,
          });
          sent++;
        } catch (mailErr: any) {
          errors.push(`${data.title}: ${mailErr.message}`);
          console.error("Mail error", mailErr);
        }
      } else {
        console.log(`[NO MAIL] Reminder: ${data.title} → ${toList.join(", ")}`);
        sent++;
      }

      await docSnap.ref.update({ reminded: true });
    }

    return NextResponse.json({
      ok: true,
      checked: snap.size,
      toRemind: toRemind.length,
      sent,
      mailConfigured: !!(gmailUser && gmailPass),
      errors: errors.length ? errors : undefined,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
