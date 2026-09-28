import * as migration_20260604_000000_baseline from './20260604_000000_baseline'
import * as migration_20260908_000000_optional_place_summary from './20260908_000000_optional_place_summary'

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
]
