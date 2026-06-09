# Server Handoff — 147.93.190.166

## Identity
- Host: `147.93.190.166`
- Primary role: NinjaDispute API and auth-adjacent backend host
- Access: `ssh ninjatools_user@147.93.190.166`

## Canonical paths
- API app: `/home/api/app`
- Static Nuxt build served for `api.ninjadispute.com`: `/home/api/app/public/spa`
- SmartCreditIntegration copy: `/home/ninjatools_user/SmartCreditIntegration`

## Active services
- `ninjadispute-api.service`
- `ninjadipute.service`
- `nginx.service`
- `clp-nginx.service`
- `automation-server.service`

## What matters
- Treat `/home/api/app` as the source of truth for the live API on this host.
- The frontend static build under `/home/api/app/public/spa` is older hash-route NinjaDispute UI, not the same thing as current `ninjadispute.com`.
- If client fields such as `status`, `reportDate`, or `daysLeft` exist in API responses but do not show in the public UI, that is usually a frontend host issue, not this API host.

## Safe workflow
1. Check `systemctl status ninjadispute-api.service`.
2. Check the actual file path before editing.
3. Back up target files before changing them.
4. Restart only the service you changed.
5. Log the change with `/usr/local/bin/agent-handoff-log`.

## Avoid
- Do not assume this host serves the public `ninjadispute.com` static site.
- Do not mix this host with `5.78.214.176` NinjaCore work.
