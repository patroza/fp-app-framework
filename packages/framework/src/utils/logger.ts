import chalk from "chalk"
import { Disposable, noop, typedKeysOf } from "./misc"

type logLevels = Pick<typeof console, "log" | "error" | "warn" | "debug">
interface AddLogging {
  addToLoggingContext: (item: { [key: string]: any }) => Disposable
}
type logger = logLevels & AddLogging

const logLevels: logLevels = {
  ...console,
}
export const logger: logger = {
  ...logLevels,
  addToLoggingContext: () => ({ dispose: noop }),
}
const setLogger = (l: logLevels & Partial<AddLogging>) => Object.assign(logger, l)

// TODO: add support for log context open/close (via using?), tracked via async namespace?
const loggers = new Map<string, typeof logger>()
const getLogger = (name: string) => {
  if (loggers.has(name)) {
    return loggers.get(name)!
  }

  // const levels = ["info", "log", "debug", "error", "warn"] as const
  const l = typedKeysOf(logLevels).reduce((prev, current) => {
    prev[current] = (...args: any[]) => logger[current](chalk.yellow(`[${name}]`), ...args)
    return prev
  }, {} as typeof logger)
  l.addToLoggingContext = logger.addToLoggingContext
  loggers.set(name, l)
  return logger
}

async function bench<T>(
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

function calculateElapsed(start: [number, number]) {
  const elapsed = process.hrtime(start)
  return elapsed[0] * 1000 + elapsed[1] / 1000000
}

const benchLog = <T>(wrappedFunction: () => Promise<T>, title?: string) =>
  bench<T>(wrappedFunction, (t, elapsed) => logger.log(chalk.bgWhite.black(`${elapsed}ms`), t), title)

export { bench, benchLog, calculateElapsed, getLogger, setLogger }
