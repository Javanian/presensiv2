import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useLogin, getLoginErrorMessage } from '@/hooks/useAuth'

// ─── Zod schema ────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Email atau ID karyawan wajib diisi'),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
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
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-8 sm:px-8">
      <div className="w-full max-w-4xl overflow-hidden rounded-xl border border-divider bg-white grid md:grid-cols-2">
        <section className="bg-brand-dark px-7 py-8 sm:px-10 md:py-12 flex flex-col justify-between text-white">
          <p className="text-2xl font-semibold tracking-tight">HadirOps</p>
          <div className="mt-8 md:mt-20">
            <h1 className="text-3xl sm:text-4xl font-semibold leading-tight tracking-tight">Kelola kehadiran.<br />Atur operasional.</h1>
            <p className="mt-5 text-sm leading-7 max-w-xs">Pantau presensi, susun jadwal shift, dan tinjau pengajuan lembur dari satu ruang kerja.</p>
          </div>
          <p className="mt-8 md:mt-16 text-sm">Portal admin dan supervisor</p>
        </section>
        <div className="px-7 py-8 sm:px-10 md:py-12">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-text-primary leading-tight">Masuk ke ruang kerja</h2>
            <p className="text-sm text-text-secondary mt-3 leading-6">Gunakan akun karyawan yang terdaftar untuk mengakses HadirOps.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Identifier field */}
            <div>
              <label
                htmlFor="identifier"
                className="block text-sm font-medium text-text-primary mb-1.5"
              >
                Email atau ID karyawan
              </label>
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                placeholder="Masukkan email atau ID karyawan"
                aria-invalid={Boolean(errors.identifier)}
                aria-describedby={errors.identifier ? 'identifier-error' : undefined}
                disabled={isPending}
                {...register('identifier')}
                className="w-full h-11 px-3 rounded-lg border border-divider bg-white text-sm text-text-primary
                           placeholder:text-text-secondary
                           focus:outline-none focus:ring-2 focus:ring-brand-light/50 focus:border-brand
                           disabled:bg-surface disabled:text-text-disabled disabled:cursor-not-allowed
                           transition-colors"
              />
              {errors.identifier && (
                <p id="identifier-error" role="alert" className="mt-1.5 text-xs text-red-600">{errors.identifier.message}</p>
              )}
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text-primary mb-1.5"
              >
                Kata sandi
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  disabled={isPending}
                  {...register('password')}
                  className="w-full h-11 px-3 pr-10 rounded-lg border border-divider bg-white text-sm text-text-primary
                             placeholder:text-text-secondary
                             focus:outline-none focus:ring-2 focus:ring-brand-light/50 focus:border-brand
                             disabled:bg-surface disabled:text-text-disabled disabled:cursor-not-allowed
                             transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={isPending}
                  className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary disabled:pointer-events-none transition-colors"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" role="alert" className="mt-1.5 text-xs text-red-600">{errors.password.message}</p>
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
              {isPending ? 'Memproses...' : 'Masuk ke HadirOps'}
            </button>
          </form>

          <p className="mt-6 text-xs text-text-secondary leading-5">
            Belum memiliki akses? Hubungi administrator perusahaan.
          </p>
        </div>

      </div>
    </div>
  )
}
