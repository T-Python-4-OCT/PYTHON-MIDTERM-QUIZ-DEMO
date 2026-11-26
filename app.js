import { QUIZ_SIZE, TIME_LIMITS, UNITS, difficultyBand, lessonName, newAttempt, outcome, isResolved, recordAnswer, summarize } from './quiz.js'

const main = document.querySelector('#main')
const storageMessage = document.querySelector('#storage-message')
const STORAGE_KEY = 'python-prep.quiz.v1'
const LETTERS = 'ABCD'
const OUTCOME_LABELS = {
  first: 'Correct · first try',
  second: 'Correct · second try',
  missed: 'Missed both tries',
  incomplete: 'Unfinished',
}
const TIMED_OUTCOME_LABELS = { first: 'Correct', missed: 'Incorrect', incomplete: 'Unanswered' }
const MODE_NOTES = {
  untimed: 'Up to two attempts per question.',
  timed: 'One answer per question. See your results at the end.',
}
const ICONS = {
  book: '<path d="M4 19V5a2 2 0 0 1 2-2h14v18H6a2 2 0 1 1 0-4h14M8 7h8m-8 4h6"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2m-5-13h6m3 5 2-2"/>',
  infinity: '<path d="M12 12c-2-3-3.5-4-5.5-4a4 4 0 1 0 0 8c2 0 3.5-1 5.5-4s3.5-4 5.5-4a4 4 0 1 1 0 8c-2 0-3.5-1-5.5-4Z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5"/>',
  list: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 9h6m-6 4h6m-6 4h4"/>',
  history: '<path d="M3 12a9 9 0 1 1 3 6.7M3 5v7h7m2-5v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  chart: '<path d="M4 19h16M7 15v-4m5 4V5m5 10V8"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
  database: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
}

const BANKS = [
  { id: 'bank-1', name: 'Bank 1', file: './data/questions.json' },
  { id: 'bank-2', name: 'Bank 2', file: './data/questions-bank-2.json' },
]
const questionBanks = new Map()
let view = 'home'
let mode = 'untimed'
let minutes = 45
let reportId = null
let state = restore()
let selectedBankId = BANKS.some(bank => bank.id === state.selectedBankId) ? state.selectedBankId : 'bank-1'

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`
}

function escapeHtml(text) {
  return String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function inlineCode(text) {
  return text.split('`').map((part, index) => index % 2 ? `<code>${escapeHtml(part)}</code>` : escapeHtml(part)).join('')
}

function showStorageError() {
  storageMessage.textContent = 'Browser storage unavailable. Progress is saved for this open tab only.'
}

function restore() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (stored && Array.isArray(stored.history)) {
      if (stored.active?.deadline != null) stored.active.answerLimit ??= 1
      return stored
    }
  } catch {
    showStorageError()
  }
  return { active: null, history: [] }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    showStorageError()
  }
}

function formatTime(milliseconds, roundUp = false) {
  const seconds = Math.max(0, (roundUp ? Math.ceil : Math.floor)(milliseconds / 1000))
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor(seconds / 60) % 60
  const secs = String(seconds % 60).padStart(2, '0')
  return hours ? `${hours}:${String(mins).padStart(2, '0')}:${secs}` : `${mins}:${secs}`
}

function dateLabel(timestamp) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
}

function attemptMode(attempt) {
  const mode = attempt.deadline === null ? 'Untimed' : `Timed · ${(attempt.deadline - attempt.startedAt) / 60_000} min`
  return `${bankName(attempt)} · ${mode}`
}

function bankName(attempt) {
  return BANKS.find(bank => bank.id === attempt.bankId)?.name ?? 'Bank 1'
}

