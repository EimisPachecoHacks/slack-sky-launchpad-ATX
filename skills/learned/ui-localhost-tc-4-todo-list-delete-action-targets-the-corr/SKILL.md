---
name: ui-localhost-tc-4: Todo list delete action targets the corr
description: >
  UI bug found while testing localhost: Todo list delete action targets the correct item
metadata:
  slash-command: enabled
  source: learned
  slug: ui-localhost-tc-4-todo-list-delete-action-targets-the-corr
---

## ui-localhost-tc-4: Todo list delete action targets the corr

> Auto-authored learned skill. Captured from a past deployment failure so a
> future deployment can pre-empt the same problem.

### Error Signature

```
Expected 'Task B' to be removed while 'Task A' and 'Task C' remain. However, the visible page text shows 'Task B' is still present in the list and 'Task A' is missing, indicating the destructive action did not target the correct item or 'Task A' was incorrectly removed.
```

### Root Cause

Objective: Verify that deleting a specific todo item removes only that exact item and does not affect other items in the list (destructive action accuracy). — observed: Expected 'Task B' to be removed while 'Task A' and 'Task C' remain. However, the visible page text shows 'Task B' is still present in the list and 'Task A' is missing, indicating the destructive actio

### Fix Pattern

Regression-check this scenario first on similar apps. Expected: Only 'Task B' is removed from the list. 'Task A' and 'Task C' remain visible and intact, confirming the destructive action targeted the correct item without unintended side effects.
