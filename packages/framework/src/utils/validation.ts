import { err, ok, Result } from "@fp-app/fp-ts-extensions"
import Joi from "@hapi/joi"
import { CombinedValidationError, FieldValidationError, ValidationError } from "../errors"
export { Joi }
import convert from "joi-to-json-schema"

const createValidator = <TIn>(schema: any): ValidatorType<TIn, ValidationError> => {
  const validator = (object: TIn): Result<TIn, ValidationError> => {
    const r = Joi.validate(object, schema, { abortEarly: false })
    if (r.error) {
      return err(new CombinedValidationError(r.error.details.map(x => new FieldValidationError(x.path.join("."), x))))
    }
    return ok(r.value)
  }
  validator.jsonSchema = convert(schema)
  return validator
}

export type ValidatorType<TIn, TErr> = ((object: TIn) => Result<TIn, TErr>) & { jsonSchema: string }

const predicate = <T, E extends ValidationError>(pred: (inp: T) => boolean, errMsg: string) => (
  inp: T,
): Result<T, E | ValidationError> => {
  if (pred(inp)) {
    return ok(inp)
  }
  return err(new ValidationError(errMsg))
}

const valueEquals = <T, TExtracted>({ value }: { value: T }, otherValue: T, extracter?: (v: T) => TExtracted) =>
  extracter ? extracter(value) === extracter(otherValue) : value === otherValue
const valueEquals2 = <T, TExtracted>(
  { value }: { value: T },
  { value: otherValue }: { value: T },
  extracter?: (v: T) => TExtracted,
) => (extracter ? extracter(value) === extracter(otherValue) : value === otherValue)

export { createValidator, predicate, valueEquals, valueEquals2 }
