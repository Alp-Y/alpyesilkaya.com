// Shared storage for the installed app: one Supabase table of JSON documents,
// with a local copy so saved lists still open without a signal.
(() => {
const CACHE_KEY = "planner-docs";

function readCache(storage) {
  try { return JSON.parse(storage.getItem(CACHE_KEY)) || []; } catch { return []; }
}

window.createCloud = function createCloud(client, storage = window.localStorage) {
  let rows = readCache(storage);
  const remember = () => { try { storage.setItem(CACHE_KEY, JSON.stringify(rows)); } catch {} };
  const put = (row) => { rows = rows.filter((r) => !(r.collection === row.collection && r.id === row.id)).concat(row); remember(); };
  const drop = (collection, id) => { rows = rows.filter((r) => !(r.collection === collection && r.id === id)); remember(); };

  return {
    rows: (collection) => rows.filter((r) => r.collection === collection).map((r) => ({ id: r.id, ...r.data })),

    /* true when fresh from the server, false when showing the local copy */
    async load() {
      const { data, error } = await client.from("docs").select("collection,id,data");
      if (error) return false;
      rows = data;
      remember();
      return true;
    },

    async save(collection, { id, ...data }) {
      const { error } = await client.from("docs").upsert({ collection, id, data, updated_at: new Date().toISOString() });
      if (error) throw error;
      put({ collection, id, data });
    },

    async remove(collection, id) {
      const { error } = await client.from("docs").delete().match({ collection, id });
      if (error) throw error;
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
