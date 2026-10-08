import { describe, it, expect } from 'vitest'
import { parseDatalogText, PARSER_VERSION } from './datalogParser'
import { RUNTIME_SIGNAL_NAMES } from '@/signals/runtimeSignals'

const HEADER = 'RPM;MAP;Boost;Lambda 1;Lambda Target;Lambda Corr;Lambda Loop;VE Value;CLT;IAT;Inj. Utiliz.;Ign. Adv.;KM/H;Turbo Target;ACC %'
const ROW    = '2567;35;103;998;1000;1032;1;575;365;323;4;34;64;100;45'

describe('parseDatalogText', () => {
  const model = parseDatalogText(`${HEADER}\n${ROW}\n`, 'a.csv', 'sha1:x')

  it('calcula VE Lambda no parse', () => {
    expect(model.rows[0]['VE Lambda']).toBeCloseTo(59.225, 3)
    expect(model.signals).toContain('VE Lambda')
  })

  it('não calcula nem lista os sinais de runtime (dependem das constantes)', () => {
    for (const name of RUNTIME_SIGNAL_NAMES) {
      expect(model.rows[0]).not.toHaveProperty(name)
      expect(model.signals).not.toContain(name)
    }
  })

  it('grava a versão do leitor', () => {
    expect(model.parserVersion).toBe(PARSER_VERSION)
  })
})

describe('Marcha (última coluna "0")', () => {
  // Cabeçalho real: ...;dACC %;0;0 — a marcha é a última das duas colunas "0".
  const H = `${HEADER};dACC %;0;0`

  it('lê a marcha da última coluna "0" e a lista entre os sinais', () => {
    const model = parseDatalogText(`${H}\n${ROW};5001;0;3\n${ROW};5001;0;5\n`, 'a.csv', 'sha1:x')
    expect(model.rows.map(r => r['Marcha'])).toEqual([3, 5])
    expect(model.signals).toContain('Marcha')
  })

  it('log sem a coluna importa normalmente, sem a chave nem o sinal', () => {
    const model = parseDatalogText(`${HEADER}\n${ROW}\n`, 'a.csv', 'sha1:x')
    expect(model.rows).toHaveLength(1)
    expect(model.rows[0]).not.toHaveProperty('Marcha')
    expect(model.signals).not.toContain('Marcha')
  })

  it('marcha vazia ou não numérica mantém a linha, sem Marcha', () => {
    const model = parseDatalogText(`${H}\n${ROW};5001;0;\n${ROW};5001;0;x\n${ROW};5001;0;2\n`, 'a.csv', 'sha1:x')
    expect(model.rows).toHaveLength(3)
    expect(model.rows[0]).not.toHaveProperty('Marcha')
    expect(model.rows[1]).not.toHaveProperty('Marcha')
    expect(model.rows[2]['Marcha']).toBe(2)
  })

  it('linha sem o último campo mantém a linha, sem Marcha', () => {
    const model = parseDatalogText(`${H}\n${ROW};5001;0\n`, 'a.csv', 'sha1:x')
    expect(model.rows).toHaveLength(1)
    expect(model.rows[0]).not.toHaveProperty('Marcha')
  })
})

describe('sinais de injeção, bateria e pressões', () => {
  const EXTRA_H = 'Inj. Pulse;Inj. DT;ACP %;dACC %;Batt Volt.;Lambda 2'
  const H = `${HEADER};${EXTRA_H}`
  const parse = (header: string, ...rows: string[]) =>
    parseDatalogText([header, ...rows].join('\n') + '\n', 'a.csv', 'sha1:x')

  it('converte os seis sinais para a unidade real e os lista', () => {
    const model = parse(H, `${ROW};1337;1100;734;5000;140;173`)
    const r = model.rows[0]
    expect(r['Inj. Pulse']).toBeCloseTo(13.37, 5)
    expect(r['Inj. DT']).toBeCloseTo(1.1, 5)
    expect(r['ACP']).toBe(734)
    expect(r['dACC']).toBe(0)
    expect(r['Batt Volt.']).toBeCloseTo(14.0, 5)
    expect(r['Pressão Óleo']).toBeCloseTo(1.73, 5)
    for (const s of ['Inj. Pulse', 'Inj. DT', 'ACP', 'dACC', 'Batt Volt.', 'Pressão Óleo']) {
      expect(model.signals).toContain(s)
    }
  })

  it('dACC: 5000 é zero e o sinal indica o sentido do pedal', () => {
    const model = parse(H, `${ROW};1337;1100;734;4900;140;173`, `${ROW};1337;1100;734;5100;140;173`)
    expect(model.rows.map(r => r['dACC'])).toEqual([-1, 1])
  })

  it('log sem uma das colunas importa normalmente, sem o sinal e sem afetar os demais', () => {
    const header = H.replace(';ACP %', '')
    const model = parse(header, `${ROW};1337;1100;5000;140;173`)
    expect(model.rows).toHaveLength(1)
    expect(model.rows[0]).not.toHaveProperty('ACP')
    expect(model.signals).not.toContain('ACP')
    expect(model.rows[0]['Inj. Pulse']).toBeCloseTo(13.37, 5)
    expect(model.rows[0]['dACC']).toBe(0)
  })

  it('campo não numérico mantém a linha, sem o valor daquele sinal', () => {
    const model = parse(H, `${ROW};1337;;734;5000;140;173`, `${ROW};1337;1100;734;5000;140;173`)
    expect(model.rows).toHaveLength(2)
    expect(model.rows[0]).not.toHaveProperty('Inj. DT')
    expect(model.rows[1]['Inj. DT']).toBeCloseTo(1.1, 5)
  })

  describe('Inj. Efetivo (Inj. Pulse − Inj. DT)', () => {
    it('é calculado e listado quando as duas colunas existem', () => {
      const model = parse(H, `${ROW};269;1100;734;5000;140;173`)
      expect(model.rows[0]['Inj. Efetivo']).toBeCloseTo(1.59, 5)
      expect(model.signals).toContain('Inj. Efetivo')
    })

    it('não existe quando falta a coluna Inj. DT', () => {
      const model = parse(H.replace('Inj. DT;', ''), `${ROW};269;734;5000;140;173`)
      expect(model.rows).toHaveLength(1)
      expect(model.rows[0]).not.toHaveProperty('Inj. Efetivo')
      expect(model.signals).not.toContain('Inj. Efetivo')
    })

    it('linha com Inj. Pulse inválido fica sem Inj. Efetivo mas é mantida', () => {
      const model = parse(H, `${ROW};x;1100;734;5000;140;173`, `${ROW};269;1100;734;5000;140;173`)
      expect(model.rows).toHaveLength(2)
      expect(model.rows[0]).not.toHaveProperty('Inj. Efetivo')
      expect(model.rows[1]['Inj. Efetivo']).toBeCloseTo(1.59, 5)
    })

    it('não faz clamp: Pulse menor que DT sai negativo', () => {
      const model = parse(H, `${ROW};50;1100;734;5000;140;173`)
      expect(model.rows[0]['Inj. Efetivo']).toBeCloseTo(-0.6, 5)
    })
  })
})
