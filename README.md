# GW Realty Villa Inventory — client demo

Live demo: https://gwrealty.netlify.app

A clickable demo of the villa inventory system for GW Realty, built by Kriyator.

## What it shows (updated 20 Oct 2026, second client meeting)

1. **Inventory (staff, phone)** — the inventory date can differ from the tenant's check-in date. Staff photograph each room; as soon as a room has a usable photo, AI lists the items for that room (simulated). Staff check and edit the list, add items manually, and add rooms (quick buttons for Miscellaneous, Terrace, Bathroom, Pool area, Garden).
2. **Dark photos** — brightness is checked on the phone the moment a photo is added. Dark photos are flagged red, ignored by the AI, left out of the PDF, and must be removed or retaken before sending.
3. **Manager review** — the manager only edits and approves (no adding or deleting items). Types the agreement code, optional tenant details, inventory, check-in and check-out dates.
4. **PDF** — agreement code in the header and file name; inventory date shown when it differs from the check-in date; tenant acknowledgement; signature lines for Owner / Villa / Listing (Owner's Representative) on the left and Tenant on the right. Printed and signed on paper.
5. **Reminder** — email to the manager 7 days before check-out.
6. **Check-out (staff)** — the check-in list is pre-filled; per room, AI compares the new photos and flags changes; staff correct; manager approves; check-out PDF shows check-in and check-out photos side by side.
7. **Accounts** — the manager creates staff accounts on the Team page.

Staff screens are in Indonesian; manager screens and PDFs are in English.

## Live mode (n8n)

Set `base` and `key` in `config.js` to connect to the n8n workflows in `n8n/` (setup steps in `n8n/README.md`). The badge shows TEST instead of DEMO; AI is real (Claude Haiku 5.5), records and photos sync across devices through Google Sheets and Drive, PDFs are saved to Drive.

## Demo limits (when config.js is empty)

- **AI is simulated.** Results come from the Villa Madya 1 item list (`data.js`), not from the photos.
- **Nothing is sent anywhere.** Records stay in the browser (localStorage), photos in IndexedDB. Each browser has its own data. "Reset demo" on the manager page starts again.
- **No real login.** The first screen lets you pick an account; no password in the demo.
- **Logo:** the PDF uses a text "GW Realty" header until the client's logo file is supplied.
- Villa Bromo is a sample lease (no photos) so the check-out flow can be tried immediately.

## Files

- `index.html`, `styles.css`, `app.js`, `data.js` — the demo (plain HTML/JS, no build step)
- `docs/overview.html` — one-page explanation for the client
- `docs/mockup.html` — screen mockups
- `netlify.toml` — Netlify serves the repo root as-is

PDFs are made in the browser with jsPDF 2.5.1 and jsPDF-AutoTable 3.8.2 (loaded from cdnjs).

## Next (not in the demo)

Real AI (Claude API), saving to Google Sheets and Drive through n8n, real email reminders, real logins, GW Realty logo in the PDF, inventory.gwrealtyglobal.com.
