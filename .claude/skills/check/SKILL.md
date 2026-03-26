---
name: check
description: Run TypeScript type check and ESLint on the Aurali project, report issues, and optionally fix them
disable-model-invocation: true
argument-hint: "[fix]"
---

Validate the Aurali codebase before committing.

## Steps

1. Run type check:
   ```
   pnpm tsc --noEmit 2>&1
   ```

2. Run lint:
   ```
   pnpm lint 2>&1
   ```

3. Analyze results:
   - Group errors by file and type (type errors vs lint warnings)
   - Highlight any errors in files recently modified (check `git diff --name-only`)
   - Distinguish between: blocking errors (must fix) vs warnings (informational)

4. Report summary:
   - Total type errors / lint errors / lint warnings
   - List each error with file:line and brief description
   - Flag any errors in: `lib/workflow/nodeExecutors.ts`, `lib/documents/generateDocument.ts`, server actions

5. If $ARGUMENTS contains "fix":
   - Fix all reported issues automatically
   - Re-run checks to confirm clean
   - Do NOT fix errors by suppressing them with `@ts-ignore` or `eslint-disable` unless the suppression is genuinely justified (e.g. Supabase `as any` cast for untyped tables)
