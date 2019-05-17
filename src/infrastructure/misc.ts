import { PipeFunctionN } from '../utils/neverthrow-extensions'

export interface RequestContextBase { id: string, correllationId: string }
export type DomainEventReturnType = void | IntegrationEventReturnType
export type IntegrationEventReturnType = PipeFunctionN<void, Error>
