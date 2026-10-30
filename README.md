# GW Realty Villa Inventory

Site: https://inventory.gwrealtyglobal.com (also https://gwrealty.netlify.app). Built by Kriyator.

## How it works (agreed with GW Realty, 20–22 Oct 2026)

1. **Accounts.** Everyone signs in with email + password. The password is checked on the server, which returns a signed 30-day sign-in. The manager adds villas, reviews and approves, and creates staff accounts on the Team page. Staff only do inventories on their phone.
2. **Inventory listing (staff, phone; added 28 Oct 2026).** For a villa without a tenant (e.g. a new listing): "Start inventory" on an empty villa. Same photo + AI steps as check-in; the manager approves with only the inventory date (no agreement, tenant or dates), the villa stays empty, no reminder is sent, and the PDF is an "Inventory Report" signed by the owner's representative and GW Realty. Approved inventories are listed under "Inventories".
2. **Check-in (staff, phone).** The inventory date can differ from the tenant's check-in date. Staff photograph **every room**; a room that does not exist in the villa is removed with "Remove room" next to its name (it can be added back under "Add a room"). As soon as a room has a usable photo, AI lists its items (using that villa's amenity list for the room). Staff check, edit and add items and rooms. Items with quantity 0 are removed when sending and when approving.
3. **Dark photos** are flagged on the phone, ignored by the AI, left out of the PDF, and must be removed or retaken before sending.
4. **AI retry.** If the AI fails or asks for a retake, "Try AI again" retries without losing items staff already typed.
5. **Manager review.** Edits and approves only. Types the agreement code, optional tenant details (email is checked if filled), inventory, check-in and check-out dates.
6. **PDF (English).** GW Realty logo and red; inventory date when it differs from check-in; tenant acknowledgement; signature lines for Owner / Villa / Listing (Owner's Representative) and Tenant. Printed and signed on paper.
7. **AI models.** Room photos are read by Claude Haiku. If Haiku fails (cut-off or invalid reply, server error) the app retries once with Claude Sonnet automatically, and "Try AI again" always uses Sonnet. The server only allows these two models.
8. **Monthly report.** On the 30th (last day in February) at 08:00 WITA the manager gets an email: every number is calculated by code from the sheet; Claude Opus writes a short summary from those numbers only (no tenant names or contact details are sent to it). If the AI step fails, the email is still sent with the figures.
7. **Reminder.** Email to the manager at 08:00 WITA, 7 days before check-out.
8. **Check-out.** The check-in list is pre-filled; staff photograph every room again; AI compares and flags changes. Each item has a Result (Good / Worn / Damaged; no "missing"). Items moved to another room (e.g. a sofa bed found in Bedroom 3) are marked "Moved to …", automatically when the AI spots them in the other room, or by hand. The manager can type an optional cost per change (0 is kept as "no charge"), also after approval. The check-out PDF shows check-in and check-out photos side by side.
9. **Photos are evidence.** A photo removed in the app stays in Google Drive; only the folder owner deletes it.

All screens and PDFs are in English (changed from Indonesian staff screens on 25 Oct 2026). Item names follow GW Realty's own inventory documents.

## Roles and villas (added 30 Oct 2026)

- **Roles:** Support Admin (Kriyator support: can do everything; only a Support Admin can change, demote or remove a Support Admin account), Manager (everything, and can also do inventories through "Staff view"), Staff (inventories on the phone only).
- **Villas:** search and sort (name, newest, oldest) on the manager and staff lists. "Add villa" puts "Villa" in front of the name (can be unticked) and starts with no rooms; staff add the rooms during the first inventory.
- **Villa page** (click a villa name): edit name and area, and enter the next lease (agreement no., tenant, contact, dates, notes) at any time. The next check-in is filled in from it; after the check-in is approved the villa's lease fields are cleared. Staff see the tenant name and dates only.
- **Inventory Report PDF:** signed by the Owner / Agent / Listing representative only (no tenant, no second signature).

## Live system (config.js)

Live since 26 Oct 2026 at https://inventory.gwrealtyglobal.com (gwrealty.netlify.app still works). The app talks only to the n8n workflows on the server: Claude AI, photos and PDFs in Google Drive, records in the Google Sheet. There is no demo mode any more; the old demo backend is kept in `dev/demo-backend.mjs` for local testing only and is not deployed.

## Security

- No key in the page. Each request carries the person's signed sign-in; n8n checks it, that the account still exists (removed staff lose access at once), and what that role may do (staff cannot approve, change accounts or see tenant contact details).
- A save is refused if someone else saved a newer copy of the same record first; the app then loads the latest version.
- Photos can only be fetched if they belong to a record.
- Passwords are stored salted and slow-hashed (PBKDF2, 10,000 rounds); older hashes are upgraded on the next sign-in.
- 5 wrong passwords for one email lock it for 15 minutes.
- Staff cannot change a record once it is sent. The PDF step only accepts real PDFs from a manager.
- The sign-in signing secret lives only in n8n.

## Files

- `index.html`, `styles.css`, `app.js`, `data.js` (rooms, demo list, GW Realty's real villas with per-room amenity lists), `config.js`
- `dev/demo-backend.mjs`: old demo backend (local testing only, not deployed)
- `n8n/`: the workflows and setup notes; `n8n/src/` holds the Code node sources and `build.py`
- `docs/overview.html`, `docs/mockup.html`: early client documents (superseded by this README where they differ)

PDFs are made in the browser with jsPDF 2.5.1 and jsPDF-AutoTable 3.8.2 (loaded from cdnjs).
