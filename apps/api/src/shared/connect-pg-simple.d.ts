declare module "connect-pg-simple" {
  interface ConnectPgSimpleOptions {
    pool?: import("pg").Pool;
    tableName?: string;
    schemaName?: string;
    pruneSessionInterval?: number | false;
  }

  function connectPgSimple(
    session: typeof import("express-session"),
  ): new (options?: ConnectPgSimpleOptions) => import("express-session").Store;

  export default connectPgSimple;
}
