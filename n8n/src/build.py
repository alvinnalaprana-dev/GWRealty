"""Build the n8n workflow JSON files from the Code node sources in this folder.

  python3 n8n/src/build.py                 -> n8n/GW-*.json (placeholders, no secrets, no credential IDs)
  python3 n8n/src/build.py OUTDIR SECRETS  -> OUTDIR/GW-*.json ready to upload (SECRETS = JSON file with
                                              secret, bootHash and credential IDs; never commit it)
"""
import json, os, sys, uuid

SRC = os.path.dirname(os.path.abspath(__file__))
REPO_N8N = os.path.dirname(SRC)
FOLDER_PHOTOS = '14eu2kei0fG9IY7DuBgY6HpRzSpQWMZCf'
FOLDER_REPORTS = '1xwvPe9PUaU2_wW9lJofF_e3YVR4gb6Vi'
RECORDS = '1cNxJUgEy1X6dpenaPSc_0vIBuBLTaCrKYDcTRGHeYN8'
TAB_GID = 1891781412          # the Records tab (renaming it is fine; deleting it is not)
TAB_NAME = 'Records'
COLS = ['recordId', 'agreement', 'villa', 'tenant', 'status', 'invDate', 'checkIn', 'checkOut', 'outInvDate', 'updatedAt', 'dataJson', 'dataJson2', 'dataJson3', 'dataJson4', 'dataJson5', 'dataJson6']

secrets = {}
if len(sys.argv) > 2:
    secrets = json.load(open(sys.argv[2]))
OUT = sys.argv[1] if len(sys.argv) > 1 else REPO_N8N
cred_id = lambda k: secrets.get('creds', {}).get(k, '')

src = lambda f: open(os.path.join(SRC, f)).read()
CORE = src('gwcore.cjs').split("if (typeof module !== 'undefined'")[0]
HEAD = src('glue_head.js')
if secrets:
    HEAD = HEAD.replace('__GW_SECRET__', secrets['secret']).replace('__GW_BOOT_HASH__', secrets['bootHash'])
WITH_CORE = lambda body: CORE + '\n' + HEAD + '\n' + body

GS = lambda: {"googleSheetsOAuth2Api": {"id": cred_id('sheets'), "name": "GW Google Sheets"}}
GD = lambda: {"googleDriveOAuth2Api": {"id": cred_id('drive'), "name": "GW Google Drive"}}

def nid(): return str(uuid.uuid4())
def webhook(path, method='POST'):
    return {"id": nid(), "name": "Webhook", "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [0, 0], "webhookId": nid(),
            "parameters": {"httpMethod": method, "path": path, "responseMode": "responseNode", "options": {"allowedOrigins": "*", "rawBody": False}}}
def code(name, js, pos):
    return {"id": nid(), "name": name, "type": "n8n-nodes-base.code", "typeVersion": 2, "position": list(pos), "parameters": {"jsCode": js}}
def respond(name, pos, body="={{ JSON.stringify($json) }}", status=None):
    opts = {"responseCode": status} if status else {}
    return {"id": nid(), "name": name, "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": list(pos),
            "parameters": {"respondWith": "json", "responseBody": body, "options": opts}}
def respond_err(pos):
    return respond('Refuse', pos, "={{ JSON.stringify({ ok: false, error: $json.error }) }}", "={{ $json.status || 500 }}")
def if_one(name, expr, pos):
    return {"id": nid(), "name": name, "type": "n8n-nodes-base.if", "typeVersion": 2, "position": list(pos),
            "parameters": {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose"},
                "conditions": [{"id": nid(), "leftValue": expr, "rightValue": 1, "operator": {"type": "number", "operation": "equals"}}], "combinator": "and"}, "options": {}}}
OK_IF = lambda pos: if_one('Allowed?', "={{ $json.ok === false ? 0 : 1 }}", pos)
def read_all(pos):
    return {"id": nid(), "name": "Read records", "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.5, "position": list(pos),
            "parameters": {"documentId": {"__rl": True, "value": RECORDS, "mode": "id"},
                           "sheetName": {"__rl": True, "value": TAB_GID, "mode": "list", "cachedResultName": TAB_NAME}, "options": {}},
            "credentials": GS(), "alwaysOutputData": True}
def conn(pairs):
    c = {}
    for a, b, *idx in pairs:
        out = idx[0] if idx else 0
        c.setdefault(a, {"main": []})
        while len(c[a]["main"]) <= out: c[a]["main"].append([])
        c[a]["main"][out].append({"node": b, "type": "main", "index": 0})
    return c
def wf(name, nodes, connections):
    return {"name": name, "nodes": nodes, "connections": connections, "active": False,
            "settings": {"executionOrder": "v1", "timezone": "Asia/Makassar"}, "pinData": {}}

