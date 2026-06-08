# SurrealDB v2 → v3 API Migration

## Summary of Breaking Changes

### 1. HTTP Methods Changed

**v2 (Old):**
```rust
// Could POST to /sql with raw SurrealQL
client.post("http://db:8000/sql")
  .body("SELECT * FROM clients;")
  .send()
```

**v3 (New):**
```rust
// Must use JSON format with Content-Type: application/json
client.post("http://db:8000/sql")
  .json(&QueryRequest { query: "SELECT * FROM clients;" })
  .send()
```

---

### 2. Type System API Changed

**v2 (Old):**
```rust
use surrealdb::sql::Thing;

// Create record IDs with type::thing()
let id = Thing::parse("clients:user123")?;
```

**v3 (New):**
```rust
use surrealdb::RecordId;

// Use RecordId directly
let id = RecordId::from(("clients", "user123"));
// Or parse from string
let id = RecordId::from_str("clients:user123")?;
```

---

### 3. Client Library Changed

**v2 (Old):**
```rust
use surrealdb::client::Client;
use surrealdb::opt::auth::Root;

let client = Client::new("http://127.0.0.1:8000")
  .await?
  .with_auth(Root {
    username: "root",
    password: "change-me",
  })
  .await?;
```

**v3 (New):**
```rust
use surrealdb::Surreal;
use surrealdb::engine::remote::http::Http;

let client = Surreal::new::<Http>("http://127.0.0.1:8000")
  .await?;
client
  .signin(surrealdb::opt::auth::Root {
    username: "root",
    password: "change-me",
  })
  .await?;
```

---

### 4. Query Execution Changed

**v2 (Old):**
```rust
let result: Vec<Client> = db.query("SELECT * FROM clients;")
  .await?
  .take(0)?;
```

**v3 (New):**
```rust
let result: Vec<Client> = db.query("SELECT * FROM clients;")
  .await?
  .take(0)?;

// Or use typed methods:
let result: Vec<Client> = db.select("clients").await?;
```

---

### 5. Cargo.toml Dependency

**v2:**
```toml
[dependencies]
surrealdb = "1.0"
```

**v3:**
```toml
[dependencies]
surrealdb = "3.0"
tokio = { version = "1", features = ["full"] }
```

---

## Migration Checklist

- [ ] Update `Cargo.toml` to SurrealDB 3.0+
- [ ] Update HTTP request format (JSON payload)
- [ ] Replace `Thing::parse()` with `RecordId::from_str()`
- [ ] Update client initialization (use `Surreal::new`)
- [ ] Update auth flow (use `.signin()` instead of `.with_auth()`)
- [ ] Replace query execution patterns
- [ ] Test database connection
- [ ] Rebuild with `cargo build --release`

---

## Common Patterns to Update

### Pattern 1: Select All Records
```rust
// v2
let clients: Vec<Client> = db.query("SELECT * FROM clients;")
  .await?
  .take(0)?;

// v3
let clients: Vec<Client> = db.select("clients").await?;
```

### Pattern 2: Create Record
```rust
// v2
let id = Thing::parse("clients:abc123")?;
let created = db.create(id).content(client_data).await?;

// v3
let created: Client = db.create(("clients", "abc123"))
  .content(client_data)
  .await?;
```

### Pattern 3: Update Record
```rust
// v2
let id = Thing::parse("clients:abc123")?;
let updated = db.update(id).merge(updates).await?;

// v3
let updated: Client = db.update(("clients", "abc123"))
  .merge(updates)
  .await?;
```

### Pattern 4: Delete Record
```rust
// v2
let id = Thing::parse("clients:abc123")?;
db.delete(id).await?;

// v3
db.delete(("clients", "abc123")).await?;
```

### Pattern 5: Raw SQL Query
```rust
// v2
let result = db.query("SELECT COUNT() FROM clients;").await?.take(0)?;

// v3
#[derive(Serialize, Deserialize)]
struct CountResult { count: u64 }

let mut response = db.query("SELECT COUNT() FROM clients;").await?;
let count: Option<CountResult> = response.take(0)?;
```

---

## Files to Update in `/opt/ninjacore/ninjacore/src/`

1. **`src/db.rs`** — Database initialization
2. **`src/handlers/clients.rs`** — Client queries (SELECT, CREATE, UPDATE)
3. **`src/handlers/auth.rs`** — Auth token queries
4. **`src/handlers/settings.rs`** — Settings CRUD
5. **`src/main.rs`** — Main connection setup
6. **`Cargo.toml`** — Dependency versions

---

## Step-by-Step Fix Process

