# Seal browser SDK 1.0.1

Candidate package; not yet published. Reports browser errors to `/api/v1/ingest` using `X-API-Key`, `app_name`, `environment`, `error_type`, `error_message`, `stack_trace`, `code_context`, and `severity`.

```js
Seal.init({apiKey: 'BROWSER_PROJECT_KEY', appName: 'Frontend', environment: 'production'});
```

Use a dedicated browser project key; values embedded in browser code are public. Do not embed backend signing or encryption secrets. Global application error handlers are preserved.

The SDK does not evaluate downloaded JavaScript. Optional `rescueEngine: true` and an explicit `onApprovedPatches(candidates)` callback expose approved candidates to application-owned review/application logic. The callback must implement validation, application and rollback. The feed requires app/environment scope and returns an array with `hash`, `patchCode`, `patch_id`, and `patch_version`. Enabling the rescue setting alone does not execute code.

`npm test` verifies the contract and absence of automatic code execution. Publish only after backend scope/approval changes are deployed and the dedicated application pilot passes.