out = {}
# 0. Login
def upsert(name, pos, src_expr='$json'):
    return {"id": nid(), "name": name, "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.5, "position": list(pos),
            "parameters": {"operation": "appendOrUpdate", "documentId": {"__rl": True, "value": RECORDS, "mode": "id"},
                           "sheetName": {"__rl": True, "value": TAB_GID, "mode": "list", "cachedResultName": TAB_NAME},
                           "columns": {"mappingMode": "defineBelow", "value": {k: "={{ %s.%s }}" % (src_expr, k) for k in COLS}, "matchingColumns": ["recordId"],
                                       "schema": [{"id": k, "displayName": k, "required": False, "defaultMatch": False, "display": True, "type": "string", "canBeUsedToMatch": True} for k in COLS]},
                           "options": {"cellFormat": "RAW"}}, "credentials": GS()}

out['GW-0-Login'] = wf('GW Inventory · 0 Login', [
    webhook('gw-login'), read_all((220, 0)), code('Check login', WITH_CORE(src('login.js')), (440, 0)),
    if_one('Upgrade password?', "={{ $json._row ? 1 : 0 }}", (660, 0)),
    upsert('Save upgraded password', (880, -100), '$json._row'),
    respond('Respond', (1100, 0), "={{ JSON.stringify(Object.assign({}, $('Check login').first().json, { _row: undefined })) }}", "={{ $('Check login').first().json.status || 200 }}")],
    conn([('Webhook', 'Read records'), ('Read records', 'Check login'), ('Check login', 'Upgrade password?'),
          ('Upgrade password?', 'Save upgraded password', 0), ('Upgrade password?', 'Respond', 1), ('Save upgraded password', 'Respond')]))

# 1. AI per room
out['GW-1-AI-room'] = wf('GW Inventory · 1 AI per room', [
    webhook('gw-ai-room'), read_all((220, 0)), code('Prepare request', WITH_CORE(src('auth_only.js') + '\n' + src('ai_prepare.js')), (440, 0)), OK_IF((660, 0)),
    {"id": nid(), "name": "Claude API", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [880, -100],
     "parameters": {"method": "POST", "url": "https://api.anthropic.com/v1/messages", "authentication": "genericCredentialType",
                    "genericAuthType": "httpHeaderAuth", "sendHeaders": True,
                    "headerParameters": {"parameters": [{"name": "anthropic-version", "value": "2023-06-01"}]},
                    "sendBody": True, "specifyBody": "json", "jsonBody": "={{ JSON.stringify($json.body) }}", "options": {"timeout": 90000}},
     "credentials": {"httpHeaderAuth": {"id": cred_id('anthropic'), "name": "GW Anthropic API key"}}},
    code('Parse reply', src('ai_parse.js'), (1100, -100)), respond('Respond', (1320, -100)), respond_err((880, 120))],
    conn([('Webhook', 'Read records'), ('Read records', 'Prepare request'), ('Prepare request', 'Allowed?'), ('Allowed?', 'Claude API', 0), ('Allowed?', 'Refuse', 1),
          ('Claude API', 'Parse reply'), ('Parse reply', 'Respond')]))

# 2. Save record + photos
out['GW-2-Save-record'] = wf('GW Inventory · 2 Save record + photos', [
    webhook('gw-save-record'), read_all((220, 0)), code('Check and prepare', WITH_CORE(src('save_prepare.js')), (440, 0)), OK_IF((660, 0)),
    if_one('Has photos?', "={{ $json.none === true ? 0 : 1 }}", (880, -100)),
    {"id": nid(), "name": "Upload photo", "type": "n8n-nodes-base.googleDrive", "typeVersion": 3, "position": [1100, -200],
     "parameters": {"name": "={{ $json.fileName }}", "driveId": {"__rl": True, "value": "My Drive", "mode": "list", "cachedResultName": "My Drive"},
                    "folderId": {"__rl": True, "value": FOLDER_PHOTOS, "mode": "id"}, "options": {}}, "credentials": GD()},
    code('Build row', src('save_row.js'), (1320, -100)),
    {"id": nid(), "name": "Upsert record", "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.5, "position": [1540, -100],
     "parameters": {"operation": "appendOrUpdate", "documentId": {"__rl": True, "value": RECORDS, "mode": "id"},
                    "sheetName": {"__rl": True, "value": TAB_GID, "mode": "list", "cachedResultName": TAB_NAME},
                    "columns": {"mappingMode": "defineBelow", "value": {k: "={{ $json.%s }}" % k for k in COLS}, "matchingColumns": ["recordId"],
                                "schema": [{"id": k, "displayName": k, "required": False, "defaultMatch": False, "display": True, "type": "string", "canBeUsedToMatch": True} for k in COLS]},
                    "options": {"cellFormat": "RAW"}}, "credentials": GS()},
    respond('Respond', (1760, -100), "={{ JSON.stringify({ ok: true, recordId: $('Build row').first().json.recordId, photoFiles: $('Build row').first().json._photoFiles, updatedAt: $('Build row').first().json.updatedAt }) }}"),
    respond_err((880, 120))],
    conn([('Webhook', 'Read records'), ('Read records', 'Check and prepare'), ('Check and prepare', 'Allowed?'), ('Allowed?', 'Has photos?', 0), ('Allowed?', 'Refuse', 1),
          ('Has photos?', 'Upload photo', 0), ('Has photos?', 'Build row', 1), ('Upload photo', 'Build row'), ('Build row', 'Upsert record'), ('Upsert record', 'Respond')]))

