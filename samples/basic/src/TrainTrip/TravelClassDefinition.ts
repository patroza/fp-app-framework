import { ValidationError } from '@fp-app/framework/errors'
import { err, ok, Result } from '@fp-app/framework/utils/neverthrow-extensions'

export default class TravelClassDefinition {
  static create(travelClassName: string): Result<TravelClassDefinition, ValidationError> {
    if (!validTravelClasss.some(x => x === travelClassName)) {
      return err(new ValidationError(`${travelClassName} is not a valid travel class name`))
    }
    return ok(new TravelClassDefinition(travelClassName))
  }

  private constructor(readonly value: string) { }
}

const validTravelClasss = ['second', 'first', 'business']

export type TravelClassName = 'first' | 'second' | 'business'
