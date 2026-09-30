// UI and dialogue text in English and Czech, plus the current-language state.
// Line lists (gorilla dialogue) must have the same length in every language,
// because the game stores which line was said by index.

const FLAG_CS = `<svg viewBox="0 0 6 4" aria-hidden="true"><rect width="6" height="4" fill="#d7141a"/><rect width="6" height="2" fill="#fff"/><path d="M0 0L3 2L0 4Z" fill="#11457e"/></svg>`;

const FLAG_EN = `<svg viewBox="0 0 60 30" aria-hidden="true"><clipPath id="uk-s"><path d="M0 0v30h60V0z"/></clipPath><clipPath id="uk-t"><path d="M30 15h30v15zv15H0zH0V0zV0h30z"/></clipPath><g clip-path="url(#uk-s)"><path d="M0 0v30h60V0z" fill="#012169"/><path d="M0 0l60 30m0-30L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30m0-30L0 30" clip-path="url(#uk-t)" stroke="#C8102E" stroke-width="4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6"/></g></svg>`;

export const LANGUAGES = [
  { code: "cs", name: "Čeština", flag: FLAG_CS },
  { code: "en", name: "English", flag: FLAG_EN },
];

export const STRINGS = {
  en: {
    loading: "loading terrain…",
    error: "error: {message}",
    help: "seed {seed} · click to capture mouse · WASD move · arrows/mouse look · wheel zoom · E give egg · hold T fast-forward time · Esc release",
    eggsTitle: "Eggs in basket",
    scoreTitle: "Score",
    clockTitle: "Time of day",
    languageLabel: "Language",
    promptGive: "Press E to give the gorilla an egg ({count} in basket)",
    promptNoEggs: "Bring eggs for the gorilla",
    helpTouch: "left thumb: move · right thumb: look · pinch: zoom · hold ⏩: fast-forward time",
    promptGiveTouch: "Tap 🥚 to give the gorilla an egg ({count} in basket)",
    giveButton: "Give the gorilla an egg",
    timeButton: "Hold to fast-forward time",
    danger: "🦈 A fin is circling you. Get to shore!",
    gameOverTitle: "Game over!",
    gameOverText: "You stayed in the water too long, and a great white shark ate you.",
    gameOverStats: "Eggs collected: {eggs} · Score: {score}",
    playAgain: "Play again",
    chooseTitle: "Choose your avatar",
    chooseNote: "Everyone can swim, but don't stay in the water too long!",
    avatar_ball: "Ball",
    avatar_cat: "Tabby cat",
    avatar_dog: "Dog",
    avatar_hedgehog: "Hedgehog",

    thanks: [
      "Oh! For me? Thank you!",
      "Mmm! Still warm!",
      "You're sweet, round one.",
      "Hee hee. Delicious.",
      "Thank you, friend!",
      "The forest and I thank you.",
    ],
    // Young as she is, she has listened to her elders.
    wisdom: [
      "My grandmother says the tallest tree was once a nut that held its ground.",
      "Roll slowly, little ball. The forest isn't going anywhere.",
      "A chicken lays one egg at a time. Maybe we should do things like that too.",
      "Moss grows where patience lives. I'm still working on the patience part.",
      "My grandmother says the river doesn't argue with the stone. It just goes around.",
      "Even the moon shares the night with the stars.",
      "Listen to the wind. It's been everywhere and it complains about nothing.",
      "The roots you can't see hold up the leaves you admire.",
      "Every shadow is proof that there is light somewhere.",
      "When a tree falls, the mushrooms say thank you.",
      "Don't count your chickens. They move around too much. Hee hee.",
      "My mother says one who shares eggs never walks the forest alone.",
      "Sit under a tree long enough and you become part of it.",
    ],
    emptyHanded: [
      "No eggs? That's okay. I like company too.",
      "Your basket is empty! Maybe the chickens will share.",
      "Nothing? Then stay a while and listen to the leaves with me.",
    ],
    greetings: ["Oh! Hello, round one!", "You came back! Sit with me.", "Shh... listen to the leaves."],
    dance: ["Hee hee! Dance with me!", "Eggs, eggs, eggs! Hoo hoo!", "My feet can't sit still!"],
  },

  cs: {
    loading: "načítám terén…",
    error: "chyba: {message}",
    help: "seed mapy {seed} · kliknutím zachytíte myš · WASD pohyb · šipky/myš rozhlížení · kolečko přiblížení · E dát vejce · podržte T pro zrychlení času · Esc uvolnit myš",
    eggsTitle: "Vejce v košíku",
    scoreTitle: "Skóre",
    clockTitle: "Denní doba",
    languageLabel: "Jazyk",
    promptGive: "Stiskněte E a dejte gorile vejce (v košíku: {count})",
    promptNoEggs: "Přineste gorile vejce",
    helpTouch: "levý palec: pohyb · pravý palec: rozhlížení · dva prsty: přiblížení · podržte ⏩: zrychlení času",
    promptGiveTouch: "Klepněte na 🥚 a dejte gorile vejce (v košíku: {count})",
    giveButton: "Dát gorile vejce",
    timeButton: "Podržením zrychlíte čas",
    danger: "🦈 Krouží kolem vás ploutev. Rychle na břeh!",
    gameOverTitle: "Konec hry!",
    gameOverText: "Zůstali jste ve vodě příliš dlouho a sežral vás žralok bílý.",
    gameOverStats: "Sebraná vejce: {eggs} · Skóre: {score}",
    playAgain: "Hrát znovu",
    chooseTitle: "Vyberte si postavu",
    chooseNote: "Všichni umí plavat, ale ve vodě nezůstávejte moc dlouho!",
    avatar_ball: "Míč",
    avatar_cat: "Mourovatá kočka",
    avatar_dog: "Pes",
    avatar_hedgehog: "Ježek",

    // She is a young female gorilla: feminine forms for herself,
    // gender-neutral wording toward the player.
    thanks: [
      "Ó! Pro mě? Děkuju!",
      "Mmm! Ještě je teplé!",
      "To je od tebe milé, kulíšku.",
      "Hi hi. Výborné.",
      "Moc ti děkuju!",
      "Les ti děkuje. A já taky.",
    ],
    wisdom: [
      "Babička říká, že i ten nejvyšší strom byl kdysi jen oříšek, který vytrval.",
      "Kutálej se pomalu, kulíšku. Les ti neuteče.",
      "Slepice snáší jedno vejce po druhém. Možná bychom to tak měli dělat se vším.",
      "Mech roste tam, kde bydlí trpělivost. Na té trpělivosti ještě pracuju.",
      "Babička říká, že řeka se s kamenem nehádá. Prostě ho oteče.",
      "I měsíc se o noc dělí s hvězdami.",
      "Poslouchej vítr. Byl všude a na nic si nestěžuje.",
      "Kořeny, které nevidíš, drží listí, které obdivuješ.",
      "Každý stín je důkazem, že někde svítí světlo.",
      "Když padne strom, houby řeknou děkuju.",
      "Nepočítej kuřata. Moc se hýbou. Hi hi.",
      "Maminka říká, že kdo se dělí o vejce, nechodí lesem nikdy sám.",
      "Když sedíš pod stromem dost dlouho, staneš se jeho součástí.",
    ],
    emptyHanded: [
      "Žádná vejce? Nevadí. Mám ráda i společnost.",
      "Košík je prázdný! Zkus to u slepic, třeba se rozdělí.",
      "Nic? Tak tu chvíli zůstaň a poslouchej se mnou listí.",
    ],
    greetings: ["Ó! Ahoj, kulíšku!", "Jsi zpátky! Posaď se ke mně.", "Pšš... poslouchej listí."],
    dance: ["Hi hi! Zatancuj si se mnou!", "Vejce, vejce, vejce! Hú hú!", "Nohy mi nevydrží v klidu!"],
  },
};

const STORAGE_KEY = "morbo.language";
const listeners = new Set();
let current = detectLanguage();

function detectLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && STRINGS[saved]) return saved;
  } catch {
    // Storage can be unavailable (private mode, tests); fall through.
  }
  const preferred = typeof navigator !== "undefined" ? navigator.language ?? "" : "";
  return preferred.toLowerCase().startsWith("cs") ? "cs" : "en";
}

export function getLanguage() {
  return current;
}

export function setLanguage(code) {
  if (!STRINGS[code] || code === current) return;
  current = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Not remembered, but the switch still works for this session.
  }
  for (const listener of listeners) listener(code);
}

export function onLanguageChange(listener) {
  listeners.add(listener);
}

// Translated string with {placeholders} filled in.
export function t(key, params = {}) {
  const text = STRINGS[current][key] ?? STRINGS.en[key];
  return text.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
}

// A translated line from a list such as "wisdom".
export function line(key, index) {
  return (STRINGS[current][key] ?? STRINGS.en[key])[index];
}

export function lineCount(key) {
  return STRINGS.en[key].length;
}
