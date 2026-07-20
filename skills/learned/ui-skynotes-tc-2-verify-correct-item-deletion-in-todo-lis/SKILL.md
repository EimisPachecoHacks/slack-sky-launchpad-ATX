---
name: ui-skynotes-tc-2: Verify correct item deletion in todo lis
description: >
  UI bug found while testing skynotes: Verify correct item deletion in todo list
metadata:
  slash-command: enabled
  source: learned
  slug: ui-skynotes-tc-2-verify-correct-item-deletion-in-todo-lis
---

## ui-skynotes-tc-2: Verify correct item deletion in todo lis

> Auto-authored learned skill. Captured from a past deployment failure so a
> future deployment can pre-empt the same problem.

### Error Signature

```
'Task B' is still visible in the todo list after the delete action. The page text shows 'Task B Delete', indicating it was not successfully removed, which violates the expected outcome that 'Task B' should be deleted while 'Task A' and 'Task C' remain.
```

### Root Cause

Objective: Ensure that when a user performs a destructive action to delete a specific todo item, only that exact item is removed and other items remain unaffected. — observed: 'Task B' is still visible in the todo list after the delete action. The page text shows 'Task B Delete', indicating it was not successfully removed, which violates the expected outcome that 'Task B' s

### Fix Pattern

Regression-check this scenario first on similar apps. Expected: 'Task B' is successfully removed from the list, while 'Task A' and 'Task C' remain visible and unaffected in the todo list.
