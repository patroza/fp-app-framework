import TrainTrip, { TravelClassConfiguration } from "@/TrainTrip/TrainTrip"
import { TrainTripContext } from "@/TrainTrip/usecases/types"
import { autoinject, ContextBase, DbError, DomainEventHandler, Event, RecordContext } from "@fp-app/framework"
import { DiskRecordContext } from "@fp-app/io.diskdb"
import { ok, Result } from "@fp-app/neverthrow-extensions"
import { parse, stringify } from "flatted"
import PaxDefinition, { Pax } from "../PaxDefinition"
import { TravelClassName } from "../TravelClassDefinition"
import { TravelClass } from "../Trip"
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
  isLocked, createdAt, id, pax, currentTravelClassConfiguration, startDate, travelClassConfiguration,
}: TrainTrip): TrainTripView => {
  return {
    id,

    allowUserModification: !isLocked,
    createdAt,

    pax: pax.value,
    startDate,
    travelClass: currentTravelClassConfiguration.travelClass.name,
    travelClasses: travelClassConfiguration.map(({ travelClass: { templateId, name } }) => ({ templateId, name })),
  }
}

const serializeTrainTrip = ({ events, ...rest }: any) => stringify(rest)

function deserializeDbTrainTrip(serializedTrainTrip: string) {
  const {
    id, createdAt, currentTravelClassConfiguration, lockedAt, startDate, pax: paxInput, travelClassConfiguration,
    ...rest
  } = parse(serializedTrainTrip) as TrainTripDTO
  // what do we do? we restore all properties that are just property bags
  // and we recreate proper object graph for properties that have behaviors
  // TODO: use type information or configuration, probably a library ;-)

  const travelClassConfigurations = travelClassConfiguration.map(mapTravelClassConfigurationDTO)
  const trainTrip = new TrainTrip(
    id,
    new (PaxDefinition as any)(paxInput.value),
    new Date(startDate),
    travelClassConfigurations,
    travelClassConfigurations.find(x => x.travelClass.name === currentTravelClassConfiguration.travelClass.name)!,
    {
      ...rest,
      createdAt: new Date(createdAt),
      lockedAt: lockedAt ? new Date(lockedAt) : undefined,
    },
  )

  return trainTrip
}

const mapTravelClassConfigurationDTO = ({ travelClass, ...slRest }: { travelClass: TravelClassDTO }) => {
  const slc = new TravelClassConfiguration(mapTravelClassDTO(travelClass))
  Object.assign(slc, slRest)
  return slc
}

const mapTravelClassDTO = ({ createdAt, templateId, name }: TravelClassDTO): TravelClass => {
  const sl = new TravelClass(templateId, name)
  Object.assign(sl, { createdAt: new Date(createdAt) })
  return sl
}

interface TrainTripDTO {
  createdAt: string
  currentTravelClassConfiguration: TravelClassConfigurationDTO,
  id: string,
  trip: TripDTO,
  startDate: string
  lockedAt?: string
  pax: {
    value: Pax,
  },
  travelClassConfiguration: TravelClassConfigurationDTO[]
}
interface TravelClassConfigurationDTO {
  travelClass: TravelClassDTO
}
interface TripDTO {
  travelClasses: TravelClassDTO[]
}
interface TravelClassDTO {
  createdAt: string
  name: TravelClassName
  templateId: string
}
