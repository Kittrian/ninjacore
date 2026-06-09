//! Cloudflare R2 / S3-compatible presigned URL generator.
//!
//! Hand-rolled AWS Sig V4 query-string presign (no aws-sdk-s3 dep) so the
//! binary stays small. Works against:
//!   - Cloudflare R2 (https://<account>.r2.cloudflarestorage.com/<bucket>)
//!   - Contabo Object Storage (https://<region>.contabostorage.com)
//!
//! The presigned URL is a PUT URL the browser uses to upload the file
//! directly. The backend never touches the file bytes — saves bandwidth,
//! cuts upload latency, and means uploads scale with R2's edge, not our
//! Hetzner box.
//!
//! Env:
//!   R2_ENDPOINT        e.g. https://<account>.r2.cloudflarestorage.com
//!   R2_BUCKET          bucket name (e.g. clients-docs)
//!   R2_ACCESS_KEY      access key id
//!   R2_SECRET_KEY      secret access key
//!   R2_REGION          defaults to "auto" for R2 ("us-east-1" works too)
//!   R2_PUBLIC_BASE     read URL base (Worker URL or public bucket URL)
//!
//! Falls back to CONTABO_* env vars when R2_* is missing so old deploys
//! keep working.

use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use time::{format_description::well_known::Iso8601, OffsetDateTime};

type HmacSha256 = Hmac<Sha256>;

#[derive(Clone, Debug)]
pub struct R2Config {
    pub endpoint: String,
    pub bucket: String,
    pub access_key: String,
    pub secret_key: String,
    pub region: String,
    /// Read URL base (Worker or public R2 URL). Used to build readable URLs.
    pub public_base: Option<String>,
}

impl R2Config {
    pub fn from_env() -> Option<Self> {
        let endpoint = env_first(&["R2_ENDPOINT", "CONTABO_S3_ENDPOINT"])?;
        let bucket =
            env_first(&["R2_BUCKET", "CONTABO_S3_BUCKET"]).unwrap_or_else(|| "clients-docs".into());
        let access_key = env_first(&["R2_ACCESS_KEY", "CONTABO_S3_ACCESS_KEY"])?;
        let secret_key = env_first(&["R2_SECRET_KEY", "CONTABO_S3_SECRET_KEY"])?;
        let region =
            env_first(&["R2_REGION", "CONTABO_S3_REGION"]).unwrap_or_else(|| "auto".into());
        let public_base = env_first(&["R2_PUBLIC_BASE"]);
        Some(Self {
            endpoint,
            bucket,
            access_key,
            secret_key,
            region,
            public_base,
        })
    }
}

