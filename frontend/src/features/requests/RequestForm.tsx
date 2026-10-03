// frontend/src/features/requests/RequestForm.tsx: request title and description form
//
// Description:
// The shared form for creating and editing a draft. It applies the same
// constraints as the API (title 1 to 200 characters, description up to 5000)
// before calling it, and reports validation messages next to the fields.
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
// - See frontend/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { Button, TextAreaField, TextField } from '@spa-ref/ui';
import { useState, type FormEvent } from 'react';

export interface RequestFormValues {
  title: string;
  description: string;
}

/** Title and description with the same constraints as the API (1..200 and 0..5000). */
export function RequestForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
}: {
  initial: RequestFormValues;
  submitLabel: string;
  busy: boolean;
  onSubmit: (values: RequestFormValues) => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});

  function handle(event: FormEvent) {
    event.preventDefault();
    const next: { title?: string; description?: string } = {};
    const trimmed = title.trim();
    if (trimmed.length === 0) next.title = 'Enter a title.';
    else if (trimmed.length > 200) next.title = 'The title must be at most 200 characters.';
    if (description.length > 5000)
      next.description = 'The description must be at most 5000 characters.';
    setErrors(next);
    if (Object.keys(next).length === 0) onSubmit({ title: trimmed, description });
  }

  return (
    <form onSubmit={handle} noValidate>
      <TextField
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title}
      />
      <TextAreaField
        label="Description"
        rows={6}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        error={errors.description}
      />
      <div className="form-actions">
        <Button type="submit" variant="primary" busy={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
