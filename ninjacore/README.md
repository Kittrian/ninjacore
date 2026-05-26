# ninjacore

Main API for **ninjacore.ninjadispute.com** — Axum + Tokio + DashMap + SurrealDB.

Pairs with [`../letter-server`](../letter-server) (Actix-Web, PDF generation only).
`ninjacore` owns clients, auth, payments, training, billing, integrations.

## Stack

| Component  | Role                                              |
| ---------- | ------------------------------------------------- |
| Axum       | Web framework — routing, handlers, middleware     |
| Tokio      | Async runtime                                     |
| DashMap    | In-process cache (sessions, hot letter chunks)    |
| Tower      | Middleware (trace, cors, compression, timeout)    |
| SurrealDB  | Database (`surrealdb` crate, ws/http)             |
| Argon2     | Password hashing                                  |
| Paseto v4  | Session cookies (`rusty_paseto`)                  |

## Quickstart

```bash
cp .env.example .env
# fill in SURREAL_* creds and generate a PASETO_KEY:
openssl rand -hex 32

cargo run             # debug
cargo run --release   # release
```

`curl http://127.0.0.1:8080/api/health` should return `{ "ok": true, ... }`.

## Routes

### Core
| Method | Path                | Auth | Notes                              |
| ------ | ------------------- | ---- | ---------------------------------- |
| GET    | `/api/health`       | no   | service + db + cache stats         |
| POST   | `/api/login`        | no   | argon2 verify, sets `txn` cookie   |
| POST   | `/api/signup`       | no   | creates `app_user`, sets cookie    |
| POST   | `/api/logout`       | no   | clears cookie                      |
| GET    | `/api/auth/status`  | opt  | `{ authenticated, user? }`         |
| GET    | `/api/clients`      | yes  | `WHERE status = 'client'`          |

### Business settings + integrations
| Method | Path                            | Auth | Notes                                            |
| ------ | ------------------------------- | ---- | ------------------------------------------------ |
| GET    | `/api/business-settings`        | yes  | merged with stored `business.settings`           |
| PUT    | `/api/business-settings`        | yes  | deep-merges incoming `{ settings: {...} }`       |
| GET    | `/api/integrations`             | yes  | all 7 services from `settings` table             |
| PUT    | `/api/integrations/:service`    | yes  | upsert into `integration.<service>`              |

### Payments
| Method | Path                              | Auth | Notes                                  |
| ------ | --------------------------------- | ---- | -------------------------------------- |
| GET    | `/api/payments/overview`          | yes  | parallel fetch (tokio::try_join!)      |
| PUT    | `/api/payments/config`            | yes  | upserts `payment_config` row           |
| POST   | `/api/payments/merchants`         | yes  | auto-assigns next id                   |
| PUT    | `/api/payments/merchants/:id`     | yes  | full update                            |
| DELETE | `/api/payments/merchants/:id`     | yes  | 404 if missing                         |
| POST   | `/api/payments/test-square`       | yes  | live Square API call (reqwest)         |
| POST   | `/api/payments/products`          | yes  |                                        |
| PUT    | `/api/payments/products/:id`      | yes  |                                        |
| DELETE | `/api/payments/products/:id`      | yes  |                                        |
| POST   | `/api/payments/autopay`           | yes  |                                        |
| PUT    | `/api/payments/autopay/:id`       | yes  |                                        |
| DELETE | `/api/payments/autopay/:id`       | yes  |                                        |

### Integrations — GoHighLevel inbound
| Method | Path                                          | Auth     | Notes                                                 |
| ------ | --------------------------------------------- | -------- | ----------------------------------------------------- |
| POST   | `/api/integrations/gohighlevel/webhook`       | webhookKey | key via `?key=` / `x-ghl-key` / `Bearer`; find-or-create on `client` |

### Training
| Method | Path                                            | Auth | Notes                                              |
| ------ | ----------------------------------------------- | ---- | -------------------------------------------------- |
| GET    | `/api/training/clients`                         | yes  | hydrated from `client` table                       |
| GET    | `/api/training/context/session`                 | yes  | in-process DashMap-backed                          |
| POST   | `/api/training/context/session`                 | yes  | accepts `{ context, pushToGhl? }`; 2.5MB max       |
| GET    | `/api/training/context/public/:id?token=`       | no   | one-shot share link, token-validated               |
| POST   | `/api/training/ai/rewrite`                      | yes  | `provider: groq \| claude`, reqwest to API         |
| GET    | `/api/training/clients/:id/derogatory`          | yes  | **501** — credit-report parser not yet ported      |

### Billing
| Method | Path                                            | Auth | Notes                                              |
| ------ | ----------------------------------------------- | ---- | -------------------------------------------------- |
| GET    | `/api/billing/failed-payments?q=&limit=`        | yes  | SurrealDB query on `failed_payment_event`          |
| POST   | `/api/billing/safe-query-all-failed-trans`      | yes  | **501** — legacy MySQL scraper (policy: no MySQL)  |

### Documents
| Method | Path                                            | Auth | Notes                                              |
| ------ | ----------------------------------------------- | ---- | -------------------------------------------------- |
| GET    | `/api/documents/proxy?key=`                     | yes  | streams from R2 via `R2_PUBLIC_BASE` + `R2_BEARER` |
| POST   | `/api/admin/migrate-documents-to-s3`            | yes  | **501** — large doc migration job, not yet ported  |

