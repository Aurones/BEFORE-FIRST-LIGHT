import {chapter, endings} from './chapter.mjs';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'before-first-light.save';
export const SETTINGS_KEY = 'before-first-light.settings';
const scores = ['L', 'S', 'N', 'P', 'J'];

export function start() {
  return {
    node: '1', phase: 'scene', next: null, response: null, history: [],
    L: 0, S: 0, N: 0, P: 0, J: 0, honest: false,
    promise: null, promises: [], broken: false, companion: null, route: null, weekend: null
  };
}

export function availableChoices(state) {
  const choices = chapter[state.node]?.choices ?? [];
  if (state.node !== '18' || state.companion !== 'P') return choices;
  return choices.map(choice => {
    if (choice.id === '18-dance') return {...choice, text: 'Предложить выйти подышать'};
    if (choice.id === '18-space') return {...choice, text: 'Оставить его одного'};
    return choice;
  });
}

export function canInvite(state, person) {
  return person === 'O' || (state[person] >= 1 && (person !== 'L' || state.J <= 3));
}

export function brokePromiseTo(state, person) {
  return state.promises.some(entry => entry.person === person && entry.status === 'broken');
}

function settlePromise(state, status) {
  const pending = state.promises.find(entry => entry.status === 'pending');
  if (!pending) return;
  pending.status = status;
  if (status === 'broken') state.broken = true;
}

export function choose(state, id) {
  if (state.phase !== 'scene') return state;
  const choice = availableChoices(state).find(item => item.id === id);
  if (!choice) return state;

  const scene = chapter[state.node];
  const effects = choice.effects;
  const result = {...state, history: [...state.history, id], promises: state.promises.map(entry => ({...entry}))};
  const replies = [];
  for (const key of scores) result[key] += effects[key] ?? 0;
  if (effects.honest) result.honest = true;

  if (effects.promise) {
    if (result.promise && result.promise !== effects.promise) settlePromise(result, 'broken');
    result.promise = effects.promise;
    result.promises.push({person: result.promise, choice: id, status: 'pending'});
  }
  if (effects.companion) {
    result.companion = effects.companion;
    if (result.promise === result.companion) {
      settlePromise(result, 'kept');
    } else if (result.promise) {
      settlePromise(result, 'broken');
      result[result.promise] -= 2;
      replies.push({speaker: result.promise, text: 'Ты же обещал. Ладно'});
    }
  }

  switch (id) {
    case '18-dance':
      if (result.companion === 'L') replies.push({speaker: 'L', text: 'Не здесь'});
      if (result.companion === 'N' || result.companion === 'S') {
        result[result.companion] += 1;
        replies.push({speaker: result.companion, text: 'Давай'});
      }
      break;
    case '25N-hand':
      replies.push(result.N >= 3
        ? {text: 'Настя соглашается. Я беру ее за руку.'}
        : {speaker: 'N', text: 'Давай не спешить'});
      break;
    case '25S-kiss':
      if (result.S >= 3) replies.push({speaker: 'S', text: 'Можно'}, {text: 'Соня целует меня.'});
      else replies.push({speaker: 'S', text: 'Не торопись'});
      break;
    case '25S-hug':
      replies.push(result.S >= 2
        ? {text: 'Соня соглашается, и я обнимаю ее.'}
        : {speaker: 'S', text: 'Давай пока без этого'});
      break;
  }

  let next = choice.next;
  if (effects.invite) {
    const person = effects.invite;
    const accepted = canInvite(result, person);
    result.route = accepted ? person : 'O';
    if (!accepted) {
      replies.push({speaker: person, text: 'Не сегодня, Кирилл'});
      next = '22O';
    }
  }
  if (scene.id === '30') result.weekend = id;
  if (choice.reaction) {
    replies.push(typeof choice.reaction === 'string'
      ? {speaker: scene.speaker, text: choice.reaction}
      : choice.reaction);
  }
  if (scene.reply) replies.push(scene.reply);
  return {...result, phase: 'response', next, response: {text: choice.text, replies}};
}

export function advance(state) {
  if (state.phase !== 'response') return state;
  const node = state.next;
  return {...state, node, phase: node === 'end' ? 'end' : 'scene', next: null, response: null};
}

export function encodeSave(state) {
  return JSON.stringify({version: SAVE_VERSION, phase: state.phase, history: state.history});
}

export function decodeSave(raw) {
  if (!raw) return null;
  try {
    const {version, phase, history} = JSON.parse(raw);
    if (version !== SAVE_VERSION || !['scene', 'response', 'end'].includes(phase)
      || !Array.isArray(history) || history.length > 30) return null;
    let state = start();
    for (const [index, id] of history.entries()) {
      const picked = choose(state, id);
      if (picked === state) return null;
      state = index === history.length - 1 && phase === 'response' ? picked : advance(picked);
    }
    if (state.phase !== phase || (phase === 'end' && !endings[state.route])) return null;
    return state;
  } catch {
    return null;
  }
}
