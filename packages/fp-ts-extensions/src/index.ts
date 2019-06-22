import { mapLeft, map, Either, left, right, either } from "fp-ts/lib/Either"
import { pipe } from "fp-ts/lib/pipeable"

export const result = either
export type Result<TSuccess, TError> = Either<TError, TSuccess>
export const err = left
export const ok = right
export { map, pipe }
export const mapErr = mapLeft
