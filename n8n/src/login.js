// Check email + password against the accounts in the _settings row. Returns a signed 30-day token.
const recs = gwRows($input.all());
const res = gwLogin($('Webhook').first().json.body || {}, recs, BOOT, SECRET);
return [{ json: res }];
