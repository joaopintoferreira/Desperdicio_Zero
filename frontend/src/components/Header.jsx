// Cabeçalho superior com o título da página atual.
export default function Header({ titulo }) {
  return (
    <header className="header">
      <h1>{titulo}</h1>
    </header>
  )
}
