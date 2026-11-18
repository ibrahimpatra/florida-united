/** Minimal in-memory Firestore for testing the order engine. Mirrors the rules that bit us: reads before writes in transactions. */
const kind = (v: any) => (v && typeof v === 'object' ? v.constructor?.name : '');
const clone = (v: any): any => (v && typeof v === 'object' && !Array.isArray(v) && !kind(v).includes('Transform') ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : Array.isArray(v) ? v.map(clone) : v);

function applyWrite(cur: any, patch: any, merge: boolean) {
  const out: any = merge ? clone(cur || {}) : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) throw new Error(`Firestore: undefined value for "${k}"`);
    const kk = kind(v);
    if (kk === 'NumericIncrementTransform') out[k] = (Number(out[k]) || 0) + (v as any).operand;
    else if (kk === 'ServerTimestampTransform') out[k] = new Date().toISOString();
    else if (kk === 'ArrayRemoveTransform') out[k] = (out[k] || []).filter((e: any) => !(v as any).elements.includes(e));
    else if (kk === 'ArrayUnionTransform') out[k] = [...(out[k] || []), ...(v as any).elements.filter((e: any) => !(out[k] || []).includes(e))];
    else out[k] = clone(v);
  }
  return out;
}

export class FakeDb {
  data = new Map<string, Map<string, any>>();
  private col(n: string) { if (!this.data.has(n)) this.data.set(n, new Map()); return this.data.get(n)!; }
  seed(c: string, id: string, d: any) { this.col(c).set(id, clone(d)); }
  read(c: string, id: string) { return this.col(c).get(id); }
  collection(n: string) { return new FakeCol(this, n); }
  doc(path: string) { const [c, id] = path.split('/'); return new FakeRef(this, c, id); }
  async getAll(...refs: FakeRef[]) { return refs.map(r => r.snap()); }
  batch() { const ops: (() => void)[] = []; const b: any = {
    delete: (r: FakeRef) => { ops.push(() => r._delete()); return b; }, update: (r: FakeRef, d: any) => { ops.push(() => r._update(d)); return b; }, set: (r: FakeRef, d: any, o?: any) => { ops.push(() => r._set(d, o)); return b; },
    commit: async () => ops.forEach(f => f()) }; return b; }
  async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const writes: (() => void)[] = []; let wrote = false;
    const guard = () => { if (wrote) throw new Error('Firestore transactions require all reads to be executed before all writes.'); };
    const tx: any = {
      get: async (r: any) => { guard(); return r instanceof FakeQuery ? r.get() : r.snap(); },
      getAll: async (...refs: FakeRef[]) => { guard(); return refs.map(r => r.snap()); },
      set: (r: FakeRef, d: any, o?: any) => { wrote = true; writes.push(() => r._set(d, o)); return tx; },
      update: (r: FakeRef, d: any) => { wrote = true; writes.push(() => r._update(d)); return tx; },
      create: (r: FakeRef, d: any) => { wrote = true; writes.push(() => { if (r.snap().exists) throw new Error('ALREADY_EXISTS'); r._set(d); }); return tx; },
      delete: (r: FakeRef) => { wrote = true; writes.push(() => r._delete()); return tx; },
    };
    const res = await fn(tx); writes.forEach(f => f()); return res;
  }
}
class FakeSnap { constructor(public ref: FakeRef, private d: any) {} get exists() { return this.d !== undefined; } get id() { return this.ref.id; } data() { return this.d === undefined ? undefined : clone(this.d); } }
class FakeRef {
  constructor(private db: FakeDb, public col: string, public id: string) {}
  snap() { return new FakeSnap(this, this.db.read(this.col, this.id)); }
  async get() { return this.snap(); }
  async set(d: any, o?: any) { this._set(d, o); }
  async update(d: any) { this._update(d); }
  async delete() { this._delete(); }
  _set(d: any, o?: any) { (this.db as any).col(this.col).set(this.id, applyWrite(this.db.read(this.col, this.id), d, !!o?.merge)); }
  _update(d: any) { if (!this.snap().exists) throw new Error(`NOT_FOUND: ${this.col}/${this.id}`); (this.db as any).col(this.col).set(this.id, applyWrite(this.db.read(this.col, this.id), d, true)); }
  _delete() { (this.db as any).col(this.col).delete(this.id); }
}
class FakeQuery {
  constructor(protected db: FakeDb, protected c: string, protected filters: [string, any, string][] = [], protected n = Infinity) {}
  where(f: string, op: string, v: any) { if (op !== '==' && op !== 'array-contains') throw new Error('fake: only == and array-contains'); return new FakeQuery(this.db, this.c, [...this.filters, [f, v, op]], this.n); }
  limit(n: number) { return new FakeQuery(this.db, this.c, this.filters, n); }
  async get() {
    const docs = [...(this.db as any).col(this.c).entries()].filter(([, d]) => this.filters.every(([f, v, op]) => op === 'array-contains' ? Array.isArray(d[f]) && d[f].includes(v) : d[f] === v)).slice(0, this.n)
      .map(([id]) => new FakeSnap(new FakeRef(this.db, this.c, id), this.db.read(this.c, id)));
    return { docs, empty: docs.length === 0, size: docs.length };
  }
}
class FakeCol extends FakeQuery {
  constructor(db: FakeDb, c: string) { super(db, c); }
  doc(id?: string) { return new FakeRef(this.db, this.c, id || `auto${Math.random().toString(36).slice(2, 10)}`); }
  async add(d: any) { const r = this.doc(); r._set(d); return r; }
}