function homePage() {
  const active = state.active
  const selectedMode = active ? (active.answerLimit === 1 ? 'timed' : 'untimed') : mode
  return `
    <section class="hero" aria-labelledby="page-title">
      <div class="hero-content">
        <p class="eyebrow"><span></span> BOOTCAMP MIDTERM</p>
        <h1 id="page-title" tabindex="-1">Python Midterm<br>Practice Quiz</h1>
        <p>Practice Python, web foundations, and Django with a fresh set of questions every time.</p>
        <div class="hero-stats" aria-label="Quiz format">
          <span>${icon('list')} <strong>${QUIZ_SIZE}</strong> questions per quiz</span>
          <span>${icon('layers')} <strong>${[...questionBanks.values()].reduce((total, bank) => total + bank.length, 0)}</strong> across 2 banks</span>
          <span>${icon('infinity')} Unlimited retakes</span>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div>
        <span class="art-spark spark-one">+</span><span class="art-spark spark-two">+</span><span class="art-spark spark-three">·</span>
        <div class="art-panel">
          <div class="art-bar"><i></i><i></i><i></i><span>practice.py</span></div>
          <div class="art-code"><span class="comment"># One question at a time</span><br><span class="keyword">def</span> <span class="function">practice</span>():<br>&nbsp;&nbsp;<span class="keyword">return</span> <span class="string">"progress"</span></div>
        </div>
        <span class="art-tag">&gt;_</span>
      </div>
    </section>
    <div class="dashboard-grid">
      <section class="panel setup" aria-labelledby="setup-heading">
        <div class="section-heading"><span class="section-icon violet">${icon('timer')}</span><div><h2 id="setup-heading">Start a practice quiz</h2><p>Choose a mode that works for you.</p></div></div>
        ${active ? `
          <div class="active-notice"><strong>Quiz in progress</strong><p>Question ${active.index + 1} of ${QUIZ_SIZE} · ${attemptMode(active)}</p></div>
          <div class="resume-actions">
            <button type="button" class="primary" data-action="resume">Resume quiz</button>
            <button type="button" class="secondary" data-action="reset">Start over</button>
          </div>
        ` : `
          <form id="setup-form">
            <label for="question-bank" class="bank-field"><span>Question bank</span>
              <span class="select-wrap"><select id="question-bank" name="bank">
                ${BANKS.map(bank => `<option value="${bank.id}" ${bank.id === selectedBankId ? 'selected' : ''}>${bank.name} · ${questionBanks.get(bank.id).length} questions</option>`).join('')}
              </select>${icon('chevron')}</span>
            </label>
            <fieldset class="mode-grid"><legend class="sr-only">Quiz mode</legend>
              ${modeOption('untimed', 'Untimed', 'Practice at your own pace.', 'infinity')}
              ${modeOption('timed', 'Timed', 'Work against the clock.', 'timer')}
            </fieldset>
            <label for="duration" id="duration-field" class="duration-field" ${mode === 'timed' ? '' : 'hidden'}><span>Time limit</span>
              <span class="select-wrap"><select id="duration" name="duration">${TIME_LIMITS.map(limit => `<option value="${limit}" ${minutes === limit ? 'selected' : ''}>${limit} minutes</option>`).join('')}</select>${icon('chevron')}</span>
            </label>
            <button class="primary full" type="submit">Start quiz</button>
          </form>
        `}
        <p class="setup-note">${icon('info')} <span id="setup-note">${MODE_NOTES[selectedMode]}</span></p>
      </section>
      <section class="panel curriculum" aria-labelledby="curriculum-heading">
        <div class="section-heading"><span class="section-icon green">${icon('book')}</span><div><h2 id="curriculum-heading">What’s covered</h2><p>18 lessons from the bootcamp curriculum.</p></div></div>
        <div class="unit-list">${UNITS.map((unit, index) => `
          <details class="unit">
            <summary><span class="unit-icon unit-icon-${index}">${icon(['code', 'globe', 'database'][index])}</span>
              <span class="unit-title"><strong>${escapeHtml(unit.name)}</strong><small>Unit ${index + 1} <span aria-hidden="true">·</span> ${unit.lessons.length} lessons</small></span><span class="chevron">${icon('chevron')}</span></summary>
            <ol>${unit.lessons.map(lesson => `<li>${escapeHtml(lesson)}</li>`).join('')}</ol>
          </details>`).join('')}</div>
      </section>
    </div>`
}

function modeOption(value, title, description, symbol) {
  return `<label class="mode-option">
    <input type="radio" name="mode" value="${value}" ${mode === value ? 'checked' : ''}>
    <span class="mode-icon">${icon(symbol)}</span><strong>${title}</strong><span class="mode-copy">${description}</span>
  </label>`
}

function questionMeta(question) {
  const band = difficultyBand(question.difficulty)
  return `<div class="question-meta"><span class="lesson-mark">Unit ${question.unit} · Lesson ${question.lesson}</span>
    <span class="difficulty ${band.toLowerCase()}">${band}</span></div>`
}

function codeBlock(question) {
  return question.code ? `<pre class="code-block"><code>${escapeHtml(question.code)}</code></pre>` : ''
}

