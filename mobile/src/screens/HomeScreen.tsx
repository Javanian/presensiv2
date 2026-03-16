import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTodayAttendance } from '../hooks/useAttendance';
import { getAuthState } from '../store/authStore';
import { AttendanceRecord } from '../types/attendance';
import CheckinModal from '../components/CheckinModal';
import CheckoutModal from '../components/CheckoutModal';
import OfflineBanner from '../components/OfflineBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}j`;
  return `${h}j ${m}m`;
}

function formatDate(): string {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  const now = new Date();
  return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

function getStatusColor(status: AttendanceRecord['status']): string {
  switch (status) {
    case 'ONTIME': return '#16A34A';
    case 'LATE': return '#D97706';
    case 'OUT_OF_RADIUS': return '#DC2626';
    default: return '#6B7280';
  }
}

function getStatusLabel(status: AttendanceRecord['status']): string {
  switch (status) {
    case 'ONTIME': return 'Tepat Waktu';
    case 'LATE': return 'Terlambat';
    case 'OUT_OF_RADIUS': return 'Di Luar Area';
    default: return '-';
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusCard({
  record,
  siteTimezone,
}: {
  record: AttendanceRecord | null | undefined;
  siteTimezone: string;
}) {
  if (record === undefined) {
    // Loading
    return (
      <View style={[styles.card, styles.cardGrey]}>
        <ActivityIndicator color="#6B7280" />
      </View>
    );
  }

  if (record === null) {
    // Not checked in yet
    return (
      <View style={[styles.card, styles.cardGrey]}>
        <Ionicons name="time-outline" size={32} color="#9CA3AF" />
        <Text style={styles.cardTitle}>Belum Absen</Text>
        <Text style={styles.cardSubtitle}>Anda belum melakukan absensi hari ini</Text>
      </View>
    );
  }

  if (record.checkout_time === null) {
    // Checked in, not yet checked out
    return (
      <View style={[styles.card, styles.cardGreen]}>
        <Ionicons name="checkmark-circle" size={32} color="#16A34A" />
        <Text style={styles.cardTitle}>Sudah Check In</Text>
        <Text style={styles.cardTime}>{formatTime(record.checkin_time, siteTimezone)}</Text>
        <View style={[styles.badge, { backgroundColor: getStatusColor(record.status) + '20' }]}>
          <Text style={[styles.badgeText, { color: getStatusColor(record.status) }]}>
            {getStatusLabel(record.status)}
          </Text>
        </View>
        <Text style={styles.cardSubtitle}>Jangan lupa absen pulang!</Text>
      </View>
    );
  }

  // Fully completed
  return (
    <View style={[styles.card, styles.cardBlue]}>
      <Ionicons name="checkmark-done-circle" size={32} color="#2563EB" />
      <Text style={styles.cardTitle}>Absensi Selesai</Text>
      <View style={styles.timeRow}>
        <View style={styles.timeItem}>
          <Text style={styles.timeLabel}>Masuk</Text>
          <Text style={styles.timeValue}>{formatTime(record.checkin_time, siteTimezone)}</Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color="#9CA3AF" />
        <View style={styles.timeItem}>
          <Text style={styles.timeLabel}>Keluar</Text>
          <Text style={styles.timeValue}>{formatTime(record.checkout_time, siteTimezone)}</Text>
        </View>
      </View>
      <Text style={styles.durationText}>
        {formatDuration(record.work_duration_minutes)}
      </Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user } = getAuthState();
  const siteTimezone = user?.site_timezone ?? 'Asia/Jakarta';
  const { data: todayRecord, isLoading, isError, refetch, isRefetching } = useTodayAttendance(siteTimezone);
  const { isConnected } = useNetworkStatus();
  const [checkinVisible, setCheckinVisible] = useState(false);
  const [checkoutVisible, setCheckoutVisible] = useState(false);

  const isCompleted =
    todayRecord !== null &&
    todayRecord !== undefined &&
    todayRecord.checkout_time !== null;

  const isCheckedIn =
    todayRecord !== null &&
    todayRecord !== undefined &&
    todayRecord.checkout_time === null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Presensi SSB</Text>
        <Text style={styles.headerDate}>{formatDate()}</Text>
      </View>
      <OfflineBanner />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Card */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeRow}>
            <View style={styles.welcomeAvatar}>
              <Text style={styles.welcomeAvatarText}>
                {(user?.name ?? 'U')[0]?.toUpperCase()}
              </Text>
            </View>
            <View style={styles.welcomeInfo}>
              <Text style={styles.welcomeGreeting}>Selamat datang,</Text>
              <Text style={styles.welcomeName}>{user?.name ?? '-'}</Text>
            </View>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{user?.role ?? '-'}</Text>
          </View>
        </View>

        {/* Status Section */}
        <Text style={styles.sectionLabel}>Status Absensi Hari Ini</Text>
        {isError ? (
          <View style={[styles.card, styles.cardGrey, { gap: 12 }]}>
            <Ionicons name="alert-circle-outline" size={32} color="#9CA3AF" />
            <Text style={{ fontSize: 14, color: '#6B7280' }}>Gagal memuat status absensi</Text>
            <Pressable
              style={[styles.ctaButton, styles.ctaCheckin, { alignSelf: 'stretch', marginTop: 0 }]}
              onPress={() => refetch()}
            >
              <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
              <Text style={styles.ctaText}>Coba Lagi</Text>
            </Pressable>
          </View>
        ) : (
          <StatusCard
            record={isLoading ? undefined : (todayRecord ?? null)}
            siteTimezone={siteTimezone}
          />
        )}

        {/* CTA Button */}
        {!isError && (isCompleted ? (
          <View style={[styles.ctaButton, styles.ctaDisabled]}>
            <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
            <Text style={styles.ctaText}>Sudah Absen</Text>
          </View>
        ) : isCheckedIn ? (
          <Pressable
            style={[styles.ctaButton, styles.ctaCheckout, !isConnected && styles.ctaDisabled]}
            onPress={() => setCheckoutVisible(true)}
            disabled={!isConnected}
          >
            <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
            <Text style={styles.ctaText}>Check Out</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.ctaButton, styles.ctaCheckin, (isLoading || !isConnected) && styles.ctaDisabled]}
            onPress={() => setCheckinVisible(true)}
            disabled={isLoading || !isConnected}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
                <Text style={styles.ctaText}>Check In</Text>
              </>
            )}
          </Pressable>
        ))}
      </ScrollView>

      <CheckinModal
        visible={checkinVisible}
        onClose={() => setCheckinVisible(false)}
        userId={user?.id}
        siteTimezone={siteTimezone}
      />
      <CheckoutModal
        visible={checkoutVisible}
        onClose={() => setCheckoutVisible(false)}
        userId={user?.id}
        siteTimezone={siteTimezone}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerDate: {
    fontSize: 13,
    color: '#BFDBFE',
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  welcomeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  welcomeInfo: {
    flex: 1,
  },
  welcomeGreeting: {
    fontSize: 12,
    color: '#6B7280',
  },
  welcomeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  roleBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  card: {
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  cardGrey: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardGreen: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  cardBlue: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  cardTime: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    alignSelf: 'stretch',
  },
  timeItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  timeLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  timeValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  durationText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  ctaButton: {
    height: 56,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  ctaCheckin: {
    backgroundColor: '#16A34A',
  },
  ctaCheckout: {
    backgroundColor: '#D97706',
  },
  ctaDisabled: {
    backgroundColor: '#9CA3AF',
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
