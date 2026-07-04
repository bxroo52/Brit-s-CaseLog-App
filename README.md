# CaseLog

**Court Visitor Billing. Capture work once. Generate the exact required billing documents with one click.**

Offline-first PWA built for Alaska court visitors to replace Harvest and kill manual monthly invoicing.

## Core Features

- **Cases**: Create and manage respondent cases with assignment type, hourly rate, first-time billing flag.
- **Time Logging**: Log time with activity types, raw + auto-rounded hours (0.1), optional timer, start/end times, descriptions. Snapshots rate at entry.
- **Expenses**: Parking, Certified Mail, Copies, Postage, Mileage, Other.
- **Billing Center**: Pick a month → see live breakdown → ONE CLICK: generates a professional multi-page PDF package + marks time "Billed". Also individual invoices + CSV export.
- **100% Offline**: Dexie + IndexedDB. All data local forever. Works in the field.
- **PWA**: Installable, basic SW caching.
- Personality: Funny, blunt billing-obsessed microcopy (never in PDFs or invoices).

## Tech

Next.js 16 (App Router) • TypeScript • Tailwind • shadcn/ui + Radix • Zustand • Dexie • date-fns • jsPDF + autotable • Sonner

## Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Quick Start Prompt

See `PROMPT_SHORT.md` for a compact version of the original build spec (great for re-creating or forking the project with Grok Build).

## Alaska-Specific Details

- Default organization header: **Alaska Court System — Superior Court**
- Court Visitor ID field
- Mileage note in expenses (use current IRS rate or per Court direction)
- All PDFs are clean, professional, and suitable for submission to the Superior Court

## Customizations

- Settings page lets you set your name, contact info, logo (stored locally as data URL), organization, and footer notes.
- All data stays in your browser via Dexie/IndexedDB.

## Offline-First Sync (Supabase)

CaseLog is fully usable offline. Changes are saved instantly to IndexedDB and queued.

When you come back online:
- Queue is pushed
- Incremental changes are pulled
- Real-time (via Supabase subscriptions) can be enabled for multi-device

### To enable remote sync (optional)

1. Create a Supabase project at https://supabase.com
2. Copy `.env.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
   ```
3. **Important for instant sign-up (no email confirmation):**  
   In your Supabase Dashboard, go to Authentication > Providers > Email,  
   and **disable "Enable email confirmations"**.  
   This makes new user sign-ups instant (user is logged in immediately).

4. Run this SQL in the Supabase SQL Editor (creates tables + basic RLS):

```sql
-- Core tables (matches Dexie models)
create table if not exists cases (
  id uuid primary key,
  user_id uuid references auth.users(id),
  respondent_name text not null,
  case_number text not null,
  assignment_type text,
  status text,
  hourly_rate numeric,
  first_time_billing boolean,
  case_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  synced boolean default true,
  is_deleted boolean default false
);

create table if not exists time_entries (
  id uuid primary key,
  user_id uuid references auth.users(id),
  case_id uuid references cases(id) on delete cascade,
  date date,
  activity_type text,
  billable_hours numeric,
  billable_hours_rounded numeric,
  hourly_rate numeric,
  amount numeric,
  description text,
  start_time text,
  end_time text,
  billing_month text,
  billing_status text,
  updated_at timestamptz,
  synced boolean default true,
  is_deleted boolean default false
);

create table if not exists expenses (
  id uuid primary key,
  user_id uuid references auth.users(id),
  case_id uuid references cases(id),
  date date,
  expense_type text,
  description text,
  amount numeric,
  updated_at timestamptz,
  synced boolean default true,
  is_deleted boolean default false
);

-- Enable RLS
alter table cases enable row level security;
alter table time_entries enable row level security;
alter table expenses enable row level security;

-- Basic policies (use auth.uid() for production)
create policy "Users can CRUD their own cases"
  on cases for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Repeat for time_entries and expenses (using user_id = auth.uid()).
-- Make sure to add user_id column and update your RLS policies for data isolation.
```

5. Restart dev server. Sync controls appear in Settings.

