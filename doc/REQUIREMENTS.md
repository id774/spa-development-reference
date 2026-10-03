# Requirements: an SPA development reference application

## 1. Purpose of this document

This document states what `spa-development-reference` is for, what kind of
application it demonstrates, which capabilities it is required to cover, which
architecture is currently supported, and where its responsibility ends.

It defines requirements and architectural boundaries, not implementation
details. The detailed composition of modules, dependency direction, deployment
topology, and concrete implementation choices belong to
[`BASIC_DESIGN.md`](BASIC_DESIGN.md). The rules used when implementing or
changing the repository belong to [`POLICY.md`](POLICY.md).

This document stands on its own. Nothing in it depends on a private document,
an internal standard, another repository, or information that is not publicly
available from this repository.

Where this document describes a capability as **current**, that capability is
part of the supported reference architecture. Where it describes a capability
as **future**, **planned**, or **conceptual**, that capability records an
extension direction and is not a requirement on the current implementation.

## 2. Name and position

The repository is named `spa-development-reference`.

It is a public reference implementation for building transactional web
applications as single-page applications. It integrates a selected set of
application frameworks, reusable components, application infrastructure,
development conventions, templates, and CI practices into one coherent
example.

The repository is not itself a replacement for React, NestJS, AWS, or another
underlying framework or platform. Its purpose is to show how those technologies
and responsibilities fit together as a development baseline.

The word `reference` is intentional. This repository demonstrates one supported
way to compose the selected technologies and concerns. It does not claim that
the same architecture is the correct architecture for every web application.

## 3. Purpose

A typical transactional web application needs more than a browser framework and
an HTTP server. It needs a repeatable way to handle authentication,
authorization, API boundaries, error handling, transactions, logging,
configuration, persistence, files, notifications, auditability, testing, and
continuous integration.

If every application decides those concerns independently, projects that use
the same basic technology stack still diverge in structure, failure semantics,
operational behavior, and maintainability.

This repository exists to provide a working reference application in which
those concerns are assembled consistently.

The reference shall demonstrate:

- a React and TypeScript single-page application;
- a TypeScript backend based on NestJS;
- a Backend for Frontend boundary for browser-facing access;
- a modular application structure that starts as one backend deployable and
  can later be decomposed;
- representative reusable frontend and backend building blocks;
- explicit API contracts between the browser-facing layer and backend
  capabilities;
- persistence, object storage, authentication, email, and notification
  integration on AWS;
- common application behavior such as logging, error handling, transaction
  control, configuration, and auditing;
- a standard CI pipeline suitable for the reference application; and
- documentation that separates current support from future architecture
  concepts.

## 4. What it is not

The scope is deliberately narrower than "all web applications".

- **Not a universal web architecture.** Applications whose primary constraints
  differ materially from a transactional business SPA may require another
  architecture.
- **Not an independent frontend framework.** React remains the frontend
  framework. This repository defines how it is used within the reference.
- **Not an independent backend framework.** NestJS remains the current backend
  framework. This repository defines how application concerns are composed
  around it.
- **Not a framework that hides the underlying technologies.** A developer
  should still be able to identify normal React, TypeScript, NestJS, HTTP, SQL,
  and AWS concepts in the resulting application.
- **Not a requirement that every adopting application use every component.**
  Optional capabilities remain optional when an application does not need
  them.
- **Not a production microservice platform today.** The current supported
  backend topology is a single deployable application.
- **Not a dynamic service-routing platform.** Runtime mutation of BFF routing is
  outside the supported model.
- **Not a multi-cloud implementation today.** AWS is the only currently
  supported cloud and infrastructure target.
- **Not a Java implementation today.** Java is a future backend implementation
  direction.
- **Not an SSR or SSG reference.** The current frontend model is a browser SPA.
- **Not a native mobile application reference.** Only web applications are in
  the current scope.
- **Not a data analytics, stream-processing, IoT, or machine-learning
  platform.** Those workloads may integrate with applications built from this
  reference, but they are not what this repository demonstrates.

