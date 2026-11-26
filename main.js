import {chapter, endings, hook, locations, names} from './game/chapter.mjs';
import {advance, choose, current, decodeSave, encodeSave, SAVE_KEY, SETTINGS_KEY, start} from './game/engine.mjs';
import {graphic, hasAudio, resourceUrl} from './game/media.mjs';
import {Soundscape} from './game/audio.mjs';

const game = document.querySelector('#game');
const view = document.querySelector('#view');
const notice = document.querySelector('#notice');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const mixer = new Soundscape();
const speeds = {slow: 36, normal: 19, fast: 9, instant: 0};

let screen = 'menu';
let returnTo = 'menu';
let nextTap = 0;
let rawSave = null;
let state = null;
let noticeText = '';
let settings = {tutorialSeen: false, speed: 'normal', volume: 0.65};
let story = null;
let shownStep = -1;
let finished = false;
let typingFrame = 0;
let revealDone;

function element(tag, className, text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function control(text, action, className = 'control') {
  const node = element('button', className, text);
  node.type = 'button';
  node.dataset.action = action;
  return node;
}

function title(text, className = 'heading') {
  const node = element('h1', className, text);
  node.tabIndex = -1;
  return node;
}

function image(key, className) {
  const node = element('img', className);
  node.alt = '';
  node.draggable = false;
  setImage(node, key);
  return node;
}

function setImage(node, key) {
  const path = graphic(key);
  node.hidden = !path;
  if (path) {
    const url = resourceUrl(path);
    if (node.src !== url) node.src = url;
  }
}

function readStorage() {
  try {
    rawSave = localStorage.getItem(SAVE_KEY);
    const saved = decodeSave(rawSave);
    state = saved.state;
    if (saved.status === 'legacy') {
      noticeText = 'Сохранение версии 0.1 сохранено на устройстве. Сцены переработаны, поэтому для версии 0.2 нужно начать главу заново.';
    } else if (saved.status === 'invalid') {
      noticeText = 'Сохранение не удалось открыть. Оно останется на устройстве, пока вы не подтвердите новую игру.';
    }
  } catch {
    noticeText = 'Хранилище недоступно. Прогресс может пропасть после закрытия страницы.';
  }

  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (stored && Object.prototype.hasOwnProperty.call(speeds, stored.speed)) settings.speed = stored.speed;
    if (stored?.tutorialSeen === true) settings.tutorialSeen = true;
    if (typeof stored?.volume === 'number' && stored.volume >= 0 && stored.volume <= 1) settings.volume = stored.volume;
  } catch {
    // Settings may be reset independently of story progress.
  }
}

function saveProgress() {
  try {
    const encoded = encodeSave(state);
    localStorage.setItem(SAVE_KEY, encoded);
    rawSave = encoded;
    noticeText = '';
  } catch {
    noticeText = 'Не удалось сохранить прогресс на устройстве. Он доступен до закрытия или обновления страницы.';
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    if (!noticeText) noticeText = 'Не удалось сохранить настройки на устройстве.';
  }
}

function renderNotice() {
  notice.textContent = screen === 'menu' || screen === 'story' ? noticeText : '';
  notice.hidden = !notice.textContent;
}

function menu() {
  const canvas = element('section', 'menu');
  const art = element('div', 'menu-art');
  art.setAttribute('aria-hidden', 'true');
  art.append(image('menu:city', 'menu-city'), image('menu:hero', 'menu-hero'));
  const stack = element('div', 'menu-content');
  stack.append(title('До первого света', 'title'), element('p', 'chapter-title', 'Глава 1 · Снова ты'));
  const actions = element('nav', 'menu-actions');
  const fresh = control('Новая игра', 'new', `control ${state ? '' : 'primary'}`);
  if (state) actions.append(control('Продолжить', 'resume', 'control primary'));
  actions.append(fresh, control('Настройки', 'settings'));
  stack.append(actions);
  canvas.append(art, stack);
  view.append(canvas);
}

