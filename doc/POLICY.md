# Policy: implementation and maintenance rules

## 1. Purpose of this document

This document defines the rules used when implementing and changing
`spa-development-reference`.

It does not define what the repository is for or what it supports; that belongs
to [`REQUIREMENTS.md`](REQUIREMENTS.md). It does not define how the application
is composed; that belongs to [`BASIC_DESIGN.md`](BASIC_DESIGN.md). The concrete
browser-facing HTTP contract belongs to
[`../openapi/openapi.yaml`](../openapi/openapi.yaml).

This policy applies to every change, whether it is made by a person or by an
automated agent. If this policy conflicts with `REQUIREMENTS.md` or
`BASIC_DESIGN.md`, those documents take precedence and this policy shall be
corrected.

The document stands on its own. No private standard, internal document, or
other repository is required to apply it.

## 2. Governing principle

Simplicity is robustness.

A change shall add only what the current requirements need. Do not add an
abstraction, dependency, network boundary, fallback, retry, state, or framework
that no current requirement uses.

Future architecture described in the requirements and basic design (Java,
microservices, orchestrator, aggregator, Azure, Google Cloud) shall not be used
to justify added complexity in the current implementation. Preserving an
extraction boundary is required; building the future component is not.

## 3. Scope discipline

- One change modifies only the scope of its approved purpose.
- Unrelated cleanup, modernization, and refactoring do not accompany a change.
- A behavior change that requires an update to `REQUIREMENTS.md`,
  `BASIC_DESIGN.md`, or `openapi/openapi.yaml` shall not be implemented ahead of
  that update. The implementation and the directly affected specification are
  changed together.
- The classification of a capability as current or future is not changed for
  implementation convenience.
- A current limitation is not removed by implementing around it.

## 4. Public repository security and privacy

The repository is public.

- Do not commit credentials, tokens, passwords, private keys, real private host
  names or network addresses, customer data, or private organizational
  information.
- Examples and fixtures use invented data or clearly marked placeholders.
- Logs never contain bearer tokens, refresh tokens, secrets, private keys, or
  full private payloads.
- Source, configuration, commit messages, and pull request metadata contain no
  non-public information.
- Input received across a trust boundary is validated before it is treated as
  valid state.
- Permissions requested from AWS services follow least privilege.

## 5. TypeScript

- TypeScript strict mode is enabled for all TypeScript code.
- Public and cross-boundary types are explicit.
- `any` is not used to bypass type safety as a standing practice. An
  unavoidable untyped external boundary is kept local and validated or narrowed
  at that boundary.
- Formatting and linting are applied by repository-wide automated tooling.
- A lint or type error is fixed, not hidden by suppression alone.

## 6. Frontend

- The feature-oriented structure in `BASIC_DESIGN.md` is maintained.
- Generic reusable UI lives in `packages/ui`; UI that knows the sample domain
  lives in its owning feature.
- The SPA uses server-side behavior only through the BFF contract.
- A hidden or disabled control is never treated as authorization.
- The browser bundle contains no secret.
- Public API types are generated from, or mechanically synchronized with,
  `openapi/openapi.yaml`. They are not hand-maintained as a second copy.

## 7. Backend and BFF

- The BFF is the browser-facing boundary.
- A capability whose routing mode is `local` is invoked by an in-process call.
  The backend never makes an HTTP request to itself to imitate a remote
  boundary.
- Business rules live inside a capability boundary, not in generic routing or
  authentication code.
- Domain and application code depend on no NestJS HTTP object, no AWS SDK type,
  and no direct environment access.
- Environment and deployment configuration is resolved at bootstrap and passed
  on as typed configuration.
- BFF routing is resolved once at startup and is immutable for the lifetime of
  the process.

## 8. API

- `openapi/openapi.yaml` is the normative browser-facing HTTP contract.
- No implementation-specific exception representation becomes part of the wire
  contract.
- Errors use `application/problem+json` and carry a stable application `code`
  and a `traceId`.
- A state transition is expressed as an explicit action endpoint, not as an
  arbitrary status update.
- A behavior change that alters the OpenAPI contract updates the contract in the
  same change.

## 9. Persistence and transactions

- Aurora PostgreSQL-compatible semantics are assumed.
- Schema changes are version-controlled migrations. Manual database mutation is
  not a substitute for a migration.
