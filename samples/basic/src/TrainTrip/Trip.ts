import { assert, InvalidStateError, ValidationError } from "@fp-app/framework"
import { err, liftType, map, mapErr, ok, Result } from "@fp-app/neverthrow-extensions"
import TrainTrip, { CreateTrainTripInfo, TemplateId } from "./TrainTrip"
import { TravelClassName } from "./TravelClassDefinition"

export default class Trip {
  readonly createdAt = new Date()

  constructor(readonly travelClasses: TravelClass[]) {
    assert(Boolean(travelClasses.length), "A trip must have at least 1 travel class")
  }

  readonly createTrainTrip = ({ templateId, ...rest }: CreateTrainTripInfo) =>
    TripWithSelectedTravelClass.create(this.travelClasses, this.travelClasses.find(x => x.templateId === templateId)!.name)
      .pipe(
        mapErr(liftType<InvalidStateError | ValidationError>()),
        map(t => TrainTrip.create(rest, t)),
      )
}

// tslint:disable-next-line:max-classes-per-file
export class TripWithSelectedTravelClass {
  static create(travelClasses: TravelClass[], travelClassName: TravelClassName): Result<TripWithSelectedTravelClass, InvalidStateError> {
    const selectedTravelClass = travelClasses.find(x => x.name === travelClassName)
    if (!selectedTravelClass) {
      return err(new InvalidStateError("The service level is not available"))
    }
    return ok(new TripWithSelectedTravelClass(travelClasses, selectedTravelClass))
  }
  private constructor(readonly travelClasses: TravelClass[], readonly currentTravelClass: TravelClass) { }
}
// tslint:disable-next-line:max-classes-per-file
export class TravelClass {
  readonly createdAt = new Date()

  constructor(public templateId: TemplateId, public name: TravelClassName) { }
}
