# Functional Programming Application Framework

## Inspiration

- Railway Oriented Programming. Result (either)  (neverthrow)
- Persistence Ignorant Domain
- Rich Domain Model
- Clean Architecture, ports and adapters
- Command/Query Handlers
- Domain Driven Design
- Domain Events (and Integration Events)
- Screaming Architecture
- Dependency Injection (IoC), but lightweight, just enough to manage some lifecycles (singleton and scoped)

## Usage

### Run Sample

- `yarn`
- `yarn start`

### Run compile/lint/test

- `yarn testsuite`

Access over `http://localhost:3535/train-trip` (see `TrainTrip.router.ts` for paths and methods)


## Thoughts

- Authentication (for whole router, for just a route, opt-in or opt-out)
  - Based on command/query metadata or is it infrastructure concern?
- Authorization
- Function names (named functions)
- Decorators (classes) and functions (ie save command)

### Additional usecase samples

- Delete (soft/hard)
