# ax-rms

## What this is

Workforce Planner: a web system for a 30–100 person company to see employee skills and current workload and assign the right people to projects.

Mode: team
PM: MoonKibong

## Commands

- `make build`
- `make test`
- `make lint`
- `make screenshots T=<N>`

These are filled in by the skeleton and design-system tasks.

## Documents

- `docs/requirements/` — REQUEST, REQ-ANALYSIS, QUESTIONS, CLIENT_ANSWERS, REQ-CONTEXT
- `docs/contracts/T<N>.md` — task contracts
- `docs/design/BRIEF.md` — design brief
- `docs/evidence/T<N>.md` — verification results
- `docs/screens/T<N>/` — screenshots
- `docs/reviews/T<N>.md` — review verdicts
- `docs/FINAL.md` — final report

## Working rules

1. Work is split into GitHub issues labelled `task` (`T#<N>`). One issue fits in one working day.
2. A task starts with its contract `docs/contracts/T<N>.md`. Implementation starts only after a person approved it
   (`상태: 승인`).
3. Implementation shows the task's new checks failing first, then every check passing, and saves the results in
   `docs/evidence/T<N>.md`.
4. Work that changes a screen follows the approved `docs/design/BRIEF.md` and saves screenshots with
   `make screenshots T=<N>` into `docs/screens/T<N>/`.
5. A different agent reviews every task (Codex, or Claude Code when Codex implemented). Only when the other agent cannot be
   used (for example its usage limit is reached) and the person explicitly chooses it, the same agent reviews in a separate
   read-only session, preferably with a stronger model, and the verdict's `reviewer:` line records that and the reason. A
   same-agent review never accepts a change that deletes, overwrites, or resets data, changes authorization or roles,
   migrates existing data, or runs commands that can reach data or services outside the project: such a change waits for
   the other agent. Task changes reach `main` only after the review says `APPROVE`.
   Documents a person approved (requirements, final report) reach `main` when approved. Commit messages read
   `feat(T#<N>): …`; documents use `docs(…)`.
6. The AI runs git, gh, build and test commands. It never rebases or force-pushes a branch someone else may have.

## Team rules

1. Each task lives on branch `t<N>`; the requirements on branch `req`. Every NEXI skill switches to the branch, and at the
   end commits its own files, pushes, and comments on the issue (or tells the person whom to notify).
2. One person works on a task branch at a time. The issue comments say whose turn it is.
3. The developer opens the pull request. The review record `docs/reviews/T<N>.md` is on the branch. Only the PM merges, with
   `nexi-merge`.

## 환경

Forge: github
Data: cloud-ok
