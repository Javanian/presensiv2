import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLogout } from '../hooks/useAuth';
import { getAuthState } from '../store/authStore';
import { UserInfo } from '../types/auth';
import { useFaceStatus } from '../hooks/useFaceRegister';
import FaceRegisterModal from '../components/FaceRegisterModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import OfflineBanner from '../components/OfflineBanner';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRoleStyle(role: UserInfo['role']) {
  switch (role) {
    case 'ADMIN':
      return { bg: '#F5F3FF', text: '#7C3AED' };
    case 'SUPERVISOR':
      return { bg: '#EFF6FF', text: '#2563EB' };
    case 'EMPLOYEE':
    default:
      return { bg: '#F0FDF4', text: '#16A34A' };
  }
}

function getRoleLabel(role: UserInfo['role']): string {
  switch (role) {
    case 'ADMIN': return 'Admin';
    case 'SUPERVISOR': return 'Supervisor';
    case 'EMPLOYEE': return 'Karyawan';
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color="#6B7280" />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user } = getAuthState();
  const logout = useLogout();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [faceModalVisible, setFaceModalVisible] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);

  const { data: faceStatus, isLoading: faceStatusLoading } = useFaceStatus(user?.id);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  const roleStyle = user ? getRoleStyle(user.role) : { bg: '#F3F4F6', text: '#6B7280' };
  const initials = (user?.name ?? 'U')[0]?.toUpperCase() ?? 'U';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profil</Text>
      </View>
      <OfflineBanner />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar + Name */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{user?.name ?? '-'}</Text>
          {user && (
            <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
              <Text style={[styles.roleBadgeText, { color: roleStyle.text }]}>
                {getRoleLabel(user.role)}
              </Text>
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionLabel}>Informasi Akun</Text>
          <InfoRow
            icon="id-card-outline"
            label="Employee ID"
            value={user?.employee_id ?? '-'}
          />
          <View style={styles.divider} />
          <InfoRow
            icon="mail-outline"
            label="Email"
            value={user?.email ?? '-'}
          />
          <View style={styles.divider} />
          <InfoRow
            icon="location-outline"
            label="Site"
            value={user?.site_id != null ? `Site #${user.site_id}` : 'Tidak ada site'}
          />
          <View style={styles.divider} />
          <InfoRow
            icon="shield-checkmark-outline"
            label="Status"
            value={user?.is_active ? 'Aktif' : 'Nonaktif'}
          />
        </View>

        {/* Face Biometric */}
        <View style={styles.faceCard}>
            <Text style={styles.sectionLabel}>Wajah Biometrik</Text>
            <View style={styles.faceStatusRow}>
              {faceStatusLoading ? (
                <ActivityIndicator size="small" color="#6B7280" />
              ) : (
                <>
                  <Ionicons
                    name={faceStatus?.has_face ? 'scan-circle' : 'scan-circle-outline'}
                    size={20}
                    color={faceStatus?.has_face ? '#16A34A' : '#9CA3AF'}
                  />
                  <Text style={[styles.faceStatusText, faceStatus?.has_face && styles.faceStatusActive]}>
                    {faceStatus?.has_face ? 'Wajah sudah terdaftar' : 'Belum terdaftar'}
                  </Text>
                </>
              )}
            </View>
            <Pressable
              style={[styles.faceBtn, faceStatus?.has_face && styles.faceBtnOutline]}
              onPress={() => setFaceModalVisible(true)}
              disabled={faceStatusLoading}
            >
              <Ionicons
                name="camera-outline"
                size={18}
                color={faceStatus?.has_face ? '#2563EB' : '#FFFFFF'}
              />
              <Text style={[styles.faceBtnText, faceStatus?.has_face && styles.faceBtnTextOutline]}>
                {faceStatus?.has_face ? 'Perbarui Wajah' : 'Daftarkan Wajah'}
              </Text>
            </Pressable>
        </View>

        {/* Change Password */}
        <Pressable
          style={styles.actionCard}
          onPress={() => setChangePasswordVisible(true)}
        >
          <View style={styles.infoIcon}>
            <Ionicons name="lock-closed-outline" size={18} color="#6B7280" />
          </View>
          <Text style={styles.actionLabel}>Ubah Password</Text>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>

        {/* Logout */}
        <Pressable
          style={[styles.logoutBtn, isLoggingOut && styles.logoutBtnDisabled]}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
              <Text style={styles.logoutText}>Keluar</Text>
            </>
          )}
        </Pressable>
      </ScrollView>

      {user && (
        <FaceRegisterModal
          visible={faceModalVisible}
          userId={user.id}
          onClose={() => setFaceModalVisible(false)}
        />
      )}

      <ChangePasswordModal
        visible={changePasswordVisible}
        onClose={() => setChangePasswordVisible(false)}
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
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  roleBadge: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 0,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: -4,
  },
  // ── Face section ─────────────────────────────────────────────────────────────
  faceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  faceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  faceStatusText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  faceStatusActive: {
    color: '#16A34A',
    fontWeight: '500',
  },
  faceBtn: {
    height: 48,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  faceBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#2563EB',
  },
  faceBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  faceBtnTextOutline: {
    color: '#2563EB',
  },
  // ── Action row (Change Password) ─────────────────────────────────────────────
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  // ── Logout ───────────────────────────────────────────────────────────────────
  logoutBtn: {
    height: 52,
    backgroundColor: '#EF4444',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  logoutBtnDisabled: {
    backgroundColor: '#FCA5A5',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
