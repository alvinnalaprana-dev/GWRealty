# GW Realty Villa Inventory

Site: https://gwrealty.netlify.app (later inventory.gwrealtyglobal.com). Built by Kriyator.

## How it works (agreed with GW Realty, 20–22 Oct 2026)

1. **Accounts.** Everyone signs in with email + password. The password is checked on the server, which returns a signed 30-day sign-in. The manager adds villas, reviews and approves, and creates staff accounts on the Team page. Staff only do inventories on their phone.
2. **Check-in (staff, phone).** The inventory date can differ from the tenant's check-in date. Staff photograph **every room**; a room that does not exist in the villa is removed with "Ruangan ini tidak ada di villa ini". As soon as a room has a usable photo, AI lists its items (using that villa's amenity list for the room). Staff check, edit and add items and rooms. Items with quantity 0 are removed when sending and when approving.
3. **Dark photos** are flagged on the phone, ignored by the AI, left out of the PDF, and must be removed or retaken before sending.
4. **AI retry.** If the AI fails or asks for a retake, "Coba AI lagi" retries without losing items staff already typed.
5. **Manager review.** Edits and approves only. Types the agreement code, optional tenant details (email is checked if filled), inventory, check-in and check-out dates.
6. **PDF (English).** GW Realty logo and red; inventory date when it differs from check-in; tenant acknowledgement; signature lines for Owner / Villa / Listing (Owner's Representative) and Tenant. Printed and signed on paper.
7. **Reminder.** Email to the manager at 08:00 WITA, 7 days before check-out.
8. **Check-out.** The check-in list is pre-filled; staff photograph every room again; AI compares and flags changes. Each item has a Result (Good / Worn / Damaged; no "missing"). Items moved to another room (e.g. a sofa bed found in Bedroom 3) are marked "Moved to …", automatically when the AI spots them in the other room, or by hand. The manager can type an optional cost per change (0 is kept as "no charge"), also after approval. The check-out PDF shows check-in and check-out photos side by side.
9. **Photos are evidence.** A photo removed in the app stays in Google Drive; only the folder owner deletes it.

Staff screens are in Indonesian; manager screens and PDFs are in English. Item names follow GW Realty's own (English) inventory documents.

## Modes (config.js)

- **DEMO** (default): shared demo backend on Netlify (`netlify/functions/gw.mjs`), sample villas, simulated AI, public demo accounts shown on the login screen. Same server rules as the real system.
- **TEST / live**: open the site once with `?live=1` on a device (`?demo=1` switches back). Talks to the n8n workflows on Alvin's server: real Claude AI, photos and PDFs in Google Drive, records in the Google Sheet. At launch set `MODE_DEFAULT = 'live'`.

## Security (live)

- No key in the page. Each request carries the person's signed sign-in; n8n checks it, that the account still exists (removed staff lose access at once), and what that role may do (staff cannot approve, change accounts or see tenant contact details).
- A save is refused if someone else saved a newer copy of the same record first; the app then loads the latest version.
- Photos can only be fetched if they belong to a record.
- Limits: no rate limit on sign-in attempts (use passwords of 8+ characters); the sign-in signing secret lives only in n8n.

## Files

- `index.html`, `styles.css`, `app.js`, `data.js` (rooms, demo list, GW Realty's real villas with per-room amenity lists), `config.js`
- `netlify/functions/gw.mjs`: demo backend
- `n8n/`: the workflows and setup notes; `n8n/src/` holds the Code node sources and `build.py`
- `docs/overview.html`, `docs/mockup.html`: early client documents (superseded by this README where they differ)

PDFs are made in the browser with jsPDF 2.5.1 and jsPDF-AutoTable 3.8.2 (loaded from cdnjs).
