# Community Platform

The public digital home and content management system for community organizations to share places, publish educational guides, showcase products, and verify memberships with privacy preservation.

## Language

**Community Platform**:
The generic open-source web application and CMS enabling community organizations to share places, publish educational articles, catalog products, and verify memberships.
_Avoid_: MBQB, portal, bespoke website

**Operator**:
An organization, club, or community using the community platform with its own hostname, branding, configuration, content, and staff assignments. Multiple Operators can share one deployment.
_Avoid_: Tenant, client, account holder

**Platform Administrator**:
A privileged staff member responsible for the shared Operator registry, hostname configuration, and staff assignments. This capability is separate from an Operator's `admin` role.
_Avoid_: Superuser, global community admin

**Operator Staff Assignment**:
A staff member's association with one Operator and the `admin`, `editor`, or `validation-manager` role they hold there. A staff member can have different roles in different Operators.
_Avoid_: Global role, tenant account, membership

**Membership**:
A staff-managed status indicating that the community considers an individual an active member, maintained indefinitely until staff updates or deactivates it.
_Avoid_: Account, user profile, subscription, validation

**Member Identifier**:
A normalized identifier (such as an email address, national ID, or member number) used by staff to record membership and by members to check active status.
_Avoid_: Username, credential, password

**Membership Verification**:
The public privacy-preserving tool that checks whether a member identifier has an active membership with the requested Operator without exposing identity or roster data.
_Avoid_: Bogeyficador, identity verifier, payment checker, public member directory, auth check

**Place**:
A physical location, facility, venue, or point of interest curated by the community for members and visitors.
_Avoid_: Cancha, golf course, simulator, establishment

**Place Browsing**:
The public experience for finding Places through location, proximity, access type, text search, and map/table/list views.
_Avoid_: Cancha browsing, course database admin, directory admin, generic search page

**Access Type**:
The admission policy of a Place (`open`, `private`, `restricted`) describing who can access the venue.
_Avoid_: Pay and play, membership tier, permission

**Articles**:
The community platform's educational content hub and knowledge base for guides, tutorials, and community resources.
_Avoid_: La Biblia, news, blog, opinion feed

**Product**:
A community merchandise item or offering showcased for visitor inquiry or external purchase through a contact flow.
_Avoid_: Cart item, checkout item, SKU

**Public Content Publishing**:
The shared CMS publishing behavior for public Place, Article, and Product content: draft previews, staff-only editing, published public reads, and public route revalidation.
_Avoid_: Generic CMS plumbing, private membership validation

**Site Settings**:
The CMS configuration belonging to one Operator and controlling its brand identity, description, default locale, HTML language code, and identifier format.
_Avoid_: Hardcoded config, theme file, environment branding

## Architectural Boundaries

**Core Platform vs. Operator Boundary**:
The core platform codebase contains generic data models, routes, UI components, and workflows. Operator-specific identity (brand name, description, locale, social links, member identifier format) is supplied via that Operator's Site Settings and database content, never hardcoded in core source files.

**Operator Isolation Boundary**:
Public requests resolve one active Operator from its configured hostname. Content, settings, staff permissions, memberships, previews, and cache identities are scoped to that Operator. Unknown and suspended hostnames do not fall back to another Operator. Platform administration is the explicit cross-Operator control plane; selecting an Operator in the CMS does not grant access to it.

**Privacy & Verification Boundary**:
The public verification endpoint checks membership status solely via the requested Operator and a keyed HMAC-SHA256 hash of the normalized member identifier using the server's secret. Raw identifiers and member details are restricted to authorized staff roles (`admin`, `validation-manager`) for that Operator and are never exposed over public APIs or client bundles.

**Public Content vs. Administrative Boundary**:
Public visitors interact with cached read-only routes (`/`, `/places`, `/articles`, `/products`, `/verify`, `/privacy`). Administrative workflows and draft previews are isolated under `/admin` and protected by role-based access control (`admin`, `editor`, `validation-manager`).