function panel(heading, copy) {
  const node = element('section', 'panel');
  node.append(title(heading));
  if (copy) node.append(element('p', 'panel-copy', copy));
  view.append(node);
  return node;
}

function settingsScreen() {
  const node = panel('Настройки');
  const label = element('label', 'setting', 'Скорость текста');
  const select = element('select', 'speed');
  select.name = 'speed';
  for (const [value, text] of Object.entries({slow: 'Медленно', normal: 'Обычно', fast: 'Быстро', instant: 'Мгновенно'})) {
    const option = element('option', '', text);
    option.value = value;
    select.append(option);
  }
  select.value = settings.speed;
  label.append(select);
  node.append(label);

  if (hasAudio) {
    const volume = element('label', 'setting', 'Громкость');
    const slider = element('input', 'volume');
    slider.type = 'range';
    slider.name = 'volume';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.05';
    slider.value = settings.volume;
    volume.append(slider);
    node.append(volume);
  } else {
    node.append(element('p', 'panel-copy', 'В этой версии нет аудиодорожек.'));
  }
  node.append(control('Назад', 'settings-back'));
}

function historyScreen() {
  const node = panel('История диалога');
  const list = element('ol', 'history');
  let location = null;
  for (const entry of state.log) {
    const row = element('li', `history-line ${entry.kind}`);
    if (entry.location !== location) {
      location = entry.location;
      row.append(element('span', 'history-location', `${locations[location].time} · ${locations[location].label}`));
    }
    if (entry.speaker) row.append(element('strong', 'speaker', names[entry.speaker]));
    row.append(element('p', 'history-text', entry.text));
    list.append(row);
  }
  if (list.childElementCount) {
    list.tabIndex = 0;
    node.append(list);
    list.scrollTop = list.scrollHeight;
  } else {
    node.append(element('p', 'panel-copy', 'Здесь будут прочитанные реплики и выбранные ответы.'));
  }
  node.append(control('Назад', 'pause'));
}

function mountStory() {
  const frame = element('section', 'cinema');
  const scenery = element('div', 'scenery');
  scenery.setAttribute('aria-hidden', 'true');
  const backdrop = element('img', 'backdrop');
  const portrait = element('img', 'portrait');
  for (const img of [backdrop, portrait]) {
    img.alt = '';
    img.draggable = false;
  }
  scenery.append(backdrop, portrait);
  const top = element('header', 'scene-strip');
  const place = element('span', 'location');
  const pause = control('', 'pause', 'pause-control');
  pause.setAttribute('aria-label', 'Пауза');
  pause.append(element('span', 'pause-icon'));
  top.append(place, pause);

  const content = element('div', 'story-content');
  frame.append(scenery, top, content);
  view.append(frame);
  story = {frame, scenery, backdrop, portrait, place, content, location: null, art: null, character: null};
}

function endTyping() {
  cancelAnimationFrame(typingFrame);
  const finish = revealDone;
  revealDone = null;
  if (finish) finish();
}

function typeText(text, display, next) {
  const chars = Array.from(text);
  const pace = motion.matches || finished ? 0 : speeds[settings.speed];
  revealDone = () => {
    display.textContent = text;
    finished = true;
    next.classList.add('ready');
    next.setAttribute('aria-label', 'Далее');
  };
  if (!pace || !chars.length) {
    endTyping();
    return;
  }

  next.setAttribute('aria-label', 'Показать реплику');
  const startAt = performance.now();
  function draw(now) {
    const visible = Math.floor((now - startAt) / pace);
    if (visible >= chars.length) endTyping();
    else {
      display.textContent = chars.slice(0, visible).join('');
      typingFrame = requestAnimationFrame(draw);
    }
  }
  typingFrame = requestAnimationFrame(draw);
}

