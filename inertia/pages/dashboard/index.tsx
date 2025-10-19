import { Head } from '@inertiajs/react'
import { DynamicLayoutWrapper } from '@/layouts/dynamic-layout-wrapper'
import { LayoutSwitcher } from '@/components/layout/layout-switcher'
import { LawStats } from '@/components/dashboard/law-stats'
import { CasesChart } from '@/components/dashboard/cases-chart'
import { DeadlinesChart } from '@/components/dashboard/deadlines-chart'
import { RecentClients } from '@/components/dashboard/recent-clients'
import { UpcomingDeadlines } from '@/components/dashboard/upcoming-deadlines'
import { ActivityFeed } from '@/components/dashboard/activity-feed'

function Dashboard() {
  return (
    <>
      <Head title="Dashboard" />

      <div className="p-5 lg:p-8 space-y-8">
        {/* Page Header - Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Bem-vindo ao painel de controle do JuridicAI
            </p>
          </div>
          <div className="sm:flex-shrink-0">
            <LayoutSwitcher />
          </div>
        </div>

        {/* KPI Cards - Stats */}
        <LawStats />

        {/* Charts Row - Responsive grid */}
        <div className="grid gap-5 md:grid-cols-2">
          <CasesChart />
          <DeadlinesChart />
        </div>

        {/* Data Tables Row - Responsive grid */}
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="space-y-5">
              <RecentClients />
              <UpcomingDeadlines />
            </div>
          </div>
          <div>
            <ActivityFeed />
          </div>
        </div>
      </div>
    </>
  )
}

Dashboard.layout = (page: React.ReactNode) => <DynamicLayoutWrapper>{page}</DynamicLayoutWrapper>

export default Dashboard