function quizPage() {
  const attempt = state.active
  const question = attempt.questions[attempt.index]
  const singleAnswer = attempt.answerLimit === 1
  const resolved = isResolved(question, attempt.answerLimit)
  const position = attempt.index + 1
  const timed = attempt.deadline !== null
  const attempts = question.attempts.length
  const nextLabel = position === attempt.questions.length ? 'View results' : 'Next question'
  return `<div class="quiz-shell">
    <section class="quiz-progress" aria-label="Quiz progress">
      <div class="progress-top"><div><span class="subtle">${bankName(attempt)} · ${timed ? 'Timed quiz' : 'Untimed quiz'}</span><h1 id="page-title" tabindex="-1">Question ${position} of ${QUIZ_SIZE}</h1></div>
        <div class="quiz-clock" id="quiz-clock">${icon('timer')}<div><span>${timed ? 'Time remaining' : 'Time elapsed'}</span><strong id="clock-value" role="timer">${clockValue(attempt)}</strong></div></div></div>
      <progress value="${attempt.index + Number(resolved)}" max="${QUIZ_SIZE}" aria-label="Questions completed"></progress>
    </section>
    <section class="panel question-card" aria-labelledby="question-title">
      ${questionMeta(question)}
      <p class="lesson-name">${escapeHtml(lessonName(question.unit, question.lesson))}</p>
      <h2 id="question-title" tabindex="-1">${inlineCode(question.prompt)}</h2>
      ${codeBlock(question)}
      <form id="answer-form">
        <fieldset class="options"><legend class="sr-only">Choose an answer</legend>
        ${question.options.map((option, index) => {
          const correct = !singleAnswer && resolved && question.answer === index
          const wrong = !singleAnswer && question.attempts.includes(index) && index !== question.answer
          const selected = singleAnswer && resolved && question.attempts.at(-1) === index
          return `<label class="answer-option ${correct ? 'option-correct' : ''} ${wrong ? 'option-wrong' : ''}">
            <input type="radio" name="option" value="${index}" ${resolved || wrong ? 'disabled' : ''} ${selected ? 'checked' : ''}>
            <span class="option-letter">${LETTERS[index]}</span><span>${escapeHtml(option)}</span>
            ${correct || wrong ? `<span class="option-status">${icon(correct ? 'check' : 'close')}<span class="sr-only">${correct ? 'Correct answer' : 'Incorrect choice'}</span></span>` : ''}
          </label>`
        }).join('')}</fieldset>
        ${!singleAnswer && attempts ? feedback(question, outcome(question), resolved) : ''}
        <div class="quiz-actions">${singleAnswer ? '' : `<span class="subtle">${resolved ? `${attempts} of 2 attempts used` : `Attempt ${attempts + 1} of 2`}</span>`}
          ${resolved
            ? `<button class="primary" type="button" data-action="next">${nextLabel}</button>`
            : `<button class="primary" type="submit" id="submit-answer" disabled>${singleAnswer ? nextLabel : 'Check answer'}</button>`}
        </div>
      </form>
    </section>
  </div>`
}

function feedback(question, result, resolved) {
  const correct = result === 'first' || result === 'second'
  const title = correct ? OUTCOME_LABELS[result] : (resolved ? 'Incorrect · both attempts used' : 'Incorrect. Try one more answer.')
  return `<div class="feedback ${correct ? 'feedback-good' : 'feedback-bad'}" id="answer-feedback" tabindex="-1" role="status">
    ${icon(correct ? 'check' : 'info')}<div><strong>${title}</strong>${resolved ? `<p>${inlineCode(question.explanation)}</p>` : ''}</div></div>`
}

function revisionList(rows, singleAnswer) {
  if (!rows.length) return '<p class="empty-inline">Every question was answered correctly.</p>'
  return `<ol class="revisions">${rows.map(({ unit, lesson, wrong, unanswered }, index) => `
    <li><span class="priority" aria-hidden="true">${index + 1}</span>
      <div><strong>${escapeHtml(lessonName(unit, lesson))}</strong><span>Unit ${unit} · Lesson ${lesson}</span></div>
      <div class="revision-count"><strong>${wrong} wrong ${wrong === 1 ? 'answer' : 'answers'}</strong>${unanswered ? `<span>${unanswered} ${singleAnswer ? 'unanswered' : 'unfinished'}</span>` : ''}</div></li>`).join('')}</ol>`
}

