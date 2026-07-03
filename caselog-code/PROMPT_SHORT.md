# CaseLog — Short Prompt (Quick Start for Grok Build)

Copy and paste the block below into a fresh Grok Build session.

---

You are Grok Build. Build a complete, production-ready, offline-first web app called **CaseLog** — a court visitor billing tool for Alaska court visitors to replace Harvest.

**Personality (strict):** Funny, blunt, billing-obsessed. Irreverent but professional humor ONLY in UI microcopy, empty states, buttons, toasts. NEVER in invoices, PDFs, summaries, or CSV.

**Stack (do not deviate):**
- Next.js 15+ (App Router) + TypeScript + Tailwind
- shadcn/ui (latest) + Radix
- lucide-react, date-fns, zustand, dexie (IndexedDB), jsPDF + jspdf-autotable, sonner
- PWA (manifest + service worker)

**Must implement exactly:**

Data models (strict interfaces):

```ts
interface Case { id, respondentName, caseNumber (text), assignmentType: 'Initial Review'|'Review'|'Three-Year Review'|'Medication', status: 'Open'|'Closed', hourlyRate, firstTimeBilling, caseNotes?, createdAt, updatedAt }
interface TimeEntry { id, caseId, date (YYYY-MM-DD), activityType: 'Contact'|'Home Visit'|'Court'|'Research'|'Report Writing'|'Drive Time'|'Wait Time'|'Other', billableHours, billableHoursRounded (nearest 0.1), hourlyRate (snapshot), amount, description, startTime?, endTime?, billingMonth (YYYY-MM), billingStatus: 'Pending'|'Billed' }
interface Expense { id, caseId, date, expenseType: 'Parking'|'Certified Mail'|'Copies'|'Postage'|'Mileage'|'Other', description, amount }
```

Core requirements:
- Dexie for all persistence (offline-first critical)
- Full CRUD for Cases, Time Entries, Expenses
- Timer helper when logging time
- Auto rounding + amount calculation
- Dashboard with stats + recent activity
- Search/filter cases
- Billing screen: select month, live preview of totals per case, "Generate Full Billing Package" (one-click)
  - Produces professional multi-page PDF using jsPDF (cover + itemized per case + totals)
  - Mark all Pending time for that month as Billed
  - Also support individual case invoice download + CSV export
- Settings: user profile (name, contact, Court Visitor ID, organization="Alaska Court System", invoice notes, optional logo)
- Professional PDFs:
  - Header with "ALASKA COURT SYSTEM / SUPERIOR COURT"
  - Include logo if provided
  - Clean tables, no jokes
- PWA + installable
- Clean, responsive UI with shadcn components

Folder structure: app/, components/, lib/, stores/, types/

Populate a default user profile with Alaska Court System details on first run.

Use only the listed libraries. Make it delightful to use in the field.

**Extra (Alaska + polish):**
- Add "Alaska Court System" branding throughout UI + PDFs
- Mileage notes referencing court/IRS rate
- Humor examples: "Go log your shit.", "The invoice monster hungers.", "Payroll isn't psychic.", "Future You called...", etc.
- Make the single-click experience the hero action

Build it completely. When finished, provide instructions to run `npm run dev`.

---

## Usage

1. Start a new chat with Grok Build.
2. Paste the entire block above.
3. Let it run.

Optional customizations you can ask for before/after:
- Your real name / specific logo
- Extra activity types or fields
- Different default rates
- More Alaska-specific language or report sections
