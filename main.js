import {chapter, endings, hook, locations, names, portraits} from './game/chapter.mjs';
import {advance, availableChoices, brokePromiseTo, choose, decodeSave, encodeSave,
  SAVE_KEY, SETTINGS_KEY, start} from './game/engine.mjs';

const game = document.querySelector('#game');
const view = document.querySelector('#view');
const notice = document.querySelector('#notice');
const artUrl = image => new URL(`./assets/${image}.webp`, import.meta.url).href;
const debounceMs = 350;

let screen = 'menu';
let lastAction = -Infinity;
let state = null;
let settings = {tutorialSeen: false, sound: false};
let saveError = '';

try {
  const raw = localStorage.getItem(SAVE_KEY);
  state = decodeSave(raw);
  if (raw !== null && !state) saveError = 'Сохранение повреждено или несовместимо. Можно начать новую игру.';
  const storedSettings = localStorage.getItem(SETTINGS_KEY);
  if (storedSettings) {
    try {
      const saved = JSON.parse(storedSettings);
      settings = {tutorialSeen: saved?.tutorialSeen === true, sound: saved?.sound === true};
    } catch {
      // The default settings still allow a previously saved game to continue.
    }
  }
} catch {
  saveError = 'Хранилище недоступно. Прогресс сохранится только до закрытия или обновления страницы.';
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, encodeSave(state));
    saveError = '';
  } catch {
    saveError = 'Не удалось сохранить прогресс на устройстве. Продолжить можно до закрытия или обновления страницы.';
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    saveError = 'Не удалось сохранить настройки на устройстве.';
  }
}

