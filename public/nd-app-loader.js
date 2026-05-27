const isNinjaDisputeHashRoute = () => String(window.location.hash || '').startsWith('#/');

if (isNinjaDisputeHashRoute()) {
  window.ND_HASH_SHELL_ACTIVE = true;
  await import('/nd-hash-shell.js?v=20260527-09');
} else {
  await import('/app.js?v=20260527-08');
}
