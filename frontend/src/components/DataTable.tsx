import type { ReactNode } from 'react'
import './DataTable.css'

export type Column<Row> = {
  key: keyof Row & string
  header: string
  align?: 'start' | 'end'
  // Draws the cell itself (a link, a badge). Without it the value is shown as text.
  render?: (row: Row) => ReactNode
}

type DataTableProps<Row> = {
  columns: Column<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  empty: ReactNode
}

// BRIEF §3.3. A table at >=1024px; below that each row is a card whose cells read "label — value"
// (data-label). With no rows the given state takes the table's place.
function DataTable<Row>({ columns, rows, rowKey, empty }: DataTableProps<Row>) {
  if (rows.length === 0) {
    return <>{empty}</>
  }

  return (
    <div className="data-table">
      <table className="data-table__table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" data-align={column.align ?? 'start'}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} data-align={column.align ?? 'start'} data-label={column.header}>
                  {column.render ? column.render(row) : String(row[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
