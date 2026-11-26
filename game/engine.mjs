import {chapter, endings, line} from './chapter.mjs';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'before-first-light.save';
export const SETTINGS_KEY = 'before-first-light.settings';
const MAX_STEPS = 512;
const people = ['L', 'S', 'N'];
const routes = {L: 'lera-listen', S: 'sonya-open', N: 'nastya-open', O: 'alone'};
const resolve = (value, state) => typeof value === 'function' ? value(state) : value;
const action = (text, focus) => ({text, focus, kind: 'action'});

function enter(state, node) {
  if (node === 'end') return {...state, node, phase: 'end', beats: [], cursor: 0, next: null};
  return {...state, node, phase: 'story', beats: resolve(chapter[node].beats, state), cursor: 0, next: null};
}

export function start() {
  return enter({
    step: 0, history: [], log: [], P: 0, J: 0, honest: false, lies: {}, romantic: [],
    relationships: Object.fromEntries(people.map(person =>
      [person, {attraction: 0, trust: 0, hurt: 0, closeness: 0}])),
    promises: [], companion: null, route: null, weekend: null
  }, 'photo');
}

export function current(state) {
  if (state.phase === 'choice') {
    const item = chapter[state.node];
    return {kind: 'choice', text: resolve(item.prompt, state), choices: item.choices.map(option =>
      ({id: option.id, text: resolve(option.text, state)}))};
  }
  return state.beats[state.cursor] ?? null;
}

export function canInvite(state, person) {
  if (person === 'O') return true;
  const {attraction, trust, hurt} = state.relationships[person];
  return attraction + Math.floor(trust / 2) - Math.max(0, hurt - 1) >= 1 && (person !== 'L' || state.J <= 3);
}

function breakPromise(state, promise, loss) {
  promise.status = 'broken';
  state.relationships[promise.person].attraction -= loss;
  state.relationships[promise.person].hurt++;
}

function changeRelationships(result, effects) {
  for (const person of people) result.relationships[person].attraction += effects[person] ?? 0;
  if (effects.trust) result.relationships[effects.trust].trust++;
  if (effects.hurt) result.relationships[effects.hurt].hurt++;
  if (effects.close) result.relationships[effects.close].closeness++;
  if (effects.repair) {
    const relation = result.relationships[effects.repair];
    relation.hurt = Math.max(0, relation.hurt - 1);
    relation.trust++;
  }
  if (effects.lie) result.lies[effects.lie] = 'told';
  if (effects.truth && result.lies[effects.truth] === 'told') {
    result.lies[effects.truth] = 'admitted';
    result.honest = true;
  }
}

function rememberContact(result, contact, replies) {
  const person = contact === 'hand' ? 'N' : 'S';
  const relation = result.relationships[person];
  const minimum = contact === 'hug' ? 2 : 3;
  const accepted = relation.attraction + relation.closeness - relation.hurt >= minimum;
  result.romantic.push({person, kind: contact, accepted});
  if (!accepted) {
    replies.push(line(person, contact === 'hand' ? 'Давай не спешить.'
      : contact === 'kiss' ? 'Не торопись.' : 'Давай пока без этого.', 'uneasy'));
    replies.push(action('Я киваю и оставляю ей пространство.', person));
    return;
  }

  relation.closeness++;
  if (contact === 'kiss') {
    replies.push(line('S', 'Можно.', 'smile'), action('Соня сама наклоняется ко мне и целует.', 'S'));
  } else if (contact === 'hug') {
    replies.push(line('S', 'Не против.', 'smile'), action('Она делает шаг ближе, и я обнимаю её.', 'S'));
  } else {
    replies.push(line('N', 'Да.', 'smile'), action('Настя вкладывает руку в мою. Так мы и доходим до моста.', 'N'));
  }
}

