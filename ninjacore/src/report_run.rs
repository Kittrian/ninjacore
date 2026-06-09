//! Browser-driven credit report runner.
//!
//! Ports `startBrowserReportRun` + `/api/clients/:id/refresh-report` from
//! `server.mjs` (lines 1149 and 9979). Spawns the Node script
//! `scripts/XxXGetReport-NinjaTools.mjs`, streams stdout/stderr into a per-run
//! log buffer, and tracks state in an in-memory DashMap on `AppState`.

use std::collections::VecDeque;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;

use dashmap::DashMap;
use serde_json::{json, Value};
use time::OffsetDateTime;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::error::{AppError, AppResult};

pub type ReportRunHandle = Arc<RwLock<ReportRun>>;
pub type ReportRunStore = Arc<DashMap<String, ReportRunHandle>>;

const MAX_LOG_LINES: usize = 250;

#[derive(Debug, Clone)]
pub struct ReportRun {
    pub id: String,
    pub client_id: String,
    pub agency: String,
    pub status: String,
    pub started_at: String,
    pub ended_at: String,
    pub exit_code: Option<i32>,
    pub error: String,
    pub logs: VecDeque<String>,
    pub client: Option<Value>,
}

impl ReportRun {
    pub fn snapshot(&self) -> Value {
        json!({
            "id": self.id,
            "clientId": self.client_id,
            "agency": self.agency,
            "status": self.status,
            "startedAt": self.started_at,
            "endedAt": self.ended_at,
            "exitCode": self.exit_code,
            "error": self.error,
            "logs": self.logs.iter().cloned().collect::<Vec<_>>(),
            "client": self.client.clone().unwrap_or(Value::Null),
        })
    }

    pub fn push_log(&mut self, line: &str, level: &str) {
        let trimmed = line.trim_end_matches(['\r', '\n']).trim_end();
        if trimmed.is_empty() {
            return;
        }
        self.logs.push_back(format!("[{level}] {trimmed}"));
        while self.logs.len() > MAX_LOG_LINES {
            self.logs.pop_front();
        }
    }
}

/// Mirrors `getBrowserRunnerTypeForAgency` in server.mjs:951.
pub fn agency_runner_type(agency: &str) -> Option<&'static str> {
    let n = agency.trim().to_lowercase();
    if n.contains("identity") || n.contains("iiq") {
        Some("identityiq")
    } else if n.contains("smart") || n.contains("myfree") || n.contains("freescorenow") {
        Some("smartcredit")
    } else {
        None
    }
}

#[derive(Debug)]
pub struct StartParams {
    pub script_path: PathBuf,
    pub script_cwd: PathBuf,
    pub node_bin: String,
    pub api_base: String,
    /// The client payload, with **camelCase** keys (firstName, lastName, email,
    /// monitoringAgency, monitoringUsername, monitoringPassword, secretKey,
    /// id). This is what the Node script reads from `TOOLS_NINJA_CLIENT`.
    pub client: Value,
}

/// Spawn the browser report Node script for the given client.
///
/// Returns the run handle whose state is updated asynchronously as the script
/// progresses. Caller should snapshot it for the HTTP response.
pub async fn start_browser_report_run(
    runs: &ReportRunStore,
    params: StartParams,
    initial_logs: Vec<String>,
) -> AppResult<ReportRunHandle> {
    let client_id = params
        .client
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();

    let agency_raw = params
        .client
        .get("monitoringAgency")
        .and_then(Value::as_str)
        .unwrap_or("");
    let runner = agency_runner_type(agency_raw).ok_or_else(|| {
        AppError::BadRequest(
            "This client is not set to an IdentityIQ, SmartCredit, or MyFreeScoreNow browser-run service.".into(),
        )
    })?;

    let username = params
        .client
        .get("monitoringUsername")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    let password = params
        .client
        .get("monitoringPassword")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    if username.is_empty() || password.is_empty() {
        let missing = match (username.is_empty(), password.is_empty()) {
            (true, true) => "username and password",
            (true, false) => "username",
            (false, true) => "password",
            (false, false) => unreachable!(),
        };
        return Err(AppError::BadRequest(format!(
            "Missing monitoring {missing} for this client — fill it in on the client detail panel and try again."
        )));
    }

    // Dedup: if an existing run for this client is queued/running, return it.
    for entry in runs.iter() {
        let guard = entry.value().read().await;
        if guard.client_id == client_id && (guard.status == "queued" || guard.status == "running") {
            drop(guard);
            return Ok(entry.value().clone());
        }
    }

    let run = ReportRun {
        id: format!("report-run-{}", Uuid::new_v4().simple()),
        client_id: client_id.clone(),
        agency: runner.to_string(),
        status: "queued".into(),
        started_at: now_rfc3339(),
        ended_at: String::new(),
        exit_code: None,
        error: String::new(),
        logs: VecDeque::new(),
        client: None,
    };
    let run_id = run.id.clone();
    let handle: ReportRunHandle = Arc::new(RwLock::new(run));
    runs.insert(run_id.clone(), handle.clone());

    let first_name = params
        .client
        .get("firstName")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let last_name = params
        .client
        .get("lastName")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    {
        let mut g = handle.write().await;
        g.push_log(
            &format!("Queued browser report runner for {first_name} {last_name}."),
            "info",
        );
        for line in initial_logs {
            g.push_log(&line, "info");
        }
    }

    let client_env = serde_json::to_string(&params.client).unwrap_or_else(|_| "{}".into());
    let script_file_name = params
        .script_path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("script")
        .to_string();

    let mut cmd = Command::new(&params.node_bin);
    cmd.arg(&params.script_path)
        .current_dir(&params.script_cwd)
        .env("TOOLS_NINJA_API_BASE", &params.api_base)
        .env("TOOLS_NINJA_CLIENT", &client_env)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            {
                let mut g = handle.write().await;
                g.status = "failed".into();
                g.error = e.to_string();
                g.ended_at = now_rfc3339();
                g.exit_code = Some(1);
                let msg = e.to_string();
                g.push_log(&msg, "error");
            }
            return Ok(handle);
        }
    };

    {
        let mut g = handle.write().await;
        g.status = "running".into();
        g.push_log(
            &format!("Started browser report runner with {script_file_name}."),
            "info",
        );
    }

    if let Some(stdout) = child.stdout.take() {
        let h = handle.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let mut g = h.write().await;
                g.push_log(&line, "info");
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        let h = handle.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let mut g = h.write().await;
                g.push_log(&line, "error");
            }
        });
    }

    let h = handle.clone();
    tokio::spawn(async move {
        let status_res = child.wait().await;
        let mut g = h.write().await;
        match status_res {
            Ok(status) => {
                let code = status.code().unwrap_or(1);
                g.exit_code = Some(code);
                g.status = if code == 0 {
                    "completed".into()
                } else {
                    "failed".into()
                };
                if code != 0 && g.error.is_empty() {
                    let msg = format!("Browser report runner exited with code {code}.");
                    g.error = msg.clone();
                    g.push_log(&msg, "error");
                }
            }
            Err(e) => {
                g.status = "failed".into();
                g.exit_code = Some(1);
                let msg = e.to_string();
                g.error = msg.clone();
                g.push_log(&msg, "error");
            }
        }
        g.ended_at = now_rfc3339();
    });

    Ok(handle)
}

fn now_rfc3339() -> String {
    OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default()
}
