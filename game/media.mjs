const emotions = ['neutral', 'smile', 'uneasy', 'surprise', 'sad', 'annoyed', 'tense'];
const cast = {K: 'kirill', L: 'lera', S: 'sonya', N: 'nastya', P: 'pasha', A: 'artem'};
const backgrounds = {
  home: ['apartment', 'apartment', 'board'],
  taxi: ['taxi-interior', 'city', 'board'],
  outside: ['union-entrance', 'union_outside', 'dps'],
  club: ['union-bar', 'union_inside', 'dps'],
  meeting: ['union-reunion', 'union_inside', 'dps'],
  dance: ['union-dance-floor', 'union_inside', 'dps'],
  exit: ['union-exit', 'union_outside', 'dps'],
  nastya: ['embankment-night', 'river', 'board'],
  sonya: ['flower-shop-street', 'city', 'board'],
  lera: ['union-side-street', 'city', 'board'],
  alone: ['winter-city-night', 'city', 'board'],
  dawn: ['apartment-entrance-dawn', 'city', 'board']
};
const illustrations = {
  'first-snow': ['home', 'apartment'],
  'union-arrival': ['outside', 'union_outside'],
  'river-walk': ['nastya', 'river'],
  'city-alone': ['alone', 'city'],
  'first-light': ['dawn', 'city']
};

function art(kind, scene, path, fallback, source, character = null, emotion = null) {
  return {
    kind, scene, character, emotion, path: `assets/art/${path}.webp`,
    status: fallback ? 'temporary' : 'missing',
    fallback: fallback ? `assets/${fallback}.webp` : null, source
  };
}

// Set status to "ready" when the corresponding final file is supplied.
export const graphics = {
  'menu:city': art('menu', 'menu', 'menu/winter-city', 'city', 'board'),
  'menu:hero': art('menu', 'menu', 'menu/kirill', 'kirill', 'dps', 'K', 'neutral'),
  ...Object.fromEntries(Object.entries(backgrounds).map(([scene, [filename, fallback, source]]) =>
    [`background:${scene}`, art('background', scene, `backgrounds/${filename}`, fallback, source)])),
  ...Object.fromEntries(Object.entries(cast).flatMap(([person, name]) =>
    emotions.map(emotion => [`portrait:${person}:${emotion}`,
      art('portrait', 'all', `portraits/${name}-${emotion}`, emotion === 'neutral' ? name : null,
        emotion === 'neutral' ? (person === 'K' ? 'dps' : 'board') : null, person, emotion)]))),
  ...Object.fromEntries(Object.entries(illustrations).map(([name, [scene, fallback]]) =>
    [`illustration:${name}`, art('illustration', scene, `illustrations/${name}`, fallback, scene === 'outside' ? 'dps' : 'board')]))
};

export function graphic(key) {
  const entry = graphics[key];
  if (!entry) return null;
  if (entry.status === 'ready') return entry.path;
  return entry.fallback ?? (entry.kind === 'portrait' && entry.emotion !== 'neutral'
    ? graphic(`portrait:${entry.character}:neutral`) : null);
}

const audio = (kind, filename) => ({kind, path: `assets/audio/${kind}/${filename}.mp3`, status: 'missing'});
export const sounds = {
  score: audio('music', 'night-score'),
  reveal: audio('music', 'first-light'),
  apartment: audio('ambience', 'apartment'),
  city: audio('ambience', 'winter-city'),
  club: audio('ambience', 'union'),
  wind: audio('ambience', 'winter-wind'),
  dawn: audio('ambience', 'dawn'),
  knock: audio('sfx', 'door-knock'),
  'club-door': audio('sfx', 'club-door'),
  'bass-return': audio('sfx', 'bass-return')
};

export const hasAudio = Object.values(sounds).some(entry => entry.status === 'ready');
export const resourceUrl = path => new URL(`../${path}`, import.meta.url).href;
