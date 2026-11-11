# Builds postman/Day20.postman_collection.json. Run: python3 scripts/make-postman.py
import json, os

def req(name, method, path, desc, body=None, auth=True, query=None):
    r = {"name": name, "request": {"method": method,
        "header": [{"key": "Content-Type", "value": "application/json"}, {"key": "Prefer", "value": "return=representation"}],
        "url": {"raw": "{{base_url}}" + path, "host": ["{{base_url}}"], "path": [p for p in path.split("?")[0].split("/") if p]},
        "description": desc}}
    if query:
        r["request"]["url"]["query"] = [{"key": k, "value": v} for k, v in query]
        r["request"]["url"]["raw"] += "?" + "&".join(f"{k}={v}" for k, v in query)
    if body is not None:
        r["request"]["body"] = {"mode": "raw", "raw": json.dumps(body, indent=2)}
    if auth:
        r["request"]["auth"] = {"type": "bearer", "bearer": [{"key": "token", "value": "{{access_token}}", "type": "string"}]}
    return r

def tests(r, lines):
    r["event"] = [{"listen": "test", "script": {"type": "text/javascript", "exec": lines}}]
    return r

def app(name, method, path, body=None, tests=None):
    r = {"name": name, "request": {"method": method, "header": [{"key": "Content-Type", "value": "application/json"}],
        "url": {"raw": "{{app_url}}" + path, "host": ["{{app_url}}"], "path": [p for p in path.split("/") if p]}}}
    if body is not None:
        r["request"]["body"] = {"mode": "raw", "raw": json.dumps(body, indent=2)}
    if tests:
        r["event"] = [{"listen": "test", "script": {"type": "text/javascript", "exec": tests}}]
    return r

token = {"name": "1. Get access token",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": [
        "const j = pm.response.json();", "(pm.environment.name ? pm.environment : pm.collectionVariables).set('access_token', j.access_token);",
        "pm.test('token issued', () => pm.expect(j.access_token).to.be.a('string'));"]}}],
    "request": {"method": "POST",
        "auth": {"type": "basic", "basic": [{"key": "username", "value": "{{client_id}}", "type": "string"}, {"key": "password", "value": "{{client_secret}}", "type": "string"}]},
        "header": [{"key": "Content-Type", "value": "application/x-www-form-urlencoded"}],
        "body": {"mode": "urlencoded", "urlencoded": [{"key": "grant_type", "value": "client_credentials"}]},
        "url": {"raw": "{{base_url}}/v1/oauth2/token", "host": ["{{base_url}}"], "path": ["v1", "oauth2", "token"]},
        "description": "Client-credentials token. Day 20 uses it only for read-only calls."}}

