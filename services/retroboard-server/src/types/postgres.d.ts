// The postgres library's TransactionSql type loses its call signatures
// because it uses Omit<Sql, ...>, and TypeScript's Omit drops call signatures.
// This augmentation restores the tagged-template call signature on TransactionSql.
import postgres from 'postgres';

declare module 'postgres' {
  interface TransactionSql<TTypes extends Record<string, unknown> = Record<string, never>> {
    <T extends readonly (object | undefined)[] = postgres.Row[]>(
      template: TemplateStringsArray,
      ...parameters: readonly (postgres.ParameterOrFragment<TTypes[keyof TTypes]>)[]
    ): postgres.PendingQuery<T>;
  }
}
