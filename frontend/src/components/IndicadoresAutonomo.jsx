import Indicadores from './Indicadores'
import useIndicadores from '../hooks/useIndicadores'

// Indicadores que carregam os próprios dados (painel "Resumo do estoque" da página Produtos).
export default function IndicadoresAutonomo({ versao }) {
  return <Indicadores estado={useIndicadores(versao)} />
}