function reviewQuestion(question, index, answerLimit) {
  const singleAnswer = answerLimit === 1
  const outcomeKey = outcome(question, answerLimit)
  const result = singleAnswer && outcomeKey === 'second' ? 'first' : outcomeKey
  const labels = singleAnswer ? TIMED_OUTCOME_LABELS : OUTCOME_LABELS
  const picks = question.attempts.map((option, attempt) => {
    const label = singleAnswer && question.attempts.length === 1 ? 'Your answer' : `Try ${attempt + 1}`
    return `<li><strong>${label}</strong><span>${LETTERS[option]}. ${escapeHtml(question.options[option])} <small>(${option === question.answer ? 'correct' : 'incorrect'})</small></span></li>`
  })
  return `<details class="review-item" data-outcome="${result}">
    <summary><span class="review-index">${index + 1}.</span><span class="review-title">${inlineCode(question.prompt)}<small>Unit ${question.unit} · Lesson ${question.lesson}</small></span>
      <span class="outcome-label ${result}">${labels[result]}</span><span class="chevron">${icon('chevron')}</span></summary>
    <div class="review-body">${questionMeta(question)}${codeBlock(question)}
      <ul class="picks">${picks.join('') || '<li>No answer submitted.</li>'}<li><strong>Correct answer</strong><span>${LETTERS[question.answer]}. ${escapeHtml(question.options[question.answer])}</span></li></ul>
      <p class="explanation">${inlineCode(question.explanation)}</p></div>
  </details>`
}

function resultPage(attempt) {
  const report = summarize(attempt)
  const singleAnswer = attempt.answerLimit === 1
  const breakdown = singleAnswer
    ? [[report.correct, 'Correct'], [report.missed, 'Incorrect'], [report.incomplete, 'Unanswered']]
    : [[report.first, 'Correct on first try'], [report.second, 'Correct on second try'],
      [report.missed, 'Missed both tries'], [report.incomplete, 'Unfinished']]
  const reviewFilters = singleAnswer
    ? TIMED_OUTCOME_LABELS
    : { first: 'First try', second: 'Second try', missed: 'Missed both', incomplete: 'Unfinished' }
  return `<div class="results-shell">
    <section class="result-hero" aria-labelledby="page-title"><div>
      <p class="eyebrow"><span></span> ${attempt.reason === 'timeout' ? 'TIME LIMIT REACHED' : 'QUIZ COMPLETE'}</p>
      <h1 id="page-title" tabindex="-1">Your results</h1>
      <p>${attemptMode(attempt)} <span aria-hidden="true">·</span> ${dateLabel(attempt.finishedAt)}</p>
      <div class="result-time">${icon('timer')} <span>Time spent <strong>${formatTime(attempt.finishedAt - attempt.startedAt)}</strong></span></div>
    </div><div class="score-ring" style="--score: ${report.percentage}%"><div><strong>${report.percentage}%</strong><span>${report.correct} of ${QUIZ_SIZE} correct</span></div></div></section>
    <section class="panel breakdown" aria-labelledby="breakdown-heading"><div class="section-heading"><span class="section-icon violet">${icon('chart')}</span><div><h2 id="breakdown-heading">Answer breakdown</h2></div></div>
      <div class="stats-grid ${singleAnswer ? 'stats-grid-timed' : ''}">
        ${breakdown.map(([total, label]) => `<div><strong>${total}</strong><span>${label}</span></div>`).join('')}
      </div>
    </section>
    <section class="panel results-panel" aria-labelledby="revision-heading"><div class="section-heading"><span class="section-icon green">${icon('book')}</span><div><h2 id="revision-heading">Lessons to revise</h2><p>${singleAnswer ? 'Ranked by wrong answers.' : 'Ranked by wrong answers across both tries.'}</p></div></div>${revisionList(report.revisions, singleAnswer)}</section>
    <section class="panel results-panel" aria-labelledby="review-heading"><div class="section-heading review-heading"><span class="section-icon violet">${icon('list')}</span><div><h2 id="review-heading">Question review</h2><p>See your choices and why each answer is correct.</p></div>
      <label class="select-wrap review-filter"><span class="sr-only">Filter question review</span><select id="review-filter"><option value="all">All questions</option>${Object.entries(reviewFilters).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select>${icon('chevron')}</label></div>
      <div class="review-list">${attempt.questions.map((question, index) => reviewQuestion(question, index, attempt.answerLimit)).join('')}</div><p id="review-empty" class="empty-inline" hidden>No questions match this filter.</p>
    </section>
    <div class="result-actions"><button class="secondary" data-action="history">Quiz history</button><button class="primary" data-action="home">${state.active ? 'Return to practice' : 'Practice again'}</button></div>
  </div>`
}

