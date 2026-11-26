import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import test from 'node:test';
import {chapter, endings, locations, names} from '../game/chapter.mjs';
import {advance, choose, current, decodeSave, encodeSave, start, storyFrame} from '../game/engine.mjs';
import {graphic, graphics, hasAudio, sounds} from '../game/media.mjs';

function play(selected, visit = () => {}, initial = start()) {
  let state = initial;
  while (state.phase !== 'end') {
    assert.ok(state.step < 300, 'Story did not terminate');
    const item = current(state);
    assert.ok(item);
    visit(state, item);
    const next = item.kind === 'choice'
      ? choose(state, state.node in selected ? `${state.node}:${selected[state.node]}` : item.choices[0].id)
      : advance(state);
    assert.notEqual(next, state, state.node);
    state = next;
  }
  visit(state, null);
  return state;
}

const routes = {
  N: {floor: 'nastya', invite: 'nastya', 'nastya-hand': 'hand'},
  S: {floor: 'sonya', invite: 'sonya', 'sonya-contact': 'kiss'},
  L: {floor: 'lera', invite: 'lera', 'lera-present': 'missed'},
  O: {floor: 'pasha', invite: 'alone'}
};

test('whole chapter: all routes, dialogue history and save restore at every beat', () => {
  const visited = new Set();
  for (const [person, choices] of Object.entries(routes)) {
    const result = play(choices, (state, item) => {
      visited.add(state.node);
      assert.deepEqual(decodeSave(encodeSave(state)), {status: 'valid', state});
      if (item?.kind === 'choice') {
        assert.equal(advance(state), state);
        assert.equal(choose(state, 'invalid-choice'), state);
      } else if (item) {
        assert.equal(choose(state, 'photo:keep'), state);
        if (item.speaker) assert.ok(names[item.speaker]);
        if (item.focus) assert.ok(names[item.focus]);
        if (item.art) assert.ok(graphic(`illustration:${item.art}`));
        if (item.sound) assert.ok(sounds[item.sound]);
      }
    });
    assert.equal(result.route, person);
    assert.ok(endings[person].length > 0);
    assert.equal(result.history.length, person === 'O' ? 17 : 19);
    assert.equal(result.weekend, 'go');
    assert.ok(result.log.length > result.history.length * 5);
    console.log(`${person}: ${result.history.length} решений, ${result.log.length} сюжетных фрагментов`);
  }
  assert.deepEqual([...visited].sort(), [...Object.keys(chapter), 'end'].sort());
});

test('every authored option terminates and applies only once', () => {
  const seen = new Set();
  for (const choices of Object.values(routes)) {
    play(choices, (state, item) => {
      if (item?.kind !== 'choice') return;
      for (const option of item.choices) {
        seen.add(option.id);
        const response = choose(state, option.id);
        assert.equal(response.phase, 'reply');
        assert.equal(choose(response, option.id), response);
        assert.equal(response.step, state.step + 1);
        assert.equal(response.history.at(-1), option.id);
        assert.equal(play(choices, () => {}, response).phase, 'end');
      }
    });
  }
  const declared = Object.values(chapter).flatMap(item => item.choices.map(option => option.id));
  assert.equal(new Set(declared).size, declared.length);
  assert.deepEqual([...seen].sort(), declared.sort());
  console.log(`${seen.size} вариантов решений`);
});

test('broken and kept promises preserve each recipient and react after reload', () => {
  const broken = play({...routes.N, 'nastya-plan': 'promise', 'sonya-plan': 'promise'});
  assert.deepEqual(broken.promises.map(({person, status}) => [person, status]), [['N', 'broken'], ['S', 'broken']]);
  assert.match(broken.log.map(entry => entry.text).join('\n'), /Ты же обещал.*Ладно/);
  assert.ok(broken.log.some(entry => entry.text.includes('Я немного подождала')));
  const kept = play({...routes.S, 'nastya-plan': 'promise', 'sonya-plan': 'promise'});
  assert.deepEqual(kept.promises.map(({person, status}) => [person, status]), [['N', 'broken'], ['S', 'kept']]);
  assert.equal(kept.relationships.S.hurt, 0);
  assert.ok(!kept.log.some(entry => entry.text.includes('запасным вариантом')));
});

