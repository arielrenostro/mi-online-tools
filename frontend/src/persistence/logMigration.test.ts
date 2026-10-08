import { describe, it, expect } from 'vitest'
import { upgradeLogEntry } from './logMigration'
import { PARSER_VERSION } from '@/parsers/datalogParser'
import type { LogDBEntry } from './db'

const HEADER = 'RPM;MAP;Boost;Lambda 1;Lambda Target;Lambda Corr;Lambda Loop;VE Value;CLT;IAT;Inj. Utiliz.;Ign. Adv.;KM/H;Turbo Target;ACC %;dACC %;0;0'
const ROW    = '2567;35;103;998;1000;1032;1;575;365;323;4;34;64;100;45;5001;0;3'

function entry(csv: string, parserVersion?: number): LogDBEntry {
  return {
    hash: 'sha1:abc', filename: 'old.csv', savedAt: 1, csvBlob: new Blob([csv]),
    model: { hash: 'sha1:abc', filename: 'old.csv', rows: [], duration_ms: 0, signals: ['RPM'], parserVersion },
  }
}

const INJ_HEADER = `${HEADER};Inj. Pulse;Inj. DT;ACP %;Batt Volt.;Lambda 2`
const INJ_ROW    = `${ROW};269;1100;734;140;173`

describe('upgradeLogEntry', () => {
  it('reconstrói um log salvo antes da Marcha, preservando hash e nome', async () => {
    const old = entry(`${HEADER}\n${ROW}\n`)
    const up  = await upgradeLogEntry(old)
    expect(up).not.toBe(old)
    expect(up.hash).toBe('sha1:abc')
    expect(up.filename).toBe('old.csv')
    expect(up.model.parserVersion).toBe(PARSER_VERSION)
    expect(up.model.signals).toContain('Marcha')
    expect(up.model.rows[0]['Marcha']).toBe(3)
  })

  it('log já na versão atual é usado como está', async () => {
    const cur = entry(`${HEADER}\n${ROW}\n`, PARSER_VERSION)
    expect(await upgradeLogEntry(cur)).toBe(cur)
  })

  it('CSV sem a coluna: reconstrói uma vez e depois não reconstrói de novo', async () => {
    const noGear = `${HEADER.replace(';dACC %;0;0', '')}\n${ROW.replace(';5001;0;3', '')}\n`
    const up = await upgradeLogEntry(entry(noGear))
    expect(up.model.signals).not.toContain('Marcha')
    expect(await upgradeLogEntry(up)).toBe(up)
  })

  it('reconstrói um log da versão 2 (antes dos sinais de injeção) e ele ganha os novos sinais', async () => {
    const up = await upgradeLogEntry(entry(`${INJ_HEADER}\n${INJ_ROW}\n`, 2))
    expect(up.model.parserVersion).toBe(PARSER_VERSION)
    for (const s of ['Inj. Pulse', 'Inj. DT', 'Inj. Efetivo', 'ACP', 'Batt Volt.', 'Pressão Óleo']) {
      expect(up.model.signals).toContain(s)
    }
    expect(up.model.rows[0]['Inj. Efetivo']).toBeCloseTo(1.59, 5)
  })

  it('log da versão atual sem as colunas de injeção não é reconstruído de novo', async () => {
    const up = await upgradeLogEntry(entry(`${HEADER}\n${ROW}\n`, 2))
    expect(up.model.signals).not.toContain('Inj. Pulse')
    expect(await upgradeLogEntry(up)).toBe(up)
  })

  it('CSV ilegível ou inválido mantém o log como estava', async () => {
    const bad = entry('')
    expect(await upgradeLogEntry(bad)).toBe(bad)
    const broken = entry('x')
    broken.csvBlob = { text: () => Promise.reject(new Error('boom')) } as unknown as Blob
    expect(await upgradeLogEntry(broken)).toBe(broken)
  })
})
