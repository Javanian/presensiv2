import { NavLink } from 'react-router-dom'
import {
  type LucideIcon,
  LayoutDashboard,
  Users,
  MapPin,
  Clock,
  CalendarDays,
  ClipboardList,
  Timer,
  BarChart2,
  X,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const ADMIN_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Pengguna', icon: Users },
  { to: '/sites', label: 'Lokasi', icon: MapPin },
  { to: '/shifts', label: 'Shift', icon: Clock },
  { to: '/holidays', label: 'Hari Libur', icon: CalendarDays },
  { to: '/attendance', label: 'Absensi', icon: ClipboardList },
  { to: '/overtime', label: 'Lembur', icon: Timer },
  { to: '/reports', label: 'Laporan', icon: BarChart2 },
]

const SUPERVISOR_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/shifts', label: 'Shift', icon: Clock },
  { to: '/attendance', label: 'Absensi', icon: ClipboardList },
  { to: '/overtime', label: 'Lembur', icon: Timer },
  { to: '/reports', label: 'Laporan', icon: BarChart2 },
]

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const { user } = useAuthStore()
  const navItems = user?.role === 'ADMIN' ? ADMIN_NAV : SUPERVISOR_NAV

  return (
    <nav className="flex flex-col h-full w-[240px] bg-surface border-r border-divider">
      {/* Brand header */}
      <div className="h-16 flex items-center px-4 gap-3 bg-brand flex-shrink-0">
        {/* Logo mark */}
        <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm select-none">P</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-tight truncate">
            Presensi Online SSB
          </p>
          <p className="text-white/60 text-xs leading-tight">v2 Admin Panel</p>
        </div>

        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors lg:hidden"
            aria-label="Tutup sidebar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation items */}
      <ul className="flex-1 py-2 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand/10 text-brand border-r-2 border-brand'
                    : 'text-text-secondary hover:bg-brand/5 hover:text-text-primary',
                )
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      {/* User info footer */}
      <div className="p-4 border-t border-divider flex-shrink-0">
        <p className="text-xs font-medium text-text-primary truncate">{user?.name}</p>
        <p className="text-xs text-text-secondary mt-0.5">{user?.role}</p>
      </div>
    </nav>
  )
}