function element(tag, className, text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function button(text, action, primary = false) {
  const control = element('button', primary ? 'button primary' : 'button', text);
  control.type = 'button';
  control.dataset.action = action;
  return control;
}

function heading(text, className = 'heading', tag = 'h1') {
  const node = element(tag, className, text);
  node.tabIndex = -1;
  return node;
}

function image(name, className) {
  const node = element('img', className);
  node.src = artUrl(name);
  node.alt = '';
  node.draggable = false;
  return node;
}

function panel(title, details) {
  const block = element('section', 'panel');
  block.append(heading(title), element('p', 'details', details));
  view.append(block);
  return block;
}

function renderMenu() {
  view.append(image('kirill', 'menu-art'));
  const menu = element('section', 'menu');
  const title = heading('До первого света', 'title');
  menu.append(title, element('p', 'chapter-title', 'Глава 1 · Снова ты'));
  menu.append(button('Новая игра', 'new', true));
  if (state) menu.append(button('Продолжить', 'continue'));
  menu.append(button('Настройки', 'settings'));
  view.append(menu);
}

function renderSettings() {
  const block = panel('Настройки', 'В этой версии аудиодорожек нет. Настройка сохранится на устройстве.');
  const label = element('label', 'setting', 'Звук');
  const toggle = element('input', 'switch');
  toggle.type = 'checkbox';
  toggle.id = 'sound';
  toggle.checked = settings.sound;
  label.append(toggle);
  block.append(label, button('В главное меню', 'menu'));
}

function dialogue(container, {speaker, text}) {
  if (speaker) container.append(element('p', 'speaker', names[speaker]));
  container.append(element('p', speaker ? 'line spoken' : 'line', text));
}

function renderStory() {
  const scene = chapter[state.node];
  const location = locations[scene.location];
  const response = state.response;
  const portrait = response?.replies.find(reply => portraits[reply.speaker])?.speaker
    ?? scene.portrait ?? scene.speaker ?? (scene.id === '18' ? state.companion : null);

  const stage = element('div', 'stage');
  const backdrop = image(location.image, location.wide ? 'backdrop wide' : 'backdrop');
  stage.append(backdrop);
  if (portraits[portrait]) stage.append(image(portraits[portrait], 'portrait'));
  const top = element('header', 'scene-header');
  top.append(element('span', 'location', location.time ? `${location.label} · ${location.time}` : location.label));
  const menu = button('Меню', 'menu');
  menu.classList.add('small');
  top.append(menu);
  stage.append(top);
  view.append(stage);

  const story = element('section', 'story');
  const copy = heading('', 'dialogue', 'div');
  const lines = scene.text.split('\n');
  if (response) {
    copy.classList.add('response');
    copy.append(element('p', 'selection', response.text));
    for (const reply of response.replies) dialogue(copy, reply);
  } else {
    for (const [i, text] of lines.entries()) dialogue(copy, {text, speaker: i === lines.length - 1 ? scene.speaker : null});
    if (scene.note) {
      const text = brokePromiseTo(state, scene.portrait) ? scene.note : scene.otherwise;
      dialogue(copy, {speaker: scene.portrait, text});
    }
  }
  story.append(copy);
  const actions = element('div', 'actions');
  if (response) actions.append(button('Далее', 'advance', true));
  else for (const choice of availableChoices(state)) actions.append(button(choice.text, `choice:${choice.id}`));
  story.append(actions);
  view.append(story);
}

function renderEnd() {
  view.append(image('river', 'menu-art ending-art'));
  const block = panel('Глава завершена', endings[state.route]);
  block.append(element('p', 'hook', hook), element('p', 'details', 'Следующая глава пока недоступна.'));
  block.append(button('В главное меню', 'menu', true));
}

function render(focus = true) {
  game.dataset.view = screen;
  notice.textContent = saveError;
  notice.hidden = !saveError;
  view.replaceChildren();
  switch (screen) {
    case 'menu':
      renderMenu();
      break;
    case 'settings':
      renderSettings();
      break;
    case 'confirm': {
      const block = panel('Начать заново?', 'Новая игра заменит текущее сохранение.');
      block.append(button('Начать заново', 'restart', true), button('Отмена', 'menu'));
      break;
    }
    case 'tutorial': {
      const block = panel('Как играть', 'Выбирайте, что Кирилл скажет или сделает. После ответа коснитесь текста или нажмите «Далее». Прогресс сохраняется автоматически на этом устройстве.');
      block.append(button('К первой сцене', 'dismiss-tutorial', true));
      break;
    }
    case 'story':
      renderStory();
      break;
    case 'end':
      renderEnd();
      break;
  }
  if (focus) {
    window.scrollTo(0, 0);
    view.querySelector('[tabindex="-1"]')?.focus({preventScroll: true});
  }
}

function startNew() {
  state = start();
  save();
  screen = settings.tutorialSeen ? 'story' : 'tutorial';
}

function run(action) {
  const now = performance.now();
  if (now - lastAction < debounceMs) return;
  lastAction = now;

  if (action.startsWith('choice:')) {
    state = choose(state, action.slice(7));
    save();
  } else {
    switch (action) {
      case 'new':
        if (state) screen = 'confirm';
        else startNew();
        break;
      case 'restart':
        startNew();
        break;
      case 'dismiss-tutorial':
        settings.tutorialSeen = true;
        saveSettings();
        screen = 'story';
        break;
      case 'continue':
        screen = state.phase === 'end' ? 'end' : settings.tutorialSeen ? 'story' : 'tutorial';
        break;
      case 'advance':
        state = advance(state);
        save();
        if (state.phase === 'end') screen = 'end';
        break;
      case 'menu':
      case 'settings':
        screen = action;
        break;
    }
  }
  render();
}

view.addEventListener('click', event => {
  const control = event.target.closest('button[data-action]');
  if (control) run(control.dataset.action);
  else if (screen === 'story' && state.phase === 'response' && event.target.closest('.dialogue')) run('advance');
});

view.addEventListener('change', event => {
  if (event.target.id !== 'sound') return;
  settings.sound = event.target.checked;
  saveSettings();
  notice.textContent = saveError;
  notice.hidden = !saveError;
});

render(false);
