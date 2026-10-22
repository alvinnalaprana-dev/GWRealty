/* Connection settings.
   - DEMO (default): shared demo storage on Netlify (netlify/functions/gw.mjs). AI is simulated; nothing goes to Google Drive.
     The demo key below is public on purpose: the demo only ever holds sample data.
   - TEST: the real system on Alvin's n8n server (real Claude AI, photos and PDFs in Google Drive, records in the Google Sheet).
   Switch on a device by opening the site once with ?live=1 (it is remembered on that device); ?demo=1 switches back.
   At launch, set MODE_DEFAULT to 'live' so every device uses the real system.
   label: the badge shown in the header. */
(function () {
  var MODE_DEFAULT = 'demo';
  var DEMO = { base: '/api', key: 'gw-demo-2026', label: 'DEMO' };
  // No key here: the live system checks each person's sign-in on the server.
  var LIVE = { base: 'https://alvinserver1.tail2b1575.ts.net/webhook', label: 'TEST' };
  var mode = MODE_DEFAULT;
  try {
    var q = new URLSearchParams(location.search);
    if (q.has('live')) localStorage.setItem('gw-mode', 'live');
    if (q.has('demo')) localStorage.setItem('gw-mode', 'demo');
    mode = localStorage.getItem('gw-mode') || MODE_DEFAULT;
  } catch (e) { /* storage blocked: use the default */ }
  window.GW_API = mode === 'live' ? LIVE : DEMO;
})();