function renderStory() {
  if (!story) mountStory();
  const scene = chapter[state.node];
  const location = scene.location;
  const item = current(state);
  const illustration = item.kind === 'illustration';
  const art = illustration ? `illustration:${item.art}` : `background:${location}`;
  if (story.location !== location || story.art !== art) {
    story.character = null;
    story.scenery.classList.remove('enter');
    // New frames reuse the backdrop so taps do not reload the scene art.
    void story.scenery.offsetWidth;
    story.scenery.classList.add('enter');
    story.location = location;
    story.art = art;
    setImage(story.backdrop, art);
    story.place.textContent = `${locations[location].time} · ${locations[location].label}`;
  }
  story.frame.classList.toggle('illustration', illustration);
  story.frame.dataset.location = location;
  story.frame.dataset.kind = item.kind;

  // Keep the scene partner visible on Kirill's reply and on beats without a new focus.
  const focus = item.focus || item.speaker;
  let person = illustration ? null : focus && focus !== 'K' ? focus : story.character;
  if (!person && !illustration) {
    for (let index = state.log.length - 1; index >= 0; index--) {
      const entry = state.log[index];
      if (entry.location !== location || entry.kind === 'illustration') break;
      const actor = entry.focus || entry.speaker;
      if (actor && actor !== 'K') {
        person = actor;
        break;
      }
    }
  }
  const portrait = person && person !== 'K' && !illustration
    ? `portrait:${person}:${item.emotion ?? 'neutral'}` : null;
  const oldSrc = story.portrait.src;
  setImage(story.portrait, portrait);
  if (!story.portrait.hidden && oldSrc !== story.portrait.src) {
    story.portrait.classList.remove('appear');
    void story.portrait.offsetWidth;
    story.portrait.classList.add('appear');
  }
  story.character = person;

  if (shownStep !== state.step) {
    shownStep = state.step;
    finished = false;
  }
  story.content.replaceChildren();
  const card = element('div', `beat-card ${item.kind}`);
  card.setAttribute('aria-live', 'polite');
  if (item.speaker) card.append(element('p', 'speaker', names[item.speaker]));
  const copy = element('div', 'beat-text');
  const reserve = element('span', 'reserve', item.text || '…');
  reserve.setAttribute('aria-hidden', 'true');
  const display = element('span', 'display', item.text || '…');
  display.setAttribute('aria-hidden', 'true');
  copy.append(element('span', 'sr-only', item.text || 'Пауза'), reserve, display);
  card.append(copy);
  story.content.append(card);

  if (item.kind === 'choice') {
    const options = element('div', 'choices');
    for (const choice of item.choices) options.append(control(choice.text, `choose:${choice.id}`, 'choice'));
    story.content.append(options);
  } else {
    const next = control('', 'advance', 'advance');
    next.append(element('span', 'advance-icon'));
    story.content.append(next);
    display.textContent = finished || motion.matches || !speeds[settings.speed] ? item.text : '';
    typeText(item.text || '…', display, next);
  }
  syncAudio(item);
}

function syncAudio(item) {
  const inStory = screen === 'story' && !document.hidden;
  mixer.volume(inStory || screen === 'settings' ? settings.volume : 0);
  if (!inStory) {
    mixer.loop('music', null);
    mixer.loop('ambience', null);
    return;
  }
  const location = chapter[state.node].location;
  mixer.loop('music', location === 'dawn' ? 'reveal' : 'score');
  mixer.loop('ambience', locations[location].audio);
  if (item?.sound) {
    const step = state.step;
    mixer.effect(item.sound, () => screen === 'story' && state.step === step && !document.hidden);
  }
}

