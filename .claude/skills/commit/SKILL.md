---
name: commit
description: Generate a descriptive git commit for current staged/unstaged changes following Aurali conventions
disable-model-invocation: true
argument-hint: "[optional message override]"
---

Create a git commit for the current changes in the Aurali project.

Steps:
1. Run `git status` and `git diff --staged` (if nothing staged, run `git diff` too)
2. Analyze what changed and draft a commit message following these rules:
   - **Language**: Spanish for lógica de dominio (features, fixes, refactors de negocio). English for infra/config/tooling.
   - **Format**: `tipo: descripción concisa` donde tipo es: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`
   - **Module prefix** when relevant: `feat(legal-process): ...`, `fix(workflow): ...`, `feat(documents): ...`
   - If `.sql` migration files changed, name them explicitly in the body
   - If workflow nodeExecutors changed, mention which node types
   - Keep subject line under 72 characters
3. Stage relevant files (avoid `.env`, secrets, large binaries)
4. Commit using HEREDOC format with Co-Authored-By trailer

If $ARGUMENTS is provided, use it as the commit message subject instead of generating one.
