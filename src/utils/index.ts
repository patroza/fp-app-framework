export const asWritable = <T>(obj: T) => obj as Writeable<T>
export type Writeable<T> = { -readonly [P in keyof T]-?: T[P] }

type logger = Pick<typeof console, 'log' | 'error' | 'warn'>

export let logger: logger = console
export const setLogger = (l: logger) => logger = l

export const isTruthyFilter = <T>(item: T | null | undefined | void): item is T => Boolean(item)

export const bench = async <T>(
  wrappedFunction: () => Promise<T>,
  log: (title: string, elapsed: number) => void,
  title?: string,
) => {
  const start = process.hrtime()
  try {
    return await wrappedFunction()
  } finally {
    log(title || '', calculateElapsed(start))
  }
}

export const calculateElapsed = (start: [number, number]) => {
  const elapsed = process.hrtime(start)
  return (elapsed[0] * 1000) + (elapsed[1] / 1000000)
}

export const benchLog = <T>(
  wrappedFunction: () => Promise<T>,
  title?: string,
) => bench<T>(wrappedFunction, (t, elapsed) => logger.log(`$$ ${elapsed}ms`, t), title)