setup = [
    tests(req("Create Maya's $66 order", "POST", "/v2/checkout/orders", "Sandbox setup only (scripts/demo.js). Approve the payer-action link as the sandbox buyer.",
        {"intent": "CAPTURE", "purchase_units": [{"reference_id": "maya-dress", "description": "Emerald satin midi dress (Day 20 demo)", "amount": {"currency_code": "USD", "value": "66.00"}}],
         "payment_source": {"paypal": {"experience_context": {"return_url": "https://example.com/approved", "cancel_url": "https://example.com/cancelled", "user_action": "PAY_NOW"}}}}),
        ["const j = pm.response.json();", "pm.test('order created', () => pm.expect(j.id).to.be.a('string'));", "pm.collectionVariables.set('order_id', j.id);"]),
    tests(req("Capture the order", "POST", "/v2/checkout/orders/{{order_id}}/capture", "Sandbox setup only. Saves capture_id.", {}),
        ["const j = pm.response.json();", "const c = j.purchase_units && j.purchase_units[0].payments.captures[0];",
         "pm.test('captured', () => pm.expect(c.status).to.eql('COMPLETED'));", "pm.collectionVariables.set('capture_id', c.id);"]),
    req("Seller adds tracking", "POST", "/v2/checkout/orders/{{order_id}}/track", "Sandbox setup only: the tracking number the seller claims.",
        {"capture_id": "{{capture_id}}", "tracking_number": "9400111899223197428490", "carrier": "USPS", "notify_payer": False}),
]
read = [
    tests(req("List disputes", "GET", "/v1/customer/disputes", "Find cases. Day 20 matches them to the signed-in buyer's payer ID. Always sets dispute_id to the first case if none is set.", query=[("page_size", "20")]),
        ["pm.test('200 OK', () => pm.response.to.have.status(200));",
         "const j = pm.response.json();",
         "if (j.items && j.items.length) pm.collectionVariables.set('dispute_id', j.items[0].dispute_id);", "pm.test('found a case to read', () => pm.expect(pm.collectionVariables.get('dispute_id')).to.be.a('string').and.not.empty);"]),
    tests(req("Read the case", "GET", "/v1/customer/disputes/{{dispute_id}}", "Status, reason, amount, refund outcome, dates: the record Day 20 checks emails against. Sets capture_id."),
        ["pm.test('200 OK', () => pm.response.to.have.status(200));",
         "const j = pm.response.json();",
         "pm.test('has a status and an amount', () => { pm.expect(j.status).to.be.a('string'); pm.expect(j.dispute_amount.value).to.be.a('string'); });",
         "const tx = (j.disputed_transactions || [])[0] || {};",
         "if (tx.seller_transaction_id) pm.collectionVariables.set('capture_id', tx.seller_transaction_id);"]),
    tests(req("Capture (links up to the order)", "GET", "/v2/payments/captures/{{capture_id}}", "The dispute carries the capture ID; its 'up' link is the order. Sets order_id. A REFUNDED status here also counts as a refund."),
        ["pm.test('200 OK', () => pm.response.to.have.status(200));",
         "const j = pm.response.json();",
         "const up = (j.links || []).find(l => l.rel === 'up' && /checkout\\/orders/.test(l.href));",
         "pm.test('links up to an order', () => pm.expect(up).to.be.an('object'));",
         "if (up) pm.collectionVariables.set('order_id', up.href.split('/').pop());"]),
    tests(req("Order (ship-to address + trackers)", "GET", "/v2/checkout/orders/{{order_id}}", "Ship-to ZIP and tracking on file: what makes 'delivered to the wrong ZIP' checkable."),
        ["pm.test('200 OK', () => pm.response.to.have.status(200));",
         "const pu = pm.response.json().purchase_units[0];",
         "pm.test('has a ship-to postal code', () => pm.expect(pu.shipping.address.postal_code).to.be.a('string'));"]),
    tests(req("Trackers on the transaction", "GET", "/v1/shipping/trackers", "Tracking numbers the seller added.", query=[("transaction_id", "{{capture_id}}")]),
        ["pm.test('200 OK', () => pm.response.to.have.status(200));"]),
]
login = [
    {"name": "Log in with PayPal: authorize (open in a browser)", "request": {"method": "GET",
        "url": {"raw": "https://www.sandbox.paypal.com/signin/authorize?flowEntry=static&client_id={{client_id}}&response_type=code&scope=openid%20profile%20email%20https%3A%2F%2Furi.paypal.com%2Fservices%2Fpaypalattributes&redirect_uri={{return_url}}",
                "host": ["https://www.sandbox.paypal.com"], "path": ["signin", "authorize"]},
        "description": "Identity only: gives Day 20 the buyer's payer ID, not her transactions."}},
    {"name": "Log in with PayPal: exchange the code", "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": [
        "const j = pm.response.json();", "(pm.environment.name ? pm.environment : pm.collectionVariables).set('user_access_token', j.access_token);",
        "pm.test('user token issued', () => pm.expect(j.access_token).to.be.a('string'));"]}}],
     "request": {"method": "POST",
        "auth": {"type": "basic", "basic": [{"key": "username", "value": "{{client_id}}", "type": "string"}, {"key": "password", "value": "{{client_secret}}", "type": "string"}]},
        "header": [{"key": "Content-Type", "value": "application/x-www-form-urlencoded"}],
        "body": {"mode": "urlencoded", "urlencoded": [{"key": "grant_type", "value": "authorization_code"}, {"key": "code", "value": "{{auth_code}}"}]},
        "url": {"raw": "{{base_url}}/v1/oauth2/token", "host": ["{{base_url}}"], "path": ["v1", "oauth2", "token"]},
        "description": "Paste the ?code= from the redirect into auth_code. Day 20 does this server-side and doesn't keep the token."}},
    {"name": "Log in with PayPal: user info", "request": {"method": "GET",
        "auth": {"type": "bearer", "bearer": [{"key": "token", "value": "{{user_access_token}}", "type": "string"}]},
        "url": {"raw": "{{base_url}}/v1/identity/oauth2/userinfo?schema=paypalv1.1", "host": ["{{base_url}}"], "path": ["v1", "identity", "oauth2", "userinfo"], "query": [{"key": "schema", "value": "paypalv1.1"}]},
        "description": "Returns payer_id, which Day 20 uses to find her cases in the sandbox demo."}},
]
day20 = [
    app("Day 20: start a demo session", "POST", "/api/demo", {}),
    app("Day 20: check an email against the case", "POST", "/api/cases/{{demo_dispute_id}}/check",
        {"text": "From: PayPal <service@paypal.com>\nThe seller has issued a full refund of $66.00 USD. Your case has been resolved. No further action is required."},
        ["const j = pm.response.json();",
         "pm.test('fake refund is caught', () => pm.expect(j.comparison.overall).to.eql('mismatch'));",
         "pm.test('the agent never claims to act', () => pm.expect(j.note).to.not.match(/I (filed|escalated|closed)/i));"]),
    app("Day 20: one-page case", "GET", "/api/cases/{{demo_dispute_id}}/page"),
]

