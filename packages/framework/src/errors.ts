// tslint:disable:max-classes-per-file

const combineValidationErrors = <E extends ValidationError>(errors: E[]) => new CombinedValidationError(errors)

const toFieldError = (fieldName: string) => (err: ValidationError) => new FieldValidationError(fieldName, err)

export {
  combineValidationErrors,
  toFieldError,
}

export abstract class ErrorBase {
  constructor(readonly message: string) { }

  toString() {
    return `${this.constructor.name}\n${this.message}`
  }
}

export class Error extends ErrorBase { }

export class ValidationError extends ErrorBase { }

export class ForbiddenError extends ErrorBase { }

export class FieldValidationError extends ValidationError {
  constructor(readonly fieldName: string, readonly error: ValidationError) { super(error.message) }

  toString() {
    return `${this.fieldName}: ${this.message}`
  }
}

export class CombinedValidationError extends ValidationError {
  constructor(readonly errors: ValidationError[]) {
    super(errors.join('\n'))
  }
}
