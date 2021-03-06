/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/no-object-literal-type-assertion */
import TrainTrip, { Price } from "@/TrainTrip/TrainTrip"
import { createTravelPlanType, getTemplateType, getTravelPlanType } from "@/TrainTrip/usecases/types"
import { ApiError, ConnectionError, InvalidStateError, RecordNotFound, typedKeysOf } from "@fp-app/framework"
import {
  err,
  flatMap,
  liftType,
  map,
  mapErr,
  ok,
  PipeFunction,
  sequenceAsync,
  startWithVal,
} from "@fp-app/neverthrow-extensions"
import { v4 } from "uuid"
import { Pax } from "../PaxDefinition"
import { TravelClassName } from "../TravelClassDefinition"
import Trip, { TravelClass, TripWithSelectedTravelClass } from "../Trip"

const getTrip = ({
  getTemplate,
}: {
  getTemplate: getTemplateType
}): PipeFunction<string, TripWithSelectedTravelClass, ApiError | InvalidStateError> => templateId =>
  getTemplate(templateId).pipe(
    mapErr(liftType<InvalidStateError | ApiError>()),
    flatMap(toTrip(getTemplate)),
  )

const toTrip = (getTemplate: getTemplateType) => (tpl: Template) => {
  const currentTravelClass = tplToTravelClass(tpl)
  return sequenceAsync(
    [startWithVal(currentTravelClass)<ApiError>()].concat(
      typedKeysOf(tpl.travelClasses)
        .filter(x => x !== currentTravelClass.name)
        .map(slKey => tpl.travelClasses[slKey]!)
        .map(sl => getTemplate(sl.id).pipe(map(tplToTravelClass))),
    ),
  ).pipe(
    mapErr(liftType<InvalidStateError | ApiError>()),
    map(travelClasses => new Trip(travelClasses)),
    flatMap(trip => TripWithSelectedTravelClass.create(trip, currentTravelClass.name)),
  )
}

const tplToTravelClass = (tpl: Template) => new TravelClass(tpl.id, getTplLevelName(tpl))

const getTplLevelName = (tpl: Template) =>
  typedKeysOf(tpl.travelClasses).find(x => tpl.travelClasses[x]!.id === tpl.id) as TravelClassName

// Typescript support for partial application is not really great, so we try currying instead for now
// https://stackoverflow.com/questions/50400120/using-typescript-for-partial-application
const getTemplateFake = ({  }: { templateApiUrl: string }): getTemplateType => async templateId => {
  const tpl = mockedTemplates()[templateId] as Template | undefined
  if (!tpl) {
    return err(new RecordNotFound("Template", templateId))
  }
  return ok(tpl)
}

const mockedTemplates: () => { [key: string]: Template } = () => ({
  "template-id1": {
    id: "template-id1",
    travelClasses: { second: { id: "template-id1" }, first: { id: "template-id2" } },
  } as Template,
  "template-id2": {
    id: "template-id2",
    travelClasses: { second: { id: "template-id1" }, first: { id: "template-id2" } },
  } as Template,
})

const getPricingFake = ({ getTemplate }: { pricingApiUrl: string; getTemplate: getTemplateType }) => (
  templateId: string,
) => getTemplate(templateId).pipe(map(getFakePriceFromTemplate))

const getFakePriceFromTemplate = (_: any) => ({ price: { amount: 100, currency: "EUR" } })

const createTravelPlanFake = ({  }: { travelPlanApiUrl: string }): createTravelPlanType => async () => ok(v4())

const sendCloudSyncFake = ({  }: { cloudUrl: string }): PipeFunction<TrainTrip, string, ConnectionError> => async () =>
  ok(v4())

const getTravelPlanFake = ({  }: { travelPlanApiUrl: string }): getTravelPlanType => async travelPlanId =>
  ok({ id: travelPlanId } as TravelPlan)

export { createTravelPlanFake, getPricingFake, getTemplateFake, getTrip, sendCloudSyncFake, getTravelPlanFake }

export interface Conversation {
  id: string

  startDate: string
  pax: Pax
}

export interface Template {
  id: string

  price: Price
  stops: TemplateStop[]

  cityCodes: string[]

  travelClasses: {
    business?: { id: string }
    first?: { id: string }
    second?: { id: string }
  }
}

export interface TravelPlan {
  id: string

  price: Price
  stops: TravelPlanStop[]
  startDate: Date
}

// tslint:disable-next-line:no-empty-interface
interface Stop {}
// tslint:disable-next-line:no-empty-interface
interface TravelPlanStop extends Stop {}
// tslint:disable-next-line:no-empty-interface
interface TemplateStop extends Stop {}
