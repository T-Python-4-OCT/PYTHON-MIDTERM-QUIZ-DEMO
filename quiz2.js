export const QUIZ_SIZE = 60
export const TIME_LIMITS = [15, 30, 45, 60, 90]
export const UNITS = [
  {
    name: 'Python Programming Foundations',
    lessons: [
      'Command-Line Interfaces (CLI) & Development Environment',
      'Version Control with Git & GitHub',
      'Python Introduction, Variables, Types & Operators',
      'Flow Control',
      'Functions & Scope',
      'Core Data Structures',
      'Modules, Packages & File Operations',
      'Recursion, Lambda Functions, Exceptions & Decorators',
      'Object-Oriented Programming',
      'Virtual Environments & PIP',
    ],
  },
  {
    name: 'Web Foundations & Django Introduction',
    lessons: [
      'Internet & World Wide Web Introduction',
      'HTML for Web Pages',
      'CSS, Libraries, Animation & Media',
      'Django Introduction & Project Setup',
      'Django Apps, Views & URL Mapping',
      'Django Templates, Static Files & Dynamic Data',
    ],
  },
  {
    name: 'Django ORM & Data Modeling',
    lessons: ['Relational Databases & ORM Concepts', 'Django Models & Fields'],
  },
]

export function difficultyBand(difficulty) {
  if (difficulty < 0.35) return 'Simple'
  if (difficulty < 0.7) return 'Medium'
  return 'High'
}

export function lessonName(unit, lesson) {
  return UNITS[unit - 1].lessons[lesson - 1]
}

function shuffle(items, random) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    const item = result[index]
    result[index] = result[other]
    result[other] = item
  }
  return result
}

export function newAttempt(bank, minutes, now = Date.now(), random = Math.random) {
  const shuffled = shuffle(bank, random)
  const covered = new Set()
  const selected = shuffled.filter(question => {
    const band = difficultyBand(question.difficulty)
    if (band === 'High') return false
    const key = `${question.unit}:${question.lesson}:${band}`
    if (covered.has(key)) return false
    covered.add(key)
    return true
  })
  const selectedIds = new Set(selected.map(question => question.id))
  const extraSimple = shuffled.filter(question => !selectedIds.has(question.id) && difficultyBand(question.difficulty) === 'Simple')
  const extraMedium = shuffled.filter(question => !selectedIds.has(question.id) && difficultyBand(question.difficulty) === 'Medium')
  const high = shuffled.filter(question => difficultyBand(question.difficulty) === 'High')
  const questions = shuffle([...selected, ...extraSimple.slice(0, 4), ...extraMedium.slice(0, 6), ...high.slice(0, 14)], random)
  if (questions.length !== QUIZ_SIZE) throw new Error('The question bank is missing required difficulty coverage.')
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${now}-${random().toString(36).slice(2)}`,
    startedAt: now,
    deadline: minutes === null ? null : now + minutes * 60_000,
    answerLimit: minutes === null ? 2 : 1,
    index: 0,
    // Snapshot the text and option order so saved reports stay accurate after bank edits.
    questions: questions.map(question => {
      const order = shuffle([0, 1, 2, 3], random)
      return {
        ...question,
        options: order.map(index => question.options[index]),
        answer: order.indexOf(question.answer),
        attempts: [],
      }
    }),
  }
}

export function outcome(question, answerLimit = 2) {
  const { attempts, answer } = question
  if (attempts[0] === answer) return 'first'
  if (attempts[1] === answer) return 'second'
  if (attempts.length >= answerLimit) return 'missed'
  return 'incomplete'
}

export function isResolved(question, answerLimit) {
  return outcome(question, answerLimit) !== 'incomplete'
}

export function recordAnswer(attempt, option, now = Date.now()) {
  if (attempt.deadline !== null && now >= attempt.deadline) return false
  const question = attempt.questions[attempt.index]
  if (!Number.isInteger(option) || option < 0 || option >= question.options.length ||
      isResolved(question, attempt.answerLimit) || question.attempts.includes(option)) return false
  question.attempts.push(option)
  return true
}

export function summarize(attempt) {
  const counts = { first: 0, second: 0, missed: 0, incomplete: 0 }
  const revisions = new Map()
  for (const question of attempt.questions) {
    const result = outcome(question, attempt.answerLimit)
    counts[result] += 1
    const wrong = question.attempts.filter(option => option !== question.answer).length
    const key = `${question.unit}:${question.lesson}`
    if (!revisions.has(key)) {
      revisions.set(key, { unit: question.unit, lesson: question.lesson, wrong: 0, missed: 0, unanswered: 0 })
    }
    const revision = revisions.get(key)
    revision.wrong += wrong
    revision.missed += Number(result === 'missed')
    revision.unanswered += Number(result === 'incomplete')
  }
  return {
    ...counts,
    correct: counts.first + counts.second,
    percentage: Math.round(100 * (counts.first + counts.second) / attempt.questions.length),
    revisions: [...revisions.values()].filter(row => row.wrong > 0 || row.unanswered > 0)
      .sort((a, b) => b.wrong - a.wrong || b.missed - a.missed || b.unanswered - a.unanswered ||
        a.unit - b.unit || a.lesson - b.lesson),
  }
}
