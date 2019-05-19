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

- Authentication (for whole router, for just a route, opt-in or opt-out)
  - Based on command/query metadata or is it infrastructure concern?
  - BasicAuth
  - future: OAuth based
- Authorization
- Decorator support for the container

## After stabilization

- Enhance container to prevent dependency capturing (ie a singleton that 'captures' a transient or scoped dependency)
- Extract Infrastructure framework implementations to separate packages
  - hosting-koa
  - io-disk

### Additional usecase samples

- Soft delete
