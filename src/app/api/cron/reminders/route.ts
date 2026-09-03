import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";
import webpush from "web-push";

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

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@family-fridge.app";
    const pushReady = !!(vapidPublic && vapidPrivate);
    if (pushReady) {
      webpush.setVapidDetails(vapidSubject, vapidPublic!, vapidPrivate!);
    }

    let sent = 0;
    let pushSent = 0;
    const errors: string[] = [];

    for (const docSnap of toRemind) {
      const data = docSnap.data();
      const dueDate = new Date(data.dueDate);
      const dueStr = dueDate.toLocaleString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const dueShort = dueDate.toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      const recipients = new Set<string>();
      const memberIds: string[] = [];

      if (data.authorId) {
        memberIds.push(data.authorId);
        try {
          const userSnap = await adminDb.collection("users").doc(data.authorId).get();
          const email = userSnap.data()?.email;
          if (email) recipients.add(String(email).toLowerCase());
        } catch (e) {
          console.warn("author lookup", e);
        }
      }

      if (data.familyId) {
        try {
          const famSnap = await adminDb.collection("families").doc(data.familyId).get();
          const members: string[] = famSnap.data()?.members || [];
          for (const memberUid of members) {
            if (!memberIds.includes(memberUid)) memberIds.push(memberUid);
            try {
              const uSnap = await adminDb.collection("users").doc(memberUid).get();
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

      if (recipients.size === 0) {
        if (process.env.REMINDER_TO) recipients.add(process.env.REMINDER_TO.toLowerCase());
        if (gmailUser) recipients.add(gmailUser.toLowerCase());
      }

      const toList = Array.from(recipients);
      const title = escapeHtml(data.title || "Scadenza");
      const description = data.description ? escapeHtml(data.description) : "";
      const author = data.authorName ? escapeHtml(data.authorName) : "";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

      if (transporter && gmailUser && toList.length > 0) {
        try {
          await transporter.sendMail({
            from: `"Family Fridge 🏠" <${gmailUser}>`,
            to: toList.join(", "),
            subject: `⏰ Promemoria: ${data.title}`,
            text: [
              `Ciao!`,
              ``,
              `Ti ricordo questa scadenza di famiglia:`,
              ``,
              `${data.title}`,
              data.description ? `Note: ${data.description}` : null,
              `Scade il: ${dueStr}`,
              data.authorName ? `Creata da: ${data.authorName}` : null,
              ``,
              `— Family Fridge`,
            ]
              .filter(Boolean)
              .join("\n"),
            html: buildEmailHtml({
              title,
              description,
              dueStr: escapeHtml(dueStr),
              dueShort: escapeHtml(dueShort),
              author,
              appUrl,
            }),
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

      // Push notifications
      if (pushReady && memberIds.length > 0) {
        try {
          const subs = await adminDb.collection("pushSubscriptions").get();
          const payload = JSON.stringify({
            title: `⏰ Promemoria: ${data.title}`,
            body: `Scade il ${dueShort}`,
            url: "/dashboard/scadenze",
          });
          for (const s of subs.docs) {
            const sd = s.data();
            if (!memberIds.includes(sd.userId)) continue;
            if (!sd.subscription?.endpoint) continue;
            try {
              await webpush.sendNotification(sd.subscription, payload);
              pushSent++;
            } catch (pe: any) {
              if (pe.statusCode === 404 || pe.statusCode === 410) {
                await s.ref.delete().catch(() => {});
              }
            }
          }
        } catch (e) {
          console.warn("push cron", e);
        }
      }

      await docSnap.ref.update({ reminded: true });
    }

    return NextResponse.json({
      ok: true,
      checked: snap.size,
      toRemind: toRemind.length,
      sent,
      pushSent,
      mailConfigured: !!(gmailUser && gmailPass),
      pushConfigured: pushReady,
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

function buildEmailHtml(opts: {
  title: string;
  description: string;
  dueStr: string;
  dueShort: string;
  author: string;
  appUrl: string;
}) {
  const { title, description, dueStr, dueShort, author, appUrl } = opts;
  const cta = appUrl
    ? `<a href="${appUrl}/dashboard/scadenze" style="display:inline-block;margin-top:8px;padding:14px 28px;background:#F97316;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;">Apri Family Fridge</a>`
    : "";

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FFF7ED;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFF7ED;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 30px rgba(146,64,14,0.12);">
        <tr>
          <td style="background:linear-gradient(135deg,#F97316,#F59E0B);padding:28px 28px 22px;text-align:center;">
            <div style="font-size:40px;line-height:1;">🏠</div>
            <div style="color:#fff;font-size:22px;font-weight:700;margin-top:8px;">Family Fridge</div>
            <div style="color:rgba(255,255,255,0.9);font-size:13px;margin-top:4px;">Promemoria di famiglia</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <div style="background:#FEF08A;border-radius:4px;padding:22px 20px;box-shadow:3px 4px 12px rgba(0,0,0,0.08);">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#A16207;font-weight:600;margin-bottom:8px;">📌 Scadenza</div>
              <div style="font-size:22px;font-weight:700;color:#451A03;line-height:1.3;margin-bottom:10px;">${title}</div>
              ${description ? `<div style="font-size:15px;color:#78350F;line-height:1.45;margin-bottom:12px;">${description}</div>` : ""}
              <div style="display:inline-block;background:#fff;border-radius:999px;padding:8px 14px;font-size:14px;color:#92400E;font-weight:600;">📅 ${dueShort}</div>
            </div>
            <p style="margin:20px 0 0;font-size:15px;color:#78350F;line-height:1.5;">
              Ti ricordiamo che questa scadenza è prevista per:<br>
              <strong style="color:#451A03;">${dueStr}</strong>
            </p>
            ${author ? `<p style="margin:12px 0 0;font-size:13px;color:#A16207;">Creata da ${author}</p>` : ""}
            <div style="text-align:center;margin-top:24px;">${cta}</div>
          </td>
        </tr>
        <tr>
          <td style="background:#FFFBEB;padding:16px 28px;text-align:center;border-top:1px solid #FED7AA;">
            <p style="margin:0;font-size:12px;color:#A16207;">Inviato automaticamente da <strong>Family Fridge</strong></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
