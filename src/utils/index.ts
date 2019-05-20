import chalk from 'chalk'

const asWritable = <T>(obj: T) => obj as Writeable<T>
export type Writeable<T> = { -readonly [P in keyof T]-?: T[P] }

type logger = Pick<typeof console, 'log' | 'error' | 'warn' | 'debug'>

export let logger: logger = console
const setLogger = (l: logger) => logger = l

const isTruthyFilter = <T>(item: T | null | undefined | void): item is T => Boolean(item)

export async function bench<T>(
  wrappedFunction: () => Promise<T>,
  log: (title: string, elapsed: number) => void,
  title?: string,
) {
  const start = process.hrtime()
  try {
    return await wrappedFunction()
  } finally {
    log(title || '', calculateElapsed(start))
  }
}

export function calculateElapsed(start: [number, number]) {
  const elapsed = process.hrtime(start)
  return (elapsed[0] * 1000) + (elapsed[1] / 1000000)
}

const benchLog = <T>(
  wrappedFunction: () => Promise<T>,
  title?: string,
) => bench<T>(wrappedFunction, (t, elapsed) => logger.log(chalk.bgWhite.black(`${elapsed}ms`), t), title)

const setFunctionName = (fnc: any, name: string) => Object.defineProperty(fnc, 'name', { value: name })

export {
  asWritable,
  benchLog,
  setLogger,
  isTruthyFilter,
  setFunctionName,
}