function scoreTrend(scores) {
  const lastIndex = scores.length - 1
  const latest = scores[lastIndex]
  const change = latest - (scores.at(-2) ?? latest)
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'steady'
  let comparison = 'Complete another quiz to compare scores.'
  if (lastIndex > 0) {
    comparison = change === 0
      ? 'Same score as the previous quiz.'
      : `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)} percentage points from the previous quiz.`
  }
  const ticks = [100, 75, 50, 25, 0]
  const points = scores.map((score, index) => ({
    x: lastIndex === 0 ? 50 : 100 * index / lastIndex,
    y: 100 - score,
    score,
    index,
  }))
  const line = points.map(point => `${point.x},${point.y}`).join(' ')
  const markers = points.length <= 16 ? points : points.slice(-1)
  return `<section class="panel trend-panel" aria-labelledby="trend-heading">
    <div class="section-heading"><span class="section-icon violet">${icon('chart')}</span><div><h2 id="trend-heading">Score trend</h2><p>Percent correct by quiz attempt</p></div></div>
    <div class="trend-summary">
      <p class="trend-latest"><strong>${latest}%</strong><span>Latest score</span></p>
      <p class="trend-change ${direction}">${comparison}</p>
    </div>
    <figure class="trend-chart" aria-label="Score history from oldest to newest. Latest score: ${latest} percent. ${comparison}">
      <div class="trend-axis" aria-hidden="true">${ticks.map(tick => `<span style="--y: ${100 - tick}%">${tick}%</span>`).join('')}</div>
      <div class="trend-graph" aria-hidden="true">
        <svg class="trend-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          ${lastIndex > 0 ? `<polygon points="0,100 ${line} 100,100"/>` : ''}
          ${ticks.map(tick => `<line x1="0" x2="100" y1="${100 - tick}" y2="${100 - tick}" vector-effect="non-scaling-stroke"/>`).join('')}
          ${lastIndex > 0 ? `<polyline points="${line}" fill="none" vector-effect="non-scaling-stroke"/>` : ''}
        </svg>
        ${markers.map(({ x, y, score, index }) => `<span class="trend-marker ${index === lastIndex ? 'latest' : ''}" style="--x: ${x}%; --y: ${y}%" title="Quiz ${index + 1}: ${score}%"></span>`).join('')}
      </div>
      <figcaption class="trend-attempts ${lastIndex === 0 ? 'single' : ''}" aria-hidden="true"><span>Quiz 1</span>${lastIndex > 0 ? `<span>Quiz ${scores.length}</span>` : ''}</figcaption>
    </figure>
  </section>`
}

function historyPage() {
  const history = state.history.map(attempt => ({ attempt, report: summarize(attempt) }))
  const scores = history.map(({ report }) => report.percentage).reverse()
  return `<div class="results-shell history-shell"><div class="history-header"><div><h1 id="page-title" tabindex="-1">Quiz history</h1><p class="subtle">Open a saved attempt to review your answers.</p></div></div>
    ${scores.length ? scoreTrend(scores) : ''}
    <section class="panel history-panel" aria-label="Saved attempts">
    ${history.length ? history.map(({ attempt, report }) => {
      return `<article class="history-row"><span class="section-icon violet">${icon('chart')}</span><div><strong>${dateLabel(attempt.finishedAt)}</strong><p>${attemptMode(attempt)} · ${formatTime(attempt.finishedAt - attempt.startedAt)}${attempt.reason === 'timeout' ? ' · Time expired' : ''}</p></div>
      <span class="history-score">${report.correct}/${QUIZ_SIZE}</span><button class="secondary" data-action="report" data-id="${escapeHtml(attempt.id)}">View report</button></article>`
    }).join('') : `<div class="empty-history"><span class="section-icon violet">${icon('history')}</span><h2>No quizzes yet</h2><p>Your completed quizzes will appear here.</p><button class="primary" data-action="home">${state.active ? 'Resume practice' : 'Go to practice'}</button></div>`}
    </section>
  </div>`
}

function clockValue(attempt, now = Date.now()) {
  return attempt.deadline === null ? formatTime(now - attempt.startedAt) : formatTime(attempt.deadline - now, true)
}

function finish(reason, end) {
  const attempt = state.active
  if (!attempt) return
  attempt.finishedAt = end
  attempt.reason = reason
  state.history.unshift(attempt)
  state.active = null
  persist()
  if (view === 'quiz') {
    reportId = attempt.id
    show('report')
  } else if (view === 'home' || view === 'history') {
    render()
  }
}

