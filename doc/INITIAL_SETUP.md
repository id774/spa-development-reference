# Initial repository setup procedure

## 1. Purpose

This document defines the standard sequence for creating a new software
repository based on the development approach demonstrated by
`spa-reference`.

The purpose of the sequence is to establish the authoritative documents before
implementation begins, so that implementation work consumes specifications
instead of becoming the place where missing specifications are invented.

The procedure applies to a new repository or to a new software product that is
being established as an independent repository.

The procedure is intentionally ordered. A later stage shall not be used to
compensate for an incomplete earlier stage.

## 2. Governing rule

Define the source of truth before implementing the system.

Requirements, architecture, implementation policy, public contracts, and other
normative documents exist so that implementation instructions can remain small
and unambiguous.

If an implementation instruction must restate requirements, architecture,
public API semantics, retry policy, transaction semantics, security boundaries,
or another design decision because the repository does not define them, the
repository specification is incomplete.

In that case, stop the implementation preparation and correct or add the
authoritative document first.

Do not hide a missing specification inside an AI-agent work instruction.

## 3. Canonical sequence

The standard sequence is:

```text
Repository creation
        |
        v
License
        |
        v
Requirements
        |
        v
Basic design
        |
        v
Detailed design, when required
        |
        v
Implementation-readiness review
        |
        +--> missing normative document -> create or correct it -> review again
        |
        v
Initial implementation
        |
        v
Implementation validation
        |
        v
README and documentation completion
        |
        v
Release-quality review
        |
        v
Initial repository version record
```

Each stage has a different responsibility. Do not merge stages merely to reduce
the number of documents.

The initial repository version is recorded only after the release-quality
review establishes the completed baseline. Recording that version does not
implicitly create a Git tag or GitHub Release.

## 4. Repository creation

Create the repository before application implementation.

At this stage, decide only repository-level facts that must exist before the
specification work can begin.

At minimum, establish:

- repository name;
- repository visibility;
- primary branch;
- repository ownership;
- intended high-level purpose; and
- the location of repository documentation.

For this development approach, repository-wide documents live under `doc/`
unless the repository has an explicit reason to use another structure.

The repository may initially contain only a minimal `README.md` containing the
repository name. That placeholder is not the final README.

Do not generate an application scaffold merely to make the repository look
complete.

Do not allow generated framework defaults to become the de facto architecture
before the architecture has been defined.

Repository creation capability is an execution concern. If the available AI
environment cannot create a repository, create it through GitHub or another
authorized mechanism and continue from the created repository. Do not claim
that an unavailable capability exists.

## 5. License

Add the repository license before substantive source code is introduced.

The license establishes the legal terms under which later source and
documentation are published. It shall not be postponed until after
implementation.

For a repository using the same licensing model as this reference, maintain:

```text
doc/LICENSE.md
doc/COPYING
doc/COPYING.LESSER
```

The selected license is a repository-level decision. Do not let a generated
framework template silently introduce another license.

Where source-file license headers are required by repository policy, define the
header rule in the implementation policy before the initial implementation is
written.

## 6. Requirements definition

Create `doc/REQUIREMENTS.md` before basic design or implementation.

The requirements document defines what the system is and what it is not.

It shall establish, as applicable:

- purpose;
- target users or application class;
- supported scope;
- non-scope;
- current capabilities;
- future or conceptual capabilities;
- externally observable behavior;
- public interfaces that must exist;
- security and privacy requirements;
- compatibility requirements;
- operational requirements;
- testing and CI requirements;
- deployment targets;
- data and persistence requirements; and
- the boundary between current support and future direction.

The requirements document shall not contain unnecessary implementation detail.

A future direction is not a current requirement. State that distinction
explicitly where confusion is possible.

The requirements document shall stand on its own. A public repository shall not
require access to private company standards, internal project documents,
customer information, or non-public infrastructure documentation to understand
its requirements.

Before moving to basic design, review the requirements for unresolved decisions
that would materially change architecture or observable behavior.

## 7. Basic design

Create `doc/BASIC_DESIGN.md` after requirements are stable enough to design the
system.

The basic design explains how the current requirements are composed at system
and component level.

