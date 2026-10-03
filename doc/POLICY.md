# Policy: implementation and maintenance rules

This document defines the repository-wide implementation and maintenance rules
for `spa-reference`.

The policy is intentionally organized in three layers.

- Section 0 states the governing principle that constrains every later rule.
- Section 1 states general policy that remains meaningful independently of this
  repository's product, domain, language, framework, cloud, and layout.
- Section 2 specializes those principles for `spa-reference`.

Sections 0 and 1 are repository-independent policy principles. They are not a
template whose wording overrides repository-specific requirements. Section 2
contains the rules that follow from this repository's actual purpose,
requirements, architecture, operating model, compatibility commitments, and
release model.

This document is self-contained. A maintainer does not need a private standard,
an internal document, or another repository in order to apply it. Where a rule
is common across repositories, the rule is stated here. Where a rule exists
because of this repository, that specialization is stated in Section 2.

## 0. Governing Principle

**Simplicity is robustness.**

This is the governing principle for every rule below. It does not authorize
dropping required behavior, compatibility, security, safety, documentation, or
validation. It requires satisfying those requirements with no more complexity
than the actual problem justifies.

Complexity is itself a source of failure, compatibility risk, operational risk,
security risk, and maintenance cost. Do not add a branch, state variable,
helper, abstraction, dependency, network boundary, retry, fallback, validation,
configuration state, or framework unless the specification requires it or it
addresses a realistic failure mode with meaningful consequence.

Do not re-check a condition already guaranteed by a preceding successful
operation or an established invariant. Do not create a layer merely to resemble
a possible future architecture.

When two designs satisfy the same requirements, choose the one with less
control flow, less state, fewer dependencies, fewer side effects, fewer moving
parts, and fewer operational assumptions. Simplicity is judged by the number of
necessary concepts and behaviors, not by line count alone.

## 1. General Policy

### 1.1 Purpose and Scope

This section defines implementation and maintenance rules that remain meaningful
independently of a particular product, domain, language, platform, release
model, or repository layout.

The rules apply when the stated scope of a change reaches the behavior or
structure they govern. They do not, by themselves, authorize revisiting
unrelated existing content.

A repository's concrete purpose, architecture, compatibility commitments,
domain contracts, runtime topology, release model, and other repository-specific
requirements belong in its repository-specific policy or another authoritative
document.

### 1.2 Decision Priorities and Maintainer Judgment

Where more than one choice satisfies the stated purpose, judge the alternatives
in this order:

1. Preserve the stated scope and the intended, valid observable behavior that
   the change was not asked to alter.
2. Preserve security, safety, and privacy: do not destroy, overwrite, expose,
   publish, or broaden access to anything the change was not asked to touch.
3. Preserve the applicable specification and source-of-truth boundaries.
4. Prefer the simpler implementation with fewer dependencies, moving parts,
   side effects, states, and operational assumptions.

Where the applicable specifications and local documentation leave more than one
valid choice, an explicit maintainer decision settles that choice. A generic
best practice, a convention from another repository, a newer technique, or an
automated tool's preference does not override that decision.

### 1.3 Wording Strength

Reserve absolute wording such as `must`, `always`, and `never` for an invariant
that admits no reasonable exception.

Use wording such as `prefer`, `should`, or `when appropriate` for a design
preference, recommendation, or situational rule.

Do not write or apply a rule so that its literal wording defeats the rule's
purpose, the governing principle, the stated scope, security, safety, or
intended behavior. Where a lower-level wording and a higher-level policy purpose
conflict, follow the higher-level purpose and correct the lower-level wording.

This is not a formal MUST/SHOULD/MAY taxonomy.

### 1.4 Change Discipline and Observable Behavior

A change touches only what its stated purpose requires. Unrelated refactoring,
reformatting, modernization, cleanup, renaming, dependency work, feature work,
or documentation rewriting does not ride along with it, even when it would be a
reasonable change on its own.

Documentation work, policy work, review, diagnostics, cleanup, or another task
whose stated scope does not include implementation change does not expand into
implementation merely because an implementation improvement is noticed.

When the task does not require a behavior change, preserve the intended and
valid existing observable behavior of the affected content. That includes, as
applicable, control flow, processing order, continuation after failure, side
effects, output, exit status, options, defaults, configuration semantics,
persistent state, API behavior, file layout, generated results, and deployment
behavior.

A clear defect is not protected merely because current code exhibits it.
Correct it when correcting that defect is part of the stated purpose. Finding a
defect while doing unrelated work does not by itself add its correction to the
current scope.

When an authorized implementation change alters behavior or an interface that
the repository documents, update the directly affected documentation or
specification in the same coherent change. That requirement does not authorize
unrelated documentation cleanup.

Changing documentation does not silently change executable behavior. If a
document and implementation disagree, determine which side is wrong from the
applicable source of truth and change only the side included in the approved
purpose.

