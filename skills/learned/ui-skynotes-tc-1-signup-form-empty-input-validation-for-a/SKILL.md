---
name: ui-skynotes-tc-1: Signup form empty input validation for a
description: >
  UI bug found while testing skynotes: Signup form empty input validation for all required fields
metadata:
  slash-command: enabled
  source: learned
  slug: ui-skynotes-tc-1-signup-form-empty-input-validation-for-a
---

## ui-skynotes-tc-1: Signup form empty input validation for a

> Auto-authored learned skill. Captured from a past deployment failure so a
> future deployment can pre-empt the same problem.

### Error Signature

```
The form only displays 'Error: name is required.' instead of showing validation error messages for all three empty required fields (name, email, and password) simultaneously as expected.
```

### Root Cause

Objective: Verify that the signup form prevents submission when required fields are left blank and displays appropriate validation messages for each empty field simultaneously. — observed: The form only displays 'Error: name is required.' instead of showing validation error messages for all three empty required fields (name, email, and password) simultaneously as expected.

### Fix Pattern

Regression-check this scenario first on similar apps. Expected: The form rejects the submission and displays specific validation error messages for all three empty required fields (e.g., 'Name is required', 'Email is required', and 'Password is required'), rather than only showing the error for the first empty field.
