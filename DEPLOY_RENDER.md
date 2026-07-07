# Deploying UnSub to Render.com — Step-by-Step

> **Before you start:** Render's free tier spins down after 15 minutes of inactivity.
> For a 24/7 automation bot like this, you need the **Starter plan ($7/month)** or higher.

---

## Phase 1 — Fix the Code for Production

### Step 1 · Fix `app.py` — Remove dev-only settings

Open `app.py` and make these two changes:

**Remove the insecure transport line** (around line 47):
```python
# DELETE this line entirely:
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
```

**Change the last line** from debug mode to production:
```python
# BEFORE:
if __name__ == "__main__":
    app.run(debug=True, port=5000)

# AFTER:
if __name__ == "__main__":
    app.run(debug=False, port=5000)
```

> ⚠️ **Important:** `OAUTHLIB_INSECURE_TRANSPORT` must be removed.
> Render serves over HTTPS automatically so OAuth works without it.

---

### Step 2 · Update `app.py` — Read secret key from environment

Replace the entire "Persistent secret key" block with:

```python
# Reads from environment variable on Render; falls back to random key locally
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or secrets.token_bytes(32)
```

---

### Step 3 · Update `app.py` — Load credentials and token from env vars

Since Render's disk is ephemeral (wiped on redeploy), you can't store files there.
Add this block near the top of `app.py`, after the imports:

```python
import base64, tempfile

# Load credentials.json from environment variable (base64-encoded)
_creds_b64 = os.environ.get("GOOGLE_CREDENTIALS_B64", "")
if _creds_b64:
    _tmp_creds = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
    _tmp_creds.write(base64.b64decode(_creds_b64))
    _tmp_creds.close()
    CREDENTIALS_FILE = _tmp_creds.name
else:
    CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), "credentials.json")

# Pre-seed token.json from environment variable so first request is authenticated
TOKEN_FILE = os.path.join(os.path.dirname(__file__), "token.json")
_token_b64 = os.environ.get("GOOGLE_TOKEN_B64", "")
if _token_b64 and not os.path.exists(TOKEN_FILE):
    with open(TOKEN_FILE, "wb") as _f:
        _f.write(base64.b64decode(_token_b64))
```

---

### Step 4 · Create `requirements.txt`

Run this in your project folder:
```bash
pip freeze > requirements.txt
```

Make sure these are present (add manually if missing):
```
flask
gunicorn
google-auth
google-auth-oauthlib
google-api-python-client
playwright
beautifulsoup4
google-generativeai
requests
```

---

### Step 5 · Create `render.yaml`

Create a file called `render.yaml` in your project root:

```yaml
services:
  - type: web
    name: unsub-app
    runtime: python
    buildCommand: pip install -r requirements.txt && playwright install chromium && playwright install-deps chromium
    startCommand: gunicorn app:app --workers 1 --threads 4 --timeout 300 --bind 0.0.0.0:$PORT
    envVars:
      - key: GEMINI_API_KEY
        sync: false
      - key: FLASK_SECRET_KEY
        sync: false
      - key: GOOGLE_CREDENTIALS_B64
        sync: false
      - key: GOOGLE_TOKEN_B64
        sync: false
```

> **Why `--timeout 300`?**
> The unsubscribe engine can take ~60 seconds per email (Playwright + page loads).
> Gunicorn's default 30s timeout would kill those requests.

> **Why `--workers 1`?**
> Playwright headless browser + SSE streams are memory-heavy.
> One worker with 4 threads is the right balance for Render Starter.

---

### Step 6 · Create `.gitignore`

Create `.gitignore` in your project root:
```
venv/
__pycache__/
*.pyc
token.json
.secret_key
.oauth_state.json
credentials.json
.env
```

> ⚠️ **Never commit `credentials.json` or `token.json` to Git.**

---

## Phase 2 — Encode Secrets as Environment Variables

### Step 7 · Encode `credentials.json`

Run this on your local machine:
```bash
python -c "import base64; print(base64.b64encode(open('credentials.json','rb').read()).decode())"
```
Copy the output — you'll paste it into Render as `GOOGLE_CREDENTIALS_B64`.

