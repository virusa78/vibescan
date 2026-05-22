# Git Workflow and Branching Strategy

## Branches
- Use short-lived feature or fix branches.
- Keep one logical change per branch when possible.
- Do not mix unrelated refactors with a feature fix unless they are required to keep the tree working.

## Commits
- Use conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- Make commit messages describe the user-visible or system-visible change, not the mechanical edit.

## Pull Requests
- Keep PRs small enough to review in one pass.
- Include the commands you used to verify the change.
- Call out migrations, schema changes, and environment changes explicitly.

## Merge Hygiene
- Never hand-edit generated migration files.
- Never revert user changes you did not make.
- Preserve existing worktree state unless it blocks the current task.
- If a change affects runtime startup or dev scripts, verify the full local flow before considering it done.

