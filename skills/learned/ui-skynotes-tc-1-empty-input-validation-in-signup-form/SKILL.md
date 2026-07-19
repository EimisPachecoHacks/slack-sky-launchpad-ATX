---
name: ui-skynotes-tc-1: Empty input validation in signup form
description: >
  UI bug found while testing skynotes: Empty input validation in signup form
metadata:
  slash-command: enabled
  source: learned
  slug: ui-skynotes-tc-1-empty-input-validation-in-signup-form
---

## ui-skynotes-tc-1: Empty input validation in signup form

> Auto-authored learned skill. Captured from a past deployment failure so a
> future deployment can pre-empt the same problem.

### Error Signature

```
Only 'Error: name is required.' is visible; the page does not show 'Email is required' or 'Password is required' messages, so the expected validation errors for all empty required fields are not present.
```

### Root Cause

Objective: Verify that the signup form prevents submission when required fields are left blank and displays appropriate validation messages. — observed: Only 'Error: name is required.' is visible; the page does not show 'Email is required' or 'Password is required' messages, so the expected validation errors for all empty required fields are not prese

### Fix Pattern

Regression-check this scenario first on similar apps. Expected: The form rejects the submission and shows validation errors for each empty required field (e.g., "Name is required", "Email is required", "Password is required").
