#!/usr/bin/env python3
"""Paramiko-based SSH runner. Works around sandboxes where sshpass needs a pty.

Usage:
  scripts/rssh.py <host> [-i] <command>      # one-shot
  SSHPW=<pw> scripts/rssh.py <host> <cmd>     # override password
  scripts/rssh.py <host> -i < script.sh       # pipe a multi-line script

Defaults (override via env):
  hetzner   → 5.78.214.176     SSHPW=Malachi77
  contabo   → 147.93.190.166   SSHPW=algara77
"""
import os, sys, paramiko

HOSTS = {
    "hetzner": ("5.78.214.176", "Malachi77"),
    "contabo": ("147.93.190.166", "algara77"),
    "frontend": ("217.76.57.182", "21Agustus123!!!"),
}

if len(sys.argv) < 2:
    print(__doc__, file=sys.stderr); sys.exit(2)

target = sys.argv[1]
rest = sys.argv[2:]

# Resolve host alias OR literal IP/hostname.
host, default_pw = HOSTS.get(target, (target, "Malachi77"))
password = os.environ.get("SSHPW", default_pw)
user = os.environ.get("SSHUSER", "root")

cmd = sys.stdin.read() if rest and rest[0] == "-i" else " ".join(rest)
if not cmd.strip():
    print("error: empty command", file=sys.stderr); sys.exit(2)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, 22, user, password,
          look_for_keys=False, allow_agent=False, timeout=15)
_, stdout, stderr = c.exec_command(cmd, timeout=900, get_pty=False)
sys.stdout.write(stdout.read().decode(errors="replace"))
err = stderr.read().decode(errors="replace")
if err:
    sys.stderr.write(err)
c.close()
sys.exit(stdout.channel.recv_exit_status())
