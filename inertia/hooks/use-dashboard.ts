import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

// ========================================
// Type Definitions
// ========================================

export interface DashboardStats {
  total_clients: number
  total_cases: number
  active_cases: number
  pending_deadlines: number
  overdue_deadlines: number
  total_documents: number
  unbilled_hours: number
  unbilled_amount: string
}

export interface CasesChartDataPoint {
  date: string
  active: number
  closed: number
  total: number
}

export interface DeadlinesChartDataPoint {
  week: string
  pending: number
  completed: number
  overdue: number
}

export interface RecentClient {
  id: number
  full_name: string | null
  company_name: string | null
  email: string
  phone: string | null
  client_type: 'individual' | 'company'
  created_at: string
}

export interface UpcomingDeadline {
  id: number
  title: string
  deadline_date: string
  is_fatal: boolean
  status: 'pending' | 'completed' | 'cancelled'
  case?: {
    id: number
    case_number: string | null
    internal_number: string | null
    title: string
  }
}

export interface ActivityFeedItem {
  id: number
  type: 'case_created' | 'deadline_added' | 'document_uploaded' | 'client_created' | 'event_logged'
  title: string
  description: string
  created_at: string
  user?: {
    id: number
    full_name: string
  }
}

// ========================================
// React Query Keys
// ========================================

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
  casesChart: () => [...dashboardKeys.all, 'cases-chart'] as const,
  deadlinesChart: () => [...dashboardKeys.all, 'deadlines-chart'] as const,
  recentClients: () => [...dashboardKeys.all, 'recent-clients'] as const,
  upcomingDeadlines: () => [...dashboardKeys.all, 'upcoming-deadlines'] as const,
  activityFeed: () => [...dashboardKeys.all, 'activity-feed'] as const,
}

// ========================================
// Hooks
// ========================================

/**
 * Fetch dashboard statistics
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: async () => {
      const response = await api.get<DashboardStats>('/dashboard/stats')
      return response.data
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  })
}

/**
 * Fetch cases chart data
 */
export function useCasesChart() {
  return useQuery({
    queryKey: dashboardKeys.casesChart(),
    queryFn: async () => {
      const response = await api.get<CasesChartDataPoint[]>('/dashboard/cases-chart')
      return response.data
    },
    staleTime: 60000, // 1 minute
  })
}

/**
 * Fetch deadlines chart data
 */
export function useDeadlinesChart() {
  return useQuery({
    queryKey: dashboardKeys.deadlinesChart(),
    queryFn: async () => {
      const response = await api.get<DeadlinesChartDataPoint[]>('/dashboard/deadlines-chart')
      return response.data
    },
    staleTime: 60000, // 1 minute
  })
}

/**
 * Fetch recent clients
 */
export function useRecentClients() {
  return useQuery({
    queryKey: dashboardKeys.recentClients(),
    queryFn: async () => {
      const response = await api.get<RecentClient[]>('/dashboard/recent-clients')
      return response.data
    },
    staleTime: 60000, // 1 minute
  })
}

/**
 * Fetch upcoming deadlines
 */
export function useUpcomingDeadlines() {
  return useQuery({
    queryKey: dashboardKeys.upcomingDeadlines(),
    queryFn: async () => {
      const response = await api.get<UpcomingDeadline[]>('/dashboard/upcoming-deadlines')
      return response.data
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  })
}

/**
 * Fetch activity feed
 */
export function useActivityFeed() {
  return useQuery({
    queryKey: dashboardKeys.activityFeed(),
    queryFn: async () => {
      const response = await api.get<ActivityFeedItem[]>('/dashboard/activity-feed')
      return response.data
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  })
}
