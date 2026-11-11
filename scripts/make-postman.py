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
        "const j = pm.response.json();", "pm.collectionVariables.set('access_token', j.access_token);",
        "pm.test('token issued', () => pm.expect(j.access_token).to.be.a('string'));"]}}],
    "request": {"method": "POST",
        "auth": {"type": "basic", "basic": [{"key": "username", "value": "{{client_id}}", "type": "string"}, {"key": "password", "value": "{{client_secret}}", "type": "string"}]},
        "header": [{"key": "Content-Type", "value": "application/x-www-form-urlencoded"}],
        "body": {"mode": "urlencoded", "urlencoded": [{"key": "grant_type", "value": "client_credentials"}]},
        "url": {"raw": "{{base_url}}/v1/oauth2/token", "host": ["{{base_url}}"], "path": ["v1", "oauth2", "token"]},
        "description": "Client-credentials token. Still Open uses it only for read-only calls."}}

setup = [
    req("Create Maya's $66 order", "POST", "/v2/checkout/orders", "Sandbox setup only (scripts/demo.js). Approve the payer-action link as the sandbox buyer.",
        {"intent": "CAPTURE", "purchase_units": [{"reference_id": "maya-dress", "description": "Emerald satin midi dress (Still Open demo)", "amount": {"currency_code": "USD", "value": "66.00"}}],
         "payment_source": {"paypal": {"experience_context": {"return_url": "https://example.com/approved", "cancel_url": "https://example.com/cancelled", "user_action": "PAY_NOW"}}}}),
    req("Capture the order", "POST", "/v2/checkout/orders/{{order_id}}/capture", "Sandbox setup only.", {}),
    req("Seller adds tracking", "POST", "/v2/checkout/orders/{{order_id}}/track", "Sandbox setup only: the tracking number the seller claims.",
        {"capture_id": "{{capture_id}}", "tracking_number": "9400111899223197428490", "carrier": "USPS", "notify_payer": False}),
]
read = [
    req("List disputes", "GET", "/v1/customer/disputes", "Find cases. Still Open matches them to the signed-in buyer's payer ID.", query=[("page_size", "20")]),
    req("Read the case", "GET", "/v1/customer/disputes/{{dispute_id}}", "Status, reason, amount, refund outcome, dates: the record Still Open checks emails against."),
    req("Capture (links up to the order)", "GET", "/v2/payments/captures/{{capture_id}}", "The dispute carries the capture ID; its 'up' link is the order."),
    req("Order (ship-to address + trackers)", "GET", "/v2/checkout/orders/{{order_id}}", "Ship-to ZIP and tracking on file: what makes 'delivered to the wrong ZIP' checkable."),
    req("Trackers on the transaction", "GET", "/v1/shipping/trackers", "Tracking numbers the seller added.", query=[("transaction_id", "{{capture_id}}")]),
]
login = [
    {"name": "Log in with PayPal: authorize (open in a browser)", "request": {"method": "GET",
        "url": {"raw": "https://www.sandbox.paypal.com/signin/authorize?flowEntry=static&client_id={{client_id}}&response_type=code&scope=openid%20profile%20email%20https%3A%2F%2Furi.paypal.com%2Fservices%2Fpaypalattributes&redirect_uri={{return_url}}",
                "host": ["https://www.sandbox.paypal.com"], "path": ["signin", "authorize"]},
        "description": "Identity only: gives Still Open the buyer's payer ID, not her transactions."}},
    {"name": "Log in with PayPal: user info", "request": {"method": "GET",
        "auth": {"type": "bearer", "bearer": [{"key": "token", "value": "{{user_access_token}}", "type": "string"}]},
        "url": {"raw": "{{base_url}}/v1/identity/oauth2/userinfo?schema=paypalv1.1", "host": ["{{base_url}}"], "path": ["v1", "identity", "oauth2", "userinfo"], "query": [{"key": "schema", "value": "paypalv1.1"}]},
        "description": "Returns payer_id, which Still Open uses to find her cases in the sandbox demo."}},
]
day20 = [
    app("Still Open: start a demo session", "POST", "/api/demo", {}),
    app("Still Open: check an email against the case", "POST", "/api/cases/{{dispute_id}}/check",
        {"text": "From: PayPal <service@paypal.com>\nThe seller has issued a full refund of $66.00 USD. Your case has been resolved. No further action is required."},
        ["const j = pm.response.json();",
         "pm.test('fake refund is caught', () => pm.expect(j.comparison.overall).to.eql('mismatch'));",
         "pm.test('the agent never claims to act', () => pm.expect(j.note).to.not.match(/I (filed|escalated|closed)/i));"]),
    app("Still Open: one-page case", "GET", "/api/cases/{{dispute_id}}/page"),
]

col = {"info": {"name": "Still Open · buyer-side PayPal dispute flow",
    "description": "Every PayPal call Still Open makes, in order, plus Still Open's own API. Read-only except the sandbox setup folder.\n\nPut your sandbox client_id and client_secret in the collection variables. Never commit them.",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
    "item": [token, {"name": "2. Sandbox setup (seller side, demo only)", "item": setup},
             {"name": "3. What Still Open reads (read-only)", "item": read},
             {"name": "4. Log in with PayPal", "item": login}, {"name": "5. Still Open API", "item": day20}],
    "variable": [{"key": k, "value": v} for k, v in [
        ("base_url", "https://api-m.sandbox.paypal.com"), ("app_url", "https://day20.onrender.com"), ("client_id", ""), ("client_secret", ""),
        ("access_token", ""), ("user_access_token", ""), ("return_url", "https://day20.onrender.com/auth/paypal/callback"),
        ("dispute_id", "PP-R-UZH-10198816"), ("capture_id", "0PP7442882460564M"), ("order_id", "42J2970806644392S")]]}

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, "..", "postman", "Day20.postman_collection.json")
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w") as f:
    json.dump(col, f, indent=2)
print("wrote", os.path.normpath(out))
