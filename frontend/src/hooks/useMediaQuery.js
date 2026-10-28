import { useEffect, useState } from 'react'

// true quando a media query casa (ex.: '(max-width: 800px)'); acompanha mudanças de tamanho.
export default function useMediaQuery(consulta) {
  const [casa, setCasa] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(consulta).matches : false))
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const lista = window.matchMedia(consulta)
    const atualizar = () => setCasa(lista.matches)
    atualizar()
    lista.addEventListener('change', atualizar)
    return () => lista.removeEventListener('change', atualizar)
  }, [consulta])
  return casa
}
