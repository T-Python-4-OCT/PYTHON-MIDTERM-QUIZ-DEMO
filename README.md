# Python Prep

A static, single-page practice quiz for the Python bootcamp midterm. The question bank covers Unit 1 (Lessons 1–10), Unit 2 (Lessons 1–6), and Unit 3 (Lessons 1–2).

## Run locally

From the project directory, run `python3 -m http.server 8000 --bind 127.0.0.1` and open [http://127.0.0.1:8000/](http://127.0.0.1:8000/). The app uses browser-native JavaScript modules and loads the question bank over HTTP.

## Publish to GitHub Pages

Commit the files at the root of a GitHub repository. In **Settings → Pages**, select **Deploy from a branch**, choose your publishing branch and **/(root)**, and save. Asset paths are relative, so the app also works under a repository subpath. The included `.nojekyll` file enables static publishing. [GitHub Pages publishing instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Quiz rules

- Before starting, choose Bank 1 (300 questions) or Bank 2 (400 questions). Both cover the same 18 lessons. Each quiz draws 50 unique questions from the selected bank, shuffles their order and answer options, and includes 18 simple, 20 medium, and 12 high-difficulty questions.
- Untimed mode records elapsed time. Timed mode offers 15, 30, 45, 60, or 90 minutes and defaults to 45. The timer runs across page reloads and while the page is closed.
- Untimed quizzes allow up to two distinct choices with immediate feedback. The report shows first-try and second-try correct counts, missed questions, and unfinished questions. Both correct outcomes count toward the overall score.
- Timed quizzes accept one answer per question. Correctness and explanations appear in the final report, which shows correct, incorrect, and unanswered counts. The report opens after the last answer or when time expires.
- Revision priority is based on incorrect submissions. Ties are ordered by missed questions, unfinished or unanswered questions, then curriculum order.
- The active quiz and completed reports are stored on the current browser and site origin. Clearing site data removes them.
- Each new quiz records its bank in the saved report and history. Earlier saved quizzes are identified as Bank 1.

## Edit the bank

[`data/questions.json`](data/questions.json) holds the original Bank 1. [`data/questions-bank-2.json`](data/questions-bank-2.json) holds Bank 2. Each row has a stable ID, unit, lesson, difficulty from 0 to 1, prompt, four options, a zero-based correct-answer index, and an explanation. The optional `code` field preserves indentation for snippets. Students see the difficulty labels Simple (below 0.35), Medium (0.35 to below 0.70), and High (0.70 to 1).
