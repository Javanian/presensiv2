import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

type StatsCardVariant = 'default' | 'success' | 'warning' | 'danger'

interface StatsCardProps {
  icon: React.ReactNode
  title: string
  value: number | string
  loading?: boolean
  variant?: StatsCardVariant
  subtitle?: string
}

const variantStyles: Record<StatsCardVariant, { bg: string; icon: string }> = {
  default: { bg: 'bg-brand/10', icon: 'text-brand' },
  success: { bg: 'bg-green-100', icon: 'text-green-600' },
  warning: { bg: 'bg-amber-100', icon: 'text-amber-600' },
  danger: { bg: 'bg-red-100', icon: 'text-red-600' },
}

export function StatsCard({
  icon,
  title,
  value,
  loading = false,
  variant = 'default',
  subtitle,
}: StatsCardProps) {
  const styles = variantStyles[variant]

  return (
    <div className="bg-white rounded-xl border border-divider p-5 flex items-center gap-4">
      <div
        className={cn(
          'h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0',
          styles.bg,
        )}
      >
        <span className={styles.icon}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-text-secondary truncate">{title}</p>
        {loading ? (
          <Skeleton className="h-6 w-14 mt-1" />
        ) : (
          <>
            <p className="text-xl font-bold text-text-primary leading-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