### 1.5 Repository-Wide and Local Rules

Repository-wide policy is the floor. A rule that applies only to one component,
language, platform, tool, directory, generated project, or other narrower scope
is kept with that scope when doing so makes the rule easier to find and less
likely to be misapplied.

A local rule may narrow what is permitted in its scope. It does not relax a
repository-wide security, privacy, attribution, licensing, safety, or
change-discipline rule.

Do not impose one implementation style mechanically across different languages,
platforms, components, or tools. Apply the native convention and the local
contract unless doing so conflicts with a repository-wide invariant.

### 1.6 Dependencies and Optional Capabilities

Minimize dependencies when doing so does not compromise the stated purpose or
make the implementation unreasonable. Dependency reduction is a design
preference in service of simplicity, not an end in itself.

A dependency or capability is required only on an execution path that actually
needs it. Do not make an optional capability a repository-wide prerequisite
merely because one component can use it.

Detect an optional capability where its result affects behavior. Its absence
must select behavior already allowed by the applicable contract: use an
established alternative, skip an optional operation, or refuse the affected
operation. Do not invent a fallback merely to keep processing.

Do not add a check whose only purpose is to reconfirm a state already guaranteed
by an established invariant or by a preceding successful operation. Add a
separate check only when the condition can vary independently and its result
changes safe behavior, reporting, fallback, or another observable choice.

Do not add two libraries that serve the same responsibility unless a concrete
requirement needs both.

### 1.7 Environment Differences

When the question is whether a capability exists or is usable, detect that
capability rather than using an operating-system, distribution, runtime,
terminal, or environment name as a proxy.

Use an environment identity only when the identity itself determines the fact
that varies, such as a platform-specific path, file format, API, system call, or
other genuinely environment-specific contract.

Keep one logical capability decision in one place. Do not answer the same
environment question independently in several locations when one established
decision can be reused.

### 1.8 Failure, Continuation, and Reporting

Treat these as separate decisions:

- whether an operation succeeded;
- whether later work may continue; and
- whether anything should be reported.

A missing required dependency or input, invalid state, failed invariant, or
another condition that makes correct completion impossible or would make
continuation invalid, inconsistent, destructive, or unsafe stops the affected
logical operation.

Do not turn a required failure into a warning merely to keep processing.

Independent later work may continue only when the applicable contract permits
it and the remaining result can still be coherent and valid.

A normal no-op, guard, intentionally inapplicable path, or supported absence is
not a warning merely because no work was performed and may be silent.

Do not add output merely to narrate ordinary control-flow choices. Report a
condition when a user or operator can act on the information, when diagnosis
requires it, or when an established interface requires it.

Do not hide an actual failure merely to keep logs quiet.

### 1.9 Security and Privacy

#### 1.9.1 Secrets

No API key, password, access token, refresh token, session credential, private
key, client secret, signing material, or equivalent secret, whether live,
expired, or of unknown status, is committed to the repository.

Examples and fixtures use invented values or clearly marked placeholders.

#### 1.9.2 Private Information

No private infrastructure information, customer information, non-public
organizational information, personal information not intended for publication,
or private production payload is committed to a public repository.

Where source, documentation, configuration, fixtures, or examples need such a
value, they use an invented value or an obvious placeholder.

#### 1.9.3 Existing Content

Where a secret or private information described above is found in existing
content, preservation of historical content does not justify keeping it.

Removal of an exposed secret from the current tree does not by itself revoke or
rotate that secret. Credential response follows the relevant provider or
operational process.

### 1.10 Safety and Side Effects

Code, tooling, or automation whose purpose is inherently destructive is not
prohibited merely because it is destructive. It must, however, act only on the
scope deliberately supplied to it or established by its contract rather than
broadening the target on its own.

Where destructive behavior is intentional, make that behavior and its affected
scope evident before execution through the applicable interface or
documentation.

Do not add a side effect that the stated purpose does not require. A safer- or
more defensive-looking implementation is not an improvement if it silently
widens the files, state, network resources, credentials, or external systems the
change can affect.

### 1.11 Privilege

Use only the privilege required by the work being performed.

Do not run an entire program, installer, build, test, or operation with elevated
privilege merely because one step requires it when elevated scope can be
confined to that step.

Do not add privilege acquisition, a broader execution identity, or wider access
as a defensive convenience.

Where elevated privilege or an alternate execution identity is part of intended
behavior, make that requirement and its affected scope explicit rather than
leaving it to be discovered during execution.

### 1.12 Naming, Comments, and Language

A new directory, file, identifier, endpoint, setting, or other named thing takes
a name that identifies it accurately and stably in the way it is ordinarily
referred to.

Name a thing by what it is, not by one incidental representation, interface, or
container it happens to use.

An existing public or stable path is not renamed only to bring it into line with
a later convention. Uniformity alone does not justify breaking references.

