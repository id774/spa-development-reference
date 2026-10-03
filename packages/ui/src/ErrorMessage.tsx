// License: The GPL version 3, or LGPL version 3 (Dual License).
export function ErrorMessage({
  title,
  detail,
  reference,
}: {
  title: string;
  detail?: string | undefined;
  /** A support reference such as a trace identifier. */
  reference?: string | undefined;
}) {
  return (
    <div role="alert" className="ui-error">
      <p className="ui-error__title">{title}</p>
      {detail ? <p className="ui-error__detail">{detail}</p> : null}
      {reference ? <p className="ui-error__reference">Reference: {reference}</p> : null}
    </div>
  );
}
