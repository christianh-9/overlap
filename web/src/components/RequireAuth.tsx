import { Navigate, Outlet } from 'react-router'
import { getToken } from '../api/client'

export default function RequireAuth() {
  return getToken() ? <Outlet /> : <Navigate to="/sign-in" replace />
}
