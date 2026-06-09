# NinjaTools Handoff Protocol

## Primary Directive
Every interaction on NinjaTools must follow the agent handoff protocol. No exceptions.

## Pre-Action: Read Handoff State
Before touching any live files, read the current handoff note:
- `147.93.190.166`: `ssh root@147.93.190.166 cat /root/AGENT_HANDOFF.md`
- `217.76.57.182`: `ssh root@217.76.57.182 cat /root/AGENT_HANDOFF.md`
- `5.78.214.176`: `ssh root@5.78.214.176 cat /root/AGENT_HANDOFF.md`

Understand the current state, any blockers, or pending work before proceeding.

## Post-Action: Log All Changes
After every server change, log it immediately:

```bash
/usr/local/bin/agent-handoff-log codex "summary" "/path/one|/path/two" "how you verified it" "how to roll it back"
```

Pipe detailed notes to stdin. Example:
```bash
echo "Detailed change notes here" | /usr/local/bin/agent-handoff-log codex "Deployed API v2.1" "/home/api/app/src|/home/api/app/Cargo.toml" "Ran tests; hit /health endpoint" "git revert to abc123; restart service"
```

## Server Roles & Paths
- **147.93.190.166**: API/backend, source at `/home/api/app`, older static at `/home/api/app/public/spa`
- **217.76.57.182**: Public ninjadispute.com frontend, live root at `/home/ninjadispute/htdocs/ninjadispute.com`
- **5.78.214.176**: Live NinjaCore, canonical root at `/opt/ninjacore`

## Local Workflow
- Treat `/Users/drewdrew/NinjaTools` as the local source root
- Save all local changes there **before** live deploys
- Handoff files: `/Users/drewdrew/NinjaTools/server-handoffs/`

## Non-Negotiable
- Do not skip the handoff protocol
- Do not deploy without reading AGENT_HANDOFF.md first
- Do not make changes without logging them
- Always verify changes and document rollback procedure

## Logging Locations
- Local: `/Users/drewdrew/NinjaTools/server-handoffs/agent-handoff-log.py`
- Per-server local: `/Users/drewdrew/NinjaTools/server-handoffs/{ip}/AGENT_HANDOFF.md`
- Live: `/root/AGENT_HANDOFF.md` + `/var/log/agent-handoff.jsonl` on each server
