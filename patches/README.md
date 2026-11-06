# Dependency patches

## Payload multi-tenant 3.93.0

The global-view redirect helper enforces read/create access in 3.93.0 but omits
request headers from its Local API calls. Our Operator access callbacks need the
Host header and selected-tenant cookie. Forward those headers to the lookup and
autosave creation without changing `overrideAccess: false` or tenant selection.

`apps/web/tests/int/singletonAccess.int.spec.ts` exercises the installed helper
with real Payload access callbacks and PostgreSQL: Site Settings navigation,
Home Page draft creation and subsequent navigation, and unknown-Host denial.

Remove the version-scoped patch once an upstream release forwards this context,
and run that regression test against the unpatched replacement.
