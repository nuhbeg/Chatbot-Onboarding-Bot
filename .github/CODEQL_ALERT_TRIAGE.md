# CodeQL alert triage

Checked 2026-10-26 against the repository `nuhbeg/Chatbot-Onboarding-Bot`.
The default branch is `main` (`fdba5fc5a08880c9671227d12916fac1a10b770c`).
GitHub's code-scanning alerts API returned **zero open alerts** for `main`
and zero open alerts across all refs.

## Recently fixed findings reviewed

| Finding | Severity | Triage |
| --- | --- | --- |
| [`js/bad-code-sanitization`](https://github.com/nuhbeg/Chatbot-Onboarding-Bot/security/code-scanning/1) | Medium | Actionable, not a false positive: discovered mockup paths were interpolated into generated import code. The default-branch source now JSON-encodes and escapes unsafe characters before generating the module. GitHub marks the alert fixed. |
| [`js/polynomial-redos`](https://github.com/nuhbeg/Chatbot-Onboarding-Bot/security/code-scanning/2) | High | Actionable, not a false positive: trimming trailing slashes from the caller-provided base URL used a regex that CodeQL identified as potentially slow on repeated input. The source now uses a backwards character scan; GitHub marks the alert fixed. |

Neither finding is unreachable code or a dismissed alert. Both are fixed on
the default branch, so there is no remaining open finding to prioritize or fix.
