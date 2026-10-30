// Shared storage for the installed app: one Supabase table of JSON documents,
// with a local copy so saved lists still open without a signal, and a queue so
// anything added offline goes up once the phone reconnects.
(() => {
const CACHE_KEY = "planner-docs", QUEUE_KEY = "planner-queue";

function readJson(storage, key) {
  try { return JSON.parse(storage.getItem(key)) || []; } catch { return []; }
}
const looksOffline = (error) => globalThis.navigator?.onLine === false || /fetch|network/i.test(error?.message || "");

window.createCloud = function createCloud(client, storage = window.localStorage) {
  let rows = readJson(storage, CACHE_KEY);
  let queue = readJson(storage, QUEUE_KEY);
  const write = (key, value) => { try { storage.setItem(key, JSON.stringify(value)); } catch {} };
  const remember = () => write(CACHE_KEY, rows);
  const put = (row) => { rows = rows.filter((r) => !(r.collection === row.collection && r.id === row.id)).concat(row); remember(); };
  const drop = (collection, id) => { rows = rows.filter((r) => !(r.collection === collection && r.id === id)); remember(); };

  const send = async (op) => {
    if (op.kind === "save") {
      const { collection, id, data } = op;
      return client.from("docs").upsert({ collection, id, data, updated_at: new Date().toISOString() });
    }
    return client.from("docs").delete().match({ collection: op.collection, id: op.id });
  };
  /* try now; if the phone is offline, keep it for later and carry on */
  const attempt = async (op) => {
    const { error } = await send(op);
    if (!error) return;
    if (!looksOffline(error)) throw error;
    queue.push(op);
    write(QUEUE_KEY, queue);
  };

  return {
    rows: (collection) => rows.filter((r) => r.collection === collection).map((r) => ({ id: r.id, ...r.data })),
    pending: () => queue.length,

    /* true when fresh from the server, false when showing the local copy */
    async load() {
      await this.flush();
      const { data, error } = await client.from("docs").select("collection,id,data");
      if (error) return false;
      rows = data;
      /* anything still queued stays visible on top of what the server sent */
      for (const op of queue) if (op.kind === "save") put(op); else drop(op.collection, op.id);
      remember();
      return true;
    },

    async flush() {
      while (queue.length) {
        const { error } = await send(queue[0]);
        if (error && looksOffline(error)) return false;
        queue = queue.slice(1);          // a rejected write can never succeed, so don't retry it forever
        write(QUEUE_KEY, queue);
      }
      return true;
    },

    async save(collection, { id, ...data }) {
      await attempt({ kind: "save", collection, id, data });
      put({ collection, id, data });
    },

    async remove(collection, id) {
      await attempt({ kind: "remove", collection, id });
      drop(collection, id);
    },

    /* onChange(type, collection, doc) fires for changes from any device */
    subscribe(onChange) {
      const channel = client.channel("docs-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "docs" }, (change) => {
          if (change.eventType === "DELETE") {
            const { collection, id } = change.old;
            if (collection === undefined) return;
            drop(collection, id);
            onChange("DELETE", collection, { id });
          } else {
            const { collection, id, data } = change.new;
            const known = rows.some((r) => r.collection === collection && r.id === id);
            put({ collection, id, data });
            onChange(known ? "UPDATE" : "INSERT", collection, { id, ...data });
          }
        })
        .subscribe();
      return () => client.removeChannel(channel);
    },
  };
};
})();