function tick() {
  const attempt = state.active
  if (!attempt) return false
  const now = Date.now()
  if (attempt.deadline !== null && now >= attempt.deadline) {
    finish('timeout', attempt.deadline)
    return true
  }
  const display = document.querySelector('#clock-value')
  if (display) {
    display.textContent = clockValue(attempt, now)
    document.querySelector('#quiz-clock').classList.toggle('urgent', attempt.deadline !== null && attempt.deadline - now <= 60_000)
  }
  return false
}

function render() {
  document.querySelector('#nav-practice').toggleAttribute('aria-current', view === 'home' || view === 'quiz')
  document.querySelector('#nav-history').toggleAttribute('aria-current', view === 'history' || view === 'report')
  for (const current of document.querySelectorAll('nav [aria-current]')) current.setAttribute('aria-current', 'page')
  if (view === 'quiz') main.innerHTML = quizPage()
  else if (view === 'history') main.innerHTML = historyPage()
  else if (view === 'report') main.innerHTML = resultPage(state.history.find(attempt => attempt.id === reportId))
  else main.innerHTML = homePage()
}

function show(next, focus = '#page-title') {
  view = next
  render()
  window.scrollTo(0, 0)
  document.querySelector(focus)?.focus({ preventScroll: true })
}

function advanceQuestion(attempt) {
  if (!isResolved(attempt.questions[attempt.index], attempt.answerLimit)) return
  if (attempt.index === attempt.questions.length - 1) {
    finish('complete', Date.now())
  } else {
    attempt.index += 1
    persist()
    show('quiz', '#question-title')
  }
}

function bindEvents() {
  document.addEventListener('click', event => {
    const target = event.target.closest('button[data-action]')
    if (!target) return
    switch (target.dataset.action) {
      case 'home': show('home'); break
      case 'history': show('history'); break
      case 'report':
        reportId = target.dataset.id
        show('report')
        break
      case 'resume':
        if (!tick() && state.active) show('quiz', '#question-title')
        break
      case 'reset':
        state.active = null
        persist()
        show('home')
        break
      case 'next':
        if (!tick() && state.active) advanceQuestion(state.active)
        break
    }
  })

  main.addEventListener('change', event => {
    const input = event.target
    if (input.name === 'mode') {
      mode = input.value
      document.querySelector('#duration-field').hidden = mode !== 'timed'
      document.querySelector('#setup-note').textContent = MODE_NOTES[mode]
    } else if (input.id === 'question-bank') {
      selectedBankId = input.value
      state.selectedBankId = selectedBankId
      persist()
    } else if (input.id === 'duration') {
      minutes = Number(input.value)
    } else if (input.name === 'option') {
      document.querySelector('#submit-answer').disabled = false
    } else if (input.id === 'review-filter') {
      const items = [...document.querySelectorAll('.review-item')]
      for (const item of items) item.hidden = input.value !== 'all' && input.value !== item.dataset.outcome
      document.querySelector('#review-empty').hidden = items.some(item => !item.hidden)
    }
  })

  main.addEventListener('submit', event => {
    event.preventDefault()
    if (event.target.id === 'setup-form' && !state.active) {
      state.active = newAttempt(questionBanks.get(selectedBankId), mode === 'timed' ? minutes : null)
      state.active.bankId = selectedBankId
      persist()
      show('quiz', '#question-title')
    } else if (event.target.id === 'answer-form' && state.active && !tick()) {
      const attempt = state.active
      const value = new FormData(event.target).get('option')
      if (value === null || !recordAnswer(attempt, Number(value))) return
      if (attempt.answerLimit === 1) {
        advanceQuestion(attempt)
      } else {
        persist()
        render()
        document.querySelector('#answer-feedback').focus()
      }
    }
  })

  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick() })
  window.addEventListener('pageshow', tick)
  window.setInterval(tick, 250)
}

try {
  await Promise.all(BANKS.map(async bank => {
    const response = await fetch(new URL(bank.file, import.meta.url))
    if (!response.ok) throw new Error(`${bank.name} unavailable.`)
    questionBanks.set(bank.id, await response.json())
  }))
  view = state.active ? 'quiz' : 'home'
  if (!tick()) render()
  bindEvents()
} catch (error) {
  console.error(error)
  main.innerHTML = '<section class="panel error-panel"><h1>Couldn’t load the quiz</h1><p>Reload the page to try again.</p></section>'
}
