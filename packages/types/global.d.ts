type Diff<T, U> = T extends U ? never : T
interface FunctionDefinitions { [key: string]: (...args: any[]) => any }

type ReturnTypes<T extends FunctionDefinitions> = {
  [P in keyof T]: ReturnType<T[P]>
}

type FilterFlags<Base, Condition> = {
  [Key in keyof Base]:
  Base[Key] extends Condition ? Key : never
}
type AllowedNames<Base, Condition> =
  FilterFlags<Base, Condition>[keyof Base]

type SubType<Base, Condition> =
  Pick<Base, AllowedNames<Base, Condition>>



// tslint:disable-next-line:ban-types
// type NonFunction<T> = T extends ((...args: any[]) => any) | Function ? never : T
// type SubType<Base, Condition> = Pick<Base, {
//   [Key in keyof Base]: Base[Key] extends Condition ? Key : never
// }[keyof Base]>

// tslint:disable-next-line:ban-types
// type NotMethods<T> = SubType<NonFunction<T>, Function | Date | string | number | undefined | null>