## 5. Intended application class

The reference is intended for interactive, authenticated, transactional web
applications in which users spend a session working with application state
through forms, lists, detail views, and business operations.

Representative application classes include:

- request and approval systems;
- administrative applications;
- customer or account management applications;
- contract and case management applications;
- internal operational applications;
- authenticated B2B applications; and
- similar systems centered on CRUD operations, workflow, authorization, and
  relational transactions.

The reference shall remain useful for applications that grow in size without
forcing those applications to adopt distributed systems before they need them.

An application with materially different primary requirements, such as a
public content site whose dominant requirement is search-engine indexing or
static generation, is not required to fit this architecture.

## 6. Reference application domain

The concrete sample domain is a generic request and approval application.

The domain exists to exercise the architecture rather than to model a
particular company or industry. It shall contain no private organizational
terminology, customer information, internal process name, or assumption that
depends on a specific workplace.

The reference application shall demonstrate three representative roles:

- **Requester**, who creates and submits a request;
- **Approver**, who reviews a submitted request and approves or rejects it; and
- **Administrator**, who can inspect application state and audit information
  needed to administer the sample.

The minimum request lifecycle is:

```text
DRAFT -> SUBMITTED -> APPROVED
                   \-> REJECTED
```

The current sample is not required to implement an arbitrary workflow engine.
The fixed lifecycle exists only to demonstrate business state transitions,
authorization, transaction boundaries, audit records, files, and
notifications.

## 7. Development model

### 7.1 Specification-driven development

The repository shall be developed from explicit specifications rather than by
treating the current source code as the only definition of intended behavior.

At minimum, the repository shall maintain separate authoritative descriptions
for:

- requirements and scope;
- basic architecture and component responsibilities;
- implementation and maintenance policy; and
- the externally visible HTTP API contract.

Implementation shall conform to those specifications. A change that alters a
specified behavior or interface shall update the directly affected
specification in the same change.

The specification model shall not require a reader to know a private standard
or another repository in order to understand this repository.

### 7.2 Framework and template concerns

The development baseline contains both framework-like and template-like
elements, and they shall remain distinguishable.

A **framework or library element** is reusable behavior that applications
consume through an interface and continue to depend on at runtime or build
time.

A **template or boilerplate element** is a starting implementation intended to
be copied, generated, or modified by the adopting application.

Template-owned application code shall be allowed to diverge after adoption.
The reference shall not require project-specific code to remain byte-for-byte
identical to a central template.

Shared framework or library behavior shall expose clear boundaries so that an
application does not need to copy its implementation in order to use it.

The repository may contain both kinds of elements, but documentation and layout
shall make clear which kind a component represents.

### 7.3 Reusable components

The reference shall demonstrate reusable components for application concerns
that recur across ordinary transactional web applications.

Frontend examples include:

- application layout and navigation;
- form controls and validation presentation;
- lists and tables;
- dialogs;
- user-visible notifications;
- loading and error states; and
- authorization-aware presentation where appropriate.

Backend examples include:

- logging;
- standardized application errors;
- authentication and authorization boundaries;
- transaction handling;
- configuration;
- audit recording;
- object-storage access;
- email delivery;
- event or notification publication; and
- provider-specific infrastructure adapters.

The reference is not required to create a custom abstraction for a capability
already expressed adequately by an underlying framework. Reuse shall reduce
repeated application work rather than hide ordinary framework concepts without
a requirement.

## 8. Current frontend requirements

The current frontend shall be:

- a web application;
- implemented with React;
- implemented in TypeScript; and
- delivered as a single-page application.

The browser application shall communicate with server-side capabilities through
the BFF-facing HTTP API rather than reaching databases or backend infrastructure
services directly.

The current reference does not require server-side rendering, static-site
generation, or a native mobile client.

The frontend shall not depend on backend implementation details that are not
part of the published HTTP contract.

## 9. Current backend requirements

The current backend shall be implemented with NestJS and TypeScript.

