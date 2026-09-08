import { isE2eFixtureSeedEnabled, loadTestEnv } from '../../scripts/loadScriptEnv'
import { seedE2eFixtures } from '../../scripts/seed-e2e-fixtures'

export default async function globalSetup() {
  loadTestEnv()

  // The seed upserts fixed-slug fixtures into POSTGRES_URL (the dev DB on
  // local runs), so it is opt-in rather than a side effect of every test
  // run: a slug collision would republish/overwrite content in that DB.
  // CI seeds explicitly before the first build; local runs either set the flag or
  // seed explicitly with `pnpm exec tsx scripts/seed-e2e-fixtures.ts` (see
  // instant-nav.rig.md).
  if (!isE2eFixtureSeedEnabled()) {
    console.warn(
      '[e2e] E2E_SEED_FIXTURES != 1; skipping fixture seed. Seed explicitly to run this suite.',
    )
    return
  }

  await seedE2eFixtures()
}
