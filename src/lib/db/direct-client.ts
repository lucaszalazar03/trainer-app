import { asUser } from "./as-user";

/**
 * Adaptador con la MISMA forma que el cliente de supabase-js
 * (supabase.from("tabla").select(...).eq(...)…) pero que corre por la
 * conexión DIRECTA a Postgres, como el usuario logueado y con sus reglas
 * de seguridad (RLS) — ver as-user.ts.
 *
 * Por qué: la API REST de Supabase (PostgREST) se corta seguido por timeout
 * en el plan actual, y cada corte era una pantalla que no abría o un botón
 * que "no hacía nada". Con esto, todas las acciones existentes pasan a la
 * conexión rápida sin reescribir cada consulta a mano.
 *
 * Soporta sólo lo que usa la app: select (con count/head), insert, update,
 * delete, filtros eq/neq/in/is/gte/gt/lte/lt/ilike, order, limit, single y
 * maybeSingle. Igual que supabase-js, NO tira errores: devuelve { error }.
 * Los resultados vienen con el mismo formato que la API REST (fechas en ISO,
 * numeric como número).
 */

type Filter = { col: string; op: string; value: unknown };
type DbError = { message: string; code?: string };
type Result = { data: any; error: DbError | null; count: number | null; status: number; statusText: string }; // eslint-disable-line @typescript-eslint/no-explicit-any

const IDENT = /^[a-z_][a-z0-9_]*$/;
function ident(name: string): string {
  const n = name.trim();
  if (!IDENT.test(n)) throw new Error(`Columna/tabla no permitida: ${name}`);
  return `"${n}"`;
}
function colList(cols: string): string {
  const c = cols.trim();
  if (c === "*" || c === "") return "*";
  return c.split(",").map((x) => ident(x)).join(", ");
}

// Formato igual al de la API REST: timestamptz → ISO, numeric/int8 → número.
function normalizeRow(row: Record<string, unknown>, columns: { name: string; type: number }[]) {
  for (const c of columns) {
    const v = row[c.name];
    if (v == null) continue;
    if (v instanceof Date) row[c.name] = v.toISOString();
    else if ((c.type === 1700 || c.type === 20) && typeof v === "string") row[c.name] = Number(v);
  }
  return row;
}

// La librería postgres serializa cada parámetro según el tipo de la
// columna (jsonb → JSON.stringify), así que los objetos van tal cual.
function toParam(v: unknown): unknown {
  return v === undefined ? null : v;
}

class Query implements PromiseLike<Result> {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private cols = "*";
  private countHead = false;
  private wantCount = false;
  private returning: string | null = null;
  private rows: Record<string, unknown>[] = [];
  private patch: Record<string, unknown> = {};
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private limitN: number | null = null;
  private mode: "many" | "single" | "maybe" = "many";

  constructor(private userId: string, private table: string) {}

