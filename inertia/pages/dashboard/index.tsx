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

      <div className="p-5 lg:p-7.5 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Bem-vindo ao painel de controle do JuridicAI
            </p>
          </div>
          <LayoutSwitcher />
        </div>

        {/* KPI Cards - Stats */}
        <LawStats />

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <CasesChart />
          <DeadlinesChart />
        </div>

        {/* Data Tables Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="space-y-6">
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