export function choose(state, id) {
  if (state.phase !== 'choice') return state;
  const item = chapter[state.node];
  const option = item.choices.find(entry => entry.id === id);
  if (!option) return state;
  const text = resolve(option.text, state);
  const effects = option.effects;
  const result = {
    ...state, step: state.step + 1, history: [...state.history, id],
    promises: state.promises.map(promise => ({...promise})), lies: {...state.lies},
    relationships: Object.fromEntries(people.map(person => [person, {...state.relationships[person]}])),
    romantic: [...state.romantic], P: state.P + (effects.P ?? 0),
    J: state.J + (effects.J ?? 0), honest: state.honest || effects.honest === true
  };
  changeRelationships(result, effects);
  if (effects.admission) result.romantic.push({person: effects.admission, kind: 'admission'});

  const replies = [];
  const pending = result.promises.find(promise => promise.status === 'pending');
  if (effects.promise) {
    if (pending) breakPromise(result, pending, 0);
    result.promises.push({person: effects.promise, status: 'pending', choice: id});
  }
  if (effects.companion) {
    result.companion = effects.companion;
    if (pending?.person === result.companion) {
      pending.status = 'kept';
      result.relationships[pending.person].trust++;
    } else if (pending) {
      breakPromise(result, pending, 2);
      replies.push(line(pending.person, 'Ты же обещал. Ладно.', 'sad'));
    }
    if (result.lies.S === 'told') {
      result.relationships.S.trust--;
      result.relationships.S.hurt++;
      if (result.companion === 'S') replies.push(line('S', 'Лера к тебе подошла так, будто вы хорошо знакомы. Вернёмся к этому потом.', 'tense'));
    }
    replies.push(action(result.companion === 'P' ? 'Я остаюсь рядом с Пашей.' : 'Я пробираюсь через танцпол.', result.companion));
  }
  if (effects.dance) {
    const person = result.companion;
    if (person === 'P') replies.push(line('P', 'Давай. Я больше не чувствую, где заканчивается колонка и начинается моя голова.', 'smile'));
    else if (person === 'L') replies.push(line('L', 'Не здесь.', 'tense'));
    else {
      result.relationships[person].attraction++;
      result.romantic.push({person, kind: 'dance', accepted: true});
      replies.push(line(person, person === 'N' ? 'Давай. Только я могу наступить тебе на ногу.' : 'Я думала, ты уже не спросишь.', 'smile'));
    }
  }
  if (effects.contact) rememberContact(result, effects.contact, replies);
  if (effects.weekend) result.weekend = effects.weekend;
  let next = item.next;
  if (effects.invite) {
    const person = effects.invite;
    result.route = canInvite(result, person) ? person : 'O';
    next = routes[result.route];
    if (person !== 'O') replies.push(result.route !== person
      ? line(person, 'Не сегодня, Кирилл.', 'uneasy')
      : line(person, {L: 'Да. Только отойдём от двери.', S: 'Пойдём. Мне как раз надо проветриться.', N: 'Да. Давай пойдём к воде.'}[person]));
  }
  const selected = {kind: 'selected', speaker: 'K', text};
  return {...result, phase: 'reply', cursor: 0, next,
    beats: [selected, ...replies, ...resolve(option.reply, result)]};
}

export function advance(state) {
  if (state.phase !== 'story' && state.phase !== 'reply') return state;
  const item = current(state);
  const entry = item.text ? {location: chapter[state.node].location, kind: item.kind,
    speaker: item.speaker, focus: item.focus, text: item.text} : null;
  const following = {...state, step: state.step + 1, cursor: state.cursor + 1,
    log: entry ? [...state.log, entry] : state.log};
  if (following.cursor < following.beats.length) return following;
  if (following.phase === 'story') return {...following, phase: 'choice'};
  return enter(following, following.next);
}

export function encodeSave(state) {
  return JSON.stringify({version: SAVE_VERSION, step: state.step, history: state.history});
}

export function decodeSave(raw) {
  if (raw === null) return {status: 'empty', state: null};
  try {
    const {version, step, history, phase} = JSON.parse(raw);
    if (version === 1 && Array.isArray(history) && history.every(id => typeof id === 'string')
      && ['scene', 'response', 'end'].includes(phase)) {
      return {status: 'legacy', state: null};
    }
    if (version !== SAVE_VERSION || !Number.isInteger(step) || step < 0 || step > MAX_STEPS
      || !Array.isArray(history) || history.length > Object.keys(chapter).length) {
      return {status: 'invalid', state: null};
    }

    let state = start();
    let index = 0;
    while (state.step < step) {
      const next = state.phase === 'choice' ? choose(state, history[index++]) : advance(state);
      if (next === state) return {status: 'invalid', state: null};
      state = next;
    }
    if (index === history.length && (state.phase !== 'end' || endings[state.route])) {
      return {status: 'valid', state};
    }
  } catch {
    // Malformed JSON and incompatible payloads remain in storage until a restart is confirmed.
  }
  return {status: 'invalid', state: null};
}