Comments and identifiers are written in English except where non-English text
is required by the product, protocol, localization, fixture, test data, or
text-processing behavior.

A comment preserves a reason, constraint, non-obvious intent, or decision that a
later change could otherwise undo. Do not use comments merely to restate code
whose operation is already evident.

### 1.13 Documentation

#### 1.13.1 Repository README

The root README is the repository entry point. It describes the repository's
purpose, the shortest supported path to use it, its high-level structure, and
the authoritative documents a user, contributor, or operator needs to find.

It does not duplicate detailed specifications whose source of truth is
elsewhere.

#### 1.13.2 Local Documentation

Behavior, interfaces, constraints, setup, or operating information that applies
only to one component, directory, tool, or other local scope is documented at
the narrowest stable location where a reader working in that scope will find it.

#### 1.13.3 Local Constraints

A local constraint may narrow what is permitted within its scope, but it does
not relax a repository-wide rule. Keep a local constraint with the scope that
owns it rather than duplicating it throughout unrelated documentation.

#### 1.13.4 Single Source of Truth

A concrete specification has exactly one authoritative home appropriate to the
responsibility that owns it. Other documents may link to or summarize that
specification for navigation, but they do not create a competing normative
copy.

Policy states implementation and maintenance rules. It does not duplicate
product, domain, architecture, protocol, API, or detailed behavioral
specifications whose source of truth belongs elsewhere.

#### 1.13.5 Reproducibility

User-facing instructions describe enough information for the intended reader to
perform the documented operation without repository-specific guesswork.

A quick start, tutorial, deployment guide, or operating procedure is incomplete
if a required repository-specific step exists only in source code, tribal
knowledge, a previous conversation, or an unstated assumption.

### 1.14 Pull Request Scope and History

A pull request presents the change it proposes, not the sequence of corrections
that produced it. It carries one coherent higher-level purpose.

#### 1.14.1 One Purpose to a Pull Request

- `Purpose` means the higher-level reason the pull request exists, not one
  finding, file, function, review comment, or mechanical edit.
- Several findings may belong to one purpose when they are part of the same
  cross-cutting investigation, maintenance task, defect class, migration,
  repository reorganization, or quality correction.
- Do not split a pull request mechanically by finding or file. Before splitting
  an approved work group, consider semantic coherence, shared files, merge
  conflicts, duplicated validation, branch and pull-request management cost,
  and whether the parts truly need independent review, rollback, or acceptance.
- Changes that serve different purposes are proposed separately, as a rule,
  even when they touch one file.
- An unrelated change noticed in passing is proposed separately.
- Tidying, renaming, reformatting, modernization, or cleanup that the approved
  purpose does not require is a different purpose and does not ride along.
- Work that cannot stand without the change is not a second purpose. Directly
  required documentation and an existing or explicitly approved test that
  proves the changed behavior belong to the change that requires them.
- Where separating parts would be artificial because neither part is correct or
  reviewable without the other, keep them together and state the shared
  purpose.

#### 1.14.2 One Coherent Change to One Commit

A branch that carries one coherent change carries it as one commit.

Revise that commit by amending it rather than adding chronology commits such as
`fix review comment`, `address feedback`, `follow-up`, or `resolve conflict`.

When rewriting a branch already pushed for review, use a safe lease-checked
force update rather than an unconditional force update.

A branch contains several commits only when it genuinely contains several
independent changes and the maintainer has explicitly chosen to group those
changes in one branch. The normal rule for this repository family is one
purpose, one pull request, one commit.

#### 1.14.3 Leaving No Trace of the Correction

Read each revision against the base branch, not merely against the previous
revision, so abandoned wording, code, comments, files, and temporary work do not
remain in the final diff.

A correction withdraws what it replaces rather than leaving both versions
standing.

Resolve conflicts with the base branch without introducing an unnecessary merge
commit into the review branch.

### 1.15 Validation and Judging a Change

Validation matches what changed and proves the property the change is meant to
preserve or establish.

- A documentation-only or policy-only change is not held to unrelated runtime
  tests.
- A source change is checked with the language- or project-appropriate syntax,
  build, static, test, or runtime validation that directly exercises what
  changed.
- Do not add a test framework, harness, mock infrastructure, dependency, or
  validation mechanism merely to make a small unrelated change look more
  formal.
- Passing an automated checker is evidence about an implementation; it is not
  permission to violate policy, specification, or scope.
- Review the final diff against the base branch and confirm that every changed
  file and every changed line belongs to the approved purpose.
- Validate documentation consistency whenever code and documentation describe
  the same changed behavior.
- A mandatory validation that was not run is not reported as PASS.
- Do not weaken an assertion, expected result, static rule, or validation scope
  merely to make a change pass.

Before accepting a change, ask whether it is the smallest coherent change that
serves its purpose, whether it alters behavior outside that purpose, whether it
adds an unnecessary dependency or side effect, whether it exposes private
information, and whether directly affected documentation remains correct.

