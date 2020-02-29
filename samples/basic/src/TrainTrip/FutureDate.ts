import { ValidationError } from "@fp-app/framework"
import { E, pipe, composeE, boolToEither } from "@fp-app/fp-ts-extensions"

// Can use for input, but for storage we should just store as date.
// because it is temporal; what is today valid may be invalid tomorrow etc.
export default class FutureDate {
  static create = composeE(
    E.chain((dateStr: string) =>
      pipe(
        boolToEither(new Date(dateStr), isInFuture),
        E.map(d => new FutureDate(d)),
        E.mapLeft(d => new ValidationError(`${d.toDateString()} is not in future`)),
      ),
    ),
  )

  // alternative:
  /*
  static create(dateStr: string) {
    const date = new Date(dateStr)
    return pipe(
      boolToEither(date, isInFuture),
      E.map(d => new FutureDate(d)),
      E.mapLeft(d => new ValidationError(`${d.toDateString()} is not in future`)),
    )
  }
  */
  private constructor(readonly value: Date) {}
}

const isInFuture = (date: Date) => date > new Date()

// // https://dev.to/gcanti/getting-started-with-fp-ts-either-vs-validation-5eja
// const a = compose(
//   FutureDate.create("2019-12-12"),
//   TE.mapLeft(toFieldError("startDate")),
// )

// const applicativeValidation = getApplicative(getArraySemigroup<string>())

// // const tup = sequenceT(a)
