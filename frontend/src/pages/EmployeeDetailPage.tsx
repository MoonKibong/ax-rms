import { useParams } from 'react-router'
import AppShell from '../components/AppShell'
import EmployeeDetailLoader from './EmployeeDetail'

// T#38: the employee detail at /employees/:id (BRIEF §6.4), read-only. Only a positive whole number names an employee;
// any other address asks nothing and says the employee was not found (the API would answer Spring's own 400).
const EMPLOYEE_ID = /^[1-9][0-9]*$/

function EmployeeDetailPage() {
  const { id = '' } = useParams()
  return (
    <AppShell current="employees">
      <EmployeeDetailLoader url={EMPLOYEE_ID.test(id) ? `/api/employees/${id}` : null} headingLevel={1} />
    </AppShell>
  )
}

export default EmployeeDetailPage