### 1.16 Attribution and Licensing

Content adapted from an external article, answer, documentation example, source
file, dataset, or other third-party material credits its source and respects the
license or redistribution terms that apply to it.

Repository-owned content follows the repository's declared license. Third-party
code, data, documentation, assets, and dependencies retain or satisfy their
applicable licensing and attribution requirements.

The concrete repository license choice, license-text paths, copyright details,
and source-header metadata are repository-specific. They belong in the
repository-specific policy or authoritative license documents rather than in
this reusable General Policy.

## 2. `spa-reference`-Specific Policy

### 2.1 Product Position and Sources of Truth

`spa-reference` is a public reference implementation for
transactional business single-page applications. It demonstrates one coherent
way to compose React, TypeScript, NestJS, PostgreSQL-compatible persistence, and
the current AWS services described by the requirements.

It is not a universal framework and shall not grow abstractions merely to hide
the underlying technologies.

The authoritative responsibilities are separated as follows:

- [`REQUIREMENTS.md`](REQUIREMENTS.md) defines purpose, current and future
  scope, required capabilities, and supported boundaries.
- [`BASIC_DESIGN.md`](BASIC_DESIGN.md) defines architecture, component
  responsibility, dependency direction, topology, and architectural invariants.
- [`DETAILED_DESIGN.md`](DETAILED_DESIGN.md) defines implementation-significant
  semantics such as processing order, concurrency, recovery, authentication
  behavior, and provider-boundary behavior.
- [`../openapi/openapi.yaml`](../openapi/openapi.yaml) is authoritative for the
  concrete browser-facing HTTP contract.
- this `POLICY.md` defines implementation and maintenance rules.
- the user, developer, deployment, configuration, and operations guides explain
  how to use the implementation; they do not override the normative
  specifications above.

The precedence and ownership rules stated by the detailed design remain in
force. If implementation reveals a contradiction among authoritative sources,
implementation stops and the contradiction is corrected in the responsible
source of truth before implementation continues.

The repository shall remain understandable without a private standard, internal
document, another repository, or previous conversation.

### 2.2 Current Scope and Future Boundaries

Current and future architecture are not interchangeable.

The current implementation remains within the scope declared current by the
requirements and design. In particular, future concepts such as Java backends,
microservices, an orchestrator, an aggregator, service discovery, dynamic route
administration, Azure, or Google Cloud do not justify current implementation
complexity.

Preserve extraction boundaries required by the basic design, but do not build
the future component merely to prepare for it.

The sample domain remains generic. Do not introduce customer data, internal
company terminology, private process names, or business rules tied to a
specific organization.

The repository demonstrates ordinary framework and platform concepts rather
than hiding React, NestJS, HTTP, SQL, or AWS behind a second proprietary
framework.

### 2.3 Repository Structure and Ownership Boundaries

The architectural ownership boundaries in `BASIC_DESIGN.md` are maintained.

In particular:

- `frontend/` owns the React browser application.
- `backend/` owns the NestJS BFF and the current in-process business
  capabilities.
- `packages/ui/` owns reusable visual components that do not know the sample
  domain.
- `packages/api-client/` owns the browser API client generated from or
  mechanically synchronized with the OpenAPI contract.
- `openapi/` owns the concrete browser-facing HTTP contract.
- `infra/` owns the AWS infrastructure definition.
- `scripts/` and the local Compose definition own local-demo orchestration, not
  business logic.
- `doc/` owns the repository's specifications, guides, operational
  documentation, and license texts.
- `.github/workflows/` owns repository CI automation.

Do not move domain-specific UI into `packages/ui` merely to increase reuse.

Do not hand-maintain a second copy of the public API types.

Do not place provider-specific AWS types in domain or application code.

Do not put business rules in build scripts, deployment definitions, local-demo
orchestration, or generic routing code.

Generated output follows its established generation workflow. A generated file
is not manually edited merely because doing so is easier than changing its
source.

### 2.4 Source Code

#### 2.4.1 Purpose and Context

A reader opening a repository-authored source file shall be able to identify
what the file is and what responsibility it has without reverse-engineering the
entire implementation.

The header or nearby authoritative documentation supplies context that is not
obvious from the implementation itself.

A multi-file subsystem keeps detailed architecture and setup in its owning
documentation rather than repeating the same specification in every source
file.

#### 2.4.2 Language and Framework Conventions

TypeScript and React code follows the repository formatter, linter, strict type
configuration, and the conventions of the underlying framework.

Do not suppress a lint or type error merely to make validation pass.

Do not use `any` as a standing escape from type safety. An unavoidable untyped
external boundary is kept local and narrowed or validated before the value is
trusted.

Use normal React, NestJS, Prisma, AWS CDK, and Node.js concepts where those
frameworks already express the requirement adequately. Do not wrap an
underlying framework concept in a repository-specific abstraction without a
concrete need.