**Alternative:** For near-zero backend code you can switch to **Dexie Cloud** (dexie-cloud-addon). See comments in `lib/sync.ts`.

Billing, PDFs, and logs always work from local data, even when unsynced.

## PWA & Offline on iPhone (iOS Safari)

CaseLog is a full installable Progressive Web App (PWA).

### How to Install on iPhone / iPad (Safari)
1. Open the app in Safari (https://your-vercel-url or localhost in dev).
2. Tap the **Share** button (square with upward arrow) at the bottom of the screen.
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**.

The app will appear on your home screen with the CaseLog icon. It launches in standalone mode (no browser UI) and works fully offline.

### Offline Capabilities
- **Core features work 100% offline**: Log time/expenses, manage cases, view entries, generate PDFs from local data (using Dexie).
- Changes are saved locally immediately via the outbox queue.
- **When Supabase is configured**: When back online, tap "Sync Now" in Settings or the header status. Uses the sync engine to push queued changes and pull updates.
- Billing / Get Paid: Generate invoices and summaries entirely from local Dexie data (works fully offline).
- No internet needed for daily use in the field.

**Note**: Supabase sync is optional. The PWA is fully functional without it (pure local Dexie). Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to enable cloud sync across devices.

**Offline Banner**: A clear amber banner appears at the top when offline, showing pending changes.

### Service Worker & Caching
- Aggressive caching of app shell and static assets (JS, CSS, icons).
- Dynamic data via Supabase falls back gracefully; local Dexie is the source of truth.
- Works reliably on iOS home screen.

### Troubleshooting
- If install prompt missing on iOS: Use Share → Add to Home Screen manually.
- Sync not working: Ensure online, check pending queue in Settings.
- Old cached version: Force close app or clear Safari website data for the domain.
- Dev: Use Chrome DevTools → Application → Service Workers → Offline checkbox to simulate.

## Deployment (Vercel)

We've included a `vercel.json` with recommended settings for PWA (proper caching for service worker, manifest, and icons, plus security headers).

1. Push to GitHub.
2. Import the repo to Vercel (or run `vercel --prod` from CLI).
3. Add the required environment variables in the Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. The PWA manifest, service worker, and offline features will work out of the box.

After deploy, test on real iPhone Safari:
- Add to Home Screen
- Go to airplane mode / offline
- Log time, create case, generate PDF
- Reconnect and sync

All core CaseLog features remain intact with the funny billing-obsessed personality.


## Usage

1. Create a Case (or several)
2. Log Time and Expenses against cases (use the timer if you want)
3. Go to **Billing** → pick month → Generate Full Billing Package
4. The PDF is court-grade clean. Send it. Done.

All data is saved automatically on your device.

## Production Notes

- Data is device-local. To move machines, export CSV or screenshot the billing summary.
- To customize invoice header info, use Settings (name, ID, notes etc).
- Hourly rate is per-case. Edit anytime (affects future entries only).

## Humor Philosophy

Empty states, toasts, and buttons are irreverent and direct.
**Never put jokes in generated invoices, reports, or CSVs.**

## License

Internal tool. Use responsibly.

## AI-Assisted Development & Auto-Commit

This project is actively developed with assistance from an AI coding agent (Grok).

**All file edits by the AI are automatically committed and pushed.**

### How it works

After any code change, the agent runs:

```bash
git quick "descriptive commit message here"
```

### Git Alias Setup

Configured locally with:

```bash
git config alias.quick '!f() { git add -A; if git commit -m "$*"; then git push origin main; else echo "Nothing to commit, skipping push."; fi; }; f'
```

Usage (manual or by AI):

```bash
git quick "Update rates modal to load from Supabase"
```

This ensures every change is tracked and pushed without manual steps.

### Git User

```bash
git config user.name "Brittany Ford"
git config user.email "brittanyford@Brittanys-MacBook-Pro.local"
```

## Notes
- `caselog-code/` and similar backup dirs are ignored.
- Always pull before major changes: `git pull origin main`
- For manual commits, use descriptive messages.

