# Server Handoff — 217.76.57.182

## Identity
- Host: `217.76.57.182`
- Primary role: public `ninjadispute.com` static frontend host
- Access: `ssh root@217.76.57.182`

## Canonical paths
- Web root: `/home/ninjadispute/htdocs/ninjadispute.com`
- Client bundle directory: `/home/ninjadispute/htdocs/ninjadispute.com/js`

## Active services
- `nginx.service`

## What matters
- Treat `/home/ninjadispute/htdocs/ninjadispute.com` as the source of truth for the live public NinjaDispute frontend.
- The clients table bundle has been edited directly on this host before; verify the currently loaded hashed files before patching.
- If you add or remove columns, check both the rendered table header and the row mapper in the same bundle.
- After a frontend change, verify with a real browser request and cache-busted asset references.

## Current note
- The public clients UI work that added `Days Left`, `Report Date`, and `Status` was done on this host, inside the hashed JS bundle under `/home/ninjadispute/htdocs/ninjadispute.com/js`.

## Safe workflow
1. Back up the exact hashed asset before editing it.
2. Edit only the active asset files.
3. Verify HTML references or query-string cache busting after deploy.
4. Confirm the live site at `https://ninjadispute.com/#/clients`.
5. Log the change with `/usr/local/bin/agent-handoff-log`.

## Avoid
- Do not assume this host owns the API.
- Do not confuse this static frontend host with `/home/api/app/public/spa` on `147.93.190.166`.
