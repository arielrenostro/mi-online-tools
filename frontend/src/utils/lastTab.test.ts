import { describe, it, expect } from 'vitest'
import { tabFromPath, resolveTab, DATALOG_TABS, MAPA_TABS } from './lastTab'

describe('tabFromPath', () => {
  it('reads the tab of the section from the path', () => {
    expect(tabFromPath('datalog', '/datalog/xy', DATALOG_TABS)).toBe('xy')
    expect(tabFromPath('mapa', '/mapa/ignition', MAPA_TABS)).toBe('ignition')
  })

  it('is null outside the section, on the bare section and on unknown tabs', () => {
    expect(tabFromPath('datalog', '/mapa/ve', DATALOG_TABS)).toBeNull()
    expect(tabFromPath('datalog', '/datalog', DATALOG_TABS)).toBeNull()
    expect(tabFromPath('datalog', '/datalog/nope', DATALOG_TABS)).toBeNull()
    expect(tabFromPath('datalog', '/', DATALOG_TABS)).toBeNull()
  })
})

describe('resolveTab', () => {
  it('keeps a known saved tab', () => {
    expect(resolveTab('charts', DATALOG_TABS, 'logs')).toBe('charts')
  })

  it('falls back when the saved value is missing or unknown', () => {
    expect(resolveTab(undefined, DATALOG_TABS, 'logs')).toBe('logs')
    expect(resolveTab('old-tab', MAPA_TABS, 've')).toBe('ve')
    expect(resolveTab(42, MAPA_TABS, 've')).toBe('ve')
  })
})
