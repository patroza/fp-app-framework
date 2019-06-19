import { ValidationError } from "@fp-app/framework"
import { err, ok, Result } from "@fp-app/neverthrow-extensions"

// Can use for input, but for storage we should just store as date.
// because it is temporal; what is today valid may be invalid tomorrow etc.
export default class FutureDate {
  static create(dateStr: string): Result<FutureDate, ValidationError> {
    const date = new Date(dateStr)
    if (!isInFuture(date)) {
      return err(new ValidationError(`${date.toDateString()} is not in future`))
    }
    return ok(new FutureDate(date))
  }
  private constructor(readonly value: Date) {}
}

const isInFuture = (date: Date) => date > new Date()
