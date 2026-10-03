# User guide

How to use the application, by role. This guide is for people using the running application, not for developers; to set one up first, see [`GETTING_STARTED.md`](GETTING_STARTED.md).

The application is a generic request and approval sample. A request has a title and a description, and moves through these states:

```text
DRAFT -> SUBMITTED -> APPROVED
                   \-> REJECTED
```

## 1. Roles, sign in, and sign out

There are three roles. In the AWS deployment your role comes from the Cognito group your account belongs to (`Requester`, `Approver`, or `Administrator`); an administrator of the deployment assigns it. In the local demo you choose the role yourself on the sign-in screen.

| Role | What it is for |
| --- | --- |
| **Requester** | Creates requests, edits drafts, attaches files, and submits them. |
| **Approver** | Reviews submitted requests and approves or rejects them. |
| **Administrator** | Reads every request and its attachments, and inspects the audit history. Cannot create, edit, submit, approve, or reject. |

**Signed-out screen.** When you open the application without being signed in (including after reloading the page, because the sign-in is kept only in the browser's memory), you see **You are signed out** and a **Sign in** button. Press it to authenticate on the Cognito sign-in page; afterwards you return to the application, to the page you were heading for.

**Local demo.** In the local demo (`npm run demo`) the signed-out screen instead offers **Continue as Requester**, **Continue as Approver**, and **Continue as Administrator**. There is no password and no redirect; the backend derives the role from the selected demo identity. **Sign out** only clears the in-memory session and returns to this screen, so you can switch roles. Wherever this guide says to press **Sign in** as a role, press the matching **Continue as** button in the local demo.

**After signing in.** The top bar shows the application title, links to the pages your role allows, your account identifier, and a **Sign out** button. **Sign out** ends the session in the application and at Cognito and returns you to the signed-out screen.

| If your role is | You see in the navigation |
| --- | --- |
| Requester | **My Requests** |
| Approver | **Approval Queue** |
| Administrator | **All Requests**, **Audit** |

If your account belongs to none of the three groups, the application shows "Your account has no application role. Ask an administrator to grant access." and no navigation.

## 2. Requester guide

### My Requests

**My Requests** lists your requests with their title, status, and last update, newest first. Open one by its title. **Load more** appears when there is another page. **Create Request** starts a new one.

### Create Request

Enter a **Title** (required, up to 200 characters) and an optional **Description** (up to 5000 characters), then press **Create draft**. You land on the new request's page in state `DRAFT`.

### Request Detail and Edit Draft Request

**Request Detail** shows the title, description, status, and last update, followed by the attachments. What you can do depends on the state:

| State | What you can do |
| --- | --- |
| `DRAFT` | **Edit Draft Request** (change the fields, then **Save draft**), attach files, and **Submit**. |
| `SUBMITTED` | View only. The draft can no longer be edited and no file can be added. It now waits for an Approver. |
| `APPROVED`, `REJECTED` | View only. These are final. |

**Submit** moves the request to `SUBMITTED`. You cannot undo it. An email about the submission is sent to the address stored on your request when you created it.

## 3. Attachments

The **Attachments** section of a request page lists its files (name, type, and size), each with a **Download** button.

- **Upload**: only on your own request while it is `DRAFT`. Choose a file under **Attach a file**, then press **Upload**. The list refreshes with the new file.
- **Accepted files**: PDF (`.pdf`), PNG (`.png`), JPEG (`.jpg`, `.jpeg`), and plain text (`.txt`, UTF-8). The file must really be of that type, and the file name extension must match it. Empty files are refused.
- **Size**: 10 MiB by default (the deployment may set a different limit, up to 100 MiB).
- **Download**: a Requester can download the files of their own requests in any state, an Approver those of requests that are `SUBMITTED`, and an Administrator any file. Downloads are always saved as files.

The full rules are in [`DETAILED_DESIGN.md`](DETAILED_DESIGN.md), section 14.

## 4. Approver guide

### Approval Queue

**Approval Queue** lists the requests that are `SUBMITTED`, **oldest submission first**. Open one by its title.

### Request Review

Opening a submitted request shows **Request Review**: the title, description, status, and its attachments, which you can download. Two buttons appear:

- **Approve** moves the request to `APPROVED`.
- **Reject** moves it to `REJECTED`.

Each opens a dialog with an optional **Comment** (up to 2000 characters). Press **Confirm** to record the decision or **Cancel** to go back. After a decision the page confirms it ("Request approved." or "Request rejected."), shows the new state, and the buttons disappear; the heading returns to **Request Detail** because the request is no longer waiting. The decision is final. The Requester receives an email about it.

You can read only requests that are `SUBMITTED`; other requests are not visible to an Approver.

## 5. Administrator guide

- **All Requests** lists every request, newest first. Open one to inspect it (title, description, status, attachments with downloads). This is read-only: an Administrator has no buttons to edit, submit, approve, or reject.
- **Audit** shows the audit history, newest event first, with the time, event, request ID, actor, and state transition. Events are `REQUEST_CREATED`, `REQUEST_UPDATED`, `ATTACHMENT_ADDED`, `REQUEST_SUBMITTED`, `REQUEST_APPROVED`, and `REQUEST_REJECTED`. Type a request ID (UUID format) into **Request ID** and press **Filter** to see one request's events; clear the field and filter again to see all.

The Administrator role is not a superuser for business operations; it only reads and audits.

## 6. Users with more than one role

The navigation is the union of your roles' links, and you can do everything any of your roles allows. For example, an account that is both Requester and Administrator sees **My Requests** (which then lists all requests) and **Audit**. What you see is a convenience: the server decides, for every action, whether you are allowed, and rejects anything outside your roles.

## 7. Demo tutorial

A guided pass through the whole workflow on a prepared environment ([`GETTING_STARTED.md`](GETTING_STARTED.md), section 4 for the local demo or section 8 for AWS), with three accounts: a Requester, an Approver, and an Administrator. In the local demo the three accounts are the **Continue as Requester / Approver / Administrator** buttons on the sign-in screen. Each step gives the screen, the action, and what you should see.

### 7.1 Requester

| Screen | Action | Expected visible result |
| --- | --- | --- |
| Signed-out screen | Press **Sign in**; authenticate as the Requester. | You return to the application on **My Requests** ("There are no requests yet." on a fresh environment). |
| My Requests | Press **Create Request**. | The **Create Request** form. |
| Create Request | Enter a title and a description; press **Create draft**. | **Request Detail** with status `DRAFT` and "No attachments". |
| Request Detail | Under **Edit Draft Request**, change the title; press **Save draft**. | "Draft saved." and the new title. |
| Request Detail | Under **Attach a file**, choose a small PDF, PNG, JPEG, or text file; press **Upload**. | "Attachment uploaded." and the file listed under **Attachments**. |
| Request Detail | Press **Download** on the file. | The file is saved and opens. |
| Request Detail | Press **Submit**. | "Request submitted." and status `SUBMITTED`; the edit form and upload controls disappear. |
| Any page | Press **Sign out**. | The signed-out screen. |

### 7.2 Approver

| Screen | Action | Expected visible result |
| --- | --- | --- |
| Signed-out screen | **Sign in** as the Approver. | The **Approval Queue**. |
| Approval Queue | Find the submitted request; open it. | **Request Review** with status `SUBMITTED` and the attachment listed. |
| Request Review | Press **Download** on the attachment. | The file is saved. |
| Request Review | Press **Approve**, optionally type a comment, press **Confirm**. | "Request approved." and status `APPROVED`; the buttons are gone. |
| Any page | **Sign out**. | The signed-out screen. |

To see the other outcome, repeat 7.1 and 7.2 with a second request and press **Reject**; it ends in `REJECTED`.

### 7.3 Requester, again

| Screen | Action | Expected visible result |
| --- | --- | --- |
| Signed-out screen | **Sign in** as the Requester. | **My Requests** with your request. |
| My Requests | Open the request. | **Request Detail** with status `APPROVED`. |
| Any page | **Sign out**. | The signed-out screen. |

### 7.4 Administrator

| Screen | Action | Expected visible result |
| --- | --- | --- |
| Signed-out screen | **Sign in** as the Administrator. | **All Requests**. |
| All Requests | Open the request. | **Request Detail**, read-only, with the attachment and `APPROVED`. |
| Audit | Open **Audit**; enter the request's ID and press **Filter**. | The events of that request: `REQUEST_CREATED`, `REQUEST_UPDATED`, `ATTACHMENT_ADDED`, `REQUEST_SUBMITTED`, `REQUEST_APPROVED`, newest first. |

If everything above happened, the Milestone 1 criteria (local demo) in [`GETTING_STARTED.md`](GETTING_STARTED.md#45-milestone-1-pass-criteria) or the Milestone 3 criteria (AWS) in [`GETTING_STARTED.md`](GETTING_STARTED.md#10-milestone-3-pass-criteria) are met.

## 8. When something goes wrong

| What you see | What it means |
| --- | --- |
| The signed-out screen when you did not expect it | Your session ended (it is kept in memory only, so reloading the page ends it, and so does the server rejecting your session). Press **Sign in**. |
| "Forbidden" | Your role does not allow that action or that request. |
| "Validation error" | Something you entered is not acceptable (for example an empty title, or a file that is too large or of an unsupported type). Fix it and try again. |
| "Concurrency conflict" | Someone else (or another window of yours) changed the request after you opened it. Press **Reload request** and try again. |
| "Invalid state transition" | The request is not in a state that allows that action (for example, it was already decided). Reload to see its current state. |
| "Identity provider unavailable" or "Object storage unavailable" | A supporting service is temporarily unavailable. Try again later. |
| "The server could not be reached." | A network problem between your browser and the application. |

Each error message may carry a **Reference** code. Give it to whoever operates the application; it identifies the request in the logs. The complete list of errors is in [`openapi/openapi.yaml`](../openapi/openapi.yaml) and [`DETAILED_DESIGN.md`](DETAILED_DESIGN.md), section 20.