The supported current topology is one backend deployable application. Starting
with one deployable is a deliberate requirement: distribution shall be
introduced when a real boundary requires it, not merely because microservices
are a possible future direction.

The single backend application shall nevertheless preserve logical module
boundaries so that a business capability can later be extracted without first
untangling unrelated responsibilities.

The current backend shall support the BFF role described in section 10 and the
business capabilities needed by the reference application.

Java is not part of the current implementation requirement. The architecture
shall, however, avoid making the browser-facing contract depend on
TypeScript-only or NestJS-only representations, because a future backend
implementation may be written in Java.

## 10. Backend for Frontend requirements

### 10.1 Role of the BFF

The reference shall adopt a Backend for Frontend architecture for the web
client.

The BFF is the browser-facing server boundary. It is responsible for concerns
that belong at that boundary, including:

- authentication integration;
- authorization enforcement at the client-facing boundary;
- browser-facing API exposure;
- routing to the business capability that owns a request;
- request and response adaptation where the browser-facing contract differs
  from an internal representation; and
- correlation and common request context needed for logging and diagnostics.

For a business operation that the BFF does not itself own, the normal BFF
behavior is to forward or invoke the request against the backend business
capability responsible for that operation.

### 10.2 Business behavior in the BFF

Business logic is not categorically forbidden from the BFF.

A business capability may initially reside in the same NestJS application and
may be implemented behind the BFF boundary when doing so keeps the application
simple and the responsibility remains clear.

The requirement is a clear responsibility boundary, not a mandatory network
hop.

When a business capability later merits an independent service, it shall be
possible to extract that capability and keep the browser-facing BFF contract
stable where the external behavior has not changed.

The BFF shall not become a dumping ground for unrelated domain behavior merely
because it is the browser-facing entry point.

### 10.3 Routing definition

BFF routing shall be defined statically for a deployed application version.

A route definition may be supplied by source configuration, deployment
configuration, or another deployment-time input, but the selected mapping is
fixed for the running deployment.

Changing a route mapping requires a deployment or equivalent controlled
configuration rollout.

Runtime administration that creates, deletes, or rewrites BFF routes without a
deployment is not supported.

The current reference shall not contain a dynamic routing database, route
management UI, or runtime route-discovery mechanism.

## 11. API contract requirements

The browser-facing HTTP API is a contract independent of the implementation
language of the backend.

The normative API description shall use OpenAPI.

TypeScript types may be generated from or checked against the API contract, but
a TypeScript interface alone shall not be the only definition of a public HTTP
request or response.

The API contract shall define, where applicable:

- paths and HTTP methods;
- request parameters;
- request bodies;
- response bodies;
- validation constraints;
- authentication requirements;
- successful status codes; and
- error response shapes.

The contract shall remain valid if a backend capability is later implemented in
Java or moved into a separate service, unless the external API itself is
deliberately changed.

## 12. Authentication and authorization

Amazon Cognito is the currently supported deployed identity service.

The local demonstration uses the fixed local identity mechanism defined in
section 20.1 and does not call Cognito.

The BFF is the primary client-facing authentication and authorization boundary.

A user shall not gain access to a business operation merely because the
corresponding frontend control is hidden. Authorization shall be enforced on
the server side.

The sample shall demonstrate role-sensitive behavior for Requester, Approver,
and Administrator.

A backend business capability may enforce additional domain authorization or
state invariants where those rules belong to the capability itself. The BFF
boundary does not make backend domain invariants optional.

Credentials, access tokens, refresh tokens, client secrets, private keys, or
other live secrets shall never be committed to the repository or written to
application logs.

## 13. Reference business requirements

### 13.1 Request creation and editing

A Requester shall be able to create a request in `DRAFT` state.

A Requester shall be able to view and edit a draft request that they are
authorized to modify.

The sample request shall contain enough data to demonstrate form validation,
persistence, and API contracts without embedding a real organization's data
model.

### 13.2 Submission

A Requester shall be able to submit a valid draft.

Submission shall transition the request from `DRAFT` to `SUBMITTED`.

The state transition and the corresponding audit record shall be treated as one
consistent business operation.

