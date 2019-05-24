declare module "joi-to-json-schema" {
  function index(joi: any, ...args: any[]): any;
  namespace index {
    namespace TYPES {
      function alternatives(schema: any, joi: any, transformer: any): any;
      function any(schema: any): any;
      function array(schema: any, joi: any, transformer: any): any;
      function binary(schema: any, joi: any): any;
      function boolean(schema: any): any;
      function date(schema: any, joi: any): any;
      function number(schema: any, joi: any): any;
      function object(schema: any, joi: any, transformer: any): any;
      function string(schema: any, joi: any): any;
    }
  }
  export = index
}
