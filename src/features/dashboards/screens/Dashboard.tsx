import { lazy } from 'react';
import { useAppContext } from '../../../components/AppContext';
import { UserRole } from '../../../types';

const RequestorDashboard = lazy(() => import('../../claims/screens').then(module => ({ default: module.RequestorDashboard })));
const ApproverDashboard = lazy(() => import('../../approvals/screens').then(module => ({ default: module.ApproverDashboard })));
const CustodianDashboard = lazy(() => import('../../disbursements/screens').then(module => ({ default: module.CustodianDashboard })));
const FinanceDashboard = lazy(() => import('../../analytics/screens').then(module => ({ default: module.FinanceDashboard })));

export function Dashboard() {
  const { currentUser } = useAppContext();

  switch (currentUser.role) {
    case UserRole.REQUESTOR:
      return <RequestorDashboard />;
    case UserRole.APPROVER:
      return <ApproverDashboard />;
    case UserRole.CUSTODIAN:
      return <CustodianDashboard />;
    case UserRole.FINANCE:
      return <FinanceDashboard />;
    default:
      return <div>Unknown Role</div>;
  }
}
