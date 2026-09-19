# Community Platform

An open-source, extensible digital home and content management system for community organizations, clubs, and interest groups. Built with Next.js 16 (App Router), Payload CMS 3.0, and PostgreSQL with PostGIS.

## Features

- **Places Directory (`/places`)**: Discover and filter community venues, locations, and facilities by distance, region, and access type (`open`, `private`, `restricted`) using PostGIS spatial queries with interactive map and table views.
- **Educational Articles (`/articles`)**: Publishing hub for guides, tutorials, and knowledge base resources with category filtering and difficulty levels (`beginner`, `intermediate`, `advanced`).
- **Product Catalog (`/products`)**: Showcase community merchandise and offerings with pricing and availability status.
- **Privacy-Preserving Membership Verification (`/verify`)**: Staff-managed membership verification using keyed HMAC-SHA256 hashes of normalized identifiers (such as email addresses, membership numbers, or national IDs), preventing member enumeration or PII exposure.
- **Configurable Site Settings**: CMS global configuration (`site-settings`) for brand name, site description, default locale, HTML `lang` code, social links, and member identifier format (`generic` or custom formats like `cl_rut`).
- **Live Preview & Draft Workflows**: Side-by-side real-time preview and versioned drafts in Payload CMS with on-demand Next.js cache revalidation upon publishing.

## Architecture

The project is structured as a lightweight `pnpm` monorepo:

```
community-platform/
├── apps/
│   └── web/            # Next.js 16 App Router + Payload CMS 3.0 application
├── docs/
│   ├── adr/            # Architectural Decision Records
│   └── agents/         # AI agent conventions and domain principles
├── CONTEXT.md          # Ubiquitous domain language and architectural boundaries
├── LICENSE             # MIT License
└── NOTICE              # Third-party notices and attribution
```

The application runs as a single deployable unit combining the public web experience and the administrative CMS, backed by PostgreSQL (with PostGIS) and optional Vercel Blob storage for media uploads.

## Prerequisites & Toolchain

Node.js and pnpm versions are pinned in the root [`package.json`](package.json):

