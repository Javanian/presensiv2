import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTeamAttendance } from '../hooks/useAttendance';
import { EmployeeSummary, TeamAttendanceRecord } from '../types/attendance';
import OfflineBanner from '../components/OfflineBanner';
import { DateRangeBar, fmtDateShort } from '../components/DateRangePicker';
import { getAuthState } from '../store/authStore';
import { exportCsv } from '../utils/exportCsv';
import { showError, showSuccess } from '../utils/toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: tz, weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(iso));
}

function formatTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}j ${m}m`;
}

function statusLabel(status: TeamAttendanceRecord['status']): string {
  if (status === 'ONTIME')        return 'Tepat Waktu';
  if (status === 'LATE')          return 'Terlambat';
  if (status === 'OUT_OF_RADIUS') return 'Di Luar Area';
  return '-';
}

function statusColor(status: TeamAttendanceRecord['status']): string {
  if (status === 'ONTIME')        return '#16A34A';
  if (status === 'LATE')          return '#D97706';
  if (status === 'OUT_OF_RADIUS') return '#DC2626';
  return '#6B7280';
}

function todayFilename(): string {
  return `tim_absensi_${new Date().toISOString().slice(0, 10)}.csv`;
}

// ── DailyRow ──────────────────────────────────────────────────────────────────

function DailyRow({ record }: { record: TeamAttendanceRecord }) {
  const color = statusColor(record.status);
  const tz = record.site_timezone ?? 'Asia/Jakarta';
  return (
    <View style={styles.dailyRow}>
      <View style={styles.dailyLeft}>
        <Text style={styles.dailyDate}>{formatDate(record.checkin_time, tz)}</Text>
        <Text style={styles.dailyTime}>
          {formatTime(record.checkin_time, tz)}
          {record.checkout_time ? ` → ${formatTime(record.checkout_time, tz)}` : ' → —'}
        </Text>
        {record.checkout_time && (
          <Text style={styles.dailyDuration}>{formatDuration(record.work_duration_minutes)}</Text>
        )}
      </View>
      <View style={[styles.statusBadge, { backgroundColor: color }]}>
        <Text style={styles.statusBadgeText}>{statusLabel(record.status)}</Text>
      </View>
    </View>
  );
}

// ── EmployeeCard ──────────────────────────────────────────────────────────────

function EmployeeCard({
  summary, expanded, onToggle,
}: { summary: EmployeeSummary; expanded: boolean; onToggle: () => void }) {
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.employeeName}>{summary.employee_name}</Text>
          <Text style={styles.employeeId}>{summary.employee_id}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
      </TouchableOpacity>

      <View style={styles.statRow}>
        <View style={styles.statBadgesLeft}>
          {summary.ontime_count > 0 && (
            <View style={[styles.statBadge, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[styles.statCount, { color: '#16A34A' }]}>{summary.ontime_count}</Text>
              <Text style={[styles.statLabel, { color: '#16A34A' }]}>Tepat</Text>
            </View>
          )}
          {summary.late_count > 0 && (
            <View style={[styles.statBadge, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.statCount, { color: '#D97706' }]}>{summary.late_count}</Text>
              <Text style={[styles.statLabel, { color: '#D97706' }]}>Terlambat</Text>
            </View>
          )}
          {summary.out_of_radius_count > 0 && (
            <View style={[styles.statBadge, { backgroundColor: '#FEE2E2' }]}>
              <Text style={[styles.statCount, { color: '#DC2626' }]}>{summary.out_of_radius_count}</Text>
              <Text style={[styles.statLabel, { color: '#DC2626' }]}>Di Luar</Text>
            </View>
          )}
        </View>
        <View style={[styles.statBadge, { backgroundColor: '#F3F4F6' }]}>
          <Text style={[styles.statCount, { color: '#374151' }]}>{summary.total_days}</Text>
          <Text style={[styles.statLabel, { color: '#374151' }]}>Hari</Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.dailyList}>
          <View style={styles.divider} />
          {summary.records.map((rec) => (
            <DailyRow key={rec.id} record={rec} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SubordinateAttendanceScreen() {
  const { user } = getAuthState();
  const siteTimezone = user?.site_timezone ?? 'Asia/Jakarta';

  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: records, isLoading, isError, refetch, isFetching } =
    useTeamAttendance(fromDate, toDate);

  const summaries = useMemo<EmployeeSummary[]>(() => {
    const map = new Map<number, EmployeeSummary>();
    for (const rec of records ?? []) {
      if (!map.has(rec.user_id)) {
        map.set(rec.user_id, {
          user_id: rec.user_id,
          employee_id: rec.employee_id,
          employee_name: rec.employee_name,
          ontime_count: 0,
          late_count: 0,
          out_of_radius_count: 0,
          total_days: 0,
          records: [],
        });
      }
      const s = map.get(rec.user_id)!;
      s.total_days++;
      s.records.push(rec);
      if (rec.status === 'ONTIME') s.ontime_count++;
      else if (rec.status === 'LATE') s.late_count++;
      else if (rec.status === 'OUT_OF_RADIUS') s.out_of_radius_count++;
    }
    return [...map.values()].sort((a, b) =>
      a.employee_name.localeCompare(b.employee_name, 'id')
    );
  }, [records]);

  const hasFilter = fromDate !== null || toDate !== null;

  // ── Export ──────────────────────────────────────────────────────────────────

  async function handleExport() {
    if (summaries.length === 0) {
      showError('Tidak ada data untuk diekspor.');
      return;
    }
    setExporting(true);
    try {
      const header = ['Karyawan', 'ID Karyawan', 'Tanggal', 'Jam Masuk', 'Jam Keluar', 'Durasi', 'Status'];
      const rows = summaries.flatMap((s) =>
        s.records.map((r) => {
          const tz = r.site_timezone ?? 'Asia/Jakarta';
          return [
            s.employee_name,
            s.employee_id,
            formatDate(r.checkin_time, tz),
            formatTime(r.checkin_time, tz),
            r.checkout_time ? formatTime(r.checkout_time, tz) : '-',
            r.work_duration_minutes > 0 ? formatDuration(r.work_duration_minutes) : '-',
            statusLabel(r.status),
          ];
        })
      );
      await exportCsv([header, ...rows], todayFilename());
      showSuccess('Data berhasil diekspor.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showError(`Gagal mengekspor: ${msg}`);
    } finally {
      setExporting(false);
    }
  }

  function toggleEmployee(userId: number) {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Tim Saya</Text>
          <Text style={styles.headerSub}>Rekap kehadiran bawahan</Text>
        </View>
        <TouchableOpacity
          style={[styles.exportBtn, (exporting || summaries.length === 0) && styles.exportBtnDisabled]}
          onPress={handleExport}
          disabled={exporting || summaries.length === 0}
        >
          {exporting
            ? <ActivityIndicator size="small" color="#2563EB" />
            : <Ionicons name="download-outline" size={20} color="#2563EB" />}
        </TouchableOpacity>
      </View>

      <OfflineBanner />

      {/* ── Date range filter ── */}
      <View style={styles.filterBar}>
        <DateRangeBar
          fromDate={fromDate}
          toDate={toDate}
          onFromDate={(d) => { setFromDate(d); setExpandedUserId(null); }}
          onToDate={(d) => { setToDate(d); setExpandedUserId(null); }}
          tz={siteTimezone}
        />
      </View>

      {/* ── Info strip ── */}
      <View style={styles.infoStrip}>
        <Ionicons
          name={hasFilter ? 'funnel' : 'time-outline'}
          size={13}
          color={hasFilter ? '#2563EB' : '#9CA3AF'}
        />
        <Text style={[styles.infoText, hasFilter && styles.infoTextActive]}>
          {hasFilter
            ? `Periode: ${fromDate ? fmtDateShort(fromDate) : '…'}  –  ${toDate ? fmtDateShort(toDate) : '…'}`
            : `Menampilkan ${(records?.length ?? 0) > 0 ? records!.length : '–'} data terbaru`}
        </Text>
        {summaries.length > 0 && !isLoading && (
          <Text style={styles.infoCount}>{summaries.length} karyawan</Text>
        )}
      </View>

      {/* ── Content ── */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color="#9CA3AF" />
          <Text style={styles.infoTextGray}>Gagal memuat data.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      ) : summaries.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Tidak ada data</Text>
          <Text style={styles.emptySubtitle}>
            {hasFilter
              ? 'Tidak ada kehadiran pada periode yang dipilih.'
              : 'Tidak ada bawahan terdaftar atau belum ada kehadiran terbaru.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={summaries}
          keyExtractor={(item) => String(item.user_id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => refetch()}
              tintColor="#2563EB"
            />
          }
          renderItem={({ item }) => (
            <EmployeeCard
              summary={item}
              expanded={expandedUserId === item.user_id}
              onToggle={() => toggleEmployee(item.user_id)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  headerSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  exportBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtnDisabled: { opacity: 0.4 },

  // Filter
  filterBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  // Info strip
  infoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoText: { flex: 1, fontSize: 12, color: '#9CA3AF' },
  infoTextActive: { color: '#2563EB', fontWeight: '500' },
  infoTextGray: { fontSize: 14, color: '#6B7280' },
  infoCount: { fontSize: 12, color: '#6B7280', fontWeight: '600' },

  list: { padding: 12, gap: 10 },

  // Employee card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
  },
  cardHeaderLeft: { flex: 1 },
  employeeName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  employeeId: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 8,
  },
  statBadgesLeft: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statCount: { fontSize: 13, fontWeight: '700' },
  statLabel: { fontSize: 12, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#F3F4F6' },
  dailyList: { paddingBottom: 4 },

  // Daily row
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  dailyLeft: { flex: 1 },
  dailyDate: { fontSize: 13, fontWeight: '600', color: '#374151' },
  dailyTime: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  dailyDuration: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },

  // States
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 4 },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    marginTop: 4, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: '#2563EB', borderRadius: 8,
  },
  retryText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
});
