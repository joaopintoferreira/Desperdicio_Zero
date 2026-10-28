// Entrega um Blob ao usuário como arquivo para baixar.
export function baixarArquivo(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