#### 2.4.3 Comments

Comments explain a reason, invariant, provider constraint, security boundary,
non-obvious failure rule, or design decision that a later maintainer could
otherwise undo.

Do not narrate self-evident code line by line.

Comments are written in English.

#### 2.4.4 Header Documentation

Repository-authored source files added by a change, and existing
repository-authored source files explicitly included in a header-documentation
maintenance change, carry a header appropriate to the file's language and
comment syntax.

The header identifies the file and its purpose. It contains:

- a first line naming the file and summarizing its responsibility;
- a `Description` section with enough context to understand the file's role;
- `Author: id774 (More info: https://id774.net)`;
- `Source Code: https://github.com/id774/spa-reference`;
- `License: The GPL version 3, or LGPL version 3 (Dual License).`;
- `Contact: idnanashi@gmail.com`;
- a `Version History` section, except for the plain configuration files
  described below.

A directly runnable repository script, application entry point, infrastructure
entry point, directly runnable test or evaluation entry point, or other file
whose invocation is part of its interface also records the applicable
`Usage`, `Build / Run`, or `Test` command and the practical `Requirements`
needed to execute it.

For a multi-file application, supporting modules keep a concise header with the
repository metadata and enough description to identify their role. They may
refer to the responsible entry point or documentation instead of duplicating
project-wide setup instructions and dependency lists.

A plain configuration file, whose content is declarative settings that carry no
logic of their own, has no meaningful per-file version and therefore carries no
`Version History` section. It still carries the rest of the header. Such files
are tool and runtime configuration files (for example the Vitest, Vite, ESLint,
and Prisma CLI configuration files), the nginx configuration files, the Docker
Compose definition, the CI workflow, and the `.env.example` sample.
Source files, test files, scripts, Dockerfiles, the Prisma schema, and the
OpenAPI contract are not plain configuration files and carry `Version History`.

The header `Version History` is the history of that source file itself. It is a
different scope from the repository-level `VERSIONS` file described in Section
2.22. In the current initial baseline, the first header entry of a
repository-authored source file is:

```text
v1.0 2026-10-03
     Initial release.
```

A header-only, comment-only, or formatting-only correction does not
mechanically bump the source-file version. A source-file version changes only
when that file has an independent behavior or specification change.

A repository version increase does not bump every source-file version at once,
and a source-file version change does not automatically increase the repository
version.

When a file format requires a leading directive such as a shebang, encoding
declaration, or other syntactically significant prefix, that directive remains
first and the header follows it.

Generated files, package-manager lockfiles, third-party source, and file formats
in which repository-authored comments are inappropriate or unsupported do not
receive an invented header.

A generated source file is governed by its generator and attribution rules, not
by manual header insertion.

An already committed database migration is not rewritten solely to normalize a
header. Migration immutability takes precedence over retrospective formatting.
A newly created repository-authored migration may carry a comment header when
the migration format and tooling support it without changing migration
semantics.

Header syntax follows the native comment convention of the file type. Do not
force one visual comment syntax across TypeScript, CSS, SQL, shell, Dockerfile,
or another format merely to make headers look alike.

Header documentation does not duplicate detailed API specifications, complete
file inventories, deployment procedures, or other information whose
authoritative home is a specification or guide.

### 2.5 Frontend

The frontend remains a React and TypeScript SPA organized around application
features.

Generic reusable visual components live in `packages/ui`. UI that knows the
sample request-and-approval domain remains in its owning feature.

The browser communicates with server-side business capabilities through the BFF
HTTP contract. Browser code does not connect directly to the database, S3, SES,
SNS, or another backend infrastructure service.

Frontend role visibility is presentation, not authorization. Hiding or
disabling a control never substitutes for server-side enforcement.

The SPA does not duplicate server-side role derivation or treat decoded token
claims as its own authorization source when the detailed design assigns that
responsibility to `GET /api/session`.

Browser authentication state, redirect state, and token persistence remain
within the security semantics defined by the detailed design. A UI refactor
does not silently weaken those semantics.

Presentation changes preserve semantic HTML, accessible names, keyboard use,
focus visibility, and sufficient contrast. Color alone does not carry required
meaning.

### 2.6 Backend and BFF

The current backend is one NestJS deployable containing the BFF and the current
local business capabilities.

A capability whose routing mode is local is invoked in process. The backend does
not make an HTTP request to itself to imitate a future service boundary.

Business rules live inside the capability that owns them, not in generic
routing, authentication middleware, local-demo adapters, or deployment code.

Domain and application code depend on no NestJS HTTP object, AWS SDK type, or
direct environment access.

Environment and deployment configuration are resolved at bootstrap and passed
as typed configuration.

BFF routing is resolved once at startup and is immutable for the lifetime of the
process.

A future extraction boundary is preserved only to the extent required by the
current design. Do not add a service registry, distributed transaction
coordinator, dynamic router, aggregator, orchestrator, or remote current
capability without a specification change that makes it current scope.