test('lies, consent, and refusal have narrative consequences', () => {
  const sonya = play({...routes.S, 'sonya-truth': 'lie', 'sonya-trust': 'open'});
  assert.equal(sonya.lies.S, 'admitted');
  assert.ok(sonya.log.some(entry => entry.text.includes('А потом я увидела')));
  assert.deepEqual(sonya.romantic.at(-1), {person: 'S', kind: 'kiss', accepted: true});
  const guarded = play({...routes.N, floor: 'pasha', 'nastya-open': 'private', 'nastya-repair': 'dismiss'});
  assert.deepEqual(guarded.romantic.at(-1), {person: 'N', kind: 'hand', accepted: false});
  assert.ok(!guarded.log.some(entry => entry.text.includes('вкладывает руку')));
  for (const [invite, overrides] of [
    ['nastya', {'nastya-intro': 'closed', 'nastya-plan': 'bye'}],
    ['sonya', {'sonya-truth': 'boundary', 'sonya-plan': 'no'}],
    ['lera', {photo: 'discard', taxi: 'avoid', reunion: 'no'}]
  ]) {
    const result = play({floor: 'pasha', invite, ...overrides});
    assert.equal(result.route, 'O');
    assert.ok(result.log.some(entry => entry.text === 'Не сегодня, Кирилл.'));
  }
  const highTension = play({taxi: 'press', 'pasha-club': 'knew', floor: 'lera', artem: 'push', invite: 'lera'});
  assert.equal(highTension.route, 'O');
});

test('saves reject damaged replays without silently asking for a replacement', () => {
  assert.equal(decodeSave(null).status, 'empty');
  const old = '{"version":1,"phase":"response","history":["1-go"]}';
  assert.deepEqual(decodeSave(old), {status: 'legacy', state: null});
  for (const raw of [
    '{', 'null', '{}', '[]', '{"version":3,"step":0,"history":[]}',
    '{"version":2,"step":513,"history":[]}', '{"version":2,"step":1,"history":[2]}',
    '{"version":2,"step":5,"history":["photo:keep"]}', '{"version":2,"step":25,"history":[]}'
  ]) assert.equal(decodeSave(raw).status, 'invalid');
});

test('all placeholders resolve to existing WebP, missing audio stays silent', () => {
  for (const [key, entry] of Object.entries(graphics)) {
    const path = graphic(key);
    assert.match(entry.path, /\.webp$/);
    assert.ok(path && existsSync(new URL(`../${path}`, import.meta.url)), key);
    if (entry.kind === 'background') assert.ok(locations[entry.scene]);
  }
  assert.equal(hasAudio, false);
  assert.ok(Object.values(sounds).every(entry => entry.status === 'missing'));
});


test('choices keep the previous story context and speaker without changing the scenario', () => {
  play(routes.N, (state, item) => {
    if (item?.kind !== 'choice') return;
    assert.ok(names[item.speaker]);
    assert.ok(state.beats.some(beat => beat.text === item.text));
    assert.notEqual(item.text, chapter[state.node].prompt);
    if (state.node === 'photo') {
      assert.equal(item.speaker, 'P');
      assert.match(item.text, /старая фотография/);
    }
    if (state.node === 'friend') {
      assert.equal(item.speaker, 'P');
      assert.equal(item.text, 'Кирюх, если серьёзно. Как ты?');
    }
  });
});

test('review is read-only, bounded by the last choice, and restored from existing saves', () => {
  for (const choices of Object.values(routes)) {
    play(choices, (state, item) => {
      if (!item) {
        assert.equal(storyFrame(state), null);
        assert.equal(storyFrame(state, 1), null);
        return;
      }

      const saved = encodeSave(state);
      const checkpoint = state.readFrames.length;
      if (item.kind === 'selected') assert.equal(checkpoint, 0);
      assert.equal(storyFrame(state, checkpoint + 1), null);
      assert.equal(storyFrame(state, -1), null);
      assert.equal(storyFrame(state).item.kind, item.kind);
      for (let back = 1; back <= checkpoint; back++) {
        const frame = storyFrame(state, back);
        assert.ok(frame && frame.item.kind !== 'choice');
        if (frame.item.kind === 'selected') assert.equal(back, checkpoint);
      }
      assert.equal(encodeSave(state), saved);
      assert.deepEqual(decodeSave(saved).state.readFrames, state.readFrames);
    });
  }
});
