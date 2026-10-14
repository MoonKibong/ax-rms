import { useContext } from 'react'
import { useParams } from 'react-router'
import { AuthContext } from '../auth/AuthContext'
import { isHrManager } from '../auth/roles'
import AppShell from '../components/AppShell'
import EmployeeDetailLoader from './EmployeeDetail'

// T#38: the employee detail at /employees/:id (BRIEF §6.4). Only a positive whole number names an employee;
// any other address asks nothing and says the employee was not found (the API would answer Spring's own 400).
// T#39: an HR manager gets 수정 and 상태 변경 under the detail.
const EMPLOYEE_ID = /^[1-9][0-9]*$/

function EmployeeDetailPage() {
  const { id = '' } = useParams()
  const user = useContext(AuthContext)?.user
  return (
    <AppShell current="employees">
      <EmployeeDetailLoader
        url={EMPLOYEE_ID.test(id) ? `/api/employees/${id}` : null}
        headingLevel={1}
        manage={isHrManager(user)}
      />
    </AppShell>
  )
}

export default EmployeeDetailPage
