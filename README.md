# Functional Programming Application Framework

## Inspiration

- Railway Oriented Programming. Result (either)  (neverthrow)
- Clean Architecture, ports and adapters
- Rich Domain Model
- Persistence Ignorant Domain
- Command/Query Handlers
- Domain Events (and Integration Events)
- Screaming Architecture
- Domain Driven Design
- Dependency Injection (IoC), but lightweight, just enough to manage some lifecycles (singleton and scoped)

## Usage

### Run Sample

- `yarn`
- `yarn start`

### Run compile/lint/test

- `yarn testsuite`

Access over `http://localhost:3535/train-trip`
see `TrainTrip.router.ts` for paths and methods, and `router-schema.json` for a complete picture.


## Thoughts

- Authentication (for whole router [DONE], for just a route, opt-in or opt-out)
  - Based on command/query metadata or is it infrastructure concern?
  - BasicAuth
  - future: OAuth based
- Authorization
- Keep up with Typescript improvements for Generic inference etc.

## After stabilization

- Enhance container to prevent dependency capturing (ie a singleton that 'captures' a transient or scoped dependency)
- Remove "opinionation"
  - Make it easy to use any validation framework
- Look into performance signatures and identify areas that need improvement

### Additional usecase samples

- Soft delete

## Resources

- https://fsharpforfunandprofit.com/ddd/
- https://fsharpforfunandprofit.com/rop/
- https://github.com/gcanti/fp-ts
- https://dev.to/_gdelgado/type-safe-error-handling-in-typescript-1p4n
- https://khalilstemmler.com/articles/enterprise-typescript-nodejs/handling-errors-result-class/
  - & more: https://khalilstemmler.com/articles
- SimpleInjector
- MediatR Request/Event handlers and Pipelines.
- https://github.com/tc39/proposal-pipeline-operator/wiki
