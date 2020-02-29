import { assert, InvalidStateError } from "@fp-app/framework"
import { err, ok, Result } from "@fp-app/fp-ts-extensions"
import { TemplateId } from "./TrainTrip"
import { TravelClassName } from "./TravelClassDefinition"

export default class Trip {
  static create(serviceLevels: TravelClass[]): Result<Trip, InvalidStateError> {
    if (!serviceLevels.length) {
      return err(new InvalidStateError("A trip requires at least 1 service level"))
    }
    return ok(new Trip(serviceLevels))
  }

  constructor(readonly travelClasses: TravelClass[]) {
    assert(Boolean(travelClasses.length), "A trip must have at least 1 travel class")
  }
}

// tslint:disable-next-line:max-classes-per-file
export class TripWithSelectedTravelClass {
  static create(
    trip: Trip,
    travelClassName: TravelClassName,
  ): Result<TripWithSelectedTravelClass, InvalidStateError> {
    const selectedTravelClass = trip.travelClasses.find(x => x.name === travelClassName)
    if (!selectedTravelClass) {
      return err(new InvalidStateError("The service level is not available"))
    }
    return ok(new TripWithSelectedTravelClass(trip.travelClasses, selectedTravelClass))
  }
  private constructor(
    readonly travelClasses: TravelClass[],
    readonly currentTravelClass: TravelClass,
  ) {}
}
// tslint:disable-next-line:max-classes-per-file
export class TravelClass {
  readonly createdAt = new Date()

  constructor(public templateId: TemplateId, public name: TravelClassName) {}
}
