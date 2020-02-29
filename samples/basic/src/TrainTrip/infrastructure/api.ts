/* eslint-disable @typescript-eslint/no-empty-interface */
import TrainTrip, { Price } from "@/TrainTrip/TrainTrip"
import {
  createTravelPlanType,
  getTemplateType,
  getTravelPlanType,
} from "@/TrainTrip/usecases/types"
import {
  ApiError,
  ConnectionError,
  InvalidStateError,
  RecordNotFound,
  typedKeysOf,
} from "@fp-app/framework"
import {
  err,
  liftType,
  map,
  ok,
  PipeFunction,
  sequenceAsync,
  startWithVal,
  pipe,
  TE,
} from "@fp-app/fp-ts-extensions"
import { v4 } from "uuid"
import { Pax } from "../PaxDefinition"
import { TravelClassName } from "../TravelClassDefinition"
import Trip, { TravelClass, TripWithSelectedTravelClass } from "../Trip"

const getTrip = ({
  getTemplate,
}: {
  getTemplate: getTemplateType
}): PipeFunction<
  string,
  TripWithSelectedTravelClass,
  ApiError | InvalidStateError
> => templateId =>
  pipe(
    getTemplate(templateId),
    TE.mapLeft(liftType<InvalidStateError | ApiError>()),
    TE.chain(toTrip(getTemplate)),
  )

const toTrip = (getTemplate: getTemplateType) => (tpl: Template) => {
  const currentTravelClass = tplToTravelClass(tpl)
  const seq = sequenceAsync(
    [startWithVal(currentTravelClass)<ApiError>()].concat(
      typedKeysOf(tpl.travelClasses)
        .filter(x => x !== currentTravelClass.name)
        .map(slKey => tpl.travelClasses[slKey]!)
        .map(sl => pipe(getTemplate(sl.id), map(tplToTravelClass))),
    ),
  )
  return pipe(
    seq,
    TE.mapLeft(liftType<ApiError | InvalidStateError>()),
    // TODO: should be chain Trip.create
    TE.chain(i =>
      pipe(
        TE.fromEither(Trip.create(i)),
        TE.mapLeft(liftType<ApiError | InvalidStateError>()),
      ),
    ),
    TE.chain(trip =>
      pipe(
        TE.fromEither(
          TripWithSelectedTravelClass.create(trip, currentTravelClass.name),
        ),
        TE.mapLeft(liftType<ApiError | InvalidStateError>()),
      ),
    ),
  )
}

const tplToTravelClass = (tpl: Template) =>
  new TravelClass(tpl.id, getTplLevelName(tpl))

const getTplLevelName = (tpl: Template) =>
  typedKeysOf(tpl.travelClasses).find(
    x => tpl.travelClasses[x]!.id === tpl.id,
  ) as TravelClassName

// Typescript support for partial application is not really great, so we try currying instead for now
// https://stackoverflow.com/questions/50400120/using-typescript-for-partial-application
// eslint-disable-next-line @typescript-eslint/require-await
const getTemplateFake = (_: {
  templateApiUrl: string
}): getTemplateType => templateId => async () => {
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

const getPricingFake = ({
  getTemplate,
}: {
  pricingApiUrl: string
  getTemplate: getTemplateType
}) => (templateId: string) =>
  pipe(getTemplate(templateId), map(getFakePriceFromTemplate))

const getFakePriceFromTemplate = () => ({ price: { amount: 100, currency: "EUR" } })

// eslint-disable-next-line @typescript-eslint/require-await
const createTravelPlanFake = (_: {
  travelPlanApiUrl: string
}): createTravelPlanType => () => async () => ok<string, ConnectionError>(v4())

const sendCloudSyncFake = (_: {
  cloudUrl: string
}): PipeFunction<TrainTrip, string, ConnectionError> => () =>
  TE.right<ConnectionError, string>(v4())

const getTravelPlanFake = (_: {
  travelPlanApiUrl: string
}): getTravelPlanType => travelPlanId => TE.right({ id: travelPlanId } as TravelPlan)

export {
  createTravelPlanFake,
  getPricingFake,
  getTemplateFake,
  getTrip,
  sendCloudSyncFake,
  getTravelPlanFake,
}

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
