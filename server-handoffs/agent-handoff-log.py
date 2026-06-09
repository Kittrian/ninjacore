#!/usr/bin/env python3
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


JSONL_PATH = Path("/var/log/agent-handoff.jsonl")
MARKDOWN_PATH = Path("/root/AGENT_HANDOFF.md")


def main() -> int:
    if len(sys.argv) < 6:
        print(
            "usage: agent-handoff-log <actor> <summary> <files> <verification> <rollback>",
            file=sys.stderr,
        )
        return 1

    actor, summary, files_arg, verification, rollback = sys.argv[1:6]
    notes = sys.stdin.read().strip()
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    files = [item for item in files_arg.split("|") if item]

    payload = {
        "timestamp": timestamp,
        "actor": actor,
        "summary": summary,
        "files": files,
        "verification": verification,
        "rollback": rollback,
        "notes": notes,
    }

    JSONL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with JSONL_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False) + "\n")

    MARKDOWN_PATH.parent.mkdir(parents=True, exist_ok=True)
    with MARKDOWN_PATH.open("a", encoding="utf-8") as handle:
        handle.write(f"\n## {timestamp} — {actor}\n")
        handle.write(f"- Summary: {summary}\n")
        handle.write(f"- Files: {', '.join(files) if files else 'none'}\n")
        handle.write(f"- Verification: {verification}\n")
        handle.write(f"- Rollback: {rollback}\n")
        if notes:
            handle.write("- Notes:\n")
            for line in notes.splitlines():
                handle.write(f"  - {line}\n")

    print(timestamp)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