### Step 1: Update Cargo.toml
```toml
[dependencies]
surrealdb = "3.0.5"  # Current v3 version
tokio = { version = "1", features = ["full"] }
```

### Step 2: Update Database Connection (src/db.rs)
```rust
use surrealdb::Surreal;
use surrealdb::engine::remote::http::Http;

pub async fn init_db() -> Result<Surreal<Http>, Box<dyn std::error::Error>> {
    let db = Surreal::new::<Http>("http://127.0.0.1:8000").await?;
    
    db.signin(surrealdb::opt::auth::Root {
        username: "root",
        password: "change-me",
    })
    .await?;
    
    db.use_ns("ninja").use_db("dispute").await?;
    
    Ok(db)
}
```

### Step 3: Update Client Handlers (src/handlers/clients.rs)
```rust
use surrealdb::RecordId;

pub async fn list_clients(db: &Surreal<Http>) -> Result<Vec<Client>> {
    let clients: Vec<Client> = db.select("clients").await?;
    Ok(clients)
}

pub async fn get_client(db: &Surreal<Http>, id: &str) -> Result<Client> {
    let client: Option<Client> = db.select(("clients", id)).await?;
    Ok(client.ok_or("Not found")?)
}

pub async fn create_client(db: &Surreal<Http>, client: Client) -> Result<Client> {
    let created: Client = db.create("clients")
        .content(client)
        .await?;
    Ok(created)
}

pub async fn update_client(db: &Surreal<Http>, id: &str, updates: Client) -> Result<Client> {
    let updated: Client = db.update(("clients", id))
        .merge(updates)
        .await?;
    Ok(updated)
}

pub async fn delete_client(db: &Surreal<Http>, id: &str) -> Result<()> {
    db.delete(("clients", id)).await?;
    Ok(())
}
```

### Step 4: Rebuild
```bash
cd /opt/ninjacore/ninjacore
/root/.cargo/bin/cargo build --release
```

### Step 5: Restart Backend
```bash
systemctl restart ninjacore
journalctl -u ninjacore.service -n 20 --no-pager
```

---

## Testing After Migration

### Verify Connection
```bash
curl -u root:change-me -X POST http://127.0.0.1:8000/sql \
  -H 'Content-Type: application/json' \
  -d '{"query":"SELECT 1"}'
```

### Check Logs
```bash
journalctl -u ninjacore.service -f --no-pager
```

### Hit API Endpoint
```bash
curl -s http://localhost:3019/api/health
curl -s http://localhost:3019/api/clients?offset=0&limit=100
```

---

## Reference: Full Example Migration

### Before (v2)
```rust
use surrealdb::client::Client;
use surrealdb::sql::Thing;

#[tokio::main]
async fn main() -> Result<()> {
    let client = Client::new("http://127.0.0.1:8000").await?
        .with_auth(Root { username: "root", password: "change-me" })
        .await?;
    
    let result: Vec<Client> = client
        .query("SELECT * FROM clients LIMIT 10;")
        .await?
        .take(0)?;
    
    println!("{:?}", result);
    Ok(())
}
```

### After (v3)
```rust
use surrealdb::Surreal;
use surrealdb::engine::remote::http::Http;

#[tokio::main]
async fn main() -> Result<()> {
    let db = Surreal::new::<Http>("http://127.0.0.1:8000").await?;
    
    db.signin(surrealdb::opt::auth::Root {
        username: "root",
        password: "change-me",
    })
    .await?;
    
    db.use_ns("ninja").use_db("dispute").await?;
    
    let clients: Vec<Client> = db.select("clients").await?;
    
    println!("{:?}", clients);
    Ok(())
}
```

---

## Known Issues & Workarounds

### Issue: "Method not allowed"
- **Cause**: v2 HTTP syntax being used on v3
- **Fix**: Use proper JSON format with Content-Type header

### Issue: "Invalid record ID"
- **Cause**: Using `Thing::parse()` or wrong tuple format
- **Fix**: Use `RecordId::from()` or string tuple `("table", "id")`

### Issue: "Auth failed"
- **Cause**: Using old `.with_auth()` pattern
- **Fix**: Use `.signin()` after creating connection

### Issue: Empty results
- **Cause**: Not calling `.use_ns()` and `.use_db()`
- **Fix**: Set namespace and database right after signin

---

## Commands to Run

```bash
# On server, update code
cd /opt/ninjacore/ninjacore
# ... apply changes to src/

# Rebuild
/root/.cargo/bin/cargo build --release

# Restart
systemctl restart ninjacore

# Verify
curl -s http://localhost:3019/api/health
```

---

**Status**: Ready to implement
**Time to fix**: 30-60 minutes
**Testing required**: Yes
