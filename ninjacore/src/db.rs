use anyhow::{Context, Result};
use serde::de::DeserializeOwned;
use serde_json::Value as JsonValue;
use surrealdb::engine::any::{connect, Any};
use surrealdb::opt::auth::Root;
use surrealdb::types::Value as SValue;
use surrealdb::{IndexedResults, Surreal};

use crate::config::Config;
use crate::error::{AppError, AppResult};

pub type Db = Surreal<Any>;

pub async fn connect_db(cfg: &Config) -> Result<Db> {
    let db = connect(&cfg.surreal_url)
        .await
        .with_context(|| format!("connecting to SurrealDB at {}", cfg.surreal_url))?;

    db.signin(Root {
        username: cfg.surreal_user.clone(),
        password: cfg.surreal_pass.clone(),
    })
    .await
    .context("SurrealDB signin failed")?;

    db.use_ns(cfg.surreal_ns.as_str())
        .use_db(cfg.surreal_db.as_str())
        .await
        .context("selecting SurrealDB namespace/database")?;

    tracing::info!(ns = %cfg.surreal_ns, db = %cfg.surreal_db, "connected to SurrealDB");
    Ok(db)
}

/// Take the first row from `IndexedResults` at `index` as `Option<T>` —
/// converts through `surrealdb::types::Value` → `serde_json::Value` → `T`.
///
/// Mirrors the v2 `.take::<Option<T>>(idx)` ergonomic on top of v3's
/// `SurrealValue` trait bound, without forcing a derive on every struct.
pub fn take_one<T: DeserializeOwned>(
    resp: &mut IndexedResults,
    index: usize,
) -> AppResult<Option<T>> {
    let raw: SValue = resp.take(index).map_err(AppError::Surreal)?;
    let json: JsonValue = raw.into_json_value();
    let cand = match json {
        JsonValue::Array(mut arr) => {
            if arr.is_empty() {
                return Ok(None);
            }
            arr.swap_remove(0)
        }
        JsonValue::Null => return Ok(None),
        other => other,
    };
    Ok(Some(
        serde_json::from_value(cand).map_err(|e| AppError::Other(anyhow::anyhow!(e)))?,
    ))
}

pub fn take_many<T: DeserializeOwned>(
    resp: &mut IndexedResults,
    index: usize,
) -> AppResult<Vec<T>> {
    let raw: SValue = resp.take(index).map_err(AppError::Surreal)?;
    let json: JsonValue = raw.into_json_value();
    match json {
        JsonValue::Array(arr) => arr
            .into_iter()
            .map(|v| serde_json::from_value(v).map_err(|e| AppError::Other(anyhow::anyhow!(e))))
            .collect(),
        JsonValue::Null => Ok(Vec::new()),
        other => Ok(vec![
            serde_json::from_value(other).map_err(|e| AppError::Other(anyhow::anyhow!(e)))?
        ]),
    }
}
