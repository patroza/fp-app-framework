import { PipeFunction, PipeFunctionN, Result } from '@fp-app/neverthrow-extensions'
import DomainEventHandler from './domainEventHandler'
import { DbError } from './errors'

// tslint:disable-next-line:max-classes-per-file
export default abstract class ContextBase {
  constructor(private readonly eventHandler: DomainEventHandler) { }

  readonly save = (): Promise<Result<void, DbError | Error>> =>
    this.eventHandler.commitAndPostEvents(
      () => this.intGetAndClearEvents(),
      () => this.intSave(),
    )

  protected abstract intGetAndClearEvents(): any[]

  protected abstract async intSave(): Promise<Result<void, DbError>>
}

export interface UnitOfWork {
  save: PipeFunctionN<void, DbError | Error>
}

export interface RecordContext<T> {
  add: (record: T) => void
  remove: (record: T) => void
  load: PipeFunction<string, T, DbError>
}