# 3. List records
out['GW-3-List-records'] = wf('GW Inventory · 3 List records', [
    webhook('gw-records', 'GET'), read_all((220, 0)), code('Check and list', WITH_CORE(src('list.js')), (440, 0)),
    respond('Respond', (660, 0), "={{ JSON.stringify($json) }}", "={{ $json.status || 200 }}")],
    conn([('Webhook', 'Read records'), ('Read records', 'Check and list'), ('Check and list', 'Respond')]))

# 4. Photo
out['GW-4-Photo'] = wf('GW Inventory · 4 Photo', [
    webhook('gw-photo', 'GET'), read_all((220, 0)), code('Check photo', WITH_CORE(src('photo_check.js')), (440, 0)), OK_IF((660, 0)),
    {"id": nid(), "name": "Download photo", "type": "n8n-nodes-base.googleDrive", "typeVersion": 3, "position": [880, -100],
     "parameters": {"operation": "download", "fileId": {"__rl": True, "value": "={{ $json.fileId }}", "mode": "id"}, "options": {}}, "credentials": GD()},
    {"id": nid(), "name": "Respond", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [1100, -100],
     "parameters": {"respondWith": "binary", "options": {"responseHeaders": {"entries": [{"name": "Cache-Control", "value": "private, max-age=86400"}]}}}},
    respond_err((880, 120))],
    conn([('Webhook', 'Read records'), ('Read records', 'Check photo'), ('Check photo', 'Allowed?'), ('Allowed?', 'Download photo', 0), ('Allowed?', 'Refuse', 1), ('Download photo', 'Respond')]))

# 6. Save PDF
out['GW-6-Save-PDF'] = wf('GW Inventory · 6 Save PDF', [
    webhook('gw-save-pdf'), read_all((220, 0)), code('PDF to file', WITH_CORE(src('pdf_file.js')), (440, 0)), OK_IF((660, 0)),
    {"id": nid(), "name": "Upload PDF", "type": "n8n-nodes-base.googleDrive", "typeVersion": 3, "position": [660, -100],
     "parameters": {"name": "={{ $json.fileName }}", "driveId": {"__rl": True, "value": "My Drive", "mode": "list", "cachedResultName": "My Drive"},
                    "folderId": {"__rl": True, "value": FOLDER_REPORTS, "mode": "id"}, "options": {}}, "credentials": GD()},
    respond('Respond', (880, -100), "={{ JSON.stringify({ ok: true, fileId: $json.id }) }}"), respond_err((660, 120))],
    conn([('Webhook', 'Read records'), ('Read records', 'PDF to file'), ('PDF to file', 'Allowed?'), ('Allowed?', 'Upload PDF', 0), ('Allowed?', 'Refuse', 1), ('Upload PDF', 'Respond')]))

# 7. Reminder
rem_read = read_all((220, 0)); rem_read.pop('alwaysOutputData')
out['GW-7-Reminder'] = wf('GW Inventory · 7 Check-out reminder (daily)', [
    {"id": nid(), "name": "Every day 08:00", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2, "position": [0, 0],
     "parameters": {"rule": {"interval": [{"triggerAtHour": 8}]}}},
    rem_read, code('Due in 7 days', src('reminder.js'), (440, 0)),
    {"id": nid(), "name": "Email manager", "type": "n8n-nodes-base.gmail", "typeVersion": 2.1, "position": [660, 0],
     "parameters": {"sendTo": "manno.realtor@gmail.com", "subject": "={{ $json.subject }}", "emailType": "text", "message": "={{ $json.text }}", "options": {"appendAttribution": False}},
     "credentials": {"gmailOAuth2": {"id": cred_id('gmail'), "name": "GW Gmail"}}}],
    conn([('Every day 08:00', 'Read records'), ('Read records', 'Due in 7 days'), ('Due in 7 days', 'Email manager')]))

os.makedirs(OUT, exist_ok=True)
for k, v in out.items():
    json.dump(v, open(os.path.join(OUT, k + '.json'), 'w'), indent=2, ensure_ascii=False)
print('built', list(out), '->', OUT)
