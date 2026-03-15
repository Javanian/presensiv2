import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useLogin, getLoginErrorMessage } from '@/hooks/useAuth'

// ─── Zod schema ────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  identifier: z.string().min(1, 'Email atau Employee ID wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
})

type LoginFormData = z.infer<typeof loginSchema>

// ─── Component ─────────────────────────────────────────────────────────────────
export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const loginMutation = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = (data: LoginFormData) => {
    setLoginError(null)
    loginMutation.mutate(data, {
      onError: (error) => {
        setLoginError(getLoginErrorMessage(error))
      },
    })
  }

  const isPending = loginMutation.isPending

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-xl border border-divider shadow-sm p-8">
          {/* Logo + App name */}
          <div className="flex flex-col items-center mb-8">
            <div className="h-14 w-14 rounded-2xl bg-brand flex items-center justify-center mb-4 shadow-sm">
              <span className="text-white text-2xl font-bold select-none">P</span>
            </div>
            <h1 className="text-xl font-bold text-brand text-center leading-tight">
              Presensi Online SSB
            </h1>
            <p className="text-sm text-text-secondary mt-1">Admin Panel v2</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Identifier field */}
            <div>
              <label
                htmlFor="identifier"
                className="block text-sm font-medium text-text-primary mb-1.5"
              >
                Email atau Employee ID
              </label>
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                placeholder="Masukkan email atau employee ID"
                disabled={isPending}
                {...register('identifier')}
                className="w-full h-11 px-3 rounded-lg border border-divider bg-white text-sm text-text-primary
                           placeholder:text-text-disabled
                           focus:outline-none focus:ring-2 focus:ring-brand-light/50 focus:border-brand
                           disabled:bg-surface disabled:text-text-disabled disabled:cursor-not-allowed
                           transition-colors"
              />
              {errors.identifier && (
                <p className="mt-1.5 text-xs text-red-600">{errors.identifier.message}</p>
              )}
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text-primary mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Masukkan password"
                  disabled={isPending}
                  {...register('password')}
                  className="w-full h-11 px-3 pr-10 rounded-lg border border-divider bg-white text-sm text-text-primary
                             placeholder:text-text-disabled
                             focus:outline-none focus:ring-2 focus:ring-brand-light/50 focus:border-brand
                             disabled:bg-surface disabled:text-text-disabled disabled:cursor-not-allowed
                             transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={isPending}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-secondary disabled:pointer-events-none transition-colors"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Inline error message from API */}
            {loginError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200"
              >
                <div className="flex-1">
                  <p className="text-sm text-red-700">{loginError}</p>
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full h-11 flex items-center justify-center gap-2
                         bg-accent text-[#1A1A1A] font-semibold text-sm rounded-lg
                         hover:bg-amber-500 active:bg-amber-600
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-colors"
            >
              {isPending && <Loader2 size={16} className="animate-spin" />}
              {isPending ? 'Masuk...' : 'Masuk'}
            </button>
          </form>

          {/* No "Remember me" — intentional for security */}
          <p className="mt-5 text-center text-xs text-text-disabled">
            Sesi akan berakhir saat tab browser ditutup.
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-text-disabled">
          Presensi Online SSB v2 &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