It shall define, as applicable:

- runtime topology;
- major components;
- component responsibilities;
- dependency direction;
- browser, API, backend, database, and external-service boundaries;
- data flow;
- control flow;
- persistence model;
- transaction boundaries;
- authentication and authorization boundaries;
- error and failure boundaries;
- logging and audit responsibilities;
- configuration boundaries;
- deployment shape;
- test boundaries;
- current architectural invariants; and
- future extraction or extension boundaries where requirements require them.

The basic design shall not pre-implement future architecture.

For example, if microservices are a future direction, the design may preserve
an extraction boundary without implementing a service registry, distributed
transaction coordinator, or network hop in the current system.

The basic design may intentionally leave internal implementation choices open
when those choices do not alter the requirements or architecture.

Examples include:

- exact file names;
- class names;
- private helper structure;
- package manager;
- ORM;
- test runner;
- logging library; and
- Infrastructure as Code tool.

Those choices may be delegated to detailed design or implementation work if the
repository policy permits it.

## 8. Detailed design when required

A separate detailed-design document is optional.

Create one when implementation would otherwise require the implementer to make
a decision that changes the meaning of the system but is too detailed for the
basic design.

Typical reasons include:

- a complex state machine;
- non-trivial retry and recovery semantics;
- a public binary or file format;
- a complex protocol;
- migration sequencing;
- distributed consistency rules;
- a security-sensitive control flow;
- a detailed batch-processing algorithm;
- a compatibility-sensitive internal extension mechanism; or
- another design where several plausible implementations would produce
  materially different behavior.

Do not create a detailed-design document merely because implementation has
classes, functions, or files.

If the remaining choices affect only internal structure and all choices satisfy
the same requirements and basic design, they may be delegated to the
implementation task.

When a detailed-design document is created, give it one clear authoritative
scope and do not duplicate the same normative decision across several
documents.

## 9. Implementation-readiness review

Before preparing the initial implementation instruction, review the complete
specification set.

This review is mandatory.

The purpose is to answer one question:

> Can an implementer build the current scope without inventing a requirement,
> public contract, architectural rule, operational rule, or failure semantic?

If the answer is no, implementation shall not begin.

### 9.1 Review the authoritative document set

Inspect at least:

- `doc/REQUIREMENTS.md`;
- `doc/BASIC_DESIGN.md`;
- any detailed-design document;
- repository policy;
- public API or protocol contract;
- data contract where one is required;
- migration or schema contract where one is required;
- security policy where one is required;
- test and CI policy; and
- deployment requirements.

Not every repository needs every document.

The rule is not "create a fixed list of files." The rule is "every normative
decision required by implementation must have an authoritative home."

### 9.2 Detect missing normative documents

A missing document exists when an existing specification delegates a required
decision to another authoritative artifact that does not exist.

Examples:

- requirements say implementation rules belong to `POLICY.md`, but
  `POLICY.md` does not exist;
- basic design says retry defaults are defined by policy, but policy does not
  define them;
- requirements say OpenAPI is the public HTTP contract, but no OpenAPI document
  exists;
- implementation depends on a file format whose schema is not defined;
- deployment depends on a configuration contract that has not been specified.

These are specification defects, not implementation details.

Correct them before implementation.

### 9.3 Do not repair specification defects in the implementation instruction

The implementation instruction is not an emergency location for missing
architecture or product decisions.

If the instruction starts accumulating sections that repeat or invent:

- endpoint definitions;
- request or response schemas;
- transaction rules;
- retry defaults;
- authorization rules;
- state transitions;
- supported platform decisions;
- future-versus-current classification; or
- other normative system behavior,

stop and determine whether those items belong in an authoritative repository
document.

If they do, add or correct that document first.

### 9.4 Readiness result

The repository is implementation-ready only when:

- requirements are internally consistent;
- basic design realizes the requirements without silently expanding them;
- required detailed design is complete;
- implementation policy exists when implementation rules are delegated to it;
- required public contracts exist;
- current and future scope are distinguishable;
- no implementation-critical placeholder remains; and
- remaining undecided items are legitimate implementation details.