function render() {
  if (typingFrame || revealDone) endTyping();
  const changed = game.dataset.view !== screen || view.childElementCount === 0;
  game.dataset.view = screen;
  renderNotice();
  if (screen === 'story') {
    if (changed) view.replaceChildren();
    const focused = view.contains(document.activeElement) && document.activeElement.closest('[data-action]');
    renderStory();
    if (focused && !view.contains(focused)) story.content.querySelector('button')?.focus({preventScroll: true});
    window.scrollTo(0, 0);
    return;
  }

  story = null;
  view.replaceChildren();
  switch (screen) {
    case 'menu':
      menu();
      break;
    case 'settings':
      settingsScreen();
      break;
    case 'pause':
      panel('Пауза').append(control('Продолжить', 'resume', 'control primary'),
        control('История диалога', 'history'), control('Настройки', 'settings'), control('В главное меню', 'menu'));
      break;
    case 'history':
      historyScreen();
      break;
    case 'confirm':
      panel('Начать заново?', 'Текущее сохранение будет заменено. Это действие нельзя отменить.')
        .append(control('Начать новую игру', 'restart', 'control primary'), control('Отмена', 'menu'));
      break;
    case 'tutorial':
      panel('Как играть', 'Коснитесь экрана, чтобы сразу показать реплику. Следующее касание продолжит сцену. В решающие моменты выберите ответ Кирилла. Прогресс сохраняется автоматически.')
        .append(control('К первой сцене', 'begin', 'control primary'));
      break;
    case 'end': {
      const ending = panel('Глава завершена', endings[state.route]);
      ending.classList.add('end-panel');
      ending.append(element('p', 'hook', hook), element('p', 'panel-copy', 'Следующая глава в разработке.'),
        control('В главное меню', 'menu', 'control primary'));
      break;
    }
  }
  syncAudio();
  if (changed) {
    window.scrollTo(0, 0);
    view.querySelector('h1')?.focus({preventScroll: true});
  }
}

function newGame() {
  state = start();
  shownStep = -1;
  saveProgress();
  screen = settings.tutorialSeen ? 'story' : 'tutorial';
}

function handle(action, keyboard = false) {
  const now = performance.now();
  if (now < nextTap && (!keyboard || action.startsWith('choose:'))) return;
  nextTap = now + (action.startsWith('choose:') ? 290 : 180);
  mixer.unlock();
  if (action.startsWith('choose:')) {
    const chosen = choose(state, action.slice(7));
    if (chosen === state) return;
    state = chosen;
    saveProgress();
  } else {
    switch (action) {
      case 'advance':
        if (!finished) {
          endTyping();
          return;
        }
        state = advance(state);
        if (state.phase === 'choice') nextTap = now + 340;
        if (state.phase === 'end') screen = 'end';
        saveProgress();
        break;
      case 'new':
        if (state || rawSave !== null) screen = 'confirm';
        else newGame();
        break;
      case 'restart':
        newGame();
        break;
      case 'resume':
        screen = state.phase === 'end' ? 'end' : (settings.tutorialSeen ? 'story' : 'tutorial');
        break;
      case 'begin':
        settings.tutorialSeen = true;
        saveSettings();
        screen = 'story';
        break;
      case 'settings':
        returnTo = screen;
        screen = 'settings';
        break;
      case 'settings-back':
        screen = returnTo;
        break;
      default:
        screen = action;
    }
  }
  render();
}

view.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (button) handle(button.dataset.action, event.detail === 0);
  else if (screen === 'story' && state.phase !== 'choice' && event.target.closest('.cinema')) handle('advance');
});

view.addEventListener('change', event => {
  const target = event.target;
  if (target.name === 'speed') settings.speed = target.value;
  else if (target.name === 'volume') {
    settings.volume = Number(target.value);
    mixer.unlock();
    mixer.volume(settings.volume);
  } else return;
  saveSettings();
  renderNotice();
});

document.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.metaKey || event.ctrlKey) return;
  if (event.key === 'Escape' && screen === 'story') handle('pause', true);
  else if (event.key === 'Escape' && screen === 'pause') handle('resume', true);
  else if (event.key === 'Escape' && screen === 'history') handle('pause', true);
  else if (event.key === 'Escape' && screen === 'settings') handle('settings-back', true);
  else if (screen === 'story' && state.phase !== 'choice' && event.key === ' '
    && !event.target.closest('button, input, select')) {
    event.preventDefault();
    handle('advance', true);
  }
});
document.addEventListener('visibilitychange', () => syncAudio());
motion.addEventListener?.('change', () => { if (motion.matches) endTyping(); });

readStorage();
render();
