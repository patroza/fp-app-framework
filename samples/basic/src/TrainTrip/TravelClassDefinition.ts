import { ValidationError } from "@fp-app/framework"
import { err, ok, Result } from "@fp-app/fp-ts-extensions"

export default class TravelClassDefinition {
  static create(travelClassName: string): Result<TravelClassDefinition, ValidationError> {
    if (!validtravelClasses.some(x => x === travelClassName)) {
      return err(new ValidationError(`${travelClassName} is not a valid travel class name`))
    }
    return ok(new TravelClassDefinition(travelClassName))
  }

  private constructor(readonly value: string) {}
}

const validtravelClasses = ["second", "first", "business"]

export type TravelClassName = "first" | "second" | "business"