### 13.3 Approval and rejection

An Approver shall be able to list or retrieve requests awaiting a decision.

An authorized Approver shall be able to approve a `SUBMITTED` request.

An authorized Approver shall be able to reject a `SUBMITTED` request.

Approval shall transition the request to `APPROVED`.

Rejection shall transition the request to `REJECTED`.

An invalid state transition shall be rejected rather than silently converted
into another operation.

### 13.4 Administration and audit visibility

An Administrator shall be able to inspect the application state and audit
information required to demonstrate administration of the sample.

Administrative capability shall not bypass the requirement to record state
changes that the audit model covers.

The reference is not required to implement a complete identity-administration
product.

## 14. Persistence and transaction requirements

Amazon Aurora is the currently supported relational database service.

Relational business state shall have explicit transaction boundaries.

A business operation whose database changes must succeed or fail together shall
use one local database transaction in the current single-backend architecture.

For the request workflow, a state transition and its required audit record
shall not be committed as unrelated partial results.

External side effects such as email delivery shall not be treated as though
they participate in the same local database transaction merely because they
are triggered by the same business action.

The current requirements do not include a distributed ACID transaction across
independent services.

## 15. File requirements

Amazon S3 is the currently supported object storage service.

The reference application shall demonstrate attaching a file to a request.

Binary file content shall be stored in object storage rather than in the
relational business tables unless a later explicit requirement changes that
decision.

Application persistence shall retain the metadata needed to associate an
authorized request with its stored object.

Authorization shall be applied before a user is permitted to access an
attachment through application behavior.

The repository shall not contain real private attachments or production data as
fixtures or examples.

## 16. Notification requirements

Amazon SES is the currently supported email service.

Amazon SNS is the currently supported notification or event publication
service.

The reference shall demonstrate at least one business event that results in an
email notification and at least one event publication path suitable for
decoupled notification or integration.

Notification failure shall be distinguishable from failure of the business
state transition that caused the notification to be requested.

The exact retry and delivery semantics belong to the detailed design. This
requirements document does not imply exactly-once delivery.

## 17. Logging and audit requirements

Application logging and business auditing are different concerns and shall not
be conflated.

### 17.1 Application logging

The application shall provide structured logging suitable for operation and
diagnosis.

Logs shall support correlation of work belonging to the same request or
operation.

Logs shall distinguish ordinary information, recoverable abnormal conditions,
and failures.

Secrets and authentication tokens shall not be written to logs.

Private application payloads shall not be logged merely for convenience.

### 17.2 Audit

The application shall persist an audit record for business state changes that
the sample uses to demonstrate accountability.

An audit record shall identify, at minimum:

- the relevant business object;
- the operation or state transition;
- the acting identity where available; and
- when the operation occurred.

An audit record is business history. It is not a substitute for an application
log, and an application log is not a substitute for the audit record.

## 18. Error handling requirements

The API shall expose a consistent application error shape.

Expected application failures shall be distinguishable from unexpected
implementation failures.

Validation errors, authorization failures, missing resources, invalid state
transitions, and infrastructure failures shall not all collapse into one
undifferentiated successful or generic response.

Framework-specific exception objects shall not become the public HTTP contract
merely because the current backend uses NestJS.

An unexpected defect shall remain diagnosable through server-side logging while
the client receives only information appropriate for the public API.

No error response shall disclose a secret, credential, private stack trace, or
unnecessary infrastructure detail.

## 19. Configuration requirements

Configuration that varies between deployments shall be externalized from
business code.

Secrets shall not be stored in committed configuration.

Configuration shall be resolved through a documented path rather than read
arbitrarily from unrelated modules throughout the application.

A configuration value that selects static BFF routing is deployment-time
configuration as described in section 10.3; it is not a runtime administration
feature.

Cloud-provider-specific configuration shall remain at the infrastructure
boundary rather than becoming a domain model concept.

## 20. Current AWS platform requirements

AWS is the only currently supported cloud platform.

The current reference architecture shall support the following AWS services:

