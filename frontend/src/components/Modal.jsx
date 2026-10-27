import { useEffect, useRef } from 'react'

// Janela de diálogo com <dialog> nativo: foco preso, Esc fecha, acessível por teclado.
export default function Modal({ titulo, onFechar, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo.open) dialogo.showModal()
    return () => dialogo.close()
  }, [])

  return (
    <dialog ref={ref} className="modal" aria-labelledby="modal-titulo" onCancel={onFechar}>
      <h2 id="modal-titulo">{titulo}</h2>
      {children}
    </dialog>
  )
}