  select(cols = "*", opts?: { count?: "exact"; head?: boolean }) {
    if (this.op === "select") {
      this.cols = cols;
      this.wantCount = !!opts?.count;
      this.countHead = !!opts?.head;
    } else {
      this.returning = cols;
    }
    return this;
  }
  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.op = "insert";
    this.rows = Array.isArray(values) ? values : [values];
    return this;
  }
  update(values: Record<string, unknown>) {
    this.op = "update";
    this.patch = values;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(col: string, value: unknown) { this.filters.push({ col, op: "=", value }); return this; }
  neq(col: string, value: unknown) { this.filters.push({ col, op: "<>", value }); return this; }
  gt(col: string, value: unknown) { this.filters.push({ col, op: ">", value }); return this; }
  gte(col: string, value: unknown) { this.filters.push({ col, op: ">=", value }); return this; }
  lt(col: string, value: unknown) { this.filters.push({ col, op: "<", value }); return this; }
  lte(col: string, value: unknown) { this.filters.push({ col, op: "<=", value }); return this; }
  ilike(col: string, value: unknown) { this.filters.push({ col, op: "ilike", value }); return this; }
  in(col: string, values: readonly unknown[]) { this.filters.push({ col, op: "in", value: values }); return this; }
  is(col: string, value: null | boolean) { this.filters.push({ col, op: "is", value }); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending !== false }); return this; }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  private where(params: unknown[]): string {
    if (!this.filters.length) return "";
    const parts = this.filters.map((f) => {
      const c = ident(f.col);
      if (f.op === "in") {
        const arr = f.value as unknown[];
        if (!arr.length) return "false";
        return `${c} in (${arr.map((v) => (params.push(toParam(v)), `$${params.length}`)).join(", ")})`;
      }
      if (f.op === "is") return f.value === null ? `${c} is null` : `${c} is ${f.value ? "true" : "false"}`;
      params.push(toParam(f.value));
      return `${c} ${f.op} $${params.length}`;
    });
    return ` where ${parts.join(" and ")}`;
  }

  private build(): { text: string; params: unknown[] } {
    const t = ident(this.table);
    const params: unknown[] = [];
    if (this.op === "select") {
      if (this.countHead) return { text: `select count(*)::int as count from ${t}${this.where(params)}`, params };
      let text = `select ${colList(this.cols)} from ${t}${this.where(params)}`;
      if (this.orders.length) text += ` order by ${this.orders.map((o) => `${ident(o.col)} ${o.asc ? "asc" : "desc"}`).join(", ")}`;
      if (this.limitN != null) text += ` limit ${Math.max(0, Math.floor(this.limitN))}`;
      return { text, params };
    }
    const ret = this.returning != null ? ` returning ${colList(this.returning)}` : "";
    if (this.op === "insert") {
      const keys = Array.from(new Set(this.rows.flatMap((r) => Object.keys(r))));
      if (!this.rows.length || !keys.length) return { text: `select 1 where false`, params };
      const values = this.rows
        .map((r) => `(${keys.map((k) => (r[k] === undefined ? "default" : (params.push(toParam(r[k])), `$${params.length}`))).join(", ")})`)
        .join(", ");
      return { text: `insert into ${t} (${keys.map(ident).join(", ")}) values ${values}${ret}`, params };
    }
    if (this.op === "update") {
      const keys = Object.keys(this.patch).filter((k) => this.patch[k] !== undefined);
      const set = keys.map((k) => (params.push(toParam(this.patch[k])), `${ident(k)} = $${params.length}`)).join(", ");
      return { text: `update ${t} set ${set}${this.where(params)}${ret}`, params };
    }
    return { text: `delete from ${t}${this.where(params)}${ret}`, params };
  }

  async run(): Promise<Result> {
    try {
      const { text, params } = this.build();
      const res = await asUser(this.userId, (sql) => sql.unsafe(text, params as never[]));
      const columns = (res as unknown as { columns?: { name: string; type: number }[] }).columns ?? [];
      const rows = Array.from(res as unknown as Record<string, unknown>[]).map((r) => normalizeRow({ ...r }, columns));

      if (this.op === "select" && this.countHead) {
        const count = Number(rows[0]?.count ?? 0);
        return { data: null, error: null, count, status: 200, statusText: "OK" };
      }
      const hasReturn = this.op === "select" || this.returning != null;
      let data: unknown = hasReturn ? rows : null;
      if (hasReturn && this.mode !== "many") {
        if (rows.length > 1) return fail("Se esperaba una sola fila", "PGRST116");
        if (rows.length === 0) {
          if (this.mode === "single") return fail("No se encontró la fila", "PGRST116");
          data = null;
        } else data = rows[0];
      }
      const count = this.wantCount ? rows.length : null;
      return { data, error: null, count, status: 200, statusText: "OK" };
    } catch (err) {
      const e = err as { message?: string; code?: string };
      console.error("[db] error", this.table, e?.code, e?.message);
      return fail(e?.message ?? "Error de base de datos", e?.code);
    }
  }

  then<R1 = Result, R2 = never>(
    onfulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

function fail(message: string, code?: string): Result {
  return { data: null, error: { message, code }, count: null, status: 400, statusText: "Error" };
}

export function createDirectClient(userId: string) {
  return {
    from: (table: string) => new Query(userId, table),
    rpc: async (fn: string, args: Record<string, unknown> = {}) => {
      try {
        const keys = Object.keys(args);
        const call = `select * from ${ident(fn)}(${keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(", ")})`;
        const res = await asUser(userId, (sql) => sql.unsafe(call, keys.map((k) => toParam(args[k])) as never[]));
        return { data: Array.from(res as unknown as unknown[]), error: null };
      } catch (err) {
        return { data: null, error: { message: (err as Error).message } };
      }
    },
  };
}
