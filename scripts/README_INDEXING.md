# Hot Query Indexing Scripts

Quick deployment guide for performance optimization.

## Files

- **`add-hot-query-indexes.surql`** — SurrealDB index definitions (9 indexes)
- **`apply-hot-query-indexes.mjs`** — SurrealDB migration runner
- **`add-mysql-hot-query-indexes.mjs`** — MySQL migration runner (12 indexes)

## Quick Start

### Step 1: Test on Development (Dry Run)

```bash
# SurrealDB - preview changes
node scripts/apply-hot-query-indexes.mjs --dry

# MySQL - preview changes
node scripts/add-mysql-hot-query-indexes.mjs --dry
```

### Step 2: Apply Indexes

```bash
# SurrealDB
node scripts/apply-hot-query-indexes.mjs

# MySQL (if credentials are set)
node scripts/add-mysql-hot-query-indexes.mjs
```

### Step 3: Verify

```bash
# Check SurrealDB indexes were created
curl -X POST http://localhost:8000/sql \
  -H "Content-Type: text/plain" \
  -H "Surreal-NS: ninja" \
  -H "Surreal-DB: dispute" \
  -d "SELECT COUNT() FROM \$info WHERE type = 'index';"

# Check MySQL indexes were created
mysql -h 127.0.0.1 -u root TOOLSNINJA -e "SHOW INDEX FROM client_profiles;" | grep idx_
```

## Expected Results

✓ 9 new SurrealDB indexes  
✓ 12 new MySQL indexes  
✓ 15-30% improvement on hot queries  
✓ 50-80 MB additional storage (both databases)

## Troubleshooting

**"Index already exists"** → Safe to ignore, indexes are idempotent  
**"Authorization failed"** → Check SURREAL_USER/SURREAL_PASS environment variables  
**"Connection refused"** → Verify SurrealDB/MySQL are running and accessible

## Rollback

If performance degrades, remove indexes:

```bash
# SurrealDB
curl -X POST http://localhost:8000/sql \
  -d "DROP INDEX idx_external_client_id ON clients;"

# MySQL
mysql -h 127.0.0.1 -u root TOOLSNINJA \
  -e "DROP INDEX idx_client_profiles_owner_status ON client_profiles;"
```

## Full Documentation

See [`docs/INDEXING_STRATEGY.md`](../docs/INDEXING_STRATEGY.md) for detailed analysis of each index and query pattern.
