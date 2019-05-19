import { ValidationError } from 'fp-app-framework/errors'
import assert from 'fp-app-framework/utils/assert'
import { err, ok, Result } from 'fp-app-framework/utils/neverthrow-extensions'

// Can use for input, but for storage we should just store as date.
// because it is temporal; what is today valid may be invalid tomorrow etc.
export default class FutureDate {
  public static create(dateStr: string): Result<FutureDate, ValidationError> {
    assert.isNotNull({ dateStr })

    const date = new Date(dateStr)
    if (!isInFuture(date)) {
      return err(new ValidationError(`${date.toDateString()} is not in future`))
    }
    return ok(new FutureDate(date))
  }
  private constructor(public readonly value: Date) { }
}

const isInFuture = (date: Date) => date > new Date()