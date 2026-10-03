// packages/ui/src/index.ts: public exports of the UI package
//
// Description:
// The public entry point of @spa-ref/ui. It re-exports the reusable visual
// components and their prop types. The package knows nothing about the sample
// request-and-approval domain.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - React 19
// - See packages/ui/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

export { AppShell, type AppShellProps, type NavItem } from './AppShell.js';
export { Button, buttonClass, type ButtonProps } from './Button.js';
export { Dialog, type DialogProps } from './Dialog.js';
export { EmptyState } from './EmptyState.js';
export { ErrorMessage } from './ErrorMessage.js';
export { LoadingIndicator } from './LoadingIndicator.js';
export { Notification } from './Notification.js';
export { PageHeader, type PageHeaderProps } from './PageHeader.js';
export { Panel, type PanelProps } from './Panel.js';
export { StatusBadge } from './StatusBadge.js';
export { SelectField, TextAreaField, TextField } from './fields.js';
export { Table, type TableColumn } from './Table.js';
