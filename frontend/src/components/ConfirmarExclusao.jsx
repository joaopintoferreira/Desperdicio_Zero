import { useState } from 'react'
import Modal from './Modal'

// Confirmação explícita antes de excluir (RF04).
export default function ConfirmarExclusao({ produto, onConfirmar, onCancelar }) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function confirmar() {
    setEnviando(true)
    try {
      await onConfirmar()
    } catch (err) {
      setErro(err.message)
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Excluir produto" onFechar={onCancelar}>
      <p>
        Deseja excluir <strong>{produto.nome}</strong> (código {produto.codigo})? Esta ação não pode ser desfeita.
      </p>
      {erro && <p role="alert" className="msg msg--erro">{erro}</p>}
      <div className="modal__acoes">
        <button type="button" className="btn" onClick={onCancelar} disabled={enviando}>Cancelar</button>
        <button type="button" className="btn btn--perigo-cheio" onClick={confirmar} disabled={enviando}>
          {enviando ? 'Excluindo…' : 'Excluir'}
        </button>
      </div>
    </Modal>
  )
}
