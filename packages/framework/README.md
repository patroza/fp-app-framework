# @fp-app/framework

## Dependency Injection

### Class vs Function sample

```
interface ISomething {
  handle(x: X): void
}

export class Something implements ISomething {
  constructor(private readonly somethingElse: SomethingElse) {}

  public handle(x: X) {
    // ...impl
    this.somethingElse(...)
  }
}
```

```
type SomethingType = (x: X) => void

const Something = ({somethingElse}: {somethingElse: SomethingElse}): SomethingType =>
 x => {  // type of X is inferred by SomethingType
    // ...impl
    somethingElse(...)
  }

export default Something // we export separately because then the function will be assigned .name "Something"
```

For singular functions, implementing the additional `public handle(x: X) {` and on the interface is what we would save.


#### With dependency configuration

```
interface ISomething {
  handle(x: X): void
}

@autoinject
export class Something implements ISomething {
  constructor(private readonly somethingElse: SomethingElse) {}

  public handle(x: X) {
    // ...impl
    this.somethingElse(...)
  }
}
```

```
type SomethingType = (x: X) => void

const Something = configureDependencies("Something", {somethingElse: SomethingElse},
  ({somethingElse}: {somethingElse: SomethingElse}): SomethingType =>
    x => {  // type of X is inferred by SomethingType
      // ...impl
      somethingElse(...)
    }
)
export default Something // we export separately because then the function will be assigned .name "Something"
```

here it gets a bit more hairy, because we loose the "Something" name assignment because we create an anonymous function.
(alternative would be to pass it a named `function Something()` instead)
