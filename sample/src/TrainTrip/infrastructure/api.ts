import TrainTrip, { Price } from '@/TrainTrip/TrainTrip'
import { ApiError, ConnectionError, RecordNotFound } from 'fp-app-framework/infrastructure/errors'
import { generateKeyFromFn } from 'fp-app-framework/infrastructure/SimpleContainer'
import assert from 'fp-app-framework/utils/assert'
import { flatMap, map, PipeFunction, sequenceAsync, startWithVal } from 'fp-app-framework/utils/neverthrow-extensions'
import { err, ok, Result } from 'neverthrow'
import { v4 } from 'uuid'
import PaxDefinition, { Pax } from '../PaxDefinition'
import { TravelClassName } from '../TravelClassDefinition'
import Trip, { TravelClass } from '../Trip'

const getTrip = (
  { getTemplate }: { getTemplate: typeof getTemplateKey },
): PipeFunction<string, Trip, ApiError> => templateId => {
  assert.isNotNull({ templateId })

  return getTemplate(templateId)
    .pipe(flatMap(toTrip(getTemplate)))
}

const toTrip = (getTemplate: typeof getTemplateKey) => (tpl: Template) => {
  const currentTravelClass = tplToTravelClass(tpl)
  return sequenceAsync(
    [startWithVal<ApiError>()(currentTravelClass)].concat(
      Object.keys(tpl.travelClasss)
        .filter(x => x !== currentTravelClass.name)
        .map(slKey => (tpl.travelClasss as any)[slKey])
        .map(sl => getTemplate(sl.id).pipe(map(tplToTravelClass))),
    ),
  ).pipe(map(travelClasss => new Trip(travelClasss)))
}

const tplToTravelClass = (tpl: Template) => new TravelClass(tpl.id, getTplLevelName(tpl))

const getTplLevelName = (tpl: any) => Object.keys(tpl.travelClasss).find(x => (tpl.travelClasss as any)[x].id === tpl.id) as TravelClassName

// Typescript support for partial application is not really great, so we try currying instead for now
// https://stackoverflow.com/questions/50400120/using-typescript-for-partial-application
const getTemplateFake = (
  { }: { templateApiUrl: string },
): PipeFunction<string, Template, ApiError> => async templateId => {
  assert.isNotNull({ templateId })

  const tpl = mockedTemplates()[templateId] as Template | undefined
  if (!tpl) { return err(new RecordNotFound(templateId, 'Template')) }
  return ok(tpl)
}

const mockedTemplates: () => { [key: string]: Template } = () => ({
  'template-id1': { id: 'template-id1', travelClasss: { second: { id: 'template-id1' }, first: { id: 'template-id2' } } } as Template,
  'template-id2': { id: 'template-id2', travelClasss: { second: { id: 'template-id1' }, first: { id: 'template-id2' } } } as Template,
})

const getPricingFake = (
  { getTemplate }: { pricingApiUrl: string, getTemplate: typeof getTemplateKey },
) => (templateId: string, pax: PaxDefinition, startDate: Date) => {
  assert.isNotNull({ templateId, pax, startDate })

  return getTemplate(templateId)
    .pipe(map(getFakePriceFromTemplate))
}

const getFakePriceFromTemplate = (_: any) => ({ price: { amount: 100, currency: 'EUR' } })

const createTravelPlanFake = (
  { }: { travelPlanApiUrl: string },
) => async (templateId: string, info: { pax: PaxDefinition, startDate: Date }): Promise<Result<string, ConnectionError>> => {
  assert.isNotNull({ templateId, info })

  return ok(v4())
}

const sendCloudSyncFake = (
  { }: { cloudUrl: string },
): PipeFunction<TrainTrip, string, ConnectionError> => async ({ currentTravelClassConfiguration: { travelClass: templateId } }: TrainTrip) => {
  assert.isNotNull({ templateId })

  return ok(v4())
}

const getTravelPlanFake = (
  { }: { travelPlanApiUrl: string },
): PipeFunction<string, TravelPlan, ApiError> => async travelPlanId => {
  assert.isNotNull({ travelPlanId })

  return ok({ id: travelPlanId } as TravelPlan)
}

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

  travelClasss: {
    business?: { id: string }
    first?: { id: string }
    second?: { id: string },
  }
}

export interface TravelPlan {
  id: string

  price: Price
  stops: TravelPlanStop[]
  startDate: Date
}

// tslint:disable-next-line:no-empty-interface
interface Stop { }
// tslint:disable-next-line:no-empty-interface
interface TravelPlanStop extends Stop { }
// tslint:disable-next-line:no-empty-interface
interface TemplateStop extends Stop { }

export const getTripKey = generateKeyFromFn(getTrip)
export const sendCloudSyncKey = generateKeyFromFn(sendCloudSyncFake)
export const getTravelPlanKey = generateKeyFromFn(getTravelPlanFake)
export const getTemplateKey = generateKeyFromFn(getTemplateFake)
export const getPricingType = generateKeyFromFn(getPricingFake)
export const createTravelPlanType = generateKeyFromFn(createTravelPlanFake)
