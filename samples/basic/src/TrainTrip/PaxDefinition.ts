import { createValidator, Joi, predicate, typedKeysOf, ValidationError } from "@fp-app/framework"
import { flatMap, map, Result } from "@fp-app/neverthrow-extensions"

export default class PaxDefinition {
  static create(pax: Pax): Result<PaxDefinition, ValidationError> {
    return validate(pax).pipe(
      flatMap(predicate(p => typedKeysOf(p).some(k => p[k] > 0), "pax requires at least 1 person")),
      flatMap(
        predicate(p => typedKeysOf(p).reduce((prev, cur) => (prev += p[cur]), 0) <= 6, "pax must be 6 or less people"),
      ),
      map(validatedPax => new PaxDefinition(validatedPax)),
    )
  }

  private constructor(readonly value: Pax) {}
}

const paxEntrySchema = Joi.number()
  .integer()
  .min(0)
  .max(6)
  .required()
export const paxSchema = Joi.object({
  adults: paxEntrySchema,
  babies: paxEntrySchema,
  children: paxEntrySchema,
  infants: paxEntrySchema,
  teenagers: paxEntrySchema,
}).required()
const validate = createValidator<Pax>(paxSchema)

export interface Pax {
  adults: number
  babies: number
  children: number
  infants: number
  teenagers: number
}
