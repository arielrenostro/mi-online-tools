import type { CorrectionRun } from '@/types/correction'
import type { MapModel } from '@/types/map'
import type { LegacySnapshot } from './legacySnapshotPersistence'
import { defaultRunName } from '@/utils/correctionGeneration'
import { isLegacyCorrectionFilters, migrateLegacyCorrectionFilters } from '@/utils/filterMigration'

/**
 * Converte o snapshot "last" da versão anterior no primeiro run. Os breakpoints vêm do mapa
 * restaurado: o app antigo apagava o snapshot a cada mapa novo, então ele sempre correspondeu ao
 * mapa carregado. O snapshot só gravava nomes de arquivo (sem hash) e um intervalo global.
 */
export function legacySnapshotToRun(
  legacy: LegacySnapshot,
  map: Pick<MapModel, 'mapBreakpoints' | 'rpmBreakpoints'>,
): CorrectionRun {
  const { provenance } = legacy
  return {
    id:          `run-legacy-${legacy.generatedAt}`,
    name:        defaultRunName(legacy.generatedAt),
    createdAt:   legacy.generatedAt,
    breakpoints: { map: [...map.mapBreakpoints], rpm: [...map.rpmBreakpoints] },
    cells:       legacy.cells,
    recipe: {
      logs:   provenance.logFilenames.map(filename => ({ hash: null, filename, range: 'full' as const })),
      filter: isLegacyCorrectionFilters(provenance.filters) ? migrateLegacyCorrectionFilters(provenance.filters) : null,
      ...(provenance.timeRange ? { globalTimeRange: provenance.timeRange } : {}),
    },
  }
}