### Misc
| Method | Path                                            | Auth | Notes                                              |
| ------ | ----------------------------------------------- | ---- | -------------------------------------------------- |
| POST   | `/api/auth/sso-login`                           | opt  | verifies via `auth.ninjadispute.com/verify`, 1h cookie |
| GET    | `/api/address-suggestions?q=`                   | no   | Nominatim by default (override `ADDRESS_SUGGEST_URL`) |
| POST   | `/api/simulator/vantage`                        | yes  | **501** — needs Python what-if model               |
| GET    | `/api/affiliate-links`                          | yes  | both sections from `settings` table                |
| PUT    | `/api/affiliate-links/credit-builder`           | yes  | replaces rows for `affiliate.creditBuilder`        |
| PUT    | `/api/affiliate-links/credit-monitoring`        | yes  | replaces rows for `affiliate.creditMonitoring`     |
| POST   | `/api/client-statuses`                          | yes  | appends to `taxonomy.client_statuses`              |
| POST   | `/api/client-phases`                            | yes  | appends to `taxonomy.client_phases`                |
| POST   | `/api/uploads/text-attachment`                  | yes  | writes `attachment` table                          |
| POST   | `/api/clients`                                  | yes  | creates `client` row                               |
| POST   | `/api/clients/import-csv`                       | yes  | bulk-creates from frontend-parsed rows             |
| POST   | `/api/report-sync/identityiq`                   | yes  | **501** — scraper not ported                       |
| POST   | `/api/report-sync/smartcredit`                  | yes  | **501** — scraper not ported                       |

### Static + pretty URLs
| Path                | Serves                                                |
| ------------------- | ----------------------------------------------------- |
| `/`                 | `public/index.html` via `ServeDir`                    |
| `/billing`          | redirect → `/billing.html`                            |
| `/payments`         | redirect → `/payments.html`                           |
| `/add-client`, `/add-clients` | redirect → `/add-client.html`               |
| `/training`, `/Training` | redirect → `/training.html`                      |
| `/learning`, `/Learning` | redirect → `/learning.html`                      |
| `/*`                | falls through to `STATIC_DIR` (default: `public`)     |

## Data migration

Port the legacy JSON store into SurrealDB once before cutover:

```bash
cargo run --bin ninjacore-migrate-json -- \
  /Users/drewdrew/NinjaTools/data/users/admin/store.json

# preview without writing
cargo run --bin ninjacore-migrate-json -- --dry-run \
  /Users/drewdrew/NinjaTools/data/users/admin/store.json
```

The script is idempotent — clients are upserted by `id`, settings by key, all
tagged with `migrated_from_json = true` for traceability.

Cookie shape matches `server.mjs`: `txn`, Path=/, Max-Age=30d, Secure, SameSite=Lax.

## SurrealDB schema (initial)

```surql
DEFINE TABLE app_user SCHEMAFULL;
DEFINE FIELD username      ON app_user TYPE string ASSERT $value = string::lowercase($value);
DEFINE FIELD password_hash ON app_user TYPE string;
DEFINE FIELD created_at    ON app_user TYPE datetime DEFAULT time::now();
DEFINE INDEX app_user_username ON app_user FIELDS username UNIQUE;

DEFINE TABLE client SCHEMALESS;
DEFINE FIELD status ON client TYPE string;
DEFINE INDEX status_idx ON client FIELDS status;

-- Normalized lookup fields used by the GHL webhook find-or-create path:
DEFINE FIELD email_n           ON client TYPE string DEFAULT '';
DEFINE FIELD phone_n           ON client TYPE string DEFAULT '';
DEFINE FIELD ghl_contact_id_n  ON client TYPE string DEFAULT '';
DEFINE INDEX client_email_n_idx           ON client FIELDS email_n;
DEFINE INDEX client_phone_n_idx           ON client FIELDS phone_n;
DEFINE INDEX client_ghl_contact_id_n_idx  ON client FIELDS ghl_contact_id_n;

DEFINE TABLE settings SCHEMALESS;
DEFINE FIELD setting_key ON settings TYPE string;
DEFINE FIELD value_json  ON settings TYPE string;
DEFINE INDEX settings_key_idx ON settings FIELDS setting_key UNIQUE;

DEFINE TABLE payment_config   SCHEMALESS;
DEFINE TABLE payment_merchant SCHEMALESS;
DEFINE TABLE payment_product  SCHEMALESS;
DEFINE TABLE payment_autopay  SCHEMALESS;
```

## Deploy (Hetzner — 5.78.214.176)

Build for Linux on the box (or cross-compile):

```bash
cargo build --release
scp target/release/ninjacore root@5.78.214.176:/opt/ninjacore/
```

Suggested `/etc/systemd/system/ninjacore.service`:

```ini
[Unit]
Description=ninjacore main API
After=network.target surrealdb.service
Requires=surrealdb.service

[Service]
ExecStart=/opt/ninjacore/ninjacore
EnvironmentFile=/etc/ninjacore/env
Restart=always
RestartSec=2
User=ninjacore
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Front with nginx/Caddy terminating TLS and proxying `ninjacore.ninjadispute.com` → `127.0.0.1:8080`.

## Cutover plan

Per the user's call: **big-bang replacement** of `server.mjs`. Roadmap after this
scaffold:

1. Port remaining endpoints from `../server.mjs` (~50). Group: business-settings,
   payments (Square / Authorize / BTCP), integrations (GoHighLevel), training,
   billing, AI proxy, document/R2 proxy.
2. Migrate the JSON file store (`data/*.json`) into SurrealDB tables.
3. Static-asset serving via `tower_http::services::ServeDir` for `public/`.
4. Cut DNS / nginx upstream to the Rust binary; retire `server.mjs`.
