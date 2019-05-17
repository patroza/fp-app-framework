import { flatMap, map, PipeFunction, PipeFunctionN } from 'fp-app-framework/src/utils/neverthrow-extensions'
import { Result } from 'neverthrow'
import DomainEventHandler from './domainEventHandler'
import { DbError } from './errors'

// tslint:disable-next-line:max-classes-per-file
export default abstract class ContextBase {
  constructor(private readonly eventHandler: DomainEventHandler) { }

  public readonly save = (): Promise<Result<void, DbError>> =>
    this.eventHandler.postEvents(() => this.intGetAndClearEvents()).pipe(
      flatMap(() => this.intSave()),
      map(this.eventHandler.publishPostCommitEventHandlers),
    )

  protected abstract intGetAndClearEvents(): any[]

  protected abstract async intSave(): Promise<Result<void, DbError>>
}

export interface UnitOfWork {
  save: PipeFunctionN<void, DbError>
}

export interface RecordContext<T> {
  add: (record: T) => void
  load: PipeFunction<string, T, DbError>
}