Record no "temporary exception" that allows implementation to begin while a
known normative gap remains.

## 10. Initial implementation

Only after the implementation-readiness review passes, create the initial
implementation task.

The task shall treat the repository specifications as sources of truth.

The implementation instruction should therefore be small.

Its normal form is:

1. identify the repository and base branch;
2. identify the authoritative documents;
3. instruct the implementer to implement the current scope defined by those
   documents;
4. state which detailed-design categories are delegated;
5. prohibit implementation of future or conceptual scope;
6. state test and validation requirements;
7. define branch, commit, push, and pull-request requirements; and
8. define completion and blocker conditions.

Do not copy the requirements and basic design into the implementation
instruction.

Do not create a second normative specification inside an AI-agent prompt.

The first runnable path for a person who has just cloned the repository shall
not depend on cloud accounts or external services. Provide a fully local
demonstration that reuses the real application logic and replaces only external
infrastructure adapters by explicit configuration, and state it first in the
README.

### 10.1 Delegated implementation detail

The initial implementation task may delegate details such as:

- file and symbol selection;
- class and function decomposition;
- private data structures;
- framework wiring;
- package-manager details;
- ORM selection where not otherwise fixed;
- test-file placement;
- mock and fixture implementation;
- logging-library selection;
- IaC-tool selection; and
- validation command selection.

Delegation is permitted only where different choices do not change an
authoritative requirement or architectural boundary.

### 10.2 Initial implementation scope

The initial implementation shall implement the current supported scope.

It shall not implement future architecture simply because the future direction
is already documented.

A reference repository should demonstrate a coherent working baseline, not a
collection of speculative extension points.

## 11. Implementation validation

The initial implementation is not complete when source files merely exist.

Validate the repository according to its policy and specifications.

Typical validation includes:

- reproducible dependency installation;
- formatting;
- lint;
- static or type checking;
- unit tests;
- integration tests;
- contract tests;
- frontend tests where applicable;
- build;
- container build;
- schema or migration validation;
- API-contract validation;
- deployment-definition validation;
- credential and private-information checks; and
- final diff and scope checks.

Validation requirements come from the repository, not from an arbitrary generic
checklist.

A failed mandatory validation is not converted into success by weakening tests,
changing requirements, or removing checks.

## 12. README and documentation completion

Write or substantially expand the README after the initial implementation is in
place and validated.

The final README describes the repository as it exists in its usable state.

It is not a development diary.

Do not make the normal README say:

- implementation has not started;
- a future task will add the application;
- the repository is currently waiting for another phase; or
- temporary work-in-progress details that cease to be true after initial
  implementation.

The README should explain, as applicable:

- what the repository is;
- what it demonstrates;
- supported scope;
- principal features;
- architecture overview;
- technology stack;
- installation or setup;
- local execution;
- testing;
- deployment;
- repository structure;
- authoritative documents;
- primary branch; and
- license.

The README summarizes authoritative documents; it does not replace them.

If implementation exposed a genuine defect in the requirements, design, policy,
or contract, correct the authoritative document deliberately. Do not silently
rewrite the README to match an accidental implementation divergence.

## 13. Other documentation after implementation

After the implementation is stable, complete other documentation whose content
depends on actual implementation details.

Examples include:

- operations;
- deployment;
- local development;
- configuration reference;
- migration procedures;
- troubleshooting;
- generated API reference; and
- release procedures.

Do not write detailed operational instructions before the relevant behavior
exists unless those instructions are themselves required design inputs.

Documentation order follows dependency: a document should not pretend to
describe implementation that has not yet been determined.

## 14. Release-quality review

Before treating the initial repository as a completed baseline, perform a
release-quality review.

Confirm that:

- implementation matches requirements;
- implementation matches basic design;
- implementation policy is followed;
- public contracts match implementation;
- tests and CI enforce the intended behavior;
- documentation describes the completed system;
- no development-only placeholder is presented as permanent behavior;
- no future capability is accidentally presented as current;
- no secret or private information is present;
- license files are present and consistent;
- repository versioning policy and the planned initial version record are
  consistent;
- source-file version-history rules, when used, are consistent with the
  repository versioning policy; and
