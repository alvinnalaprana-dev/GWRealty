# GW Realty Villa Inventory — client demo

Live demo: https://gwrealty.netlify.app

A clickable demo of the villa inventory system for GW Realty, built by Kriyator.

## What it shows

1. **Check-in** — staff take photos of each room (camera or gallery, phone or desktop).
2. **AI list** — the system lists the items it sees per room (simulated in this demo).
3. **Manager review** — the manager edits the list, adds villa, tenant, check-in and check-out dates, and approves.
4. **PDF** — "Generate PDF" makes the check-in report with photos and the approved list.
5. **Reminders** — a check-out reminder email to the manager 7 days before (shown on the manager page).
6. **Check-out** — new photos on the same record; AI compares with the approved check-in list; the manager confirms each change, approves, and generates the check-out PDF.

Staff screens are in Indonesian; manager screens and PDFs are in English.

Updated 20 Oct 2026 after the client meeting: rooms can be added per villa, tenant details are optional, the manager creates staff accounts (Team page), one email reminder 7 days before check-out, an agreement code picked from the manager's agreement Google Sheet (required to approve; shown on the PDF and in its file name), and the PDF has a tenant acknowledgement with manager and tenant signature lines.

## Demo limits

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
