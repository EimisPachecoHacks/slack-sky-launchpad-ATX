---
name: ui-clicking-generate-architecture-gives-no-
description: >
  The fix adds a loading overlay to UseCaseForm that displays when generation is in progress, using existing state and logic. The submit button is also explicitly
metadata:
  slash-command: enabled
  source: learned
  slug: ui-clicking-generate-architecture-gives-no
---

## ui-clicking-generate-architecture-gives-no-

> Auto-authored learned skill. Captured from a past deployment failure so a
> future deployment can pre-empt the same problem.

### Error Signature

```
Clicking Generate Architecture gives no visible loading feedback, so the user clicks repeatedly and fires duplicate generation requests. The submit button is not disabled while the request is in flight.
```

### Root Cause

The UseCaseForm component was missing JSX to render a loading state when the `isGenerating` prop was true. Additionally, the 'Generate Architecture' button was not explicitly disabled, allowing users to click it multiple times and trigger duplicate requests before the UI updated.

### Fix Pattern

The fix adds a loading overlay to UseCaseForm that displays when generation is in progress, using existing state and logic. The submit button is also explicitly disabled and its text and icon are updated to reflect the loading state, preventing duplicate submissions.
