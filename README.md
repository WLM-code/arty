# Art Drop (with logins)

Snap or upload an artwork. Get the title, artist, period, three sharp facts and a 15-minute dare. Everything is saved in your stash, which lives in your account, so it follows you to any phone.

- Logging in is required to scan. That keeps strangers from using your free AI limit.
- Every person gets a few scans per day (3 by default). The whole app has a daily cap too.
- Lessons, dares and result pics are private to each account.

## What you need (all free)

- A Google AI Studio key: https://aistudio.google.com/apikey
- A Supabase project (new, region in the EU): https://supabase.com
- A Vercel account connected to GitHub: https://vercel.com

## Set up, step by step

### 1. Supabase: database

1. Create a new project. Pick an EU region (for example Frankfurt). Save the database password somewhere. MatisseKuyama123
2. Open **SQL Editor > New query**, paste everything from `supabase/setup.sql`, press **Run**.

### 2. Supabase: login

Open **Authentication**.

- **Sign In / Providers > Email**: switch **Confirm email** OFF. Then "Create account" works straight away, with no email to send. (If you leave it on, Supabase's built-in email service only sends a handful of emails per hour and is meant for testing.)
- **Sign In / Providers > Google** (recommended for teens, no emails involved):
  1. In Google Cloud console (console.cloud.google.com) create a project, then **APIs & Services > OAuth consent screen**: type External, fill in the app name and your email, and publish the app ("In production"). Only the basic email and profile scopes are used.
  2. **Credentials > Create credentials > OAuth client ID > Web application**.
  3. Under **Authorized redirect URIs** paste the "Callback URL" that Supabase shows on its Google provider page.
  4. Copy the Client ID and Client secret into the Supabase Google provider page and enable it.
- **URL Configuration**: set **Site URL** to your Vercel link (for example `https://art-drop.vercel.app`) and add the same link under **Redirect URLs**.

### 3. Keys

In Supabase open **Project Settings > API** (or "API Keys").

- Copy the **Project URL** and the **anon / publishable key** into `config.js`. These two are public, that is fine.
- Copy the **service_role / secret key** for Vercel only (next step). **Never** put it in `config.js`, in GitHub or in a chat.

### 4. Vercel

1. Put this whole folder in a GitHub repo and import it in Vercel (Add New > Project). The files must sit at the top of the repo.
2. In **Settings > Environment Variables** add:

| Name | Value |
| --- | --- |
| `GEMINI_API_KEY` | your Google AI Studio key |
| `SUPABASE_URL` | the Project URL |
| `SUPABASE_ANON_KEY` | the anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role / secret key |
| `SCAN_LIMIT` | optional, scans per person per day (default 3) |
| `DARE_LIMIT` | optional, dares per person per day (default 3) |
| `GLOBAL_LIMIT` | optional, total calls per day for everyone (default 150) |

3. Redeploy. Open the link on your phone in Safari or Chrome.

The day rolls over at midnight in Amsterdam. Choose `GLOBAL_LIMIT` below your Gemini free daily limit so the app stops cleanly before Google does.

## Good to know

- **Pausing:** a free Supabase project pauses after a week without activity. `vercel.json` has a daily job that pings the database to prevent that. A paused project can be resumed from the Supabase dashboard.
- **Old stash:** lessons saved in a browser by the earlier version show up in the stash with a "Move them to my account" button.
- **Privacy:** the app stores email addresses, lessons and photos, and photos are sent to Google Gemini. On Google's free tier they may be used to improve Google's products. Tell users, keep an eye on age rules (under 16 may need parental consent in the Netherlands), and tell them not to scan photos of people. You can delete a user in Supabase under Authentication > Users, which also deletes their lessons.
- **Passwords:** there is no "forgot password" button. Google login avoids that problem.

## Files

- `index.html` the app, `config.js` your public Supabase settings
- `api/analyse.js`, `api/challenge.js` the AI calls, `api/usage.js` scans left, `api/ping.js` keep-alive
- `api/_ai.js` prompts, Gemini call, login check and daily limits
- `supabase/setup.sql` the database
- `icon.svg`, `icon-180.png`, `icon-192.png`, `icon-512.png`, `manifest.webmanifest` the icon and name on the home screen