- **Node.js**: `^24.19.0` (managed via [Corepack](https://nodejs.org/api/corepack.html) or your version manager)
- **pnpm**: `11.24.0` (activated automatically via Corepack)
- **Docker & Docker Compose**: for running local PostgreSQL with PostGIS

## Quick Start

### 1. Install dependencies

```sh
pnpm install
```

### 2. Start local PostgreSQL with PostGIS

Use Docker Compose to start a local PostgreSQL 17 instance with PostGIS on port **5433** (configured to avoid clashing with standard Postgres on port 5432):

```sh
cd apps/web
docker compose up -d postgres
cd ../..
```

The container automatically creates the primary development database (`community`) and test database (`community_test`).

If you already have a `pgdata` volume from before the rename, it retains the old database names. Recreate that disposable local volume or rename its databases to `community` and `community_test` before pulling the updated environment.

### 3. Configure environment variables

Create `apps/web/.env.local` with the required local development configuration:

```env
NODE_ENV=development
POSTGRES_URL=postgres://postgres:postgres@127.0.0.1:5433/community
TEST_POSTGRES_URL=postgres://postgres:postgres@127.0.0.1:5433/community_test
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
PAYLOAD_SECRET=development-secret-must-be-at-least-32-chars-long
PREVIEW_SECRET=development-preview-secret-value
```

If you use Vercel for hosting, you can pull remote environment variables directly:

```sh
cd apps/web
pnpm env:pull
cd ../..
```

### 4. Run database migrations

Apply Payload database migrations to initialize the schema:

```sh
pnpm migrate
```

For a completely fresh local database:

```sh
pnpm --filter @community/web migrate:fresh
```

### 5. Start the development server

```sh
pnpm dev
```

The application will be available at:
- **Public Site**: [http://localhost:3000](http://localhost:3000)
- **Payload Admin**: [http://localhost:3000/admin](http://localhost:3000/admin)

## Environment Variables Reference

All environment variables are validated at build and runtime via [`apps/web/src/env.ts`](apps/web/src/env.ts) using `@t3-oss/env-nextjs` and Zod:

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_URL` | Yes | PostgreSQL connection URI (must support PostGIS). |
| `TEST_POSTGRES_URL` | Optional | Dedicated database URI for isolated integration tests (`pnpm test:int`). |
| `PAYLOAD_SECRET` | Yes | Secret key used by Payload CMS for auth encryption and HMAC member hashing. |
| `PREVIEW_SECRET` | Yes | Secret token for Next.js draft mode and CMS live preview. |
| `NEXT_PUBLIC_SERVER_URL` | Yes | Public canonical base URL (e.g. `http://localhost:3000`). |
| `BLOB_READ_WRITE_TOKEN` | Optional | Vercel Blob access token for cloud media asset storage. |

## CMS Workflows & Setup

### Creating the First Admin User

1. Navigate to [http://localhost:3000/admin](http://localhost:3000/admin) in your browser.
2. Complete the initial registration form to create the primary administrator account for your local environment.

For production deployments, administrative users can also be provisioned via CLI script with production credentials:

```sh
cd apps/web
CMS_USER_EMAIL=admin@example.com CMS_USER_PASSWORD=your-secure-password pnpm create:prod-user
cd ../..
```
*(Requires `.env.production.local` configured with production database credentials).*

### Configuring Site Identity (Site Settings)

In Payload Admin, navigate to **Globals > Site Settings** to configure your organization's identity:
- **Brand Name**: Displayed in navigation, metadata, and page titles.
- **Site Description**: Default SEO and social sharing meta description.
- **Default Locale & HTML Lang**: Set default content language code (e.g., `en`, `es`).
- **Social Links**: URLs for Instagram and WhatsApp channels.
- **Member Identifier Format**: Choose `generic` (default) or regional formats like `cl_rut`.

### Managing Content

- **Places (`/admin/collections/places`)**: Create community locations with coordinates (`location` point field), locality (`region`, `city`), `accessType` (`open`, `private`, `restricted`), and rich-text details.
- **Articles (`/admin/collections/articles`)**: Publish guides and educational resources with categories, `difficulty` (`beginner`, `intermediate`, `advanced`), and Lexical rich text.
- **Products (`/admin/collections/products`)**: Showcase community merchandise and offerings with pricing, stock status (`available`, `unavailable`), and imagery.
- **Memberships (`/admin/collections/memberships`)**: Staff-managed membership roster. Enter raw identifiers (`identifier`); the system automatically computes a normalized identifier and a secure HMAC `lookupHash`.
- **Home Page (`/admin/globals/home-page`)**: Configure hero video and featured media for the landing page.

### Drafts, Live Preview, and Publishing

- **Drafts**: Collections support draft versions, allowing content to be saved and reviewed before publication.
- **Live Preview**: The admin panel embeds a live iframe of the frontend that updates instantly as editors type.
- **On-Demand Cache Revalidation**: When content is published or updated, Payload lifecycle hooks automatically revalidate the relevant Next.js routes and tag caches.

## Development & Quality Assurance

### Testing

```sh
pnpm test:unit        # Vitest unit test suite
pnpm test:int         # Vitest integration test suite (requires TEST_POSTGRES_URL)
pnpm test:e2e         # Playwright end-to-end test suite
pnpm test:coverage    # Unit test suite with v8 coverage report
```

Follow [`docs/agents/testing-principles.md`](docs/agents/testing-principles.md) when writing and updating tests.

### Linting & Formatting

```sh
pnpm typecheck        # TypeScript compilation check (tsc --noEmit)
pnpm oxlint           # Oxlint static code linter
pnpm format:check     # oxfmt formatting validation
pnpm format           # Auto-format files with oxfmt
```

### Fallow Quality Gate

The repository enforces a zero-debt steady state with [Fallow](docs/fallow.md):

```sh
pnpm fallow:ci        # Strict audit across dead code, duplication, and code health
```

### Git Hooks

Local verification hooks are managed by [hk](https://hk.jdx.dev/) **2.0.1 or newer**.
When upgrading from v1, upgrade the binary first (`brew upgrade hk`, or update
the hk pin in your mise configuration, including `.mise.local.toml` if present,
to `2.0.1` and run `mise install`), then rerun setup to refresh the hook launchers:

```sh
# Set up or refresh hooks (validates the hk version and config first)
bash scripts/setup-hk.sh
```

For mise-managed tools, run setup with `HK_MISE=1` so Git hooks run through mise.
See the [hk v2 upgrade guide](https://hk.jdx.dev/migration-v2) for changes to any
personal hk configuration.

- **Pre-commit**: Checks staged files with oxlint and oxfmt, then runs repo-wide typechecking, unit tests, and Fallow checks.
- **Pre-push**: Verifies environment, typechecks, builds, generates test coverage, and executes the full Fallow CI gate.
- **Manual fixes**: `hk fix` leaves fixes unstaged for review; use `hk fix --stage` to stage them. Pre-commit still automatically stages its fixes.

## Core Platform vs. Operator Separation

To preserve reusability across diverse communities:
- The core application contains **zero** organization-specific logic, hardcoded branding, or bespoke editorial routes.
- Organization branding, locales, and member verification formats are configured through **Site Settings** and CMS collections.
- For architectural background, see [CONTEXT.md](CONTEXT.md) and [ADR 0005: Separate generic platform source from operator configuration and content](docs/adr/0005-generic-platform-and-operator-separation.md).

## License

This project is licensed under the [MIT License](LICENSE).
Third-party notices and licensing disclosures are documented in [NOTICE](NOTICE).
