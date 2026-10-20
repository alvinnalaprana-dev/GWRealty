# GW Realty Inventory — n8n workflows

Six workflows for your own n8n server. The web page talks to them through webhooks; n8n talks to Claude (AI) and Google Drive/Sheets/Gmail.

| File | Webhook | What it does |
|---|---|---|
| GW-1-AI-room.json | POST `gw-ai-room` | Sends a room's photos to Claude Haiku 5.5, returns the item list (check-in) or the comparison (check-out) |
| GW-2-Save-record.json | POST `gw-save-record` | Uploads new photos to Drive `Photos`, upserts the record row in the Records sheet |
| GW-3-List-records.json | GET `gw-records` | Returns all records (and the `_settings` row with villas and users) |
| GW-4-Photo.json | GET `gw-photo?id=` | Streams one photo from Drive, so the manager's device can see staff photos |
| GW-6-Save-PDF.json | POST `gw-save-pdf` | Saves each generated PDF to Drive `Reports (PDF)` |
| GW-7-Reminder.json | daily 08:00 WITA | Emails the manager about check-outs 7 days away |

## Setup (about 20 minutes)

Agreement codes are typed in by the manager (GW Realty decided on 20 Oct 2026 not to link their agreement sheet).

1. **Import** each JSON file: n8n → Workflows → Import from File.
2. **Create five credentials** in n8n (Credentials → Add):
   - **GW Inventory key** (type *Header Auth*): Name `X-GW-Key`, Value = a long random string. This protects every webhook.
   - **Anthropic API key** (type *Header Auth*): Name `x-api-key`, Value = an API key from console.anthropic.com (prepaid credit, set a spend limit). Not the Claude Pro plan.
   - **Google Sheets account**, **Google Drive account**, **Gmail account** (OAuth2). For testing, sign in with the account that owns the `GW Realty Inventory (TEST)` folder. For live use, sign in with GW Realty's Google account.
3. **Open each workflow** and pick the credential on every node with a warning triangle.
4. **GW-7 Reminder:** change `manager@example.com` on the *Email manager* node to the manager's email.
5. **Activate** all six workflows (toggle top right).
6. **Connect the page:** in `config.js` set
   ```js
   window.GW_API = { base: 'https://YOUR-N8N-DOMAIN/webhook', key: 'THE SAME RANDOM STRING AS STEP 2' };
   ```
   Commit and push; Netlify redeploys. The header badge changes from DEMO to TEST.

## Test locations already created (Google Drive, Alvin's account)

- Folder `GW Realty Inventory (TEST)` with `Photos` and `Reports (PDF)`
- Sheet `GW Inventory Records (TEST)` (headers in row 1; do not rename them)

The IDs are already filled into the workflows. For live use, replace them with GW Realty's own folder and sheet IDs (nodes *Upload photo*, *Upload PDF*, *Upsert record*, *Read records*).

## Switching the AI model

In GW-1, node *Prepare request*, first line: `const MODEL = 'claude-haiku-5-5';`. Change to `'claude-sonnet-5-5'` if Haiku misses too much on real photos (roughly 20× the cost).

## Known limits (testing stage)

- **Login is not secure yet.** The page still lets anyone pick an account, and the webhook key is visible in the page source. Fine for testing with GW Realty; proper sign-in must be added before going live.
- **Your server must be up.** If n8n is down, staff can still type items manually, but nothing saves until it is back.
- **One record per sheet row**, full detail in the `dataJson` column (Google Sheets cell limit about 50,000 characters, enough for roughly 300 items).
- **Each AI call sends up to 4 photos per room.** Staff can add more photos; the latest four are used.
