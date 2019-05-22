import TrainTrip, { TravelClassConfiguration } from "@/TrainTrip/TrainTrip"
import { TrainTripContext } from "@/TrainTrip/usecases/types"
import { ContextBase, RecordContext } from "@fp-app/framework"
import { DbError } from "@fp-app/framework"
import { DiskRecordContext } from "@fp-app/io.diskdb"
import { map, mapErr, Result } from "@fp-app/neverthrow-extensions"
import { parse, stringify } from "flatted"
import PaxDefinition, { Pax } from "../PaxDefinition"
import { TravelClassName } from "../TravelClassDefinition"
import Trip, { TravelClass } from "../Trip"

// TODO: hide fact that this is a class? :-)
// tslint:disable-next-line:max-classes-per-file
export default class DiskDBContext extends ContextBase implements TrainTripContext {
  get trainTrips() { return this.trainTripsi as RecordContext<TrainTrip> }

  private readonly trainTripsi = new DiskRecordContext<TrainTrip>("trainTrip", serializeTrainTrip, deserializeDbTrainTrip)

  // Internal
  protected intGetAndClearEvents(): any[] { return this.trainTripsi.intGetAndClearEvents() }
  protected intSave(): Promise<Result<void, DbError>> { return this.trainTripsi.intSave() }
}

const serializeTrainTrip = ({ _EVENTS, ...rest }: any) => stringify(rest)

const deserializeDbTrainTrip = (serializedTrainTrip: string) =>
  intDeserializeDbTrainTrip(serializedTrainTrip)
    .pipe(mapErr(x => { throw new Error("Database consistency error: " + x.message) }))

const intDeserializeDbTrainTrip = (serializedTrainTrip: string) => {
  const {
    createdAt, currentTravelClassConfiguration, trip, startDate, pax: paxInput, travelClassConfiguration,
    ...rest
  } = parse(serializedTrainTrip) as TrainTripDTO
  return PaxDefinition.create(paxInput.value)
    .pipe(
      map(pax => {
        // what do we do? we restore all properties that are just property bags
        // and we recreate proper object graph for properties that have behaviors
        // TODO: use type information or configuration, probably a library ;-)
        // (trip.travelClasss as any[]).map(sl => tplToTravelClass(sl.template))
        const t = new Trip(trip.travelClasss.map(mapTravelClassDTO))
        const trainTrip = new TrainTrip({
          pax,
          // we omit FutureDate because it is temporal..
          startDate: { value: new Date(startDate) },
        }, t, t.travelClasss.find(x => x.name === currentTravelClassConfiguration.travelClass.name)!)

        // TODO: restore CurrentTravelClassConfiguration data..

        // reset created domain events, as we didn't Create.
        const trainTripAny: any = trainTrip
        Object.assign(trainTrip, rest, {
          createdAt: new Date(createdAt),
          travelClassConfiguration: (travelClassConfiguration as any[]).map(x => mapTravelClassConfigurationDTO(t, x)),
        })
        trainTripAny._EVENTS = []
        return trainTrip
      }),
    )
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