- Application Load Balancer;
- Amazon ECS;
- AWS Fargate;
- Amazon Aurora;
- Amazon S3;
- Amazon Cognito;
- Amazon SES; and
- Amazon SNS.

These services cover ingress, container execution, relational persistence,
object storage, identity, email, and notification or event publication for the
reference.

The detailed design decides the exact connection and deployment topology among
them.

The repository does not currently promise an equivalent deployed implementation
for another cloud provider.

### 20.1 Local demonstration

The first runnable path of the repository shall be a fully local demonstration.
After cloning the repository and installing dependencies, a person shall be able
to run the complete sample (Requester, Approver, and Administrator workflows,
including attachments, notifications, and audit) with one command and a
browser, without an AWS account, Amazon Cognito, Amazon S3, Amazon SES, Amazon
SNS, Amazon Aurora, ACM, DNS, an external identity provider, an API key, or the
editing of an environment file. A local container runtime for PostgreSQL is
permitted as a prerequisite.

The local demonstration shall reuse the same domain and application logic,
browser-facing HTTP API, database model, transactional outbox, and
authorization as the AWS deployment. Only the external infrastructure adapters
(identity, object storage, email delivery, and event publication) differ, and
the choice shall be an explicit configuration value that defaults to the AWS
adapters. The local identity mechanism shall never be accepted by the AWS
configuration. The local demonstration is for learning and evaluation on a
single machine and is not a supported deployment.

## 21. Cloud portability requirements

Although AWS is the only current target, business and application logic shall
not depend directly on AWS-specific SDK types where a provider boundary is
required.

Provider-specific behavior shall be kept behind an application-facing boundary
for capabilities such as:

- object storage;
- identity integration;
- email delivery; and
- notification or event publication.

This requirement exists to keep provider choice from spreading through domain
logic. It does not require an abstraction around every AWS concept, and it does
not require implementing an unused second provider.

Microsoft Azure and Google Cloud are future platform directions. Their
existence in the roadmap does not mean they are currently supported, tested, or
deployment-compatible.

## 22. Continuous integration requirements

The repository shall provide a standard CI pipeline for changes to the
reference application.

The normal CI path shall be able to run without production cloud credentials.

The CI pipeline shall validate the application concerns relevant to the
repository, including:

- dependency installation;
- formatting or formatting verification;
- linting;
- TypeScript type checking;
- unit tests;
- integration tests that do not require production infrastructure;
- frontend build;
- backend build;
- validation of the OpenAPI contract; and
- container build validation when container definitions are present.

A validation step shall fail the CI run when the condition it is responsible
for checking is not satisfied.

Tests that require a live external service, if any are later added, shall be
separated from the ordinary credential-free CI path unless an explicit
requirement changes that policy.

This section requires continuous integration, not automatic production
deployment.

## 23. Security and privacy requirements

The repository is public.

No implementation, fixture, example, document, configuration, commit message,
or pull request shall contain:

- a live credential;
- a real private host name or network address;
- confidential infrastructure information;
- customer data;
- private organizational information;
- non-public business data; or
- material whose publication depends on access to an internal document.

Examples shall use invented or clearly placeholder data.

Authentication and authorization shall be enforced by server-side behavior, not
only by frontend presentation.

The application shall apply least privilege to the permissions it requests from
AWS services.

Input received across a trust boundary shall be validated before it is treated
as valid application state.

## 24. Maintainability and dependency requirements

The reference shall favor explicit boundaries and ordinary framework mechanisms
over unnecessary custom infrastructure.

A dependency shall be added because the reference requires the capability it
provides, not merely because the dependency is fashionable or available.

The architecture shall remain understandable to a developer familiar with
React, TypeScript, NestJS, HTTP, relational databases, and AWS.

The reference shall not add a distributed process, network boundary, service
registry, runtime router, orchestration engine, or other operational component
until a supported requirement needs it.

Starting simple and preserving extraction boundaries is preferred to
pre-installing the operational complexity of a future architecture.

## 25. Future backend language support

