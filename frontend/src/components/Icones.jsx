// Ícones SVG simples (herdam a cor do texto).
const props = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export const IconeHome = () => <svg {...props}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>
export const IconeProdutos = () => <svg {...props}><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></svg>
export const IconeBusca = () => <svg {...props}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
export const IconeRelatorios = () => <svg {...props}><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-8" /><path d="M22 20H2" /></svg>
export const IconeMenu = () => <svg {...props} width="22" height="22"><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></svg>
export const IconeFechar = () => <svg {...props} width="22" height="22"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
