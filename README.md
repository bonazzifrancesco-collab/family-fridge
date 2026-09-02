# Family Fridge 🏠📝

WebApp familiare calda e accogliente: post-it sul frigo, scadenze con promemoria email e archivio documentale su Nextcloud.

**Stack (tutto free tier):**
- Frontend + API: Next.js 14 (App Router) su **Vercel**
- Auth + DB: **Firebase** (Auth email+Google, Firestore)
- Documenti: **Nextcloud** (WebDAV) sul tuo NAS `nas.bonazziiotti.dpdns.org`
- Repo: **GitHub**

## Funzionalità

1. **Login / Registrazione** con email+password e Google
2. **Famiglia**: crea una famiglia oppure unisciti con codice invito a 6 caratteri
3. **Frigo (Dashboard)**: appunti come post-it colorati e inclinati (effetto realistico)
4. **Scadenze**: crea scadenze con data/ora e intervallo di promemoria (1h, 3h, 1g, 2g, 1sett). Un cron orario su Vercel controlla e invia email (configura Gmail App Password)
5. **Documenti**: categorie e sottocategorie (albero). I file fisici vivono sul tuo Nextcloud; le categorie mirrorano le cartelle.

## Setup rapido

### 1. Firebase (free)
1. Vai su [console.firebase.google.com](https://console.firebase.google.com) → crea progetto
2. Abilita **Authentication** → Email/Password + Google
3. Crea **Firestore** (modalità produzione o test, poi regole)
4. Project Settings → Your apps → Web app → copia le config
5. Genera Service Account (Project Settings → Service accounts → Generate new private key) per Admin SDK

**Regole Firestore di esempio (da rifinire):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /families/{familyId} {
      allow read: if request.auth != null && request.auth.uid in resource.data.members;
      allow create: if request.auth != null;
      allow update: if request.auth != null && request.auth.uid in resource.data.members;
    }
    match /notes/{id} {
      allow read, write: if request.auth != null; // restringi con familyId in produzione
    }
    match /deadlines/{id} {
      allow read, write: if request.auth != null;
    }
    match /categories/{id} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 2. Nextcloud
- Crea un utente o usa uno esistente
- Crea la cartella base (es. `/FamilyFridge`)
- Abilita WebDAV
- Metti URL, username, password (meglio App Password se disponibile) in `.env`

### 3. Gmail per promemoria
- Account Google → Sicurezza → Password per le app → genera una
- Metti `GMAIL_USER` e `GMAIL_APP_PASSWORD` in env
- Il route `/api/cron/reminders` è chiamato ogni ora da Vercel Cron. Completa l'invio email con nodemailer (aggiungi `nodemailer` alle dipendenze).

### 4. Env vars su Vercel / locale
Copia `.env.example` → `.env.local` e compila tutto.

Su Vercel: Project Settings → Environment Variables.

Aggiungi anche `CRON_SECRET` (stringa random) per proteggere il cron.

### 5. Deploy
```bash
npm install
npm run dev   # locale
```

Poi collega il repo a Vercel (o usa `vercel` CLI). Il progetto è già pronto per `create_git_project`.

## Struttura cartelle
```
src/
  app/
    page.tsx              # Landing
    login/ register/ onboarding/
    dashboard/            # Frigo + layout
      scadenze/
      documenti/
    api/cron/reminders/
  components/
    AuthProvider.tsx
    DashboardNav.tsx
  lib/
    firebase.ts
    types.ts
    utils.ts
    nextcloud.ts
```

## Note importanti
- **Indici Firestore**: per le query `where + orderBy` crea gli indici compositi quando Firebase te lo chiede (link nella console error).
- I promemoria email sono stub: il cron marca `reminded: true`. Aggiungi nodemailer + transporter Gmail per l'invio reale.
- Nextcloud: la pagina Documenti gestisce solo le categorie (metadata). Estendi con upload via API route che usa `src/lib/nextcloud.ts`.
- Design: palette cream / warm orange / post-it colors + font Caveat per l'effetto scritto a mano.

Buon uso in famiglia! 🧡
