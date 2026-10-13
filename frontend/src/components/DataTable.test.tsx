import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DataTable, { type Column } from './DataTable'
import StateMessage from './StateMessage'

type Row = { id: string; name: string; rate: string }

const columns: Column<Row>[] = [
  { key: 'name', header: '이름' },
  { key: 'rate', header: '투입률', align: 'end' },
]

const rows: Row[] = [
  { id: 'a', name: '김하나', rate: '60%' },
  { id: 'b', name: '이둘', rate: '30%' },
]

describe('DataTable', () => {
  it('draws column headers with scope="col" and one row per item', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} empty={null} />)

    const headers = screen.queryAllByRole('columnheader')
    expect(headers).toHaveLength(2)
    expect(headers.map((th) => th.getAttribute('scope'))).toEqual(['col', 'col'])
    expect(screen.getAllByRole('row')).toHaveLength(3)
  })

  it('end-aligns numeric columns and labels each cell for the narrow card view', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} empty={null} />)

    expect(screen.getByRole('columnheader', { name: '투입률' })).toHaveAttribute('data-align', 'end')
    const firstRow = screen.getAllByRole('row')[1]
    const cells = within(firstRow).getAllByRole('cell')
    expect(cells.map((cell) => cell.getAttribute('data-align'))).toEqual(['start', 'end'])
    expect(cells.map((cell) => cell.getAttribute('data-label'))).toEqual(['이름', '투입률'])
  })

  it('shows the given state in place of the table when there are no rows', () => {
    render(
      <DataTable columns={columns} rows={[]} rowKey={(row) => row.id} empty={<StateMessage kind="empty" />} />,
    )

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText('표시할 항목이 없습니다')).toBeInTheDocument()
  })
})
