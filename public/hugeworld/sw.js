// Offline support. The build fills in VERSION and FILES.
const VERSION = "64aa9b944f";
const FILES = ["./","index.html","config.js","cloud.js","manifest.webmanifest","world.js","land.js","country.js","facts.js","cities.js","stickers.js","more-scenes.js","home-countries.js","spots.js","boost.js","final.js","vendor/d3.min.js","vendor/supabase.js","icons/icon-180.png","icons/icon-192.png","icons/icon-512.png","regions/afghanistan.json","regions/albania.json","regions/algeria.json","regions/american-samoa.json","regions/andorra.json","regions/angola.json","regions/anguilla.json","regions/antigua-and-barb.json","regions/argentina.json","regions/armenia.json","regions/australia.json","regions/austria.json","regions/azerbaijan.json","regions/bahamas.json","regions/bahrain.json","regions/bangladesh.json","regions/barbados.json","regions/belarus.json","regions/belgium.json","regions/belize.json","regions/benin.json","regions/bermuda.json","regions/bhutan.json","regions/bolivia.json","regions/bosnia-and-herz.json","regions/botswana.json","regions/brazil.json","regions/brunei.json","regions/bulgaria.json","regions/burkina-faso.json","regions/burundi.json","regions/cabo-verde.json","regions/cambodia.json","regions/cameroon.json","regions/canada.json","regions/central-african-rep.json","regions/chad.json","regions/chile.json","regions/china.json","regions/co-te-d-ivoire.json","regions/colombia.json","regions/comoros.json","regions/congo.json","regions/costa-rica.json","regions/croatia.json","regions/cuba.json","regions/cyprus.json","regions/czechia.json","regions/dem-rep-congo.json","regions/denmark.json","regions/djibouti.json","regions/dominica.json","regions/dominican-rep.json","regions/ecuador.json","regions/egypt.json","regions/el-salvador.json","regions/eq-guinea.json","regions/eritrea.json","regions/estonia.json","regions/eswatini.json","regions/ethiopia.json","regions/fiji.json","regions/finland.json","regions/france.json","regions/gabon.json","regions/gambia.json","regions/georgia.json","regions/germany.json","regions/ghana.json","regions/greece.json","regions/greenland.json","regions/grenada.json","regions/guatemala.json","regions/guinea-bissau.json","regions/guinea.json","regions/guyana.json","regions/haiti.json","regions/honduras.json","regions/hong-kong.json","regions/hungary.json","regions/iceland.json","regions/india.json","regions/indonesia.json","regions/iran.json","regions/iraq.json","regions/ireland.json","regions/israel.json","regions/italy.json","regions/jamaica.json","regions/japan.json","regions/jordan.json","regions/kazakhstan.json","regions/kenya.json","regions/kosovo.json","regions/kuwait.json","regions/kyrgyzstan.json","regions/laos.json","regions/latvia.json","regions/lebanon.json","regions/lesotho.json","regions/liberia.json","regions/libya.json","regions/liechtenstein.json","regions/lithuania.json","regions/luxembourg.json","regions/macedonia.json","regions/madagascar.json","regions/malawi.json","regions/malaysia.json","regions/maldives.json","regions/mali.json","regions/malta.json","regions/mauritania.json","regions/mauritius.json","regions/mexico.json","regions/micronesia.json","regions/moldova.json","regions/mongolia.json","regions/montenegro.json","regions/montserrat.json","regions/morocco.json","regions/mozambique.json","regions/myanmar.json","regions/namibia.json","regions/nauru.json","regions/nepal.json","regions/netherlands.json","regions/new-caledonia.json","regions/new-zealand.json","regions/nicaragua.json","regions/niger.json","regions/nigeria.json","regions/north-korea.json","regions/norway.json","regions/oman.json","regions/pakistan.json","regions/palau.json","regions/panama.json","regions/papua-new-guinea.json","regions/paraguay.json","regions/peru.json","regions/philippines.json","regions/poland.json","regions/portugal.json","regions/qatar.json","regions/romania.json","regions/russia.json","regions/rwanda.json","regions/s-sudan.json","regions/sa-o-tome-and-principe.json","regions/saint-helena.json","regions/saint-lucia.json","regions/samoa.json","regions/san-marino.json","regions/saudi-arabia.json","regions/senegal.json","regions/serbia.json","regions/seychelles.json","regions/sierra-leone.json","regions/singapore.json","regions/slovakia.json","regions/slovenia.json","regions/solomon-is.json","regions/somalia.json","regions/south-africa.json","regions/south-korea.json","regions/spain.json","regions/sri-lanka.json","regions/st-kitts-and-nevis.json","regions/st-vin-and-gren.json","regions/sudan.json","regions/suriname.json","regions/sweden.json","regions/switzerland.json","regions/syria.json","regions/taiwan.json","regions/tajikistan.json","regions/tanzania.json","regions/thailand.json","regions/timor-leste.json","regions/togo.json","regions/tonga.json","regions/trinidad-and-tobago.json","regions/tunisia.json","regions/turkey.json","regions/turkmenistan.json","regions/uganda.json","regions/ukraine.json","regions/united-arab-emirates.json","regions/united-kingdom.json","regions/united-states-of-america.json","regions/uruguay.json","regions/uzbekistan.json","regions/vanuatu.json","regions/venezuela.json","regions/vietnam.json","regions/yemen.json","regions/zambia.json","regions/zimbabwe.json"];
const CACHE = `planner-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== location.origin && !isFont) return;   // Supabase always goes to the network

  /* pages: newest when online, saved copy when not */
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("./index.html")));
    return;
  }
  /* everything else: saved copy first, and keep what we fetch (province files, fonts) */
  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      if (res.ok || res.type === "opaque") {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    }))
  );
});
