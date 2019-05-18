import { ValidationError } from 'fp-app-framework/src/errors'
import { err, ok, Result } from 'neverthrow'

export default class TravelClassDefinition {
  public static create(travelClassName: string): Result<TravelClassDefinition, ValidationError> {
    if (!validTravelClasss.some(x => x === travelClassName)) {
      return err(new ValidationError(`${travelClassName} is not a valid travel class name`))
    }
    return ok(new TravelClassDefinition(travelClassName))
  }

  private constructor(public readonly value: string) { }
}

const validTravelClasss = ['second', 'first', 'business']

export type TravelClassName = 'first' | 'second' | 'business'
