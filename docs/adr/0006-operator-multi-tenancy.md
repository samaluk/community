---
status: accepted
---

# Isolate Operators within one Payload deployment

## Context

ADR-0005 separated generic platform source from Operator identity, but the
application still stored one set of settings, one staff role per user, and
globally unique content slugs and membership identifiers. Those assumptions
cannot isolate multiple Operators in a shared deployment. Issue
[#337](https://github.com/samaluk/community/issues/337) brings that capability
into scope following the open-source release.

## Decision

Use Payload's official multi-tenant plugin, matched to the installed Payload
version, for Operator relationships, staff assignments, and the CMS Operator
selector. Keep the Operator registry as shared platform data. Places, Articles,
Products, Media, Memberships, Site Settings, and Home Page content belong to one
Operator. Represent the former globals as plugin-supported singleton
collections, with one document per Operator.

Resolve public requests from their configured canonical hostname. Preserve the
unprefixed public routes. Normalize hostname case, ports, and trailing dots;
ignore client-supplied Operator identifiers and forwarded-host overrides.
Unknown and suspended hosts fail closed. There is no default-Operator fallback
for an unrecognized host. Platform Administrators configure hostnames and are
responsible for establishing their ownership and deployment routing.

Store `admin`, `editor`, and `validation-manager` on each Operator Staff
Assignment. Keep Platform Administrator authority separate. A role held in one
Operator never authorizes an operation in another. The CMS selector is a
navigation preference, not an authorization credential. Shared staff grants and
platform authority are managed by Platform Administrators; ordinary staff may
not promote themselves or replace another Operator's assignments.

Apply Operator constraints at both boundaries: Payload collection access for
REST, GraphQL, uploads, media, staff operations, and versions; explicit Operator
predicates for trusted Local API queries. Local API access overrides do not
remove the need for query scoping. Related documents must belong to the same
Operator. Draft Mode alone is insufficient authorization: previews and draft
queries verify the current Operator and the staff member's permission.

Resolve request hostnames outside cached functions. Pass the Operator ID into
each cached data function and include it in content/settings cache tags.
Host-dependent output must remain within request-aware streaming boundaries,
so a prerendered shell cannot contain another Operator's identity or content.
Build-time slug enumeration does not choose an Operator without a request.
Publishing invalidates the relevant Operator's content and settings caches.
The static document starts with a generic language; streamed Operator chrome
carries its own `lang` attribute and hydration updates the document language.
Resolve the header and footer inside their own Suspense boundaries, leaving
page navigation shells independent of those request-time reads. This preserves
the shared loading shell without reading request headers above its Suspense
boundary.

Enforce unique content slugs, normalized member identifiers, and membership
lookup hashes within an Operator using database compound indexes. Keep the
existing keyed HMAC model and response privacy: the public lookup uses both the
resolved Operator and the hash, never a raw identifier query or a public roster.

Use a forward migration to create the initial Operator and attach existing
documents, versions, settings, media, and staff roles. Preserve document IDs,
membership hashes, and retained legacy version content. Do not rewrite the
baseline or silently promote existing Operator administrators to Platform
Administrators. Provision platform authority through an explicit trusted
bootstrap workflow.

Platform Administrators provision Operators and their first staff assignments.
Suspension denies public access while preserving administrative recovery.
Disable automatic cascading cleanup and deletion until a separate, deliberate
offboarding workflow defines retention and destructive removal.

## Consequences

Every public data access, preview, cache, and publishing path must carry Operator
context. Two-Operator tests must reuse slugs and member identifiers, exercise
different staff roles, and alternate hostnames while caches are warm. Migration
tests must cover both existing data and an empty installation.

Media records, relationships, and uploads are Operator-scoped. Vercel Blob's
public object URLs remain public assets: CMS access checks cannot revoke an
already-published external URL or a downloaded copy. Suspension removes public
access through the Operator's application routes; it does not promise erasure
of public object storage or browser/CDN caches. Private membership data must
never be published as media. Private file delivery would require a separate
storage and authorization contract.

Hostnames for local development, tests, and isolated Preview deployments must be
registered deliberately in their own databases. Reusing Production credentials
or falling back to a Production Operator is not a Preview configuration
strategy.