col = {"info": {"name": "Day 20 · buyer-side PayPal dispute flow",
    "description": "Every PayPal call Day 20 makes, in order, plus Day 20's own API. Read-only except the sandbox setup folder.\n\nImport the environment file next to this collection and put your sandbox client_id and client_secret there (the secret is a secret-type variable). Then run 1 and folder 3 in order: each request saves the next ID (dispute -> capture -> order), so the chain works on your own sandbox case. Never commit keys.",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
    "item": [token, {"name": "2. Sandbox setup (seller side, demo only)", "item": setup},
             {"name": "3. What Day 20 reads (read-only)", "item": read},
             {"name": "4. Log in with PayPal", "item": login}, {"name": "5. Day 20 API", "item": day20}],
    "variable": [{"key": k, "value": v} for k, v in [
        ("base_url", "https://api-m.sandbox.paypal.com"), ("app_url", "https://day20.onrender.com"),
        ("access_token", ""), ("user_access_token", ""), ("auth_code", ""), ("return_url", "https://day20.onrender.com/auth/paypal/callback"),
        ("dispute_id", ""), ("capture_id", ""), ("order_id", ""), ("demo_dispute_id", "PP-R-UZH-10198816")]]}

env = {"name": "Day 20 sandbox", "values": [
    {"key": "client_id", "value": "", "type": "default", "enabled": True},
    {"key": "client_secret", "value": "", "type": "secret", "enabled": True},
    {"key": "access_token", "value": "", "type": "secret", "enabled": True},
    {"key": "user_access_token", "value": "", "type": "secret", "enabled": True}]}

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, "..", "postman", "Day20.postman_collection.json")
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w") as f:
    json.dump(col, f, indent=2)
print("wrote", os.path.normpath(out))
with open(os.path.join(os.path.dirname(out), "Day20.sandbox.postman_environment.json"), "w") as f:
    json.dump(env, f, indent=2)