### 2.7 API Contract and Client Generation

`openapi/openapi.yaml` is the normative browser-facing HTTP contract.

A change to a public path, method, parameter, body, response schema, status code,
header, or public error contract changes the OpenAPI contract in the same
coherent change.

Public wire representations remain language-neutral. NestJS classes and
TypeScript-only representations do not become the browser contract merely
because the current backend is written in TypeScript.

Application errors use the problem-details contract and stable application
error semantics defined by the authoritative specifications.

A business state transition is represented by the explicit action contract
defined by the API. Do not introduce a generic status-update shortcut that
bypasses domain transition rules.

The generated or mechanically synchronized API client is updated from the
OpenAPI source. Do not hand-edit generated client output as an independent
second contract.

### 2.8 Authentication and Authorization

Amazon Cognito is the current identity provider for the AWS deployment. The
local demo uses its explicit local identity adapter.

The BFF remains the client-facing authentication and authorization boundary.
Every business operation enforces authorization on the server side regardless
of frontend visibility.

The local demo's fixed bearer tokens are non-secret development values. They
are accepted only when the backend is explicitly running in local mode.

AWS mode never accepts local demo tokens.

Local mode does not instantiate Cognito merely to preserve the shape of the AWS
deployment.

Access tokens, refresh tokens, private keys, client secrets, session
credentials, and raw authorization headers are not committed or logged.

Authentication and session changes preserve the callback, state-validation,
token-storage, sign-out, and session-reconstruction semantics defined by the
detailed design.

### 2.9 Persistence, Transactions, and Migrations

Persistence uses PostgreSQL semantics compatible with the current Aurora target.

Schema changes are represented by version-controlled migrations. Manual
database mutation is not a substitute for a migration.

A committed migration is treated as immutable history once it may have been
applied. Correct an earlier migration with a new migration rather than editing
the already committed migration, except before the migration has entered shared
history and the maintainer explicitly chooses to amend it.

Business state and required relational records that must succeed or fail
together use the local transaction boundary defined by the basic and detailed
design.

A request state transition and the audit event that records it remain one local
consistency boundary where the design requires them to be committed together.

External services do not participate in the local database transaction merely
because they are triggered by the same business action.

Optimistic concurrency conflicts are reported according to the defined contract
and are not silently retried into apparent success.

Local demo persistence uses the same application model and migration history as
the AWS-oriented application path.

### 2.10 Outbox and External Delivery

Business state and delivery intent are recorded in the same local transaction
where the design requires reliable post-commit delivery.

The outbox processor handles committed rows only.

Pending deliveries are claimed or locked according to the detailed design so
multiple workers do not intentionally process the same delivery concurrently.

Delivery is at-least-once. Do not claim exactly-once delivery.

Email and event-publication delivery state remain independently observable when
the design treats them as separate channels.

A failure in SES, SNS, or the corresponding local recorder does not roll back a
business transaction that has already committed. Retry, claim expiry, maximum
attempt, and terminal failure semantics remain those defined by
`DETAILED_DESIGN.md`; policy does not duplicate those numeric values.

Do not bypass the outbox in local mode merely because the external providers
have been replaced by local recorders.

### 2.11 Attachments and Object Storage

The application stores attachment content through the object-storage boundary
and relational attachment metadata through persistence.

AWS mode uses S3. Local mode uses the local object-storage adapter defined by the
design.

Authorization is enforced before an attachment is listed, uploaded, or
downloaded.

Attachment validation, file-name handling, size limits, accepted media types,
signature checks, state restrictions, cleanup behavior, and safe download
headers remain the semantics defined by the detailed design and OpenAPI
contract.

A local file-backed adapter confines storage to its configured data area and
does not permit path traversal or an object key to escape that area.

The repository contains no real private attachment or production payload as a
fixture.

### 2.12 Configuration, Bootstrap, and Runtime Modes

Configuration is resolved once at process bootstrap and passed as typed state.
Domain and application code do not read environment variables directly.

Missing or invalid required configuration fails bootstrap. Do not silently
start in a partially configured mode that disables a current required
capability.

`APP_MODE` explicitly selects the current infrastructure-adapter set.

`aws` is the deployment mode. It uses the AWS adapters and never accepts demo
tokens.

`local` is the local demonstration mode. It requires no AWS account, AWS
credential, Cognito configuration, S3 bucket, SES sender, or SNS topic and does
not instantiate those clients merely to start.

Frontend runtime configuration exposes only values safe for a browser.

Configuration names, defaults, and operator-facing setup belong in
`CONFIGURATION.md` and the deployment documentation. Policy defines the
boundary, not a duplicate environment-variable catalogue.

### 2.13 Local-First Runnable Path

The first runnable path for a new reader is the fully local demonstration.

The supported first-run path remains conceptually:

```text
clone
-> install repository dependencies
-> start the local demo
-> open the browser
-> exercise the representative workflow
-> confirm success
```

After repository dependencies and the required local database image are
available, application runtime for this first path requires no external account,
cloud credential, external identity provider, API key, or manually prepared
environment file.

Network access used to clone the repository, download package dependencies, or
pull the initial container image is dependency acquisition and does not turn
the application runtime into an external-service demo.

The local demo binds application services to loopback interfaces unless a
different exposure becomes an explicit requirement.

The local demo reuses the same application logic, HTTP API, database model,
authorization rules, migrations, and transactional outbox as the AWS mode. Only
the external infrastructure adapters differ.

A change shall not make the documented first-run path depend on AWS or another
external provider unless the requirements themselves are changed first.

`README.md` and `GETTING_STARTED.md` remain consistent with the actual first-run
behavior. A required first-run step is not left undocumented.

### 2.14 Logging, Audit, Health, and Error Boundaries

Operational logging and persisted business audit remain separate concerns.

Application logs are structured according to the implementation's logging
contract and support correlation through the trace identifier defined by the
design.

Logs do not contain bearer tokens, refresh tokens, secrets, private keys, full
private payloads, or credentials.

Provider diagnostic context may be logged only after redaction appropriate to
the value.

Public HTTP errors do not expose raw AWS errors, database connection strings,
private hosts, credentials, stack traces, or other infrastructure internals.

Liveness and readiness preserve the distinct semantics defined by the detailed
design. A health probe does not call unrelated external providers merely to look
more comprehensive.

Audit history records business events required by the domain model and does not
substitute for application logging. Application logging does not substitute for
business audit.

### 2.15 AWS and Infrastructure Boundary

AWS is the only current supported cloud deployment target.

The current provider set and deployment topology remain those declared by the
requirements and design. Do not add another cloud implementation, portability
layer, provider-selection framework, or service abstraction merely because a
future multi-cloud direction is documented.

Application-facing ports are defined by application need. AWS SDK types stop at
infrastructure adapters.

Infrastructure as Code lives under `infra/` and is validated with the
repository's established infrastructure workflow.

AWS permissions follow least privilege. Infrastructure definitions do not embed
credentials or secrets.

The production browser-facing topology, same-origin routing, health checks,
Cognito integration, and backend provider wiring remain consistent with the
basic and detailed design.

A local emulator stack is not introduced merely to imitate AWS when the explicit
local adapters already satisfy the local-demo requirement.

### 2.16 Dependencies and Package Management

The repository uses the package-management and workspace strategy committed in
the repository. The lockfile is committed and CI installs according to it.

Add a dependency only when the current requirements need the capability it
provides and the platform or existing dependency set does not already provide a
reasonable solution.

Prefer stable, maintained releases. Prerelease or nightly dependencies require a
specific reason tied to the approved purpose.

Do not introduce a second library for a responsibility already adequately served
by the existing stack.

Dependency upgrades are not mixed into unrelated feature, documentation, policy,
or design work.

Do not add a general-purpose framework to avoid writing a small amount of
repository-specific glue when the framework would add more concepts than it
removes.

### 2.17 Tests

The test boundaries defined by `BASIC_DESIGN.md` and the implementation
semantics defined by `DETAILED_DESIGN.md` remain authoritative.

- Domain tests perform no external I/O.
- Application tests replace infrastructure ports with test doubles where that
  is the established boundary.
- Backend integration tests use non-production infrastructure.
- Contract tests verify agreement among OpenAPI, backend behavior, and the API
  client.
- Frontend tests cover representative feature and session behavior.
- Ordinary tests do not require live Cognito, S3, SES, SNS, or production
  Aurora.
- A defect fix adds or updates an automated test that reproduces the defect when
  the existing test architecture can directly express it.
- A test expectation is not weakened to fit an implementation.

Do not create a new test framework, harness, fixture system, mock framework, or
test-only infrastructure merely because one small change needs validation.

A documentation-only or policy-only change is validated as documentation or
policy and does not require unrelated runtime tests.

A change to the local-first startup path is not complete until the actual
documented startup behavior has been exercised in an environment capable of
running it.

### 2.18 Continuous Integration and Build

GitHub Actions is the repository CI system.

Ordinary pull-request CI requires no production AWS credentials and does not
deploy to production.

The standard pipeline continues to validate the repository properties already
established by the project, including formatting, linting, type checking, tests,
builds, API-contract consistency, generated-client freshness, Prisma
validation, infrastructure synthesis, and container build validation where
those checks are part of the current workflow.

Do not disable, skip, weaken, or special-case a failing standard check merely to
land a change.

Generated outputs checked by CI are regenerated from their source rather than
edited to match the checker.

A CI change is itself subject to the same scope and validation discipline as
application code.

### 2.19 Documentation and User Experience

Repository documentation is written in English unless a concrete product,
protocol, fixture, or localization requirement needs another language.

