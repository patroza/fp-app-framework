import assert from 'fp-app-framework/src/utils/assert'
import TrainTrip, { CreateTrainTripInfo, TemplateId } from './TrainTrip'
import { TravelClassName } from './TravelClassDefinition'

export default class Trip {
  public readonly createdAt = new Date()

  constructor(public readonly travelClasss: TravelClass[]) {
    assert(Boolean(travelClasss.length), 'A trip must have at least 1 travel class')
  }

  public createTrainTrip = ({ templateId, ...rest }: CreateTrainTripInfo) => new TrainTrip(
    rest,
    this,
    this.travelClasss.find(x => x.templateId === templateId)!,
  )
}

// tslint:disable-next-line:max-classes-per-file
export class TravelClass {
  public readonly createdAt = new Date()

  constructor(public templateId: TemplateId, public name: TravelClassName) { }
}
