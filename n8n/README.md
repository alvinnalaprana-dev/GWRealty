# GW Realty Inventory — n8n workflows

Seven workflows on Alvin's n8n server (alvinserver1). The web page talks to them through webhooks (public through Tailscale Funnel, `/webhook` only); n8n talks to Claude (AI) and Google Drive/Sheets/Gmail.

| File | Webhook | What it does |
|---|---|---|
| GW-0-Login.json | POST `gw-login` | Checks email + password against the accounts in the sheet, returns a signed 30-day sign-in |
| GW-1-AI-room.json | POST `gw-ai-room` | Signed-in users. Sends a room's photos to Claude Haiku 5.5, returns the item list (check-in) or the comparison (check-out) |
| GW-2-Save-record.json | POST `gw-save-record` | Checks who is saving and what they may change, refuses stale copies (409), uploads new photos to Drive `Photos`, upserts the row |
| GW-3-List-records.json | GET `gw-records` | Records for a signed-in user. Never sends password hashes; staff get no tenant contact details |
| GW-4-Photo.json | GET `gw-photo?id=` | Streams one photo from Drive, only if it belongs to a record |
| GW-6-Save-PDF.json | POST `gw-save-pdf` | Manager only. Saves each PDF to Drive `Reports (PDF)` |
| GW-7-Reminder.json | daily 08:00 WITA | Emails the manager about check-outs 7 days away |

## How sign-in works

- The page sends no key. Every request carries the header `X-GW-Token` (the signed sign-in from `gw-login`).
- The server rules are in `src/gwcore.cjs`, shared with the demo backend. n8n Code nodes block the crypto module, so SHA-256/HMAC are plain JavaScript there.
- The signing secret and the first manager password are written into the Code nodes at upload time by `src/build.py OUTDIR SECRETS.json`. They are **not** in this repo; the files here contain `__GW_SECRET__` / `__GW_BOOT_HASH__` placeholders. Changing the secret signs everyone out.
- Before the sheet has a `_settings` row, only the first manager account (manno.realtor@gmail.com, password given to Alvin privately) can sign in. On that first sign-in the page creates `_settings` with GW Realty's villas (Blu, Zala, Karisma) and the manager account. The manager then creates staff accounts and should change their own password on the Team page.

## Credentials in n8n

GW Anthropic API key (Header Auth `x-api-key`, prepaid with spend limit), GW Google Sheets, GW Google Drive, GW Gmail (OAuth2, Alvin's Google account). The old "GW Inventory key" credential is no longer used and can be deleted.

## Rebuilding / updating workflows

1. Edit the sources in `src/`, then `python3 n8n/src/build.py` (repo copies) and `python3 n8n/src/build.py OUT SECRETS.json` (upload copies).
2. Paste or import into n8n, keeping the same workflow so the webhook URLs stay the same.
3. **Switch the workflow off and on again** after any edit: n8n keeps running the old copy until then.

## Google Drive locations (Alvin's account)

- `GW Realty File/Photos` and `GW Realty File/Reports (PDF)`: shared with GW Realty as **Viewer**. Photos removed in the app stay here as evidence; only the folder owner deletes them.
- `GW Realty System (private)/GW Realty Inventory Records`, tab **Records**: one row per record, full detail in `dataJson`, accounts and villas in the `_settings` row (password hashes, never sent to devices). Workflows point at the tab by ID: renaming is fine, deleting is not. Do not rename the headers.

## Switching the AI model

In GW-1, node *Prepare request*: `const MODEL = 'claude-haiku-5-5';`. Change to `'claude-sonnet-5-5'` if Haiku misses too much on real photos (roughly 20× the cost).

## Known limits

- No rate limit on sign-in attempts.
- Your server must be up. If n8n is down, staff can keep working on the phone, but nothing saves until it is back.
- One record per sheet row (Google Sheets cell limit about 50,000 characters, enough for roughly 300 items).
- Each AI call sends up to 4 photos per room (the latest four).
