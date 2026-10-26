/* Connection settings: the live system on GW Realty's n8n server
   (Claude AI, photos and PDFs in Google Drive, records in the Google Sheet).
   No key here: the server checks each person's sign-in. */
(function () {
  try { localStorage.removeItem('gw-mode'); } catch (e) { /* storage blocked */ }
  // Old links with ?live=1 or ?demo=1: tidy the address bar.
  try {
    var q = new URLSearchParams(location.search);
    if (q.has('live') || q.has('demo')) {
      q.delete('live'); q.delete('demo');
      history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    }
  } catch (e) { /* old browser: leave the address as it is */ }
  window.GW_API = { base: 'https://alvinserver1.tail2b1575.ts.net/webhook', label: '' };
})();
