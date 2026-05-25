# letter-server

Actix-web server that generates professional letters as PDFs using Typst.

## Run

```bash
cd /Users/drewdrew/NinjaTools/letter-server
source "$HOME/.cargo/env"

# optional (only if use_ai_improve=true)
export GROQ_API_KEY="..."

cargo run
```

Server listens on `http://0.0.0.0:8080`.

## Request (PDF download)

```bash
curl -sS -X POST http://127.0.0.1:8080/generate-letter \
  -H 'Content-Type: application/json' \
  -d '{
    "recipient":"Jane Doe",
    "sender":"Acme Corp",
    "subject":"Regarding your account",
    "body":"Thank you for your time. This letter confirms our discussion.",
    "logo_base64": null,
    "signature_base64": null,
    "use_ai_improve": false
  }' \
  -o professional_letter.pdf
```

Notes:
- `logo_base64` / `signature_base64` should be raw base64 of a PNG file (no `data:image/png;base64,` prefix).
- If AI rewriting fails or `GROQ_API_KEY` is missing, the original `body` is used.

