import { ValidationError } from 'fp-app-framework/src/errors'
import assert from 'fp-app-framework/src/utils/assert'
import { err, ok, Result } from 'neverthrow'

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