---

### Step 8 · Get a valid `token.json`

You need to run the app locally once and log in via Google first:

```bash
python app.py
```
Open `http://127.0.0.1:5000` → Sign in with Google → complete OAuth.

Then encode the generated `token.json`:
```bash
python -c "import base64; print(base64.b64encode(open('token.json','rb').read()).decode())"
```
Copy the output — you'll paste it into Render as `GOOGLE_TOKEN_B64`.

---

## Phase 3 — Update Google OAuth Redirect URI

### Step 9 · Add your Render URL to Google Cloud Console

Your Render URL will be: `https://unsub-app.onrender.com`
(Confirm the exact name from the Render dashboard after first deploy.)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Navigate to **APIs & Services → Credentials**
3. Click your **OAuth 2.0 Client ID**
4. Under **Authorized redirect URIs**, click **Add URI**:
   ```
   https://unsub-app.onrender.com/oauth2callback
   ```
5. Click **Save**

---

## Phase 4 — Push to GitHub

### Step 10 · Push your code

```bash
git init
git add .
git commit -m "Initial commit — ready for Render"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/unsub-app.git
git push -u origin main
```

---

## Phase 5 — Create the Render Service

### Step 11 · Create a new Web Service on Render

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect GitHub and select your `unsub-app` repo
3. Render auto-detects `render.yaml` — click **Apply**

If it doesn't auto-detect, fill in manually:

| Field | Value |
|-------|-------|
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt && playwright install chromium && playwright install-deps chromium` |
| **Start Command** | `gunicorn app:app --workers 1 --threads 4 --timeout 300 --bind 0.0.0.0:$PORT` |
| **Plan** | **Starter ($7/mo)** — free tier sleeps and will stop your automation |

---

### Step 12 · Set Environment Variables in Render

Go to your service → **Environment** tab → Add the following:

| Key | Value |
|-----|-------|
| `FLASK_SECRET_KEY` | Run `python -c "import secrets; print(secrets.token_hex(32))"` and paste |
| `GEMINI_API_KEY` | Your key from [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| `GOOGLE_CREDENTIALS_B64` | The base64 string from Step 7 |
| `GOOGLE_TOKEN_B64` | The base64 string from Step 8 |

Click **Save Changes** — Render will redeploy automatically.

---

## Phase 6 — Verify the Deployment

### Step 13 · Watch the build logs

A successful build ends with:
```
==> Running: playwright install chromium
==> Running: playwright install-deps chromium
==> Build successful 🎉
==> Starting service with: gunicorn app:app ...
```

### Step 14 · Open the app and test

1. Open `https://unsub-app.onrender.com`
2. It should redirect to the Inbox (already authenticated via `token.json`)
3. The automation starts automatically and the progress drawer opens

### Step 15 · Verify in Render logs

In the Render dashboard → **Logs** tab, you should see:
```
GET /api/unread-ids HTTP/1.1 200
GET /api/unsubscribe/all?ids=... HTTP/1.1 200
[INFO] unsubscribe_engine: Strategy 1: Trying direct button click…
[INFO] __main__: Reply sent to ...
```

---

## Ongoing Maintenance

| Task | When |
|------|------|
| **Re-upload `GOOGLE_TOKEN_B64`** | If users get logged out (token expired/revoked). Re-run Step 8 locally and update the env var. |
| **Update code** | Just `git push` — Render auto-deploys on every push |
| **View logs** | Render dashboard → your service → **Logs** tab |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `redirect_uri_mismatch` OAuth error | Add exact Render URL to Google Cloud Console → Authorized Redirect URIs (Step 9) |
| `Playwright executable doesn't exist` | Ensure build command includes `playwright install chromium && playwright install-deps chromium` |
| `gunicorn worker timeout` | Increase `--timeout 300` in start command |
| App stops running / automation pauses | Upgrade to Render **Starter** plan — free tier sleeps after 15 min inactivity |
| `token.json` lost after redeploy | Re-encode and re-upload `GOOGLE_TOKEN_B64` env var |
| `GEMINI_API_KEY` not set warning | Add `GEMINI_API_KEY` in Render Environment tab |
