export * from "./src"

import { parse as parseOriginal, stringify } from "flatted"

const parse: <T>(input: string) => T = parseOriginal

export {
  parse,
  stringify,
}
