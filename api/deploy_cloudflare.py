"""Deploy api/dist/worker.mjs to Cloudflare Workers, copying secrets from the Render service (values never printed)."""
import json, urllib.request, uuid

ACCOUNT = "86eb082f432b1091750cbc849f00eaf3"
SCRIPT = "break-a-fast-api"
RENDER_SVC = "srv-dc01a867bikc7394mhfg"

def req(url, method="GET", data=None, headers=None):
    h = {"Authorization": "Bearer proxy-injected", **(headers or {})}
    r = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

# 1. secrets from Render
st, envs = req(f"https://api.render.com/v1/services/{RENDER_SVC}/env-vars?limit=50")
vals = {e["envVar"]["key"]: e["envVar"]["value"] for e in envs}
assert len(vals.get("SIGNING_SECRET", "")) >= 32, "no signing secret on Render"
print("render env keys:", sorted(vals))

# 2. upload worker (multipart)
code = open(__import__("os").path.join(__import__("os").path.dirname(__file__), "dist", "worker.mjs"), "rb").read()
bindings = [{"type": "secret_text", "name": "SIGNING_SECRET", "text": vals["SIGNING_SECRET"]},
            {"type": "plain_text", "name": "ALLOWED_ORIGINS", "text": "https://break-a-fast.onrender.com"}]
for k in ("ALERT_KEY", "ALERT_URL"):
    if vals.get(k):
        bindings.append({"type": "secret_text", "name": k, "text": vals[k]})
meta = {"main_module": "worker.mjs", "compatibility_date": "2025-09-01", "compatibility_flags": ["nodejs_compat"], "bindings": bindings,
        "observability": {"enabled": True}}
b = uuid.uuid4().hex
parts = [
    (f'--{b}\r\nContent-Disposition: form-data; name="metadata"; filename="blob"\r\nContent-Type: application/json\r\n\r\n').encode() + json.dumps(meta).encode() + b"\r\n",
    (f'--{b}\r\nContent-Disposition: form-data; name="worker.mjs"; filename="worker.mjs"\r\nContent-Type: application/javascript+module\r\n\r\n').encode() + code + b"\r\n",
    f"--{b}--\r\n".encode(),
]
st, res = req(f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/scripts/{SCRIPT}", "PUT", b"".join(parts),
              {"Content-Type": f"multipart/form-data; boundary={b}"})
print("upload:", st, res.get("success"), res.get("errors"))

# 3. enable workers.dev route for the script
st, res = req(f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/scripts/{SCRIPT}/subdomain", "POST",
              json.dumps({"enabled": True, "previews_enabled": False}).encode(), {"Content-Type": "application/json"})
print("enable workers.dev:", st, res.get("success"), res.get("errors"))
st, res = req(f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/subdomain")
print("account subdomain:", st, res.get("result"), res.get("errors"))
