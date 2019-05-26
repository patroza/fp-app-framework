import chalk from "chalk"
import assert from "./assert"

export * from "@fp-app/neverthrow-extensions"
export * from "./validation"
export { default as generateUuid } from "./generateUuid"
export { default as assert } from "./assert"

export type Constructor<T> = new (...args: any[]) => T

const asWritable = <T>(obj: T) => obj as Writeable<T>
export type Writeable<T> = { -readonly [P in keyof T]-?: T[P] }

type logger = Pick<typeof console, "log" | "error" | "warn" | "debug"> & { addToLoggingContext: (item: { [key: string]: any }) => Disposable }

export let logger: logger = {
  ...console,
  addToLoggingContext: () => ({ dispose: () => void 0 }),
}
const setLogger = (l: logger) => Object.assign(logger, l)

// TODO: add support for log context open/close (via using?), tracked via async namespace?
const loggers = new Map()
const getLogger = (name: string) => {
  if (loggers.has(name)) { return loggers.get(name) }

  // const levels = ["info", "log", "debug", "error", "warn"] as const
  const l = typedKeysOf(logger).reduce((prev, current) => {
    prev[current] = (...args: any[]) => logger[current](chalk.yellow(`[${name}]`), ...args)
    return prev
  }, {} as typeof logger)
  loggers.set(name, l)
  return logger
}

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
    log(title || "", calculateElapsed(start))
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

const setFunctionName = (fnc: any, name: string) => Object.defineProperty(fnc, "name", { value: name })

export const typedKeysOf = <T>(obj: T) => Object.keys(obj) as Array<keyof T>

export interface Disposable {
  dispose(): void
}

const using = async <T>(disposable: Disposable, fnc: () => Promise<T> | T) => {
  assert(!disposable || !!disposable.dispose, "The provided disposable must implement a `dispose` function")
  try {
    return await fnc()
  } finally {
    disposable.dispose()
  }
}

const removeElement = <T>(array: T[], element: T) => {
  assert.isNotNull({
    array,
    element,
  })
  const index = array.indexOf(element)
  if (index !== -1) {
    array.splice(index, 1)
  }
}

export {
  asWritable,
  benchLog,
  getLogger,
  setLogger,
  isTruthyFilter,
  removeElement,
  setFunctionName,
  using,
}
