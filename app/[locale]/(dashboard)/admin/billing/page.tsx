import { getOrganizationsBillingOverview, getAvailablePlans } from './actions'
import { BillingOrgList } from './_components/billing-org-list'
import { CreditCard } from 'lucide-react'

export default async function AdminBillingPage() {
  const [orgs, plans] = await Promise.all([getOrganizationsBillingOverview(), getAvailablePlans()])

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <CreditCard className="size-6 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold">Planes y facturación</h1>
          <p className="text-sm text-muted-foreground">
            {orgs.length} {orgs.length === 1 ? 'organización' : 'organizaciones'}
          </p>
        </div>
      </div>

      <BillingOrgList orgs={orgs} plans={plans} />
    </div>
  )
}
