# Habit House — a habit garden for two

A shared habit tracker for you and your girlfriend: workouts, eating well, reading (books or the Bible), reminders, and a live feed of what the other person's doing.

**This version is 100% Railway.** No more Netlify, no more Firebase. Hosting, the realtime sync, and the database all run on Railway now.

## What changed from the old version
- **Hosting**: was Netlify (drag-and-drop static site) → now a small Node/Express server on Railway that serves the app.
- **Realtime sync**: was Firebase Realtime Database → now a WebSocket connection straight to your own Railway server.
- **Storage**: was Firebase's database → now a Postgres database (Railway's Postgres plugin).
- `config.js` and `netlify.toml` are gone — there's nothing to paste into the app itself anymore. Everything backend-related is now an environment variable set in Railway's dashboard (see below), not in the code.
- The app's actual features (habits, garden, journal entries, reminders, sign-up/login by household code + PIN) are unchanged.

## Files in this folder
- `index.html` — the whole app (UI + logic)
- `server.js` — Express server: serves the app + WebSocket sync + talks to Postgres
- `package.json` — dependencies (`express`, `ws`, `pg`)
- `railway.json` — tells Railway how to build/start the app
- `.env.example` — reference for the one env var used (see below)
- `manifest.json`, `sw.js` — make it installable as a home-screen app

## Environment variables

Only one variable actually matters, and Railway sets it for you automatically — you don't type it in by hand. Still, here's the full copy-paste reference:

| Variable | Where it comes from | Set it yourself? |
|---|---|---|
| `DATABASE_URL` | Auto-injected when you add a Postgres plugin, or reference it as `${{Postgres.DATABASE_URL}}` | Only if it's not already there — see Step 4 below |
| `PORT` | Auto-injected by Railway | No — never set this manually |

That's it. There are no Firebase keys, no API keys, nothing else to configure. A `.env.example` file is included in the folder for local development only (running the server on your own laptop) — it is **not** used on Railway itself.

## Hosting on Railway — step by step

**1. Get the code into a GitHub repo** (Railway deploys from GitHub, or via CLI — GitHub is easiest)
   - Create a new repo (e.g. `habit-house-app`) and push this whole folder to it, exactly as-is.

**2. Create the Railway project**
   - Go to **railway.app** → sign in (GitHub login is easiest) → **New Project**.
   - Choose **Deploy from GitHub repo** → pick the repo you just made.
   - Railway detects it's a Node app (via `package.json`) and starts a build automatically using `railway.json`.

**3. Add a Postgres database**
   - In the same Railway project, click **New** → **Database** → **Add PostgreSQL**.
   - This creates a separate "Postgres" service in your project — it comes with `DATABASE_URL` already set *on itself*.

**4. Connect your app to the database**
   - Click on your **app service** (not the Postgres one) → **Variables** tab → **New Variable**.
   - Name: `DATABASE_URL`
   - Value: click **Add Reference** and pick the Postgres service's `DATABASE_URL` (or type `${{Postgres.DATABASE_URL}}` — replace `Postgres` with whatever you named that service if you renamed it).
   - Save. Railway will redeploy automatically.

**5. Get your live URL**
   - Click your app service → **Settings** → **Networking** → **Generate Domain**.
   - Railway gives you a `https://your-app-name.up.railway.app` URL — that's the real, live site.

**6. Try it**
   - Open the URL → it should load the household-code screen. The little dot near the top turns green when it's synced ("live"). The server creates the `households` table in Postgres automatically the first time it starts — no manual database setup needed.

Then on each phone: open the site in the browser → Share (iPhone) or menu (Android) → **Add to Home Screen**. It opens full-screen like an app, no store needed.

## Running it locally (optional, for testing before you deploy)
```bash
npm install
cp .env.example .env
# edit .env and paste in a DATABASE_URL — easiest is to copy it from
# Railway's Postgres service → "Connect" tab → "Postgres Connection URL"
npm start
# open http://localhost:3000
```

## Signing up (unchanged)
1. On your phone: open the site, enter a household code you both will use (e.g. `og-and-mimi-2026`), tap Continue.
2. You'll land on "Set up your profile" since no one's signed up yet — enter your name, a username, and a PIN. Tap **Sign up**.
3. On her phone: open the site, enter the **exact same household code**. Since your slot is taken, she'll land on "Set up your profile" too — she signs up with her own name, username, and PIN.
4. From then on, each of you sees the other's name and username on their card (marked "YOU" on your own), and everything — habits, garden, notes, reminders — updates live between you.
5. If either of you opens the site on a new/different device later, entering the household code will show a **login** screen instead (pick your username, enter your PIN) rather than sign-up again.

The PIN is a simple lock to keep out casual strangers, not bank-grade security — don't reuse a PIN you use for anything sensitive. Anyone who knows your exact household code can read/write that household's data (same trust model as the old Firebase rules) — pick a code that isn't guessable.

Signed in and want to switch devices or start over? Open the gear icon → **Log out of this device** logs you out locally (your data stays); **Reset all data for this household** wipes everything and both of you sign up fresh.

## Reminders — what to expect
Reminders fire as browser notifications while the site is open (foreground or a background tab). What it does **not** do yet: buzz your phone when the browser/app is fully closed. That needs push notifications (Web Push, since there's no Firebase Cloud Messaging anymore) plus a small script that sends the push at the right time — a real next step, not a small tweak. Say the word and I'll build that layer too.

## Natural next steps
- Push notifications that work with the app fully closed (Web Push + a scheduler)
- Login/accounts with real password hashing instead of a shared code + PIN
- Weekly summary or streak-recovery rules
- A custom domain on Railway (Settings → Networking → Custom Domain)

Tell me which one and I'll build it the same way: working code, ready to preview.
