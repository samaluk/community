import * as migration_20260604_000000_baseline from './20260604_000000_baseline'
import * as migration_20260908_000000_optional_place_summary from './20260908_000000_optional_place_summary'
import * as migration_20260928_000000_reset_password_requested_at from './20260928_000000_reset_password_requested_at'

export const migrations = [
  {
    down: migration_20260604_000000_baseline.down,
    name: '20260604_000000_baseline',
    up: migration_20260604_000000_baseline.up,
  },
  {
    down: migration_20260908_000000_optional_place_summary.down,
    name: '20260908_000000_optional_place_summary',
    up: migration_20260908_000000_optional_place_summary.up,
  },
  {
    down: migration_20260928_000000_reset_password_requested_at.down,
    name: '20260928_000000_reset_password_requested_at',
    up: migration_20260928_000000_reset_password_requested_at.up,
  },
]