A Java backend implementation is planned as a future extension.

Java support is not part of the current implementation scope.

Current contracts shall therefore avoid an unnecessary dependency on
NestJS-specific wire representations or TypeScript-only public contracts.

The future Java implementation may use a different internal framework while
conforming to the same browser-facing API and business contracts where those
contracts have not deliberately changed.

No Java source, build system, runtime, or CI job is required merely because this
future direction is recorded here.

## 26. Future microservice architecture

Microservices are a future deployment option, not the current default.

The current single backend application shall preserve business module
boundaries so that an independently valuable capability can later become an
independently deployable service.

Extraction shall be driven by a concrete operational, scaling, ownership,
release, or architectural requirement rather than by a target number of
services.

The BFF shall remain the browser-facing boundary when backend capabilities are
split, unless a later requirement deliberately changes that contract.

A service extraction shall not force the SPA to learn internal service
locations.

Static BFF routing shall be sufficient to map browser-facing operations to the
extracted backend services.

Runtime dynamic routing remains outside the planned requirement unless a future
requirement explicitly introduces it.

## 27. Future orchestration concept

A future microservice deployment may require one business operation to span
multiple independently transactional services.

The architecture therefore reserves a future **orchestrator** capability.

The purpose of the orchestrator would be to coordinate a cross-service business
process, observe the result of each participating operation, and maintain the
required business consistency when one local transaction cannot cover the whole
process.

This is a conceptual future capability only.

The current reference application shall not implement an orchestrator merely to
demonstrate the idea.

This requirement does not promise a distributed ACID transaction or two-phase
commit. The exact consistency model, compensation model, messaging model, and
failure recovery mechanism shall be decided when a concrete distributed
business requirement exists.

## 28. Future aggregation concept

A future microservice deployment may require one browser-facing operation to
combine information owned by multiple backend services.

The architecture therefore reserves a future **aggregator** capability.

The aggregator would call or otherwise obtain information from the responsible
services and compose a client-oriented result without requiring the SPA to
coordinate those services directly.

This is a conceptual future capability only.

The current reference application shall not implement a separate aggregator
service merely to demonstrate the idea.

Aggregation may later be implemented as part of the BFF or as a separately
deployed capability according to the concrete requirement at that time.

## 29. Current limitations

The following are explicit current limitations rather than missing
implementations to be filled automatically:

- web client only;
- React and TypeScript SPA frontend;
- NestJS and TypeScript backend;
- one backend deployable application;
- AWS infrastructure only;
- static deployment-time BFF routing;
- no runtime dynamic route administration;
- no production microservice topology;
- no distributed transaction orchestrator;
- no dedicated multi-service aggregator;
- no Java backend;
- no Azure deployment implementation;
- no Google Cloud deployment implementation;
- no SSR or SSG mode;
- no native mobile client;
- no general workflow engine; and
- no claim that this architecture covers every class of web application.

A future change may remove one of these limitations only when the corresponding
requirement is explicitly adopted.

## 30. Source of truth and compatibility

This requirements document is authoritative for the purpose, supported scope,
current limitations, and future directions it states.

`BASIC_DESIGN.md` shall describe how the current supported requirements are
composed without silently expanding them.

`POLICY.md` shall describe how the repository is implemented and changed
without silently changing the product scope defined here.

The OpenAPI description is authoritative for the concrete browser-facing HTTP
contract.

When implementation and an authoritative specification disagree, the
difference shall be resolved deliberately. An accidental implementation detail
does not become a requirement merely because code currently exhibits it.

A current limitation is not removed by implementing around it without first
changing the corresponding requirement.

## 31. Public repository boundary

The repository shall remain understandable as a standalone public project.

No document shall describe the repository as an internal company standard,
identify a private organization as the source of the architecture, or require
access to non-public material in order to understand why the application is
structured as it is.

The repository may explain the engineering reasoning behind its architecture,
including trade-offs and limits, as public technical documentation.

The reference application shall use generic names and invented sample data so
that its code and documentation remain reusable outside any one organization.
