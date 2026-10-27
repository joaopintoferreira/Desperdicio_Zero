// Apenas apresentação: "2026-11-15" -> "15/11/2026" (sem Date, evita erro de fuso).
export function formatarData(iso) {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}
