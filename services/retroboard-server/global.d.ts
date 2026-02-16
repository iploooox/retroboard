// Override fetch Response.json() to return any instead of unknown
interface Body {
  json<T = any>(): Promise<T>;
}
