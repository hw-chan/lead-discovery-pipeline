import { request } from '../../shared/api'

export interface Organization {
  name: string
  credits: number
}

export async function fetchOrganization(): Promise<Organization> {
  const res = await request('/api/organizations/me')
  if (!res.ok) throw new Error('Failed to fetch organization')
  return (await res.json()) as Organization
}
