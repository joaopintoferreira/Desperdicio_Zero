// Registra o carregador de JSX usado só nos testes (node --import ./test-support/register.mjs).
import { register } from 'node:module'

register('./jsx-loader.mjs', import.meta.url)
