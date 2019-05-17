// tslint:disable:max-classes-per-file

export const combineValidationErrors = <E extends ValidationError>(errors: E[]) => new CombinedValidationError(errors)

export const toFieldError = (fieldName: string) => (err: ValidationError) => new FieldValidationError(fieldName, err)

export abstract class ErrorBase {
  constructor(public readonly message: string) { }

  public toString() {
    return `${this.constructor.name}\n${this.message}`
  }
}

export class Error extends ErrorBase {
}

export class ValidationError extends ErrorBase {
}

export class ForbiddenError extends ErrorBase {}

export class FieldValidationError extends ValidationError {
  constructor(public readonly fieldName: string, public readonly error: ValidationError) { super(error.message) }

  public toString() {
    return `${this.fieldName}: ${this.message}`
  }
}

export class CombinedValidationError extends ValidationError {
  constructor(public readonly errors: ValidationError[]) {
    super(errors.join('\n'))
  }
}
