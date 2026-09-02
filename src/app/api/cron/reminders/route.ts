import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Vercel Cron invia automaticamente Authorization: Bearer <CRON_SECRET> se impostato,
  // oppure puoi chiamare manualmente con lo stesso header.
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
      // Supporta sia remindDays (nuovo) sia vecchio remindBefore in minuti
      let msBefore = 0;
      if (typeof data.remindDays === "number") {
        msBefore = data.remindDays * 24 * 60 * 60 * 1000;
      } else if (typeof data.remindBefore === "number") {
        msBefore = data.remindBefore * 60 * 1000;
      } else {
        msBefore = 24 * 60 * 60 * 1000; // default 1 giorno
      }
      return data.dueDate - msBefore <= now;
    });

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;

    let transporter: nodemailer.Transporter | null = null;
    if (gmailUser && gmailPass) {
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
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

      if (transporter && gmailUser) {
        try {
          // Invia al creatore; in futuro si possono risolvere le email dei membri famiglia
          const toEmail = gmailUser; // mittente = destinatario di default (la tua mail)
          // Se vuoi inviare a un'altra mail, aggiungi REMINDER_TO in env
          const recipient = process.env.REMINDER_TO || gmailUser;

          await transporter.sendMail({
            from: `"Family Fridge" <${gmailUser}>`,
            to: recipient,
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
                <p style="font-size: 18px; color: #451A03;"><strong>${data.title}</strong></p>
                ${data.description ? `<p style="color: #78350F;">${data.description}</p>` : ""}
                <p style="color: #92400E;">📅 Scade il: <strong>${dueStr}</strong></p>
                ${data.authorName ? `<p style="color: #A16207; font-size: 13px;">Creata da: ${data.authorName}</p>` : ""}
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
        console.log(`[NO MAIL CONFIG] Reminder: ${data.title} due ${dueStr}`);
        sent++; // marca comunque per non ritentare all'infinito in dev
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
