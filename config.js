/* Connection settings: the live system on GW Realty's n8n server
   (Claude AI, photos and PDFs in Google Drive, records in the Google Sheet).
   No key here: the server checks each person's sign-in. */
(function () {
  try { localStorage.removeItem('gw-mode'); } catch (e) { /* storage blocked */ }
  window.GW_API = { base: 'https://alvinserver1.tail2b1575.ts.net/webhook', label: '' };
})();
