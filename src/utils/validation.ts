import Joi from '@hapi/joi'
import { err, ok, Result } from 'neverthrow'
import { CombinedValidationError, FieldValidationError, ValidationError } from '../errors'
export { Joi }

const createValidator = <TIn>(schema: any) => (object: TIn): Result<TIn, ValidationError> => {
  const r = Joi.validate(object, schema, { abortEarly: false })
  if (r.error) {
    return err(new CombinedValidationError(r.error.details.map(x => new FieldValidationError(x.path.join('.'), x))))
  }
  return ok(r.value)
}

const predicate = <T, E extends ValidationError>(pred: (inp: T) => boolean, errMsg: string) => (inp: T): Result<T, E | ValidationError> => {
  if (pred(inp)) {
    return ok(inp)
  }
  return err(new ValidationError(errMsg))
}

const valueEquals = <T>({ value }: { value: T }, otherValue: T, extracter?: (v: T) => any) =>
  extracter ? extracter(value) === extracter(otherValue) : value === otherValue
const valueEquals2 = <T>({ value }: { value: T }, { value: otherValue }: { value: T }, extracter?: (v: T) => any) =>
  extracter ? extracter(value) === extracter(otherValue) : value === otherValue

export {
  createValidator,
  predicate,
  valueEquals,
  valueEquals2,
}
