import assert from 'node:assert/strict';
import test from 'node:test';
import {chapter, endings, locations, portraits} from '../game/chapter.mjs';
import {advance, availableChoices, brokePromiseTo, canInvite, choose, decodeSave,
  encodeSave, start} from '../game/engine.mjs';
import {existsSync} from 'node:fs';

test('valid scene graph, choice IDs and local artwork', () => {
  const ids = new Set();
  for (const scene of Object.values(chapter)) {
    assert.ok(locations[scene.location]);
    assert.ok(scene.text.length);
    assert.ok(scene.choices.length >= 2);
    for (const choice of scene.choices) {
      assert.ok(!ids.has(choice.id), choice.id);
      ids.add(choice.id);
      assert.ok(choice.next === 'end' || chapter[choice.next], choice.id);
    }
  }
  for (const file of ['kirill', ...Object.values(portraits), ...Object.values(locations).map(item => item.image)]) {
    assert.ok(existsSync(new URL(`../assets/${file}.webp`, import.meta.url)), file);
  }
});

test('all reachable transitions, refusal paths and four endings without dead ends', () => {
  const visitedChoices = new Set();
  const observedEndings = new Set();
  const invitations = new Set();
  const observedNodes = new Set();
  let frontier = [start()];
  let transitions = 0;

  // Trust, honesty, and previous choice text have no effect on future routing.
  // Keep one representative per state with the same future-relevant inputs.
  const equivalent = state => JSON.stringify(state.route
    ? [state.node, state.route, state[state.route], state.promises]
    : [state.node, state.L, state.S, state.N, state.J, state.companion, state.promise, state.promises]);

  for (let depth = 0; depth < 30; depth++) {
    const successors = new Map();
    for (const state of frontier) {
      observedNodes.add(state.node);
      const choices = availableChoices(state);
      assert.ok(choices.length);
      for (const choice of choices) {
        visitedChoices.add(choice.id);
        const response = choose(state, choice.id);
        transitions++;
        assert.equal(response.phase, 'response');
        assert.equal(choose(response, choice.id), response);
        if (state.node === '21') invitations.add(`${choice.effects.invite}:${response.route}`);
        const following = advance(response);
        assert.equal(following.history.length, depth + 1);
        if (depth === 29) {
          assert.equal(following.phase, 'end');
          assert.ok(endings[following.route]);
          assert.equal(following.weekend, choice.id);
          observedEndings.add(following.route);
        } else {
          assert.equal(following.phase, 'scene');
          successors.set(equivalent(following), following);
        }
      }
    }
    frontier = [...successors.values()];
  }

  assert.equal(observedNodes.size, Object.keys(chapter).length);
  assert.equal(visitedChoices.size, Object.values(chapter).flatMap(scene => scene.choices).length);
  assert.deepEqual([...observedEndings].sort(), ['L', 'N', 'O', 'S']);
  assert.deepEqual([...invitations].sort(), ['L:L', 'L:O', 'N:N', 'N:O', 'O:O', 'S:O', 'S:S']);
  console.log(`${observedNodes.size} узлов · ${visitedChoices.size} вариантов · ${transitions} переходов`);
});

function walk(overrides, stopAt) {
  let state = start();
  assert.deepEqual(decodeSave(encodeSave(state)), state);
  while (!['end', stopAt].includes(state.node)) {
    const choices = availableChoices(state);
    const choiceId = overrides[state.node] ?? choices[0].id;
    const response = choose(state, choiceId);
    assert.deepEqual(decodeSave(encodeSave(response)), response);
    state = advance(response);
    assert.deepEqual(decodeSave(encodeSave(state)), state);
  }
  return state;
}

test('valid saves restore each decision, reply, ending and weekend choice', () => {
  for (const [choice, route] of Object.entries({nastya: 'N', sonya: 'S', lera: 'L', alone: 'O'})) {
    const state = walk({'17': '17-nastya', '21': `21-${choice}`, '30': '30-think'});
    assert.equal(state.route, route);
    assert.equal(state.weekend, '30-think');
  }
  for (const raw of [
    null, '{', 'null', '[]', '{"version":0,"phase":"scene","history":[]}',
    '{"version":1,"phase":"end","history":["1-go"]}', '{"version":1,"phase":"response","history":[]}',
    '{"version":1,"phase":"scene","history":["2-hide"]}', '{"version":1,"phase":"scene","history":["1-go",2]}'
  ]) assert.equal(decodeSave(raw), null);
});

test('overwritten, kept and broken promises retain their recipients and consequences', () => {
  const overrides = {'8': '8-promise', '12': '12-promise', '17': '17-nastya'};
  const before = walk(overrides, '17');
  assert.equal(before.promise, 'S');
  assert.equal(brokePromiseTo(before, 'N'), true);
  assert.equal(brokePromiseTo(before, 'S'), false);
  const broken = choose(before, '17-nastya');
  assert.equal(broken.S, before.S - 2);
  assert.equal(broken.N, before.N + 2);
  assert.equal(broken.broken, true);
  assert.deepEqual(broken.response.replies[0], {speaker: 'S', text: 'Ты же обещал. Ладно'});
  assert.equal(brokePromiseTo(broken, 'S'), true);
  const kept = choose(before, '17-sonya');
  assert.equal(kept.promises.at(-1).status, 'kept');
  assert.equal(brokePromiseTo(kept, 'S'), false);
  assert.equal(brokePromiseTo(kept, 'N'), true);
  const friend = advance(choose(before, '17-pasha'));
  assert.equal(availableChoices(friend)[0].text, 'Предложить выйти подышать');
  assert.equal(choose(friend, '18-dance').P, friend.P);
  const lera = advance(choose(before, '17-lera'));
  assert.deepEqual(choose(lera, '18-dance').response.replies, [{speaker:'L', text:'Не здесь'}]);
});

test('invitation and physical contact honor the exact score boundaries', () => {
  assert.equal(canInvite({L: 1, J: 3}, 'L'), true);
  assert.equal(canInvite({L: 1, J: 4}, 'L'), false);
  assert.equal(canInvite({N: 0}, 'N'), false);
  assert.equal(canInvite({S: 0}, 'S'), false);
  const pending = (node, stats, choice) => choose({...start(), node, ...stats}, choice).response.replies;
  assert.equal(pending('25N', {N: 2}, '25N-hand')[0].text, 'Давай не спешить');
  assert.match(pending('25N', {N: 3}, '25N-hand')[0].text, /соглашается/);
  assert.equal(pending('25S', {S: 2}, '25S-kiss')[0].text, 'Не торопись');
  assert.equal(pending('25S', {S: 3}, '25S-kiss')[0].text, 'Можно');
  assert.match(pending('25S', {S: 1}, '25S-hug')[0].text, /без этого/);
  assert.match(pending('25S', {S: 2}, '25S-hug')[0].text, /соглашается/);
});
