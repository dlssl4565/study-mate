(() => {
  const defaults = { focus: 25, short: 5, long: 15, cycle: 4, accent: '#3a3a3a', background: '#FFFFFF', surface: '#FFFFFF', autoStart: false, sound: true, goal: 4 };
  const $ = (selector) => document.querySelector(selector);
  const settingsKey = 'tempo-settings-v1';
  const progressKey = 'tempo-progress-v1';
  const historyKey = 'tempo-history-v1';
  const profileKey = 'tempo-profile-v1';
  const baseTitle = 'Study Mate — 나만의 공부 타이머';
  const characters = [
    { id: 'character-1', name: '케로로', image: 'c1.png', messages: ['{nickname}, 오늘 공부 임무도 훌륭히 해냈어! 케로케로링~ 🐸', '{nickname}, 한 걸음씩 쌓은 공부가 실력이 되는 거야!', '{nickname}, 집중력 발휘 성공이야! 정말 대단해.', '케로케로링~ 오늘도 목표를 향해 전진했어!', '{nickname}, 공부 임무 완료야! 다음 임무도 힘내자.'] },
    { id: 'character-2', name: '아카아시', image: 'c2.png', messages: ['{nickname}, 오늘도 차분히 집중했어. 쌓인 시간은 분명 도움이 될 거야.', '한 번에 많이 하지 않아도 괜찮아, {nickname}. 꾸준히 이어가는 게 중요해.', '{nickname}, 계획한 공부를 잘 마쳤네. 스스로를 칭찬해도 좋아.', '오늘의 노력이 내일의 자신감을 만들어줄 거야. 수고했어, {nickname}.', '{nickname}, 지금처럼 한 걸음씩 가면 돼. 오늘도 잘 해냈어.'] },
    { id: 'character-3', name: '쿠로오', image: 'c3.png', messages: ['오야오야, {nickname}. 오늘 집중 꽤 잘했잖아? 이 페이스 계속 가보자고.', '한 문제씩 풀다 보면 결국 끝까지 가는 거야. 오늘도 제법인데, {nickname}.', '{nickname}, 방금 공부한 내용이 다음 실력으로 이어질 거야. 잘했어!', '오, 목표에 한 발 가까워졌네. {nickname}, 계속 응원할 테니까 힘내.', '오늘도 해냈구나, {nickname}. 꾸준함이 제일 무서운 무기라니까.'] },
    { id: 'character-4', name: '우시지마', image: 'c4.png', messages: ['{nickname}, 오늘 정한 공부를 끝냈다. 목표에 가까워졌군.', '집중한 시간은 쌓인다. 오늘의 노력도 의미가 있다, {nickname}.', '{nickname}, 한 세션을 해냈다. 다음 목표도 이룰 수 있다.', '매일의 반복이 실력을 만든다. 오늘도 잘 해냈다.', '좋은 집중이었다, {nickname}. 이대로 계속 나아가면 된다.'] },
    { id: 'character-5', name: '오사무', image: 'c5.png', messages: ['{nickname}, 오늘 공부 꽤 했네. 차근차근 쌓아가면 된다 아이가.', '와이 보기에도 오늘은 집중 잘했데이, {nickname}. 그 정도면 충분하다.', '{nickname}, 한 번에 다 하려 하지 말고 하나씩 해라. 오늘도 잘했다.', '공부는 꾸준히 하는 게 제일 어렵다 아이가. 오늘 해낸 것도 대단한 기다.', '{nickname}, 오늘 노력은 헛되지 않다. 다음에도 네 페이스대로 해라.'] }
  ];

  const safeRead = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  };

  // 저장 공간이 막혀 있거나 가득 차도 타이머가 멈추지 않게 보호
  const safeWrite = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 저장 실패는 무시: 타이머는 계속 동작
    }
  };

  const getTodayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const emptyProgress = (date) => ({ date, completed: 0, focusMinutes: 0, blocks: [] });

  let settings = { ...defaults, ...safeRead(settingsKey, {}) };
  settings.accent = defaults.accent;
  settings.background = defaults.background;
  settings.surface = defaults.surface;

  let profile = safeRead(profileKey, null);
  let chosenCharacter = profile?.character || 'character-1';
  const savedProgress = safeRead(progressKey, emptyProgress(getTodayKey()));
  let history = safeRead(historyKey, {});
  if (!history || typeof history !== 'object' || Array.isArray(history)) history = {};
  if (!Array.isArray(savedProgress.blocks)) {
    savedProgress.blocks = Array.from({ length: Math.max(0, savedProgress.focusMinutes || 0) }, () => 'focus');
  }
  if (savedProgress.date && !history[savedProgress.date]) history[savedProgress.date] = savedProgress;
  let progress = history[getTodayKey()] || (savedProgress.date === getTodayKey() ? savedProgress : emptyProgress(getTodayKey()));
  if (!Array.isArray(progress.blocks)) progress.blocks = [];
  history[getTodayKey()] = progress;
  let viewedDate = getTodayKey();
  let calendarMonth = new Date();

  let mode = 'focus';
  let remaining = settings.focus * 60;
  let endTime = 0;
  let interval = null;
  let running = false;
  let activitySeconds = 0;
  let audioContext = null;
  let toastTimeout;
  let companionTimer = null;
  let lastMessageIndex = -1;

  const modeNames = { focus: '집중 시간', short: '짧은 휴식', long: '긴 휴식' };
  const modeTitles = { focus: '집중', short: '짧은 휴식', long: '긴 휴식' };
  const ringLength = 2 * Math.PI * 128;

  function renderToday() {
    $('#today').textContent = new Intl.DateTimeFormat('ko-KR', {
      weekday: 'short',
      month: 'long',
      day: 'numeric'
    }).format(new Date());
  }

  // 자정이 지나도 페이지를 켜둔 경우 오늘 기록을 새로 시작
  function rollDayIfNeeded() {
    const key = getTodayKey();
    if (progress.date === key) return;
    history[progress.date] = progress;
    progress = emptyProgress(key);
    history[key] = progress;
    viewedDate = key;
    persist();
    updateProgress();
    renderToday();
  }

  function shiftDate(date, amount) {
    const [year, month, day] = date.split('-').map(Number);
    const shifted = new Date(year, month - 1, day + amount);
    return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`;
  }

  function changeViewedDate(date) {
    viewedDate = date;
    const isToday = viewedDate === getTodayKey();
    $('#date-nav').setAttribute('aria-pressed', String(!isToday));
    $('#date-pill').setAttribute('aria-pressed', String(isToday));
    updateProgress();
  }

  function openCalendar() {
    const [year, month, day] = viewedDate.split('-').map(Number);
    calendarMonth = new Date(year, month - 1, day, 12);
    renderCalendar();
    $('#calendar-dialog').hidden = false;
    $('#calendar-close').focus();
  }

  function closeCalendar() {
    $('#calendar-dialog').hidden = true;
    $('#date-nav').focus();
  }

  function renderCalendar() {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const today = getTodayKey();
    const monthStart = new Date(year, month, 1);
    const offset = (monthStart.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(monthStart);
    $('#calendar-month-label').textContent = monthName;

    const cells = Array.from({ length: offset }, () => '<span class="calendar-empty" aria-hidden="true"></span>');
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const record = history[date] || (progress.date === date ? progress : null);
      const studied = Boolean(record && ((record.focusMinutes || 0) > 0 || record.blocks?.includes('focus')));
      const isToday = date === today;
      const isSelected = date === viewedDate;
      const accessibleDate = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(year, month, day));
      cells.push(`<button class="calendar-day${studied ? ' has-study' : ''}${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}" type="button" data-date="${date}" aria-label="${accessibleDate}${studied ? ', 공부 기록 있음' : ''}" aria-pressed="${isSelected}"><span class="calendar-day-number">${day}</span></button>`);
    }
    $('#calendar-days').innerHTML = cells.join('');
    document.querySelectorAll('.calendar-day').forEach(button => button.addEventListener('click', () => {
      changeViewedDate(button.dataset.date);
      closeCalendar();
    }));
  }

  function shiftCalendarMonth(amount) {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + amount, 1, 12);
    renderCalendar();
  }

  function renderCharacters() {
    $('#character-grid').innerHTML = characters.map(character => `
      <button class="character-card ${chosenCharacter === character.id ? 'selected' : ''}" type="button" data-character="${character.id}" aria-pressed="${chosenCharacter === character.id}">
        <span class="character-avatar">
          <img src="${character.image}" alt="" onerror="this.hidden=true;this.parentElement.classList.add('image-missing')">
          <span class="image-placeholder">이미지 ${character.id.slice(-1)}</span>
        </span>
        <span class="character-name">${character.name}</span>
        <span class="character-check" aria-hidden="true">✓</span>
      </button>
    `).join('');

    document.querySelectorAll('.character-card').forEach(button => button.addEventListener('click', () => {
      chosenCharacter = button.dataset.character;
      document.querySelectorAll('.character-card').forEach(card => {
        const selected = card === button;
        card.classList.toggle('selected', selected);
        card.setAttribute('aria-pressed', String(selected));
      });
    }));
  }

  function showWelcome(edit = false) {
    document.title = baseTitle;
    $('#welcome-screen').hidden = false;
    $('#app-shell').hidden = true;
    $('#nickname').value = profile?.nickname || '';
    $('#focus-duration').value = settings.focus;
    chosenCharacter = profile?.character || chosenCharacter;
    renderCharacters();
    $('#welcome-title').innerHTML = edit
      ? '나의 공부 메이트를<br><em>바꿔볼래?</em>'
      : '오늘은 누구와<br><em>함께 공부할래?</em>';
    $('#profile-form button[type="submit"]').innerHTML = edit
      ? '변경 완료 <span aria-hidden="true">→</span>'
      : '공부 시작하기 <span aria-hidden="true">→</span>';
    $('#nickname').focus();
  }

  function enterApp() {
    $('#welcome-screen').hidden = true;
    $('#app-shell').hidden = false;
    const character = characters.find(item => item.id === profile.character) || characters[0];
    const image = $('#companion-image');
    // 이전에 이미지 로딩이 실패해 숨겨졌더라도 다시 보이게 초기화
    image.hidden = false;
    image.onerror = () => { image.hidden = true; };
    image.src = character.image;
    image.alt = `${character.name} 캐릭터`;
    $('#companion-name').textContent = character.name;
    updateCompanionMessage(character);
    clearInterval(companionTimer);
    companionTimer = setInterval(() => updateCompanionMessage(character), 20000);
    $('#helper-text').textContent = `${profile.nickname}, 오늘도 같이 집중해보자!`;
    updateDisplay();
  }

  function goBackToWelcome() {
    pauseTimer();
    clearInterval(companionTimer);
    updateDisplay();
    showWelcome(Boolean(profile));
  }

  function updateCompanionMessage(character) {
    const list = character.messages;
    let index = Math.floor(Math.random() * list.length);
    if (list.length > 1 && index === lastMessageIndex) index = (index + 1) % list.length;
    lastMessageIndex = index;
    $('#companion-message').textContent = list[index].replaceAll('{nickname}', profile?.nickname || '친구');
  }

  function showCompletion() {
    const nickname = profile?.nickname || '친구';
    $('#completion-message').textContent = `${nickname}, 오늘 ${progress.completed}번째 세션을 완료했어!`;
    $('#completion-dialog').hidden = false;
    $('#completion-continue').focus();
  }

  function closeCompletion() {
    $('#completion-dialog').hidden = true;
  }

  function persist() {
    safeWrite(settingsKey, settings);
    safeWrite(progressKey, progress);
    history[progress.date] = progress;
    safeWrite(historyKey, history);
  }

  function applyTheme() {
    document.documentElement.style.setProperty('--accent', settings.accent);
    document.documentElement.style.setProperty('--page', settings.background);
    document.documentElement.style.setProperty('--surface', settings.surface);
    document.querySelector('meta[name="theme-color"]').content = settings.background;
  }

  function updateProgress() {
    const displayProgress = viewedDate === getTodayKey() ? progress : (history[viewedDate] || emptyProgress(viewedDate));
    const breakMinutes = displayProgress.blocks.filter(block => block === 'break').length;
    const rhythmTitle = viewedDate === getTodayKey()
      ? '오늘의 리듬'
      : `${new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(`${viewedDate}T12:00:00`))} 리듬`;
    $('#rhythm-title').textContent = rhythmTitle;
    $('#completed-count').textContent = displayProgress.completed;
    $('#goal-count').textContent = settings.goal;
    $('#focus-total').textContent = `${displayProgress.focusMinutes}분`;
    $('#break-total').textContent = `${breakMinutes}분`;
    $('#goal-fill').style.width = `${Math.min(100, displayProgress.completed / settings.goal * 100)}%`;
    const dayLabel = viewedDate === getTodayKey() ? '오늘' : '선택한 날짜';
    $('#time-grid').setAttribute('aria-label', `${dayLabel} 공부 ${displayProgress.focusMinutes}분, 휴식 ${breakMinutes}분`);
    renderTimeGrid(displayProgress);
  }

  function renderTimeGrid(dayProgress) {
    const blocks = dayProgress.blocks;
    const cells = Array.from({ length: 144 }, (_, i) => {
      const tenMinutes = blocks.slice(i * 10, (i + 1) * 10);
      const focusCount = tenMinutes.filter(block => block === 'focus').length;
      const breakCount = tenMinutes.filter(block => block === 'break').length;
      const type = tenMinutes.length < 10 ? '' : focusCount >= breakCount ? 'focus' : 'break';
      const label = type === 'focus' ? '공부' : type === 'break' ? '휴식' : '기록 없음';
      return `<span class="minute-cell ${type === 'focus' ? 'is-study' : type === 'break' ? 'is-break' : ''}" title="${i + 1}번째 10분 · ${label}" aria-hidden="true"></span>`;
    });
    $('#time-grid').innerHTML = cells.join('');
  }

  function updateDisplay() {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    const timeText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    $('#time').textContent = timeText;
    if (!$('#app-shell').hidden) document.title = `${timeText} · ${modeTitles[mode]} | Study Mate`;

    const total = settings[mode] * 60;
    $('#ring-progress').style.strokeDasharray = ringLength;
    $('#ring-progress').style.strokeDashoffset = ringLength * (1 - Math.max(0, remaining / total));
    $('#session-label').textContent = modeNames[mode];
    $('#timer-caption').textContent = mode === 'focus' ? '공부에 집중해' : '잠깐 숨을 돌려';
    $('#start').textContent = running
      ? '일시정지'
      : remaining === total
        ? `${modeTitles[mode]} 시작`
        : '이어서 하기';

    document.querySelectorAll('.mode-button').forEach(button => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    $('#sound-toggle').classList.toggle('muted', !settings.sound);
    $('#sound-toggle').setAttribute('aria-label', settings.sound ? '알람 소리 끄기' : '알람 소리 켜기');
  }

  function stopTimer() {
    clearInterval(interval);
    interval = null;
    running = false;
  }

  function setMode(next) {
    stopTimer();
    mode = next;
    remaining = settings[next] * 60;
    activitySeconds = 0;
    $('#helper-text').textContent = next === 'focus'
      ? '작은 집중이 큰 변화를 만들어.'
      : '휴식도 공부의 중요한 일부야.';
    updateDisplay();
  }

  function ensureAudio() {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
    } catch {
      // Audio is optional.
    }
  }

  function beep() {
    if (!settings.sound) return;
    try {
      ensureAudio();
      if (!audioContext) return;
      [0, .28, .56].forEach(delay => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.value = delay === .28 ? 660 : 880;
        gain.gain.setValueAtTime(.0001, audioContext.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(.18, audioContext.currentTime + delay + .025);
        gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + delay + .21);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(audioContext.currentTime + delay);
        osc.stop(audioContext.currentTime + delay + .22);
      });
    } catch {
      // Audio is optional; timer remains usable if audio is unavailable.
    }
  }

  function completeSession() {
    stopTimer();
    remaining = 0;
    updateDisplay();
    beep();
    rollDayIfNeeded();

    if (mode === 'focus') {
      progress.completed += 1;
      persist();
      updateProgress();
      const next = progress.completed % settings.cycle === 0 ? 'long' : 'short';
      setMode(next);
      $('#helper-text').textContent = '집중 세션을 마쳤어. 잠깐 충전하자.';
      showCompletion();
      if (document.hidden) notify(`${profile?.nickname || '친구'}, 집중 세션 완료! 잠깐 쉬어가자.`);
    } else {
      setMode('focus');
      $('#helper-text').textContent = '휴식이 끝났어. 준비되면 다시 시작하자.';
      if (document.hidden) notify('휴식이 끝났어. 다시 집중해볼까?');
    }

    if (settings.autoStart) startTimer();
  }

  function addActivity(seconds) {
    rollDayIfNeeded();
    activitySeconds += seconds;
    let added = false;
    while (activitySeconds >= 60) {
      activitySeconds -= 60;
      progress.blocks.push(mode === 'focus' ? 'focus' : 'break');
      added = true;
    }
    if (added) {
      progress.focusMinutes = progress.blocks.filter(block => block === 'focus').length;
      persist();
      updateProgress();
    }
  }

  function tick() {
    if (!running) return;
    const next = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    const elapsed = remaining - next;
    if (elapsed <= 0 && next > 0) return;
    remaining = next;
    if (elapsed > 0) addActivity(elapsed);
    if (remaining <= 0) completeSession();
    else updateDisplay();
  }

  function startTimer() {
    if (running) return;
    rollDayIfNeeded();
    if (settings.sound) ensureAudio();
    running = true;
    endTime = Date.now() + remaining * 1000;
    interval = setInterval(tick, 250);
    updateDisplay();
  }

  function pauseTimer() {
    if (!running) return;
    tick();
    if (!running) return;
    stopTimer();
    updateDisplay();
  }

  function requestNotificationPermission() {
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        const result = Notification.requestPermission();
        if (result && typeof result.catch === 'function') result.catch(() => {});
      }
    } catch {
      // 알림은 선택 기능
    }
  }

  function notify(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 3500);
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification('Study Mate', { body: message });
    }
  }

  function openSettings() {
    const panel = $('#settings-panel');
    panel.inert = false;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    $('#overlay').hidden = false;
    requestAnimationFrame(() => $('#overlay').classList.add('visible'));
    fillForm();
    $('#settings-form input[name="profileNickname"]').focus();
  }

  function closeSettings() {
    const panel = $('#settings-panel');
    const wasOpen = panel.classList.contains('open');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;
    $('#overlay').classList.remove('visible');
    setTimeout(() => {
      if (!panel.classList.contains('open')) $('#overlay').hidden = true;
    }, 250);
    if (wasOpen) $('#settings-open').focus();
  }

  function fillForm(values = settings) {
    const form = $('#settings-form');
    Object.entries(values).forEach(([key, value]) => {
      const input = form.elements.namedItem(key);
      if (!input) return;
      if (input.type === 'checkbox') input.checked = value;
      else input.value = value;
    });
    form.elements.namedItem('profileNickname').value = profile?.nickname || '';
  }

  function saveForm(event) {
    event.preventDefault();
    const form = $('#settings-form');
    const previous = { ...settings };
    const nickname = form.elements.namedItem('profileNickname').value.trim();

    if (nickname) {
      profile = { ...(profile || {}), nickname, character: profile?.character || chosenCharacter };
      safeWrite(profileKey, profile);
    }

    for (const key of ['focus', 'short', 'long', 'cycle', 'goal']) {
      settings[key] = Number(form.elements.namedItem(key).value);
    }
    settings.autoStart = form.elements.namedItem('autoStart').checked;
    settings.sound = form.elements.namedItem('sound').checked;

    if (!running && settings[mode] !== previous[mode] && remaining === previous[mode] * 60) {
      remaining = settings[mode] * 60;
    }

    persist();
    applyTheme();
    updateDisplay();
    updateProgress();
    closeSettings();
    notify('설정을 저장했어.');
  }

  $('#profile-form').addEventListener('submit', event => {
    event.preventDefault();
    const nickname = $('#nickname').value.trim();
    if (!nickname) return;

    const nextFocus = Number($('#focus-duration').value);
    if (!Number.isFinite(nextFocus) || nextFocus < 1 || nextFocus > 180) return;

    if (nextFocus !== settings.focus) {
      settings.focus = nextFocus;
      if (!running && mode === 'focus') remaining = nextFocus * 60;
      safeWrite(settingsKey, settings);
    }

    profile = { nickname, character: chosenCharacter };
    safeWrite(profileKey, profile);
    updateDisplay();
    enterApp();
  });

  $('#completion-close').addEventListener('click', closeCompletion);
  $('#completion-continue').addEventListener('click', closeCompletion);
  $('#completion-dialog').addEventListener('click', event => {
    if (event.target === $('#completion-dialog')) closeCompletion();
  });

  $('#settings-open').addEventListener('click', openSettings);
  $('#settings-close').addEventListener('click', closeSettings);
  $('#overlay').addEventListener('click', closeSettings);
  $('#back-to-welcome').addEventListener('click', goBackToWelcome);
  $('#date-nav').addEventListener('click', openCalendar);
  $('#date-pill').addEventListener('click', () => changeViewedDate(getTodayKey()));
  $('#calendar-close').addEventListener('click', closeCalendar);
  $('#calendar-dialog').addEventListener('click', event => {
    if (event.target === $('#calendar-dialog')) closeCalendar();
  });
  $('#calendar-prev').addEventListener('click', () => shiftCalendarMonth(-1));
  $('#calendar-next').addEventListener('click', () => shiftCalendarMonth(1));
  $('#settings-form').addEventListener('submit', saveForm);
  $('#reset-settings').addEventListener('click', () => {
    fillForm(defaults);
    notify('기본값을 채워뒀어. 저장을 눌러 적용해.');
  });
  $('#start').addEventListener('click', () => {
    if (running) {
      pauseTimer();
    } else {
      requestNotificationPermission();
      startTimer();
    }
  });
  $('#restart').addEventListener('click', () => {
    stopTimer();
    remaining = settings[mode] * 60;
    activitySeconds = 0;
    updateDisplay();
    $('#helper-text').textContent = '새롭게 시작해보자. 할 수 있어!';
  });
  document.querySelectorAll('.mode-button').forEach(button => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });
  $('#sound-toggle').addEventListener('click', () => {
    settings.sound = !settings.sound;
    persist();
    updateDisplay();
    if (!settings.sound) notify('알림음을 껐어.');
    else {
      beep();
      notify('알림음을 켰어.');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && running) tick();
  });

  const canUseSpaceShortcut = () =>
    !$('#app-shell').hidden &&
    !$('#settings-panel').classList.contains('open') &&
    $('#completion-dialog').hidden &&
    !['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'A'].includes(document.activeElement?.tagName);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeSettings();
      closeCompletion();
      if (!$('#calendar-dialog').hidden) closeCalendar();
    }
    if (event.code === 'Space' && canUseSpaceShortcut()) {
      event.preventDefault();
      if (running) pauseTimer();
      else startTimer();
    }
  });

  renderToday();
  applyTheme();
  updateProgress();
  fillForm();
  updateDisplay();
  showWelcome();
})();