- Required relational writes follow the local transaction boundaries in
  `BASIC_DESIGN.md`.
- SES and SNS calls are never made inside a database transaction.
- An optimistic concurrency conflict is reported to the caller and is never
  silently retried.

## 10. Outbox

- Business state and delivery intent are recorded in the same local
  transaction.
- The outbox processor handles only committed rows.
- Pending deliveries are claimed or locked so that multiple backend tasks do not
  intentionally process the same delivery at the same time.
- External delivery is at-least-once. Exactly-once delivery is not claimed.
- Success and failure are tracked independently for each delivery channel.

The initial defaults are:

| Setting | Default |
| --- | --- |
| Poll interval | 5 seconds |
| Maximum automatic attempts | 5 |
| Retry delay after attempt 1 | 30 seconds |
| Retry delay after attempt 2 | 120 seconds |
| Retry delay after attempt 3 | 600 seconds |
| Retry delay after attempt 4 | 1800 seconds |

A failure of attempt 5 marks the delivery `FAILED`, and automatic retry stops.

These defaults are deployment configuration and may be overridden at
deployment. An invalid value fails during bootstrap and is never silently
normalized.

## 11. AWS boundary

- Application-facing ports are defined by application need, not by AWS SDK
  shape.
- AWS SDK types do not leak into the domain or the public API.
- The Cognito, S3, SES, and SNS adapters convert provider-specific failures into
  application infrastructure errors.
- No second-cloud implementation is added to the current code.

## 12. Logging and audit

- Structured operational logging and persisted business audit are separate.
- `traceId` correlates a request or operation across logs and error responses.
- An audit event is written in the same local transaction as the business state
  change it records.
- Application logs never substitute for audit history.

## 13. Dependencies

- Add a dependency only when a requirement needs the capability it provides.
- Use stable, maintained releases. Prerelease and nightly builds are not normal
  dependencies.
- Do not introduce two libraries for the same purpose.
- Commit the package manager's lockfile; CI installs according to it.
- Dependency updates are not mixed into unrelated feature changes.

## 14. Tests

The test boundaries in `BASIC_DESIGN.md` are repository policy.

- Domain tests perform no external I/O.
- Application tests replace ports with test doubles.
- Backend integration tests use non-production infrastructure.
- Contract tests verify that `openapi/openapi.yaml`, the backend, and the
  generated client agree.
- Frontend tests cover representative feature behavior.
- Ordinary CI does not use live Cognito, S3, SES, SNS, or production Aurora.
- A bug fix adds an automated test that reproduces the defect and proves the
  fix.
- A test expectation is not weakened to fit an implementation.

## 15. Continuous integration

- GitHub Actions is used.
- Ordinary pull request CI requires no production AWS credentials.
- CI verifies formatting, linting, type checking, tests, frontend and backend
  builds, OpenAPI validation, and container build validation, as required by
  `REQUIREMENTS.md` and `BASIC_DESIGN.md`.
- Standard CI never deploys to production.

## 16. Source licensing

A newly added source code file carries a header stating the repository's dual
license, in a file type that supports comments:

```text
License: The GPL version 3, or LGPL version 3 (Dual License).
```

The header is written in the comment syntax of the file type.

It is not forced onto generated files, lockfiles, or formats such as JSON or
YAML where a comment header is inappropriate or not allowed.

## 17. Documentation

- `REQUIREMENTS.md`: purpose, scope, and what the repository provides.
- `BASIC_DESIGN.md`: composition, responsibility, dependency, and flow.
- `POLICY.md`: implementation and maintenance rules.
- `openapi/openapi.yaml`: the concrete browser-facing HTTP contract.
- `README.md`: the repository entry point.

The same normative specification is not duplicated as authoritative in more
than one document.

## 18. Versioning

The repository has not started versioned releases. A version number is not
assigned per implementation change.

If a versioned unit is introduced later, no more than one version number is
created for the same versioned unit on the same `YYYY-MM-DD`. Later changes on
that date are merged into that day's single version entry.

## 19. Primary branch and change integration

- The primary branch is `master`.
- Merging a pull request is a human responsibility.
- An automated agent does not merge a pull request unless explicitly told to.
