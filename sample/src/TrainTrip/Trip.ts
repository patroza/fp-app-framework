import assert from 'fp-app-framework/utils/assert'
import TrainTrip, { CreateTrainTripInfo, TemplateId } from './TrainTrip'
import { TravelClassName } from './TravelClassDefinition'

export default class Trip {
  readonly createdAt = new Date()

  constructor(readonly travelClasss: TravelClass[]) {
    assert(Boolean(travelClasss.length), 'A trip must have at least 1 travel class')
  }

  readonly createTrainTrip = ({ templateId, ...rest }: CreateTrainTripInfo) => new TrainTrip(
    rest,
    this,
    this.travelClasss.find(x => x.templateId === templateId)!,
  )
}

// tslint:disable-next-line:max-classes-per-file
export class TravelClass {
  readonly createdAt = new Date()

  constructor(public templateId: TemplateId, public name: TravelClassName) { }
}