- repository history and pull requests contain only the intended scope.

If the review finds a specification defect, correct the authoritative
specification and the affected implementation together.

### 14.1 Initial repository version record

After the release-quality review passes, create or update `doc/VERSIONS` as the
repository-level release history when this development approach is used.

The initial entry records one release baseline, not the development chronology
that led to it. The lowest entry contains only `Initial release.`.

Do not create more than one repository version for the same calendar date.
Independent changes completed on that date remain within that date's single
repository version.

Repository version history and source-file `Version History` have different
scopes. A repository version does not mechanically bump every source file, and
a source-file version does not mechanically create a repository release.

Recording a version in `doc/VERSIONS` does not create or require a Git tag or
GitHub Release. Either is a separate maintainer decision.

## 15. Document responsibilities

Keep normative responsibilities distinct.

| Artifact | Responsibility |
| --- | --- |
| `README.md` | Public entry point and overview of the completed repository |
| `doc/REQUIREMENTS.md` | Purpose, scope, required behavior, current and future capability |
| `doc/BASIC_DESIGN.md` | System composition, responsibility, dependency, data and control flow |
| Detailed-design document | Implementation-significant design not suitable for basic design |
| `doc/POLICY.md` | Implementation and maintenance rules |
| `doc/VERSIONS` | Repository-level version and release history |
| OpenAPI or equivalent contract | Concrete public protocol or API |
| Deployment / operations documents | How the implemented system is deployed and operated |
| License documents | Legal terms |

Do not make an AI-agent task instruction the authoritative home of product or
architecture semantics.

## 16. Anti-patterns

The following are process errors.

### 16.1 Writing the final README before the initial implementation

A README that describes the temporary construction phase quickly becomes wrong
and encourages progress status to be confused with product documentation.

### 16.2 Repeating requirements inside the implementation instruction

This creates two competing sources of truth and makes later maintenance
ambiguous.

### 16.3 Filling a missing design decision inside an agent prompt

If a decision is important enough to constrain implementation, it belongs in an
authoritative repository document.

### 16.4 Implementing before checking document completeness

The existence of `REQUIREMENTS.md` and `BASIC_DESIGN.md` does not prove that
the specification set is complete.

The readiness review must examine what those documents delegate to other
documents.

### 16.5 Treating future architecture as current work

Documenting an extraction path does not mean implementing the extracted service.

### 16.6 Creating documents mechanically

Not every repository needs the same document list.

Create a document because it owns a necessary class of decisions, not because a
template contains that file name.

### 16.7 Letting generated scaffolding decide architecture

Framework-generated defaults are implementation material, not a substitute for
requirements or architecture.

## 17. Completion checklist for a new repository

Before declaring the initial repository baseline complete, confirm:

- [ ] The repository exists with the intended name, visibility, ownership, and
      primary branch.
- [ ] The intended license is present before substantive implementation.
- [ ] `REQUIREMENTS.md` defines purpose, scope, non-scope, current behavior, and
      future direction.
- [ ] `BASIC_DESIGN.md` defines the current architecture and architectural
      invariants.
- [ ] Required detailed design exists where basic design is not sufficient.
- [ ] Every normative artifact referenced by another specification actually
      exists.
- [ ] Implementation policy exists when implementation rules depend on it.
- [ ] Repository-level version history exists when this development approach
      uses `doc/VERSIONS`, and its initial entry matches the release baseline.
- [ ] Required public API, protocol, schema, or data contracts exist.
- [ ] The implementation-readiness review has no unresolved normative gap.
- [ ] The initial implementation was produced from the authoritative documents,
      not from duplicated prompt specifications.
- [ ] Mandatory validation passes.
- [ ] The README describes the completed baseline rather than temporary
      development status.
- [ ] Supporting documentation matches the implemented system.
- [ ] Current and future capabilities are not confused.
- [ ] No private information or credential is present.
- [ ] Repository version history and source-file version-history policy are
      mutually consistent.
- [ ] License, documentation, implementation, tests, and CI are mutually
      consistent.

Only after these conditions are satisfied, and the initial repository version
record has been established where applicable, is the initial repository setup
complete.
