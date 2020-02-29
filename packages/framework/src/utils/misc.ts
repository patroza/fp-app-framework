import assert from "./assert"

export type Constructor<T> = new (...args: any[]) => T

const asWritable = <T>(obj: T) => obj as Writeable<T>
export type Writeable<T> = { -readonly [P in keyof T]-?: T[P] }

const isTruthyFilter = <T>(item: T | null | undefined | void): item is T =>
  Boolean(item)

const setFunctionName = (fnc: any, name: string) =>
  Object.defineProperty(fnc, "name", { value: name })

export const typedKeysOf = <T>(obj: T) => Object.keys(obj) as (keyof T)[]

export interface Disposable {
  dispose(): void
}

const using = async <T>(disposable: Disposable, fnc: () => Promise<T> | T) => {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  assert(
    !disposable || !!disposable.dispose,
    "The provided disposable must implement a `dispose` function",
  )
  try {
    return await fnc()
  } finally {
    disposable.dispose()
  }
}

const removeElement = <T>(array: T[], element: T) => {
  const index = array.indexOf(element)
  if (index !== -1) {
    array.splice(index, 1)
  }
}

const noop = () => void 0

// Defers object creation until the instance is accessed
const createLazy = <T>(creatorFunction: () => T) => {
  let instance: T
  return {
    get value() {
      return instance || (instance = creatorFunction())
    },
  }
}

// TODO: don't allow to put more properties in as default, than T
function immutableObj<T>() {
  return <TDefaults extends Partial<T>>(def?: TDefaults) => {
    const frozenDefault = Object.freeze({ ...def })
    return (current: Omit<T, keyof TDefaults> & Partial<T>, updates?: Partial<T>) => {
      const newObj = Object.freeze({ ...frozenDefault, ...current, ...updates })
      // TODO: consider
      // type UpdateableT = T & { update: (current: T, updates?: Partial<T>) => UpdateableT }
      return newObj as T
    }
  }
}

export {
  asWritable,
  createLazy,
  isTruthyFilter,
  immutableObj,
  noop,
  removeElement,
  setFunctionName,
  using,
}
