// Carregador mínimo para testar componentes React com node:test, sem navegador nem jsdom:
//  - transpila .jsx com esbuild (o mesmo transpilador do Vite);
//  - resolve imports sem extensão ('./Icones') como o Vite faz.
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { transform } from 'esbuild'

const EXTENSOES = ['.jsx', '.js']

export async function resolve(especificador, contexto, proximo) {
  if (/^\.{1,2}\//.test(especificador) && !/\.[a-z]+$/i.test(especificador) && contexto.parentURL) {
    const base = fileURLToPath(new URL(especificador, contexto.parentURL))
    for (const ext of EXTENSOES) {
      if (existsSync(base + ext)) return { url: pathToFileURL(base + ext).href, shortCircuit: true }
    }
  }
  return proximo(especificador, contexto)
}

const DEFINICOES = { 'import.meta.env': '{}' } // o Vite injeta import.meta.env; nos testes é um objeto vazio

export async function load(url, contexto, proximo) {
  if (url.endsWith('.jsx')) {
    const fonte = await readFile(fileURLToPath(url), 'utf8')
    const { code } = await transform(fonte, { loader: 'jsx', jsx: 'automatic', format: 'esm', sourcefile: url, define: DEFINICOES })
    return { format: 'module', source: code, shortCircuit: true }
  }
  // Arquivos .js do projeto que usam import.meta.env (ex.: services/api.js) também precisam da definição.
  if (url.startsWith('file:') && url.endsWith('.js') && !url.includes('/node_modules/')) {
    const fonte = await readFile(fileURLToPath(url), 'utf8')
    if (fonte.includes('import.meta.env')) {
      const { code } = await transform(fonte, { loader: 'js', format: 'esm', sourcefile: url, define: DEFINICOES })
      return { format: 'module', source: code, shortCircuit: true }
    }
  }
  return proximo(url, contexto)
}
