// tslint:disable:max-classes-per-file

const combineValidationErrors = <E extends ValidationError>(errors: E[]) =>
  new CombinedValidationError(errors)

const toFieldError = (fieldName: string) => (err: ValidationError) =>
  new FieldValidationError(fieldName, err)

export { combineValidationErrors, toFieldError }

export abstract class ErrorBase {
  constructor(readonly message: string) {}

  toString() {
    return `${this.constructor.name}\n${this.message}`
  }
}

export class ValidationError extends ErrorBase {
  readonly name = "ValidationError"
}

export class InvalidStateError extends ErrorBase {
  readonly name = "InvalidStateError"
}

export class ForbiddenError extends ErrorBase {
  readonly name = "ForbiddenError"
}

export class FieldValidationError extends ValidationError {
  constructor(readonly fieldName: string, readonly error: ValidationError | ErrorBase) {
    super(error.message)
  }

  toString() {
    return `${this.fieldName}: ${this.message}`
  }
}

export class CombinedValidationError extends ValidationError {
  constructor(readonly errors: ValidationError[]) {
    super(errors.join("\n"))
  }
}
