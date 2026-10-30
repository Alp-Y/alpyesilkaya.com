// The finishing layer: pets and birds, the words of the day, and a last helping of places.
(() => {
const { art, ink: I, SCENES, NOTES } = window.STICKERS;
const W = "#fff6dc", RED = "#d6432c", BLUE = "#3350b0", LEAF = "#4f8a3f", GOLD = "#f2ae14", DARK = "#7a4a26", TEAL = "#2c9c98", ORANGE = "#f28a1e";
const eye = (x, y, c = I) => `<circle cx="${x}" cy="${y}" r="2.800" fill="${c}" stroke="none"/>`;

/* faces for profile pictures */
const catFace = (fur, inner, mark = "", eyes = I) => `<path d="M22 44L18 12l22 14c7-2 13-2 20 0l22-14-4 32c4 8 4 18-2 26-7 10-18 14-26 14s-19-4-26-14c-6-8-6-18-2-26z" fill="${fur}"/><path d="M23 18l12 10-10 8zM77 18L65 28l10 8z" fill="${inner}" stroke="none"/>${mark}${eye(38, 52, eyes)}${eye(62, 52, eyes)}<path d="M46 62h8l-4 4zM50 66c-2 4-6 5-9 3M50 66c2 4 6 5 9 3M20 58l13 2M20 66l13-2M80 58l-13 2M80 66l-13-2" fill="${I}" stroke-width="2"/>`;
const dogFace = (fur, ear, mark = "") => `<path d="M26 40c4-18 44-18 48 0 6 10 6 24 0 34-6 10-16 14-24 14s-18-4-24-14c-6-10-6-24 0-34z" fill="${fur}"/>${mark}<ellipse cx="50" cy="66" rx="15" ry="12" fill="${W}"/>${eye(38, 50)}${eye(62, 50)}<path d="M45 60h10l-5 5zM50 65v5M43 72c4 3 10 3 14 0" fill="${I}" stroke-width="2"/>${ear}`;
const owlFace = (body, face, wing = body) => `<path d="M50 10c-22 0-32 18-32 42 0 24 14 38 32 38s32-14 32-38c0-24-10-42-32-42z" fill="${body}"/><path d="M22 18l10 12M78 18L68 30" /><circle cx="37" cy="44" r="14" fill="${face}"/><circle cx="63" cy="44" r="14" fill="${face}"/>${eye(37, 44)}${eye(63, 44)}<path d="M50 50l-5 6h10z" fill="${GOLD}"/><path d="M34 70c3 3 5 3 8 0M46 76c3 3 5 3 8 0M58 70c3 3 5 3 8 0" fill="none" stroke-width="2"/><path d="M20 48c-6 14-4 28 6 34M80 48c6 14 4 28-6 34" fill="${wing}"/>`;
const songbird = (body, belly) => `<path d="M24 56c0-20 16-32 34-30 16 2 26 14 24 30-2 14-16 24-32 24-16 0-26-10-26-24z" fill="${body}"/><path d="M34 62c6 12 22 16 34 8-2-12-14-20-26-18-4 2-8 6-8 10z" fill="${belly}"/><path d="M24 44l-16-2 15 10z" fill="${GOLD}"/><path d="M76 50l18-6-8 18z" fill="${body}"/>${eye(38, 42)}<path d="M46 80v10M56 80v10" fill="none"/>`;

/* whole animals for the opening and the visitors, all facing left */
const walkCat = (fur, tail, mark = "", eyes = I) => `<path d="M82 56c12-6 12-22 4-30" fill="none" stroke="${tail}" stroke-width="7"/><path d="M26 56c0-10 14-14 30-14 16 0 30 6 30 18v24h-9V70H42v14h-9V70c-4-3-7-8-7-14z" fill="${fur}"/><path d="M14 34L12 14l12 8c6-2 10-2 16 0l12-8-2 20c3 6 2 14-3 19-5 4-11 6-15 6s-11-2-15-6c-5-5-5-13-3-19z" fill="${fur}"/>${mark}${eye(25, 36, eyes)}${eye(39, 36, eyes)}<path d="M30 44h4l-2 3z" fill="${I}" stroke-width="1.500"/>`;
const flyParrot = (body, wing, tail) => `<path d="M60 54l34 20-8-16 12 2-26-18z" fill="${tail}"/><path d="M14 44c4-16 22-22 38-16 12 4 20 14 20 24-14 8-40 8-58-8z" fill="${body}"/><path d="M42 40C34 24 42 8 60 2c6 14 2 32-6 42z" fill="${wing}"/><path d="M14 44c-6-2-8 6-4 10 4 1 8-3 8-7z" fill="${GOLD}"/><circle cx="24" cy="38" r="4.500" fill="${W}"/>${eye(24, 38)}`;
const flySmall = (body) => `<path d="M18 50c6-12 22-16 34-10 8 4 14 12 16 18-14 8-36 6-50-8z" fill="${body}"/><path d="M40 42C34 28 42 14 56 8c4 12 2 26-6 36z" fill="${body}"/><path d="M66 56l22 8-10-16z" fill="${body}"/><path d="M18 50l-12 2 10 6z" fill="${GOLD}"/>${eye(28, 44)}`;

Object.assign(art, {
siamese: catFace("#f0e4cc", "#5a4034", `<path d="M36 62c4-8 24-8 28 0-2 10-26 10-28 0z" fill="#5a4034" stroke="none"/>`, "#3f8fd0"),
tabby: catFace("#c98f52", "#ef9a9a", `<path d="M44 20l2 12M50 18v14M56 20l-2 12M24 46l8 2M76 46l-8 2" fill="none" stroke="${DARK}" stroke-width="3"/>`),
ginger: catFace("#ef9a3f", "#f7c9a0", `<path d="M46 22l2 10M54 22l-2 10" fill="none" stroke="#b4621c" stroke-width="3"/>`),
blackCat: catFace("#30303c", "#ef9a9a", "", "#f2ae14"),
whiteCat: catFace("#fbf4e4", "#ef9a9a", "", "#47925a"),
persian: catFace("#c9c5cf", "#ef9a9a", `<path d="M20 60c-6 8-2 18 6 20M80 60c6 8 2 18-6 20" fill="#c9c5cf"/>`),
tuxedo: catFace("#30303c", "#ef9a9a", `<path d="M38 60c4 12 20 12 24 0-2-8-22-8-24 0z" fill="#fbf4e4" stroke="none"/>`, "#8cc06a"),
shiba: dogFace("#e0a35a", `<path d="M28 34L24 12l18 12zM72 34l4-22-18 12z" fill="#e0a35a"/>`),
corgi: dogFace("#e8a452", `<path d="M26 36L18 8l22 14zM74 36l8-28-22 14z" fill="#e8a452"/>`, `<path d="M50 28v22" stroke="${W}" stroke-width="8"/>`),
husky: dogFace("#8a939c", `<path d="M28 34L22 10l20 14zM72 34l6-24-20 14z" fill="#8a939c"/>`, `<path d="M32 44c6-8 12-4 18 4 6-8 12-12 18-4-2 10-10 12-18 12s-16-2-18-12z" fill="${W}" stroke="none"/>`),
golden: dogFace("#e6bb6e", `<path d="M26 36c-14 6-14 28-4 32 6-2 8-16 8-26zM74 36c14 6 14 28 4 32-6-2-8-16-8-26z" fill="#d49f4e"/>`),
dachshund: dogFace("#8a5430", `<path d="M26 36c-12 8-12 34-2 38 6-4 8-22 6-34zM74 36c12 8 12 34 2 38-6-4-8-22-6-34z" fill="#5f3820"/>`),
pug: dogFace("#e3cda4", `<path d="M28 32c-10 2-12 14-6 18 6-2 8-10 8-16zM72 32c10 2 12 14 6 18-6-2-8-10-8-16z" fill="#3a3030"/>`, `<ellipse cx="50" cy="62" rx="20" ry="16" fill="#3a3030" stroke="none"/>`),
dalmatian: dogFace("#fbf4e4", `<path d="M26 36c-12 8-12 30-2 34 6-4 8-20 6-32zM74 36c12 8 12 30 2 34-6-4-8-20-6-32z" fill="#30303c"/>`, `<circle cx="40" cy="34" r="4" fill="#30303c" stroke="none"/><circle cx="62" cy="30" r="3" fill="#30303c" stroke="none"/><circle cx="68" cy="58" r="3" fill="#30303c" stroke="none"/>`),
owl: owlFace("#a9794a", "#f1e2c2"),
snowyOwl: owlFace("#f5f1e4", "#ffffff", "#dcd8ca"),
barnOwl: owlFace("#d9a860", "#fbf4e4"),
budgie: songbird("#7ccf5a", "#f6e27a"),
blueBird: songbird(BLUE, "#f3b48a"),
robin: songbird("#8a6a4c", "#e4693c"),
canary: songbird("#f6d13f", "#fbe88e"),
peacock: `<path d="M50 88C8 84 2 40 22 18c12 6 22 20 28 40 6-20 16-34 28-40 20 22 14 66-28 70z" fill="${TEAL}"/><circle cx="24" cy="44" r="6" fill="${GOLD}"/><circle cx="76" cy="44" r="6" fill="${GOLD}"/><circle cx="50" cy="26" r="6" fill="${GOLD}" transform="translate(0 8)"/><path d="M44 88c-2-20 0-34 6-44 6 10 8 24 6 44z" fill="${BLUE}"/><circle cx="50" cy="42" r="8" fill="${BLUE}"/>${eye(47, 41)}<path d="M50 34v-8" />`,
walkCheetah: art.cheetah,
walkGinger: walkCat("#ef9a3f", "#ef9a3f", `<path d="M56 44v10M66 44v10" fill="none" stroke="#b4621c" stroke-width="3"/>`),
walkSiamese: walkCat("#f0e4cc", "#5a4034", `<path d="M20 38c4-5 20-5 24 0-2 12-22 12-24 0z" fill="#5a4034" stroke="none"/>`, "#3f8fd0"),
walkBlack: walkCat("#30303c", "#30303c", "", "#f2ae14"),
flyRed: flyParrot(RED, BLUE, GOLD),
flyBlue: flyParrot(BLUE, GOLD, LEAF),
flyGreen: flyParrot(LEAF, RED, BLUE),
flyPink: flySmall("#ef9a9a"),
flyGold: flySmall(GOLD),
flyTeal: flySmall(TEAL),
});

Object.assign(NOTES, {
walkGinger: "Around four in five ginger cats are male.", peacock: "Only male peafowl have the huge tail fan.", owl: "Owls can turn their heads about 270 degrees.",
});

/* a Turkish and Ukrainian word for each day */
window.DAILY_WORDS = [
["Merhaba", "Привіт", "Hello"], ["Teşekkürler", "Дякую", "Thank you"], ["Günaydın", "Доброго ранку", "Good morning"], ["İyi geceler", "На добраніч", "Good night"],
["Seni seviyorum", "Я тебе кохаю", "I love you"], ["Yolculuk", "Подорож", "Journey"], ["Deniz", "Море", "Sea"], ["Güneş", "Сонце", "Sun"], ["Ay", "Місяць", "Moon"],
["Yıldız", "Зірка", "Star"], ["Ev", "Дім", "Home"], ["Kedi", "Кіт", "Cat"], ["Köpek", "Собака", "Dog"], ["Kuş", "Птах", "Bird"], ["Çay", "Чай", "Tea"], ["Kahve", "Кава", "Coffee"],
["Dağ", "Гора", "Mountain"], ["Çiçek", "Квітка", "Flower"], ["Mutluluk", "Щастя", "Happiness"], ["Dünya", "Світ", "World"], ["Birlikte", "Разом", "Together"],
];

SCENES.push(
["Istanbul's street cats",41.03,29,"walkGinger",4],["Van cats",38.5,43.4,"whiteCat",3.6],["Aoshima cat island",33.74,132.48,"tabby",3.6],["Siamese cats of Thailand",14.5,100.9,"siamese",3.6],["Kumano owls",33.9,135.8,"owl",4],["Snowy owls of Lapland",68,24.5,"snowyOwl",3.6],["Indian peacocks",26.9,75.8,"peacock",3.4],["Sri Lankan peacocks",6.5,81.3,"peacock",3.8],["Shiba dogs of Nagano",36.6,138.2,"shiba",3.8],["Huskies of Tromsø",69.5,19.5,"husky",3.8],["Corgis of Wales",52.3,-3.8,"corgi",3.4],["Dachshunds of Bavaria",48.1,11.6,"dachshund",3.8],["Canaries of Tenerife",28.3,-16.5,"canary",3.4],["Budgies of the Outback",-25,140,"budgie",3.4],
["Rhodes old town",36.44,28.22,"castle",3.4],["Dolomite peaks",46.5,11.9,"mountain",3.2],["Rothenburg",49.38,10.18,"castle",3.6],["Hallstatt",47.56,13.65,"hut",3.6],["Bergen wharf",60.4,5.32,"hut",3.4],["Cinque Terre",44.13,9.7,"lighthouse",3.6],["Tulum ruins",20.21,-87.43,"mesoamerican",3.6],["Banff bears",51.2,-115.6,"bear",3.6],["Hạ Long kayaks",20.8,107.2,"gondola",3.8],["Zanzibar dhows",-6.2,39.2,"junk",3.4],["Wadi Rum tents",29.5,35.5,"tent",3.6],["Great Ocean Road",-38.66,143.1,"edge",3.4]
);

window.SPOTS.push(
["Istanbul's Balat lanes","Istanbul, Türkiye","turkiye",41.03,28.95,"walkGinger","history city food romantic","Colourful houses, antique shops and more street cats than you can count."],
["Princes' Islands","Istanbul, Türkiye","turkiye",40.86,29.12,"palm","island quiet romantic","Car-free islands of wooden mansions, a short ferry from the city."],
["Bosphorus by ferry","Istanbul, Türkiye","turkiye",41.08,29.05,"tea","still city romantic","Çay and simit on the top deck, between two continents."],
["Cappadocia cave hotel","Nevşehir, Türkiye","turkiye",38.64,34.83,"balloon","romantic history","Sleep in a carved room, then watch balloons from your terrace."],
["Sinop on the Black Sea","Sinop, Türkiye","turkiye",42.02,35.15,"lighthouse","coast quiet history","A calm peninsula town, as far north as Türkiye goes."],
["Uzungöl","Trabzon, Türkiye","turkiye",40.62,40.29,"hut","lake forest romantic","A mountain lake village wrapped in misty green hills."],
["Kyiv's Andriivskyi Descent","Kyiv, Ukraine","ukraine",50.46,30.52,"kyiv","history city","A cobbled artists' street winding below golden domes."],
["Lviv's chocolate workshop","Lviv, Ukraine","ukraine",49.84,24.03,"coffee","food city romantic","Handmade chocolate in a city that takes dessert seriously."],
["Yaremche market and falls","Ivano-Frankivsk, Ukraine","ukraine",48.45,24.55,"falls","hike forest","The Probiy waterfall and Hutsul crafts in the Carpathians."],
["Carpathian high meadows","Zakarpattia, Ukraine","ukraine",48.5,23.5,"hut","quiet forest hike","Wooden churches and cheese-makers on the high meadows."],
["Jeddah Corniche sunset","Jeddah, Saudi Arabia","saudi",21.6,39.11,"lighthouse","coast romantic city","Sea air, the giant fountain and a very long evening walk."],
["Tanomah in the clouds","Asir, Saudi Arabia","saudi",19,42.15,"mountain","mountain quiet hike","Juniper forests and cool air high above the Red Sea plain."],
["Duba's coast","Tabuk, Saudi Arabia","saudi",27.35,35.7,"turtle","coast dive quiet","A quiet stretch of northern Red Sea, with old forts nearby."],
["Thadiq escape","Riyadh Province, Saudi Arabia","saudi",25.3,45.87,"dune","hike still","Rock pools and ridges an easy drive from Riyadh."],
["Seoul's hanok lanes","Seoul, South Korea","asia",37.58,126.98,"pagoda","history city food","Tea houses in old wooden homes around Bukchon."],
["Taipei night markets","Taipei, Taiwan","asia",25.03,121.56,"dumplings","food city","Soup dumplings, bubble tea and hot springs up the hill."],
["Kampot pepper farms","Kampot, Cambodia","asia",10.6,104.18,"tea","food quiet","Slow river town, famous for its peppercorns."],
["Hoi An lantern evening","Quảng Nam, Vietnam","asia",15.88,108.33,"junk","history romantic food","Tailors, lanterns on the river and cao lầu noodles."],
["Cat island of Aoshima","Ehime, Japan","asia",33.74,132.48,"tabby","wild island quiet","A tiny fishing island where cats far outnumber people."],
["Sicily's baroque towns","Sicily, Italy","europe",36.89,14.73,"library","food history romantic","Noto, Modica chocolate and cannoli in the sun."],
["Provence lavender road","Provence, France","europe",43.84,5.7,"tulips","food romantic quiet","Purple fields in early summer, markets all year."],
["Bled's cream cake","Upper Carniola, Slovenia","europe",46.37,14.11,"castle","food lake romantic","Row to the island church, then order the famous kremšnita."],
["Tuscany by Vespa","Tuscany, Italy","europe",43.35,11.3,"wine","food romantic","Cypress roads, hill towns and long lunches."],
["Reykjavík to the Blue Lagoon","Reykjanes, Iceland","europe",63.88,-22.45,"terraces","still volcano romantic","Milky blue geothermal water in a lava field."],
["Sintra's palaces","Lisbon, Portugal","europe",38.79,-9.39,"castle","history forest romantic","Fairy-tale palaces in misty hills."],
["Chiang Rai's white temple","Chiang Rai, Thailand","asia",19.82,99.76,"stupa","history quiet","A dazzling modern temple in the far north."],
["Kerala houseboat","Alappuzha, India","asia",9.5,76.34,"gondola","still food romantic","Drift through palm-lined backwaters with a cook on board."],
["Stone Town evenings","Zanzibar, Tanzania","africa",-6.16,39.19,"coral","history food city","Carved doors, spice markets and night food stalls."],
["Essaouira's windy ramparts","Morocco","africa",31.51,-9.77,"lighthouse","coast food quiet","Blue boats, grilled fish and sea walls."],
["Lake Malawi beach lodge","Malawi","africa",-13.7,34.6,"fish","dive still quiet","A freshwater sea full of colourful cichlids."],
["New Orleans jazz nights","Louisiana, USA","americas",29.95,-90.07,"coffee","food city","Beignets by day, brass bands by night."],
["Cartagena rooftops","Bolívar, Colombia","americas",10.42,-75.55,"parrot","history romantic food","Bougainvillea balconies and warm Caribbean evenings."],
["Hobbiton and Waitomo glowworms","Waikato, New Zealand","oceania",-38.26,175.1,"hut","cave romantic","A film set by day and caves lit by glowworms."]
);
})();
