// Deeper learning content: story chapters at two reading depths, harder questions,
// dated events for timeline games, and statements for Fact or Fiction.
(() => {
const L = window.LESSONS;
const hard = (track, rows) => L[track].questions.push(...rows.map((r) => Object.assign(r, { hard: true })));

L.turkiye.stories = [
  { title: "The first temples", kind: "heads", short: "Long before cities, people in Anatolia built stone temples at Göbeklitepe. Later, at Çatalhöyük, thousands lived in a town with no streets.",
    deep: "Around 9500 BC, hunter-gatherers raised huge T-shaped pillars at Göbeklitepe, carved with foxes, snakes and vultures. It upended the old idea that farming came before monuments: here, building may have come first. A few thousand years later, Çatalhöyük grew into one of the earliest large towns. Its people entered their homes through the roof, plastered their walls with hunting scenes, and buried their dead beneath the floors." },
  { title: "Hittites, Greeks and Romans", kind: "library", short: "The Hittites ruled from Hattusa. Greek cities lined the coast, and Rome later made Ephesus one of its greatest cities.",
    deep: "The Hittites ruled central Anatolia from Hattusa in the Bronze Age and signed one of the world's oldest surviving peace treaties, with Egypt. Greek colonies later spread along the Aegean, giving us Troy's legend, Ephesus, and the philosophers of Miletus. Under Rome, Ephesus became a great port of hundreds of thousands, and Constantine moved his capital to the Bosphorus in 330, creating Constantinople." },
  { title: "Seljuks and Ottomans", kind: "mosque", short: "After 1071 the Seljuks settled Anatolia. The Ottomans rose around 1299, took Constantinople in 1453 and ruled for six centuries.",
    deep: "Victory at Manzikert in 1071 opened Anatolia to the Seljuk Turks, who built caravanserais and the great mosques of Konya, where Rumi taught. From a small state founded by Osman around 1299, the Ottomans grew to take Constantinople in 1453. Under Suleiman the Magnificent their empire reached from Hungary to Yemen, and the architect Mimar Sinan filled Istanbul with domes that still define its skyline." },
  { title: "The Republic", kind: "tower", short: "After World War I, Mustafa Kemal led a war of independence. The Republic of Türkiye was founded in 1923 with Ankara as its capital.",
    deep: "Defeat in World War I left the Ottoman Empire occupied and divided. Mustafa Kemal, hero of Gallipoli, organised resistance from Anatolia and won the War of Independence. The Treaty of Lausanne recognised the new borders, and the Republic was declared on 29 October 1923. Reforms followed quickly: a new alphabet in 1928, new laws, and voting rights for women in national elections in 1934." },
];
L.ukraine.stories = [
  { title: "Before Rus", kind: "pysanka", short: "The Trypillian people farmed Ukraine's rich soil over 5,000 years ago. Later came Scythians and Greek colonies on the Black Sea.",
    deep: "From about 5000 BC the Trypillian culture built some of the largest settlements in the world on Ukraine's black earth, decorating pottery with spirals that still echo in folk art. Scythian horsemen later ruled the steppe and left astonishing gold work, while Greek colonies like Olbia traded grain across the Black Sea." },
  { title: "Kyivan Rus", kind: "kyiv", short: "Kyiv became the capital of a great medieval state. Volodymyr adopted Christianity in 988 and Yaroslav the Wise built Saint Sophia.",
    deep: "By the 9th century Kyiv controlled the trade route from the Baltic to Constantinople. Volodymyr the Great adopted Christianity in 988, tying Rus to the Byzantine world. His son Yaroslav the Wise gave the state a law code, built Saint Sophia Cathedral and married his daughters into the royal houses of Europe. Mongol armies sacked Kyiv in 1240, and power shifted west to Halych-Volhynia, where King Danylo founded Lviv." },
  { title: "The Cossacks", kind: "horse", short: "Free warriors formed the Zaporizhian Sich on the Dnipro. In 1648 Bohdan Khmelnytsky's uprising created a Cossack state.",
    deep: "On the wild steppe beyond the Dnipro rapids, free men formed the Zaporizhian Sich, electing their leaders in open council. In 1648 Bohdan Khmelnytsky led a huge uprising and founded the Hetmanate, a self-governing Ukrainian state. In 1710 Hetman Pylyp Orlyk wrote a constitution that divided power between branches of government, one of the earliest of its kind in Europe." },
  { title: "A nation's voice", kind: "sunflower", short: "Taras Shevchenko's poetry gave Ukrainians a voice. The 20th century brought independence hopes, the Holodomor and finally freedom in 1991.",
    deep: "Born a serf, Taras Shevchenko published Kobzar in 1840 and gave the Ukrainian language a national voice. A short-lived independent republic rose in 1917. Under Soviet rule, millions died in the Holodomor of 1932–33, a famine caused by Stalin's policies. Chornobyl in 1986 deepened distrust of Moscow, and in 1991 Ukrainians voted overwhelmingly for independence. The Orange Revolution and the Revolution of Dignity showed how fiercely they would defend it." },
];
L.world.stories = [
  { title: "Rivers and first cities", kind: "pyramids", short: "Civilisation grew along great rivers: the Nile, Tigris, Indus and Yellow River. Writing and cities followed.",
    deep: "Reliable harvests along rivers let people settle, trade and specialise. In Mesopotamia, Sumerians pressed writing into clay around 3200 BC; in Egypt, the Old Kingdom raised the pyramids of Giza; the Indus cities laid out drains on a grid; and along the Yellow River, Chinese writing took shape on oracle bones." },
  { title: "Roads between worlds", kind: "camel", short: "The Silk Road and Indian Ocean winds carried silk, spices, religions and ideas between continents.",
    deep: "For over a thousand years, caravans crossed Central Asia and sailors rode the monsoon winds. Paper, compasses and gunpowder moved west from China; glass and astronomy travelled east. Cities like Samarkand, Baghdad and Constantinople grew rich at the crossroads, and Buddhism and Islam spread along the same routes." },
  { title: "A connected planet", kind: "lighthouse", short: "From 1492, ocean voyages linked the continents, bringing trade and exchange, but also conquest and slavery.",
    deep: "Printing spread knowledge from the 1450s, and ocean voyages joined the world's continents. Crops like potatoes and maize changed diets everywhere, but conquest, disease and the transatlantic slave trade brought immense suffering. Later, steam engines and telegraph lines shrank distances, and the 20th century's world wars and the fall of the Berlin Wall in 1989 reshaped the map." },
];
L.geography.stories = [
  { title: "The Black Sea between us", kind: "lighthouse", short: "The Black Sea links Türkiye and Ukraine. Rivers pour in from Europe, and the Bosphorus connects it to the Mediterranean.",
    deep: "The Danube, Dnipro and Dniester all empty into the Black Sea, whose deep waters hold almost no oxygen and preserve ancient shipwrecks remarkably well. Its only exit is the Bosphorus, a narrow strait through Istanbul. Sailors once called it the hospitable sea, and traders, Greeks, Cossacks and Ottomans all crossed it." },
  { title: "Deserts, oases and monsoons", kind: "dune", short: "Deserts form where dry air sinks. Oases appear where underground water reaches the surface.",
    deep: "Around 30 degrees north and south of the equator, dry air sinks and creates the great deserts, from the Sahara to the Rub' al Khali of Arabia. Ancient water lies in rock far below, surfacing at oases like Al-Ahsa. Elsewhere, monsoon winds reverse with the seasons, bringing life to southern Oman and India." },
  { title: "How mountains grow", kind: "mountain", short: "Mountains rise when Earth's plates collide. The Himalayas are still growing today.",
    deep: "The Earth's crust is broken into plates that drift a few centimetres a year. When India struck Asia, it pushed up the Himalayas, which are still rising. Anatolia sits on a plate squeezed westward, which is why Türkiye has so many earthquakes, and the Carpathians curve across Ukraine where older plates met." },
];

hard("turkiye", [
  ["Which architect designed Istanbul's Süleymaniye Mosque?", "Mimar Sinan", "Mehmed Ağa", "Isidore of Miletus", "Sinan served as chief architect for almost fifty years.", "Selimiye Mosque", "Edirne, Türkiye", 41.68, 26.56, "mosque"],
  ["In which year did Turkish women gain the vote in national elections?", "1934", "1923", "1960", "That was earlier than women in France or Italy.", null],
  ["Which sultan's reign ended the Janissary corps in 1826?", "Mahmud II", "Abdülhamid II", "Selim I", "It's known as the Auspicious Incident.", null],
  ["With whom did the Hittites sign an early peace treaty?", "Ramesses II of Egypt", "Darius of Persia", "Alexander the Great", "A copy hangs in the United Nations.", "Hattusa", "Çorum, Türkiye", 40.02, 34.62, "library"],
  ["When did Constantine make Constantinople his capital?", "330", "1071", "44 BC", "He rebuilt the old Greek town of Byzantium.", null],
  ["Which Seljuk capital held the great Alaeddin Mosque?", "Konya", "Edirne", "Izmir", "Konya was the heart of the Sultanate of Rum.", "Alaeddin Hill", "Konya, Türkiye", 37.87, 32.49, "mosque"],
]);
hard("ukraine", [
  ["When did the Mongols sack Kyiv?", "1240", "988", "1648", "The city took centuries to recover its old importance.", null],
  ["In which year did the Ukrainian People's Republic proclaim independence?", "1918", "1991", "1945", "It declared full independence in January 1918, before being overrun.", null],
  ["Who was the historian and first head of the Central Rada?", "Mykhailo Hrushevsky", "Ivan Franko", "Symon Petliura", "His history of Ukraine-Rus shaped national identity.", null],
  ["Which poet wrote The Forest Song?", "Lesya Ukrainka", "Ivan Kotliarevsky", "Lina Kostenko", "She's one of Ukraine's most loved writers, and appears on the 200-hryvnia note.", null],
  ["Which book by Ivan Kotliarevsky began modern Ukrainian literature in 1798?", "Eneida", "Kobzar", "Zakhar Berkut", "It retold the Aeneid with Cossacks in place of Trojans.", null],
  ["What's Pechersk Lavra in Kyiv best known for?", "Its cave monastery", "A royal palace", "A Cossack fort", "Monks have lived in its tunnels since the 11th century.", "Pechersk Lavra", "Kyiv, Ukraine", 50.43, 30.56, "kyiv"],
]);
hard("world", [
  ["Who pressed the earliest known writing into clay?", "The Sumerians", "The Phoenicians", "The Minoans", "Cuneiform began as record-keeping around 3200 BC.", null],
  ["Which city was the Abbasid capital?", "Baghdad", "Cairo", "Córdoba", "Its House of Wisdom gathered scholars from across the world.", null],
  ["In which year did the Meiji Restoration begin in Japan?", "1868", "1603", "1945", "It ended the rule of the shoguns and started rapid modernisation.", null],
  ["Who led the first expedition to sail around the world?", "Ferdinand Magellan", "Marco Polo", "James Cook", "He died on the way, and Juan Sebastián Elcano finished the voyage.", null],
  ["Which empire built Great Zimbabwe's stone walls?", "The Shona people's kingdom", "The Roman Empire", "The Ottoman Empire", "It was a medieval trading capital in southern Africa.", "Great Zimbabwe", "Masvingo, Zimbabwe", -20.27, 30.93, "stonehenge"],
]);
hard("geography", [
  ["Which country has the most time zones, counting overseas territories?", "France", "China", "Brazil", "Its overseas territories span the globe.", null],
  ["What's the driest non-polar desert?", "The Atacama", "The Sahara", "The Namib", "Some weather stations there have never recorded rain.", "Atacama", "San Pedro, Chile", -22.9, -68.2, "cactus"],
  ["Which river carries the most water?", "The Amazon", "The Nile", "The Yangtze", "It discharges more than the next several rivers combined.", null],
  ["Which sea has almost no oxygen in its deep water?", "The Black Sea", "The Red Sea", "The Baltic", "Its depths preserve ancient ships remarkably well.", null],
  ["What's the capital of Saudi Arabia's Eastern Province?", "Dammam", "Jeddah", "Tabuk", "It sits on the Gulf coast near the great oil fields.", "Al-Ahsa Oasis", "Eastern Province, Saudi Arabia", 25.4, 49.6, "palm"],
]);

window.TIMELINE = [
  ["Göbeklitepe is built", -9500], ["Writing begins in Sumer", -3200], ["The Great Pyramid rises", -2560], ["Rome is founded", -753], ["Constantinople becomes capital", 330], ["Fall of Western Rome", 476], ["Hagia Sophia is finished", 537], ["Volodymyr's baptism of Kyiv", 988], ["Battle of Manzikert", 1071], ["Magna Carta", 1215], ["Mongols sack Kyiv", 1240], ["Lviv is founded", 1256], ["Osman founds the Ottoman state", 1299], ["Fall of Constantinople", 1453], ["Columbus crosses the Atlantic", 1492], ["Khmelnytsky's uprising", 1648], ["Orlyk's constitution", 1710], ["Kobzar is published", 1840], ["Gallipoli campaign", 1915], ["Shchedryk premieres", 1916], ["Republic of Türkiye founded", 1923], ["Moon landing", 1969], ["Chornobyl disaster", 1986], ["Berlin Wall falls", 1989], ["Ukraine's independence", 1991],
];
window.FACT_OR_FICTION = [
  ["Istanbul stands on two continents.", true], ["Ukraine's flag is blue over yellow.", true], ["Ankara has always been Türkiye's capital.", false], ["Sunflower is Ukraine's national flower.", true], ["The Great Wall is one continuous wall.", false], ["Kyiv is older than Moscow.", true], ["Mount Ararat is in Ukraine.", false], ["Bats are blind.", false], ["The Sahara is the largest hot desert.", true], ["Camels store water in their humps.", false], ["Venus is hotter than Mercury.", true], ["The Sun is a star.", true], ["Cheetahs can roar.", false], ["An octopus has three hearts.", true], ["Lviv's symbol is the lion.", true], ["Tulips came to Holland from the Ottoman world.", true], ["Saudi Arabia has rivers that flow all year.", false], ["The Black Sea is connected to the Mediterranean.", true], ["Penguins live at the North Pole.", false], ["Mount Everest is on the border of Nepal.", true], ["Turkish uses the Arabic alphabet today.", false], ["Pysanky are decorated Easter eggs.", true], ["Australia's capital is Sydney.", false], ["There are eight planets in our solar system.", true],
];
})();