The documentation responsibilities remain separated:

- `README.md` is the public entry point and shortest path into the repository.
- `GETTING_STARTED.md` takes a new reader from clone through the supported local
  demonstration and subsequent validation milestones.
- `USER_GUIDE.md` explains how the application is used by each role.
- `DEVELOPMENT.md` explains contributor development and validation.
- `CONFIGURATION.md` explains runtime configuration.
- `DEPLOYMENT.md` explains AWS deployment.
- `OPERATIONS.md` explains runtime operation and troubleshooting.
- the normative specifications retain their responsibilities defined in Section
  2.1.

A document shall not make a reader inspect source code to discover a required
repository-specific setup step that belongs in that document.

The local first-run path, button names, commands, URLs, role names, state names,
and other user-visible instructions remain synchronized with the implementation.

Documentation summarizes or links to normative specifications rather than
creating a second authoritative copy.

The README contains the repository's established `Primary Branch` and `License`
sections and identifies `master` as the primary branch.

Documentation and examples use only public, invented, or placeholder data.

### 2.20 Generated Files, Build Output, and Local Artifacts

Generated files are changed through their owning generator when the generator is
the source of truth.

Do not manually patch generated output and leave its source unchanged.

Whether a generated artifact is tracked is determined by the repository's
established workflow. Do not add or remove generated artifacts from version
control merely to satisfy personal preference.

Build output, caches, temporary files, local demo data, and other ignored local
artifacts remain outside version control unless the artifact itself becomes an
explicit repository deliverable.

A cleanup command removes only the local state that its documented contract
owns. It does not broaden deletion to unrelated user files or external
resources.

### 2.21 License and Attribution

This repository is dual licensed under the GPL version 3 or the LGPL version 3,
at the recipient's option.

The authoritative license notice is [`LICENSE.md`](LICENSE.md). The full license
texts are [`COPYING`](COPYING) and [`COPYING.LESSER`](COPYING.LESSER).

Repository-authored source carries the license metadata defined by Section
2.4.4 when that section applies.

Third-party code, documentation, data, assets, and dependencies retain or
satisfy their own copyright, license, notice, and attribution requirements.
Repository dual licensing does not erase a third party's terms.

Do not add third-party material merely because it is publicly accessible.
Confirm that the repository is permitted to redistribute it in the form being
committed.

### 2.22 Versioning and Release State

This repository has started repository-level versioning.

The authoritative repository version history is [`VERSIONS`](VERSIONS).

The initial repository version is `v1.0`, released on `2026-10-03`.

`doc/VERSIONS` is a release-level summary, not a raw commit log. A repository
version is created only when the maintainer establishes a release boundary; an
ordinary implementation, documentation, design, policy, or maintenance change
does not receive a new repository version automatically.

The first entry in `doc/VERSIONS` is `v1.0 (2026-10-03)` and contains only
`Initial release.` Earlier development chronology is not reconstructed into the
initial release entry.

Do not create more than one repository version on the same `YYYY-MM-DD`.
Independent changes released on the same date remain in that date's single
version entry.

The detailed entry-format rules are recorded at the end of `doc/VERSIONS` and
are part of the repository's version-history maintenance convention.

A source file's header `Version History` and the repository version history have
different scopes. A source-file version changes only when that file has an
independently meaningful behavior or specification change under the header
policy. A repository release does not mechanically bump every source-file
version, and a source-file version change does not mechanically create a
repository release.

The private npm workspace `version` fields and the OpenAPI `info.version` are
not the authoritative repository release version. They are changed only when
their own contract requires it, not merely because `doc/VERSIONS` changes.

Recording a version in `doc/VERSIONS` does not itself create or authorize a Git
tag or GitHub Release. A tag or GitHub Release is created only when the
maintainer explicitly instructs that operation.

### 2.23 Primary Branch and Change Integration

The primary branch is `master`.

A normal repository change starts from the current `master` unless an approved
task explicitly names another base.

The general rule in Section 1.14 applies: one coherent purpose is one pull
request and one commit.

A pull request is reviewed as the complete diff from `master` to its head. It is
not considered clean merely because the latest incremental commit looks
correct.

Merging a pull request is a human responsibility. An automated agent does not
merge a pull request unless the maintainer explicitly instructs it to do so.

### 2.24 Maintenance Standard

This repository is a maintained public reference implementation, not a
throwaway experiment.

Source, documentation, examples, tests, local startup, and deployment
definitions are expected to remain mutually understandable and reproducible at
the level promised by their authoritative documents.

That maintenance standard does not justify speculative complexity, unrelated
cleanup, or rewriting stable code for fashion. It means that when the
repository claims a supported path, contract, or example, that claim is kept
working and documented.

A reference implementation should make important decisions visible. It should
not require a reader to infer foundational policy, architecture, security
boundaries, runtime modes, or first-run behavior from scattered implementation
details.