fn env_first(keys: &[&str]) -> Option<String> {
    for k in keys {
        if let Ok(v) = std::env::var(k) {
            let trimmed = v.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

#[derive(Debug)]
pub struct PresignedPut {
    pub url: String,
    pub key: String,
    pub expires_at: String,
    pub headers: Vec<(String, String)>,
}

/// Build a presigned PUT URL for `key` with `content_type` signed in.
/// `expires_in_secs` is clamped to [60, 3600].
pub fn presign_put(
    cfg: &R2Config,
    key: &str,
    content_type: &str,
    expires_in_secs: u64,
    now: Option<OffsetDateTime>,
) -> Result<PresignedPut, String> {
    let expires = expires_in_secs.clamp(60, 3600);
    let key = key.trim_start_matches('/');
    let now = now.unwrap_or_else(OffsetDateTime::now_utc);
    let date = now.format(&Iso8601::DEFAULT).map_err(|e| e.to_string())?;
    // YYYYMMDDTHHMMSSZ
    let amz_date = format!(
        "{:04}{:02}{:02}T{:02}{:02}{:02}Z",
        now.year(),
        now.month() as u8,
        now.day(),
        now.hour(),
        now.minute(),
        now.second(),
    );
    let date_stamp = format!("{:04}{:02}{:02}", now.year(), now.month() as u8, now.day());

    let endpoint = cfg.endpoint.trim_end_matches('/');
    // Pull "host[:port]" out of "scheme://host[:port][/path]" without pulling
    // in a URL parser. Path on the endpoint is discarded — bucket is prefixed
    // separately into the canonical URI.
    let after_scheme = endpoint.split_once("://").map(|t| t.1).unwrap_or(endpoint);
    let host_header = after_scheme
        .split('/')
        .next()
        .unwrap_or(after_scheme)
        .to_string();
    if host_header.is_empty() {
        return Err("R2 endpoint missing host".into());
    }

    let canonical_uri = format!("/{}/{}", urlencode_path(&cfg.bucket), urlencode_path(key));

    let credential_scope = format!("{date_stamp}/{}/s3/aws4_request", cfg.region);
    let credential = format!("{}/{credential_scope}", cfg.access_key);

    // Query parameters that get signed. Must be sorted by key for canonical form.
    let mut qs: BTreeMap<String, String> = BTreeMap::new();
    qs.insert("X-Amz-Algorithm".into(), "AWS4-HMAC-SHA256".into());
    qs.insert("X-Amz-Credential".into(), credential.clone());
    qs.insert("X-Amz-Date".into(), amz_date.clone());
    qs.insert("X-Amz-Expires".into(), expires.to_string());
    qs.insert("X-Amz-SignedHeaders".into(), "content-type;host".into());

    let canonical_query = qs
        .iter()
        .map(|(k, v)| format!("{}={}", urlencode_strict(k), urlencode_strict(v)))
        .collect::<Vec<_>>()
        .join("&");

    let canonical_headers = format!("content-type:{content_type}\nhost:{host_header}\n");
    let signed_headers = "content-type;host";
    let payload_hash = "UNSIGNED-PAYLOAD";

    let canonical_request = format!(
        "PUT\n{canonical_uri}\n{canonical_query}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
    );

    let mut hasher = Sha256::new();
    hasher.update(canonical_request.as_bytes());
    let canon_hash = hex::encode(hasher.finalize());

    let string_to_sign = format!("AWS4-HMAC-SHA256\n{amz_date}\n{credential_scope}\n{canon_hash}");

    let signing_key = derive_signing_key(&cfg.secret_key, &date_stamp, &cfg.region, "s3")?;
    let mut mac = HmacSha256::new_from_slice(&signing_key).map_err(|e| e.to_string())?;
    mac.update(string_to_sign.as_bytes());
    let signature = hex::encode(mac.finalize().into_bytes());

    let signed_qs = qs
        .iter()
        .map(|(k, v)| format!("{}={}", urlencode_strict(k), urlencode_strict(v)))
        .chain(std::iter::once(format!("X-Amz-Signature={signature}")))
        .collect::<Vec<_>>()
        .join("&");

    let url = format!("{endpoint}{canonical_uri}?{signed_qs}");
    let expires_at = (now + time::Duration::seconds(expires as i64))
        .format(&Iso8601::DEFAULT)
        .unwrap_or(date);

    Ok(PresignedPut {
        url,
        key: key.to_string(),
        expires_at,
        headers: vec![("Content-Type".into(), content_type.to_string())],
    })
}

fn derive_signing_key(
    secret: &str,
    date_stamp: &str,
    region: &str,
    service: &str,
) -> Result<Vec<u8>, String> {
    fn hmac(key: &[u8], msg: &[u8]) -> Result<Vec<u8>, String> {
        let mut mac = HmacSha256::new_from_slice(key).map_err(|e| e.to_string())?;
        mac.update(msg);
        Ok(mac.finalize().into_bytes().to_vec())
    }
    let k_date = hmac(format!("AWS4{secret}").as_bytes(), date_stamp.as_bytes())?;
    let k_region = hmac(&k_date, region.as_bytes())?;
    let k_service = hmac(&k_region, service.as_bytes())?;
    hmac(&k_service, b"aws4_request")
}

/// AWS URL-encode (unreserved chars + slash kept). Used for path components.
fn urlencode_path(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        if is_unreserved(b) || b == b'/' {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{:02X}", b));
        }
    }
    out
}

/// AWS strict URL-encode (used for query string values). NO chars passed through except unreserved.
fn urlencode_strict(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        if is_unreserved(b) {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{:02X}", b));
        }
    }
    out
}

fn is_unreserved(b: u8) -> bool {
    (b'a'..=b'z').contains(&b)
        || (b'A'..=b'Z').contains(&b)
        || (b'0'..=b'9').contains(&b)
        || matches!(b, b'-' | b'_' | b'.' | b'~')
}

/// Build a public read URL for an uploaded key, preferring the configured
/// public base (Worker / public bucket). Falls back to a /api/documents/proxy
/// path so the API server's auth gate stays in the loop.
pub fn public_url(cfg: &R2Config, key: &str) -> String {
    if let Some(base) = &cfg.public_base {
        format!(
            "{}/{}",
            base.trim_end_matches('/'),
            key.trim_start_matches('/')
        )
    } else {
        format!("/api/documents/proxy?key={}", urlencode_strict(key))
    }
}
