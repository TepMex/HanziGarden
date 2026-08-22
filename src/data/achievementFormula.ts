export type AchievementFormulaContext = {
  event: Record<string, unknown>
  player: Record<string, unknown>
  session: Record<string, unknown>
  persistence: Record<string, unknown>
  daysSinceLastActive: number
}

type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'ident'; value: string }
  | { type: 'symbol'; value: string }

type FormulaNode =
  | { type: 'literal'; value: unknown }
  | { type: 'path'; parts: string[] }
  | { type: 'call'; name: string; args: FormulaNode[] }
  | { type: 'unary'; op: '!'; argument: FormulaNode }
  | { type: 'binary'; op: string; left: FormulaNode; right: FormulaNode }

const SYMBOLS = ['||', '&&', '===', '!==', '==', '!=', '>=', '<=', '>', '<', '!', '(', ')', ',', '.']
const HELPERS = new Set(['includes', 'length'])
const ROOTS = new Set(['event', 'player', 'session', 'persistence', 'daysSinceLastActive'])

export function parseAchievementFormula(source: string): FormulaNode {
  const tokens = tokenize(source)
  let index = 0

  const peek = () => tokens[index]
  const take = () => tokens[index++]
  const match = (value: string) => {
    if (peek()?.type === 'symbol' && peek()?.value === value) {
      take()
      return true
    }
    return false
  }

  const parsePrimary = (): FormulaNode => {
    const token = take()
    if (!token) throw formulaError('выражение оборвано')
    if (token.type === 'number' || token.type === 'string') return { type: 'literal', value: token.value }
    if (token.type === 'ident') {
      if (token.value === 'true') return { type: 'literal', value: true }
      if (token.value === 'false') return { type: 'literal', value: false }
      if (match('(')) {
        if (!HELPERS.has(token.value)) throw formulaError(`неизвестная функция ${token.value}`)
        const args: FormulaNode[] = []
        if (!match(')')) {
          args.push(parseOr())
          while (match(',')) args.push(parseOr())
          if (!match(')')) throw formulaError('ожидалась закрывающая скобка')
        }
        return { type: 'call', name: token.value, args }
      }
      const parts = [token.value]
      while (match('.')) {
        const next = take()
        if (next?.type !== 'ident') throw formulaError('после точки ожидалось имя поля')
        parts.push(next.value)
      }
      if (!ROOTS.has(parts[0]!)) throw formulaError(`неизвестный путь ${parts[0]}`)
      return { type: 'path', parts }
    }
    if (token.type === 'symbol' && token.value === '(') {
      const inner = parseOr()
      if (!match(')')) throw formulaError('ожидалась закрывающая скобка')
      return inner
    }
    throw formulaError('неожиданный фрагмент формулы')
  }

  const parseUnary = (): FormulaNode => {
    if (match('!')) return { type: 'unary', op: '!', argument: parseUnary() }
    return parsePrimary()
  }

  const parseCompare = (): FormulaNode => {
    const left = parseUnary()
    const token = peek()
    if (token?.type !== 'symbol' || !['==', '===', '!=', '!==', '>', '>=', '<', '<='].includes(token.value)) return left
    take()
    return { type: 'binary', op: token.value, left, right: parseUnary() }
  }

  const parseAnd = (): FormulaNode => {
    let node = parseCompare()
    while (match('&&')) node = { type: 'binary', op: '&&', left: node, right: parseCompare() }
    return node
  }

  const parseOr = (): FormulaNode => {
    let node = parseAnd()
    while (match('||')) node = { type: 'binary', op: '||', left: node, right: parseAnd() }
    return node
  }

  if (tokens.length === 0) throw formulaError('формула пуста')
  const ast = parseOr()
  if (index < tokens.length) throw formulaError('лишние символы после формулы')
  return ast
}

export function evaluateAchievementFormula(source: string, context: AchievementFormulaContext): boolean {
  return Boolean(evaluate(parseAchievementFormula(source), context))
}

function evaluate(node: FormulaNode, context: AchievementFormulaContext): unknown {
  if (node.type === 'literal') return node.value
  if (node.type === 'path') return readPath(context, node.parts)
  if (node.type === 'unary') return !evaluate(node.argument, context)
  if (node.type === 'call') {
    const args = node.args.map((arg) => evaluate(arg, context))
    if (node.name === 'includes') return Array.isArray(args[0]) && args[0].includes(args[1])
    if (node.name === 'length') return Array.isArray(args[0]) ? args[0].length : 0
  }
  if (node.type === 'binary') {
    if (node.op === '&&') return Boolean(evaluate(node.left, context)) && Boolean(evaluate(node.right, context))
    if (node.op === '||') return Boolean(evaluate(node.left, context)) || Boolean(evaluate(node.right, context))
    const left = evaluate(node.left, context)
    const right = evaluate(node.right, context)
    if (node.op === '==' || node.op === '===') return left === right
    if (node.op === '!=' || node.op === '!==') return left !== right
    const leftNumber = asNumber(left)
    const rightNumber = asNumber(right)
    if (leftNumber === undefined || rightNumber === undefined) return false
    if (node.op === '>') return leftNumber > rightNumber
    if (node.op === '>=') return leftNumber >= rightNumber
    if (node.op === '<') return leftNumber < rightNumber
    if (node.op === '<=') return leftNumber <= rightNumber
  }
  return false
}

function readPath(context: AchievementFormulaContext, parts: string[]): unknown {
  let current: unknown = context
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let index = 0
  while (index < source.length) {
    const char = source[index]!
    if (/\s/.test(char)) {
      index += 1
      continue
    }
    if (char === '"' || char === "'") {
      const quote = char
      let value = ''
      index += 1
      while (index < source.length && source[index] !== quote) {
        value += source[index]
        index += 1
      }
      if (source[index] !== quote) throw formulaError('строка не закрыта')
      index += 1
      tokens.push({ type: 'string', value })
      continue
    }
    if (/[0-9]/.test(char) || (char === '-' && /[0-9]/.test(source[index + 1] ?? ''))) {
      const start = index
      index += 1
      while (index < source.length && /[0-9_]/.test(source[index]!)) index += 1
      tokens.push({ type: 'number', value: Number(source.slice(start, index).replaceAll('_', '')) })
      continue
    }
    const symbol = SYMBOLS.find((item) => source.startsWith(item, index))
    if (symbol) {
      tokens.push({ type: 'symbol', value: symbol })
      index += symbol.length
      continue
    }
    if (/[A-Za-z_]/.test(char)) {
      const start = index
      index += 1
      while (index < source.length && /[A-Za-z0-9_]/.test(source[index]!)) index += 1
      tokens.push({ type: 'ident', value: source.slice(start, index) })
      continue
    }
    throw formulaError(`неожиданный символ ${char}`)
  }
  return tokens
}

function formulaError(detail: string): Error {
  return new Error(`Некорректная формула достижения: ${detail}`)
}
