// License: The GPL version 3, or LGPL version 3 (Dual License).
import type { ReactNode } from 'react';

export interface TableColumn<Row> {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
}

export function Table<Row>({
  caption,
  columns,
  rows,
  rowKey,
}: {
  caption: string;
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
}) {
  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <caption className="ui-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
