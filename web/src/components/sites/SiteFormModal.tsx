import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { sitesApi } from '@/api/sites.api'
import { isAxiosError } from '@/api/axios'
import { showSuccess, showError } from '@/utils/toast'
import { TIMEZONE_OPTIONS } from '@/types/sites'
import type { SiteResponse } from '@/types/sites'

const siteSchema = z.object({
  name: z.string().min(1, 'Nama lokasi wajib diisi'),
  latitude: z
    .number({ invalid_type_error: 'Latitude harus berupa angka' })
    .min(-90, 'Latitude minimum -90')
    .max(90, 'Latitude maksimum 90'),
  longitude: z
    .number({ invalid_type_error: 'Longitude harus berupa angka' })
    .min(-180, 'Longitude minimum -180')
    .max(180, 'Longitude maksimum 180'),
  radius_meter: z
    .number({ invalid_type_error: 'Radius harus berupa angka' })
    .int('Radius harus bilangan bulat')
    .positive('Radius harus lebih dari 0'),
  timezone: z.enum(['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura']),
})

type FormData = z.infer<typeof siteSchema>

interface Props {
  open: boolean
  onClose: () => void
  editingSite: SiteResponse | null
}

export function SiteFormModal({ open, onClose, editingSite }: Props) {
  const qc = useQueryClient()
  const isEdit = editingSite !== null

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      name: '',
      latitude: 0,
      longitude: 0,
      radius_meter: 100,
      timezone: 'Asia/Jakarta',
    },
  })

  useEffect(() => {
    if (editingSite) {
      reset({
        name: editingSite.name,
        latitude: editingSite.latitude,
        longitude: editingSite.longitude,
        radius_meter: editingSite.radius_meter,
        timezone: editingSite.timezone as 'Asia/Jakarta' | 'Asia/Makassar' | 'Asia/Jayapura',
      })
    } else {
      reset({ name: '', latitude: 0, longitude: 0, radius_meter: 100, timezone: 'Asia/Jakarta' })
    }
  }, [editingSite, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      isEdit ? sitesApi.update(editingSite!.id, data) : sitesApi.create(data),
    onSuccess: () => {
      showSuccess(isEdit ? 'Lokasi berhasil diperbarui' : 'Lokasi berhasil ditambahkan')
      void qc.invalidateQueries({ queryKey: ['sites'] })
      onClose()
    },
    onError: (err) => {
      if (isAxiosError(err) && err.response?.status === 422) {
        const detail = (err.response.data as { detail?: string })?.detail
        showError(detail ?? 'Data tidak valid')
      }
    },
  })

  const handleClose = () => { reset(); onClose() }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit: ${editingSite?.name}` : 'Tambah Lokasi Baru'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nama Lokasi *</Label>
            <Input placeholder="cth. SSB Jakarta" {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Latitude *</Label>
              <Input
                type="number"
                step="any"
                placeholder="-6.2088"
                {...register('latitude', { valueAsNumber: true })}
              />
              {errors.latitude && <p className="text-xs text-red-500">{errors.latitude.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Longitude *</Label>
              <Input
                type="number"
                step="any"
                placeholder="106.8456"
                {...register('longitude', { valueAsNumber: true })}
              />
              {errors.longitude && <p className="text-xs text-red-500">{errors.longitude.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Radius Absensi (meter) *</Label>
            <Input
              type="number"
              placeholder="100"
              {...register('radius_meter', { valueAsNumber: true })}
            />
            {errors.radius_meter && (
              <p className="text-xs text-red-500">{errors.radius_meter.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Zona Waktu *</Label>
            <Controller
              control={control}
              name="timezone"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.timezone && <p className="text-xs text-red-500">{errors.timezone.message}</p>}
          </div>

          {/* Google Maps preview */}
          {editingSite && (
            <a
              href={`https://maps.google.com/?q=${editingSite.latitude},${editingSite.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand hover:underline"
            >
              Lihat koordinat di Google Maps ↗
            </a>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Batal</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? 'Menyimpan...'
                : isEdit ? 'Simpan Perubahan' : 'Tambah Lokasi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
