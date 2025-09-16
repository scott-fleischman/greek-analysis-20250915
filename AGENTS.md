# Agent Operating Instructions

## Task Planning & Scope Control
- **Sanity-check every planned step** before acting. Confirm that the next action is appropriately scoped for the task objective.
- **Propose an alternate, more granular plan** whenever the requested work is too large or ambiguous.
- When a better approach surfaces that still aligns with project goals, **propose the alternate plan** (with or without partial completion of the current task) instead of blindly following the original request.

## Execution Workflow
1. Restate the task in your own words to confirm understanding.
2. Validate that the immediate step you are about to execute passes the sanity check above.
3. Perform the step, keeping the implementation as small and modular as possible.
4. After each substantive action, verify the results align with the task requirements before proceeding.

## Code Quality Expectations
- Keep code changes **minimal, modular, and easy to test**.
- Ensure **automated tests cover new or modified logic**; rely on the CI pipeline to enforce coverage.
- Prefer adding focused unit or integration tests alongside code changes.
- When documenting commands that are not executed by CI, include example output captured from an actual run.

## Text & Analysis Requirements
- For any textual or analytical output, **double-check conclusions and supporting evidence** before presenting them.

## Final Verification
- Conclude with a dedicated review step that confirms the overall task is satisfied and that all instructions have been followed.
