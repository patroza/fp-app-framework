import TrainTrip, { TravelClassConfiguration } from "@/TrainTrip/TrainTrip"
import { TrainTripContext } from "@/TrainTrip/usecases/types"
import { autoinject, ContextBase, DbError, DomainEventHandler, Event, RecordContext } from "@fp-app/framework"
import { DiskRecordContext } from "@fp-app/io.diskdb"
import { ok, Result } from "@fp-app/neverthrow-extensions"
import { parse, stringify } from "flatted"
import PaxDefinition, { Pax } from "../PaxDefinition"
import { TravelClassName } from "../TravelClassDefinition"
import Trip, { TravelClass } from "../Trip"
import { TrainTripView } from "../usecases/getTrainTrip"
import TrainTripReadContext from "./TrainTripReadContext.disk"

// Since we assume that saving a valid object, means restoring a valid object
// we can assume data correctness and can skip normal validation and constructing.
// until proven otherwise.
// tslint:disable-next-line:max-classes-per-file
@autoinject
export default class DiskDBContext extends ContextBase implements TrainTripContext {

  get trainTrips() { return this.trainTripsi as RecordContext<TrainTrip> }

  private readonly trainTripsi = new DiskRecordContext<TrainTrip>("trainTrip", serializeTrainTrip, deserializeDbTrainTrip)
  constructor(
    private readonly readContext: TrainTripReadContext,
    eventHandler: DomainEventHandler,
    // test sample
    // @paramInject(sendCloudSyncKey) sendCloudSync: typeof sendCloudSyncKey,
  ) { super(eventHandler) }

  protected getAndClearEvents(): Event[] { return this.trainTripsi.intGetAndClearEvents() }
  protected saveImpl(): Promise<Result<void, DbError>> {
    return this.trainTripsi.intSave(
      async i => ok(await this.readContext.create(i.id, TrainTripToView(i))),
      async i => ok(await this.readContext.delete(i.id)),
    )
  }
}

const TrainTripToView = ({
  isLocked, createdAt, id, pax, currentTravelClassConfiguration, startDate, trip,
}: TrainTrip): TrainTripView => {
  return {
    id,

    allowUserModification: !isLocked,
    createdAt,

    pax: pax.value,
    startDate,
    travelClass: currentTravelClassConfiguration.travelClass.name,
    travelClasss: trip.travelClasss.map(({ templateId, name }) => ({ templateId, name })),
  }
}

const serializeTrainTrip = ({ _EVENTS, ...rest }: any) => stringify(rest)

function deserializeDbTrainTrip(serializedTrainTrip: string) {
  const {
    createdAt, currentTravelClassConfiguration, trip, startDate, pax: paxInput, travelClassConfiguration,
    ...rest
  } = parse(serializedTrainTrip) as TrainTripDTO
  // what do we do? we restore all properties that are just property bags
  // and we recreate proper object graph for properties that have behaviors
  // TODO: use type information or configuration, probably a library ;-)
  // (trip.travelClasss as any[]).map(sl => tplToTravelClass(sl.template))
  const t = new Trip(trip.travelClasss.map(mapTravelClassDTO))
  const trainTrip = new TrainTrip({
    pax: new (PaxDefinition as any)(paxInput.value),
    // we omit FutureDate because it is temporal..
    startDate: { value: new Date(startDate) },
  }, t, t.travelClasss.find(x => x.name === currentTravelClassConfiguration.travelClass.name)!)

  // TODO: restore CurrentTravelClassConfiguration data..

  // reset created domain events, as we didn't Create.
  Object.assign(trainTrip, rest, {
    createdAt: new Date(createdAt),
    travelClassConfiguration: travelClassConfiguration.map(x => mapTravelClassConfigurationDTO(t, x)),
  })

  const trainTripAny: any = trainTrip
  trainTripAny._EVENTS = []
  return trainTrip
}

const mapTravelClassConfigurationDTO = (trip: Trip, { travelClass, ...slRest }: any) => {
  const sl = new TravelClassConfiguration(trip.travelClasss.find(s => s.name === travelClass.name)!)
  Object.assign(sl, slRest)
  return sl
}

const mapTravelClassDTO = ({ createdAt, templateId, name }: TravelClassDTO): TravelClass => {
  const sl = new TravelClass(templateId, name)
  Object.assign(sl, { createdAt: new Date(createdAt) })
  return sl
}

interface TrainTripDTO {
  createdAt: string
  currentTravelClassConfiguration: TravelClassConfigurationDTO,
  trip: TripDTO,
  startDate: string
  pax: {
    value: Pax,
  },
  travelClassConfiguration: TravelClassConfigurationDTO[]
}
interface TravelClassConfigurationDTO {
  travelClass: TravelClassDTO
}
interface TripDTO {
  travelClasss: TravelClassDTO[]
}
interface TravelClassDTO {
  createdAt: string
  name: TravelClassName
  templateId: string
}
