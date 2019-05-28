import assert from "./assert"

export type Constructor<T> = new (...args: any[]) => T

const asWritable = <T>(obj: T) => obj as Writeable<T>
export type Writeable<T> = { -readonly [P in keyof T]-?: T[P] }

const isTruthyFilter = <T>(item: T | null | undefined | void): item is T => Boolean(item)

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

const noop = () => void 0

// Defers object creation until the instance is accessed
const createLazy = <T>(creatorFunction: () => T) => {
  assert.isNotNull({ creatorFunction })

  let instance: T
  return {
    get value() {
      return instance || (instance = creatorFunction())
    },
  }
}

export {
  asWritable,
  createLazy,
  isTruthyFilter,
  noop,
  removeElement,
  setFunctionName,
  using,
}
