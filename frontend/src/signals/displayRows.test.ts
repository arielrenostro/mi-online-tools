import { describe, it, expect } from 'vitest'
import { getDisplayRows, withRuntimeSignals } from './displayRows'
import { flattenActiveRows } from '@/store/logStore'
import { DEFAULT_CONSTANTS } from '@/store/constantsStore'
import type { DatalogRow, LogEntry } from '@/types/datalog'

function makeRow(ts: number): DatalogRow {
  return {
    timestamp_ms: ts, 'RPM': 2567, 'MAP': 35, 'IAT': 50, 'Lambda 1': 0.998, 'VE': 57.5, 'VE Lambda': 59.225,
  }
}

function makeLog(): LogEntry {
  const rows = [makeRow(0), makeRow(100)]
  return {
    hash: 'h', filename: 'a.csv', enabled: true, duration_ms: 100,
    model: { hash: 'h', filename: 'a.csv', rows, duration_ms: 100, signals: ['RPM'] },
  }
}

describe('getDisplayRows', () => {
  it('calcula as três chaves de runtime em cada linha', () => {
    const rows = getDisplayRows([makeLog()], DEFAULT_CONSTANTS)
    expect(rows).toHaveLength(2)
    expect(rows[0]['VE Lambda Corrigido']).toBeCloseTo(59.225, 6) // k = 1
    expect(rows[0]['Potência']).toBeGreaterThan(0)
    expect(rows[0]['Torque']).toBeCloseTo(rows[0]['Potência'] * 716.2 / 2567, 9)
  })

  it('aplica a calibração em VE Lambda Corrigido e na potência, sem mexer em VE Lambda', () => {
    const logs = [makeLog()]
    const base = getDisplayRows(logs, DEFAULT_CONSTANTS)[0]
    const calibrated = getDisplayRows(logs, { ...DEFAULT_CONSTANTS, veAtFull: 500 })[0] // k = 2
    expect(calibrated['VE Lambda']).toBe(base['VE Lambda'])
    expect(calibrated['VE Lambda Corrigido']).toBeCloseTo(base['VE Lambda'] * 2, 6)
    expect(calibrated['Potência']).toBeCloseTo(base['Potência'] * 2, 6)
  })

  it('reaproveita o array com as mesmas referências e recalcula com constantes novas', () => {
    const logs = [makeLog()]
    const a = getDisplayRows(logs, DEFAULT_CONSTANTS)
    expect(getDisplayRows(logs, DEFAULT_CONSTANTS)).toBe(a)
    expect(getDisplayRows(logs, { ...DEFAULT_CONSTANTS })).not.toBe(a)
  })

  it('não contamina o model nem flattenActiveRows', () => {
    const logs = [makeLog()]
    getDisplayRows(logs, DEFAULT_CONSTANTS)
    expect(logs[0].model.rows[0]).not.toHaveProperty('Potência')
    expect(flattenActiveRows(logs)[0]).not.toHaveProperty('VE Lambda Corrigido')
  })
})

describe('withRuntimeSignals', () => {
  it('acrescenta os nomes de runtime quando há sinais, e nada sem log ativo', () => {
    expect(withRuntimeSignals(['RPM'])).toEqual(['RPM', 'VE Lambda Corrigido', 'Potência', 'Torque'])
    expect(withRuntimeSignals([])).toEqual([])
  })

  it('lista em ordem agrupada, com VE Lambda Corrigido logo após VE Lambda', () => {
    expect(withRuntimeSignals(['Lambda 1', 'VE Lambda', 'RPM', 'VE'])).toEqual([
      'RPM', 'Lambda 1', 'VE', 'VE Lambda', 'VE Lambda Corrigido', 'Potência', 'Torque',
    ])
  })
})
