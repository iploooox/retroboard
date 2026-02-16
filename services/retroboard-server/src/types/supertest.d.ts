import 'supertest';

declare module 'supertest' {
  interface Response {
    body: unknown;
  }
}
