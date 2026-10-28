import { useState } from 'react'
import Indicadores from '../components/Indicadores'
import GraficosIndicadores from '../components/graficos/GraficosIndicadores'
import TabelaCategorias from '../components/TabelaCategorias'
import SecaoRecolhivel from '../components/SecaoRecolhivel'
import AlertaEstoqueBaixo from '../components/AlertaEstoqueBaixo'
import useIndicadores from '../hooks/useIndicadores'
import { baixarCsvAVencer } from '../services/api'
import { baixarArquivo } from '../utils/download'
import { formatarData } from '../utils/data'

// Relatório de indicadores: retrato do estoque no momento da consulta (não há histórico).
export default function RelatoriosPage() {
  const estado = useIndicadores()
  const { dados } = estado
  const [exportando, setExportando] = useState(false)
  const [erroCsv, setErroCsv] = useState('')

  async function exportarCsv() {
    setExportando(true)
    setErroCsv('')
    try {
      const blob = await baixarCsvAVencer()
      baixarArquivo(blob, `produtos-a-vencer-${dados?.data_referencia ?? 'hoje'}.csv`)
    } catch (err) {
      setErroCsv(err.message)
    } finally {
      setExportando(false)
    }
  }

  return (
    <section className="painel conteudo__cheio relatorio" aria-labelledby="titulo-relatorio">
      <div className="barra nao-imprimir">
        <h2 id="titulo-relatorio">Relatório de indicadores</h2>
        <div className="barra__acoes">
          <button type="button" className="btn" onClick={exportarCsv} disabled={exportando || !dados}>
            {exportando ? 'Gerando…' : 'Exportar produtos a vencer (CSV)'}
          </button>
          <button type="button" className="btn" onClick={() => window.print()} disabled={!dados}>
            Imprimir / Salvar como PDF
          </button>
        </div>
      </div>
      {/* Só aparece na impressão (o cabeçalho e o menu ficam ocultos). */}
      <h2 className="so-impressao">Desperdício Zero — Relatório de indicadores</h2>
      {erroCsv && <p role="alert" className="msg msg--erro nao-imprimir">{erroCsv}</p>}

      <p className="relatorio__explicacao">
        Retrato do estoque no momento da consulta
        {dados ? <> — classificação das validades em <strong>{formatarData(dados.data_referencia)}</strong></> : null}.
        Não há histórico: o sistema não guarda a evolução ao longo do tempo.
      </p>
      <ul className="relatorio__definicoes">
        <li><strong>Vencido:</strong> validade anterior à data de referência.</li>
        <li>
          <strong>A vencer:</strong> validade entre a data de referência e {dados ? dados.janela_alerta_dias : 7} dias
          depois, incluindo os dois limites.
        </li>
        <li><strong>Dentro da validade:</strong> validade posterior a essa janela.</li>
        <li>
          <strong>Valor estimado em risco:</strong> soma de quantidade × preço dos produtos a vencer. É uma
          estimativa; não inclui vencidos e não é prejuízo confirmado.
        </li>
      </ul>

      <AlertaEstoqueBaixo quantidade={dados?.produtos_estoque_baixo} />
      <Indicadores estado={estado} />
      <GraficosIndicadores estado={estado} />
      {dados && (
        <SecaoRecolhivel id="indicadores-por-categoria" titulo="Indicadores por categoria">
          <TabelaCategorias categorias={dados.por_categoria} janelaDias={dados.janela_alerta_dias} />
        </SecaoRecolhivel>
      )}
    </section>
  )
}
