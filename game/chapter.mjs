const option = (id, text, effects = {}, reaction = '', next = null) => ({id, text, effects, reaction, next});
const scene = (id, location, text, speaker, options, {portrait, reply, next, note, otherwise} = {}) => ({
  id, location, text, speaker, portrait, reply, next, note, otherwise,
  choices: options.map(choice => ({...choice, id: `${id}-${choice.id}`}))
});

export const locations = {
  home: {label: 'Квартира', time: '19:42', image: 'apartment', wide: true},
  taxi: {label: 'По дороге', time: '21:08', image: 'city', wide: true},
  outside: {label: 'У входа в UNION', time: '21:36', image: 'union_outside'},
  club: {label: 'UNION', time: '22:15', image: 'union_inside'},
  meeting: {label: 'UNION', time: '23:02', image: 'union_inside'},
  dance: {label: 'Танцпол', time: '00:18', image: 'union_inside'},
  exit: {label: 'Выход из UNION', time: '02:34', image: 'union_outside'},
  river: {label: 'Набережная', image: 'river', wide: true},
  street: {label: 'Улица', image: 'city', wide: true},
  dawn: {label: 'У подъезда', time: '05:48', image: 'city', wide: true}
};

export const names = {L: 'Лера', S: 'Соня', N: 'Настя', P: 'Паша', A: 'Артём', O: 'Кирилл'};
export const portraits = {L: 'lera', S: 'sonya', N: 'nastya', A: 'artem'};
export const endings = {
  N: 'Я вспомнил, каково это — когда рядом с человеком не нужно ничего изображать.',
  S: 'Я не знал, что из этого выйдет. Но впервые за долгое время мне хотелось узнать.',
  L: 'Оказывается, целый год я жил с чужой версией нашей истории.',
  O: 'Впервые за долгое время я не пытался заполнить тишину кем-то другим.'
};
export const hook = 'На выходных мы снова окажемся вместе. И теперь я знаю: Паша рассказал мне не всё.';

