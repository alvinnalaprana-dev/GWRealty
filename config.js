/* Connection to the n8n server.
   Leave base empty to run as a self-contained demo (simulated AI, data stays in this browser).
   Fill both to go live: AI, records, photos and PDFs go through n8n to Google Drive/Sheets.
   base: the n8n webhook base URL, e.g. 'https://n8n.example.com/webhook'
   key:  the value of the "GW Inventory key" header credential in n8n (header name X-GW-Key) */
window.GW_API = { base: '', key: '' };
