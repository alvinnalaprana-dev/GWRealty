/* Connection settings.
   - Empty base: self-contained demo, data stays in one browser.
   - base '/api': shared demo storage on Netlify (netlify/functions/gw.mjs). Phone and laptop see the same data; AI is simulated; nothing goes to Google Drive.
   - n8n URL (e.g. 'https://n8n.example.com/webhook') + the n8n key: live system with real AI and Google Drive.
   label: the badge shown in the header. */
window.GW_API = { base: '/api', key: 'gw-demo-2026', label: 'DEMO' };