const scenes = [
  scene('1', 'home', 'За окном снег. В колонках крутится незаконченный бит. Паша стучит в дверь.\nКирюх, открывай. В UNION сегодня едем. Ты неделю из дома не выходил.', 'P', [
    option('go', 'Погнали', {P: 1}, 'Вот это разговор'),
    option('no-dates', 'Мне не до знакомств', {}, 'Да никто тебя не сватает'),
    option('quiet', 'Только без приключений', {}, 'Не обещаю')
  ]),
  scene('2', 'home', 'Паша замечает на столе старую фотографию.', null, [
    option('hide', 'Убрать фотографию'), option('keep', 'Не трогай, пусть лежит', {L: 1}),
    option('discard', 'Пора выбросить', {L: -1})
  ], {reply: {speaker: 'P', text: 'Ладно, не мое дело'}}),
  scene('3', 'home', 'Ты вообще как, нормально?', 'P', [
    option('tired', 'Да, просто устал'), option('struggling', 'Иногда накрывает', {P: 1, honest: true}),
    option('stop', 'Не начинай', {P: -1})
  ], {reply: {speaker: 'P', text: 'Если что, я рядом'}}),
  scene('4', 'taxi', 'Снег тает на стекле такси. Паша вдруг выключает музыку.\nСлушай, а если Лера там будет?', 'P', [
    option('fine', 'Мне всё равно'), option('unsure', 'Не знаю, как отреагирую', {P: 1}),
    option('ask', 'Ты что-то знаешь?', {J: 1})
  ], {reply: {speaker: 'P', text: 'Я просто спросил'}}),
  scene('5', 'taxi', 'Ты бы хотел с ней поговорить?', 'P', [
    option('yes', 'Да', {L: 1}), option('if-she-asks', 'Только если сама подойдет'), option('no', 'Нет', {L: -1})
  ], {reply: {text: 'Я смотрю в окно. Город проносится мимо.'}}),
  scene('6', 'outside', 'У входа девушка пытается поднять упавшую перчатку, ветер гонит ее по асфальту. Я поднимаю ее.\nСпасибо. Я Настя.', 'N', [
    option('introduce', 'Кирилл. Рад знакомству', {N: 1}),
    option('joke', 'Ты всегда так эффектно знакомишься?', {N: 1}, {text: 'Она смеется.'}),
    option('glove', 'Держи', {}, {text: 'Она кивает.'})
  ]),
  scene('7', 'outside', 'Я фотографирую здесь иногда. А ты чем занимаешься?', 'N', [
    option('music', 'Пишу музыку', {N: 1}, 'Покажешь когда-нибудь?'),
    option('vague', 'Да так, всяким'), option('questions', 'А ты всегда задаешь столько вопросов?', {N: -1}, 'Ладно, не буду')
  ]),
  scene('8', 'outside', 'Увидимся внутри?', 'N', [
    option('promise', 'Давай найду тебя позже', {promise: 'N', N: 1}),
    option('maybe', 'Если пересечемся'), option('farewell', 'Хорошего вечера')
  ], {reply: {text: 'Она прячет руки в карманы и уходит.'}}),
  scene('9', 'club', 'Бас отдается в груди. Паша исчезает в толпе. Блондинка у бара ловит мой взгляд.\nТы так смотришь, будто знаешь меня. Соня.', 'S', [
    option('now', 'Теперь знаю', {S: 1}), option('thinking', 'Просто задумался'),
    option('first', 'Ты всегда первая знакомишься?', {S: 1}, 'Когда хочется')
  ]),
  scene('10', 'club', 'Давай выйдем из этой толпы, тут ничего не слышно.', 'S', [
    option('go', 'Пойдем', {S: 1}), option('friend', 'Я друга ищу'), option('stay', 'Лучше здесь')
  ]),
  scene('11', 'club', 'Ты какой-то напряженный. Кто тебя обидел?', 'S', [
    option('story', 'Долгая история'), option('ex', 'Бывшая. Но это в прошлом', {S: 1, honest: true}),
    option('private', 'Не твое дело', {S: -1})
  ], {reply: {speaker: 'S', text: 'Хорошо, не буду лезть'}}),
  scene('12', 'club', 'Потанцуем позже?', 'S', [
    option('promise', 'Обещаю', {promise: 'S', S: 1}), option('maybe', 'Посмотрим'), option('no', 'Не сегодня')
  ]),
  scene('13', 'meeting', 'Я узнаю Леру раньше, чем она меня. Рядом мужчина, держит ее за руку.\nКирилл?.. Это Артём.', 'L', [
    option('hello', 'Привет, Лер', {L: 1}), option('compliment', 'Красиво выглядишь', {L: 1, J: 1}),
    option('leave', 'Не буду мешать', {L: -1})
  ], {reply: {speaker: 'A', text: 'Приятно познакомиться'}}),
  scene('14', 'meeting', 'Артём протягивает мне руку.', null, [
    option('likewise', 'Взаимно'), option('history', 'Мы с Лерой давно знакомы', {J: 1}),
    option('handshake', 'Пожать руку и уйти')
  ], {portrait: 'A', reply: {speaker: 'L', text: 'Подожди, можно потом поговорить?'}}),
  scene('15', 'meeting', 'Лера ждет моего ответа.', null, [
    option('yes', 'Да', {L: 1}), option('unsure', 'Не уверен'), option('no', 'Не стоит', {L: -1})
  ], {portrait: 'L'}),
  scene('16', 'meeting', 'Паша подходит.\nКирюх, всё нормально?', 'P', [
    option('knew', 'Ты знал?', {P: -1}, 'Я слышал, что она может прийти'),
    option('fine', 'Нормально'), option('later', 'Потом поговорим', {P: 1})
  ]),
  scene('17', 'dance', 'Настя машет из толпы. Соня стоит рядом. Лера смотрит издалека.', null, [
    option('nastya', 'Подойти к Насте', {N: 2, companion: 'N'}),
    option('sonya', 'Подойти к Соне', {S: 2, companion: 'S'}),
    option('lera', 'Подойти к Лере', {L: 1, J: 1, companion: 'L'}),
    option('pasha', 'Остаться с Пашей', {P: 1, companion: 'P'})
  ]),
  scene('18', 'dance', 'Музыка не стихает.', null, [
    option('dance', 'Предложить танец'), option('talk', 'Поговорить'), option('space', 'Дать ей пространство')
  ]),
  scene('19', 'dance', 'Артём подходит.\nКирилл, давай без странностей сегодня.', 'A', [
    option('calm', 'Я не собираюсь устраивать сцен', {J: -1}),
    option('lera', 'Поговори с Лерой, не со мной', {J: 1}), option('leave', 'Уйти')
  ]),
  scene('20', 'dance', 'Паша предлагает уехать.', null, [
    option('wait', 'Еще немного'), option('go', 'Пора'), option('walk', 'Хочу пройтись один')
  ]),
  scene('21', 'exit', 'Холодный воздух отрезвляет. Паша ждет такси. Я решаю, с кем провести остаток ночи.', null, [
    option('nastya', 'Позвать Настю', {invite: 'N'}, '', '22N'),
    option('sonya', 'Позвать Соню', {invite: 'S'}, '', '22S'),
    option('lera', 'Поговорить с Лерой', {invite: 'L'}, '', '22L'),
    option('alone', 'Уйти одному', {invite: 'O'}, '', '22O')
  ]),
  scene('22N', 'river', 'Снег ложится ей на волосы.\nТы сегодня всё время будто где-то не здесь.', 'N', [
    option('ex', 'Встретил бывшую', {N: 1}), option('tired', 'Просто устал'), option('private', 'Не хочу об этом')
  ], {next: '23N'}),
  scene('23N', 'river', 'Я иду рядом с Настей по набережной.', null, [
    option('calm', 'Мне с тобой спокойно', {N: 1}), option('beautiful', 'Ты красивая', {N: 1}), option('thanks', 'Спасибо за компанию')
  ], {portrait: 'N', next: '24N'}),
  scene('24N', 'river', 'Я думаю о том, что говорил сегодня.', null, [
    option('sorry', 'Извини, я поступил некрасиво', {N: 1}),
    option('promise', 'Не обещаю того, чего не могу дать'), option('dismiss', 'Ты преувеличиваешь', {N: -1})
  ], {portrait: 'N', next: '25N', note: 'Мне важно, чтобы слова что-то значили',
    otherwise: 'Я не до конца поняла, что ты хотел сказать сегодня.'}),
  scene('25N', 'river', 'Мы останавливаемся у набережной.', null, [
    option('hand', 'Можно взять тебя за руку?'), option('taxi', 'Проводить до такси'), option('bye', 'Попрощаться')
  ], {portrait: 'N', reply: {speaker: 'N', text: 'Увидимся, Кирилл'}, next: '26'}),
  scene('22S', 'street', 'Ты весь вечер пытался выглядеть так, будто тебе никто не нужен.', 'S', [
    option('check', 'А ты хочешь проверить?', {S: 1}), option('feelings', 'Просто не люблю показывать чувства', {S: 1}),
    option('maybe', 'Может, так и есть')
  ], {next: '23S'}),
  scene('23S', 'street', 'Соня смотрит на меня, ожидая ответа.', null, [
    option('know', 'Мне интересно узнать тебя', {S: 1}), option('like', 'Ты мне нравишься', {S: 1}),
    option('evening', 'Это просто хороший вечер')
  ], {portrait: 'S', next: '24S'}),
  scene('24S', 'street', 'Я думаю о том, что могу пообещать.', null, [
    option('sorry', 'Справедливо. Прости', {S: 1}), option('not-ready', 'Я пока не готов к обещаниям'),
    option('dismiss', 'Не драматизируй', {S: -1})
  ], {portrait: 'S', next: '25S', note: 'Я не люблю, когда меня держат запасным вариантом',
    otherwise: 'Я пока не понимаю, чего ты хочешь от этого знакомства.'}),
  scene('25S', 'street', 'Мы останавливаемся на улице.', null, [
    option('kiss', 'Можно тебя поцеловать?'), option('hug', 'Обнять, если не против'), option('bye', 'Попрощаться')
  ], {portrait: 'S', reply: {speaker: 'S', text: 'Посмотрим, что будет дальше'}, next: '26'}),
  scene('22L', 'street', 'Я не хочу обманывать Артёма. Но мне нужно с тобой поговорить.', 'L', [
    option('listen', 'Я слушаю', {L: 1}), option('why-now', 'Почему сейчас?'), option('unsure', 'Не уверен, что хочу это слышать')
  ], {next: '23L'}),
  scene('23L', 'street', 'Я тогда думала, что ты сам решил уйти. Паша сказал, что ты не хочешь меня видеть.', 'L', [
    option('denial', 'Я такого не говорил', {L: 1}), option('sort-it-out', 'Нам нужно разобраться', {L: 1}),
    option('past', 'Это уже прошлое', {L: -1})
  ], {next: '24L'}),
  scene('24L', 'street', 'Лера замолкает. Я подбираю слова.', null, [
    option('happy', 'Ты счастлива с Артёмом?'), option('missed', 'Я скучал', {L: 1}),
    option('respect', 'Не хочу вмешиваться в ваши отношения', {L: 1})
  ], {portrait: 'L', reply: {speaker: 'L', text: 'Я пока сама не знаю, чего хочу'}, next: '25L'}),
  scene('25L', 'street', 'Снег не перестает идти.', null, [
    option('later', 'Давай поговорим, когда ты разберешься', {L: 1}),
    option('not-ready', 'Я не готов снова через это проходить'), option('taxi', 'Проводить до такси')
  ], {portrait: 'L', reply: {text: 'Лера уезжает.'}, next: '26'}),
  scene('22O', 'river', 'Снег скрипит под ногами. В наушниках мой собственный незаконченный трек.', null, [
    option('lonely', 'Признать, что мне одиноко'), option('quiet', 'Насладиться тишиной')
  ], {next: '23O'}),
  scene('23O', 'river', 'Мысли возвращаются к этому вечеру.', null, [
    option('lera', 'Подумать о Лере', {L: 1}), option('people', 'О новых знакомствах'), option('self', 'О себе')
  ], {next: '24O'}),
  scene('24O', 'river', 'Я пытаюсь понять, чего хочу дальше.', null, [
    option('wait', 'Не торопиться с отношениями'), option('chance', 'Дать себе шанс')
  ], {next: '25O'}),
  scene('25O', 'river', 'Пора решать, куда идти.', null, [
    option('pasha', 'Вернуться к Паше'), option('home', 'Поехать домой')
  ], {next: '26'}),
  scene('26', 'dawn', 'Паша стоит у подъезда.\nКирюх, я должен тебе кое-что сказать. Год назад Лера просила меня передать, что хочет встретиться. Я не передал. Я думал, вам лучше разойтись.', 'P', [
    option('no-right', 'Ты не имел права решать за нас', {P: -2}), option('why', 'Почему ты молчал?'),
    option('thanks', 'Спасибо, что наконец сказал', {P: 1})
  ]),
  scene('27', 'dawn', 'Я боялся потерять друга. Это не оправдание.', 'P', [
    option('time', 'Мне нужно время'), option('talk', 'Мы еще поговорим', {P: 1}), option('go', 'Уходи', {P: -1})
  ]),
  scene('28', 'dawn', 'Я остаюсь со своими мыслями.', null, [
    option('past', 'Сначала разобраться с прошлым', {L: 1}), option('present', 'Не хочу жить прошлым'),
    option('feelings', 'Хочу узнать, что чувствую на самом деле')
  ]),
  scene('29', 'dawn', 'Что я могу сделать уже сейчас?', null, [
    option('no-promise', 'Не обещать никому ничего, пока не разберусь'),
    option('honest', 'Быть честным с девушкой, которую выбрал', {honest: true}),
    option('unchanged', 'Оставить всё как есть')
  ]),
  scene('30', 'dawn', 'Кстати, нас на выходные зовут за город. Все будут там.', 'P', [
    option('go', 'Я поеду'), option('think', 'Мне нужно подумать'), option('not-for-lera', 'Поеду, но не ради Леры')
  ], {next: 'end'})
];

export const chapter = Object.fromEntries(scenes.map(item => {
  const next = item.next ?? String(Number(item.id) + 1);
  return [item.id, {...item, choices: item.choices.map(choice => ({...choice, next: choice.next ?? next}))}];
}));
