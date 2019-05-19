import { ValidationError } from 'fp-app-framework/errors'
import assert from 'fp-app-framework/utils/assert'
import { flatMap, map, Result } from 'fp-app-framework/utils/neverthrow-extensions'
import { createValidator, Joi, predicate } from 'fp-app-framework/utils/validation'

export default class PaxDefinition {
  public static create(pax: Pax): Result<PaxDefinition, ValidationError> {
    assert.isNotNull({ pax })

    return validate(pax)
      .pipe(
        flatMap(predicate(p => Object.keys(p).some(k => (p as any)[k] > 0), 'pax requires at least 1 person')),
        flatMap(predicate(p => Object.keys(p).reduce((prev, cur) => prev += (p as any)[cur], 0) <= 6, 'pax must be 6 or less people')),
        map(validatedPax => new PaxDefinition(validatedPax)),
      )
  }

  private constructor(public readonly value: Pax) { }
}

const paxEntrySchema = Joi.number().integer().min(0).max(6).required()
const validate = createValidator<Pax>(Joi.object({
  adults: paxEntrySchema,
  babies: paxEntrySchema,
  children: paxEntrySchema,
  infants: paxEntrySchema,
  teenagers: paxEntrySchema,
}).required())

export interface Pax {
  adults: number
  babies: number
  children: number
  infants: number
  teenagers: number
}
