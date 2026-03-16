import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { isAxiosError } from 'axios';
import { useFaceRegister } from '../hooks/useFaceRegister';
import { FaceRegisterResponse } from '../types/face';

// ── Types ──────────────────────────────────────────────────────────────────────

type Step = 'requesting' | 'preview' | 'reviewing' | 'uploading' | 'success' | 'error';

interface Props {
  visible: boolean;
  userId: number;
  onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function mapErrorDetail(detail: string): string {
  const lower = detail.toLowerCase();
  if (lower.includes('no face')) {
    return 'Tidak ada wajah terdeteksi. Pastikan wajah terlihat jelas dan cukup cahaya.';
  }
  if (lower.includes('multiple face')) {
    return 'Terdeteksi lebih dari satu wajah. Gunakan foto dengan satu wajah saja.';
  }
  if (lower.includes('decode') || lower.includes('invalid')) {
    return 'Gambar tidak valid. Coba ambil foto ulang.';
  }
  return detail;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FaceRegisterModal({ visible, userId, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>('requesting');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<FaceRegisterResponse | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const facing: CameraType = 'front';

  const register = useFaceRegister();

  const init = useCallback(async () => {
    setStep('requesting');
    setPhotoUri(null);
    setErrorMsg('');
    setResult(null);

    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setErrorMsg('Izin kamera diperlukan. Aktifkan di Pengaturan > Aplikasi > Izin Kamera.');
        setStep('error');
        return;
      }
    }
    setStep('preview');
  }, [permission?.granted, requestPermission]);

  useEffect(() => {
    if (visible) {
      init();
    }
  }, [visible, init]);

  async function handleCapture() {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
        setStep('reviewing');
      }
    } catch {
      setErrorMsg('Gagal mengambil foto. Coba lagi.');
      setStep('error');
    }
  }

  function handleRetake() {
    setPhotoUri(null);
    setStep('preview');
  }

  async function handleUpload() {
    if (!photoUri) return;
    setStep('uploading');
    try {
      const res = await register.mutateAsync({ userId, imageUri: photoUri });
      setResult(res);
      setStep('success');
    } catch (e) {
      if (__DEV__) console.error('[FaceRegisterModal] upload error:', e);
      if (isAxiosError(e) && !e.response) {
        // Network error — backend unreachable or wrong IP
        const baseURL = e.config?.baseURL ?? 'unknown';
        setErrorMsg(`Tidak dapat terhubung ke server.\nURL: ${baseURL}\nError: ${e.message}`);
      } else if (isAxiosError(e)) {
        const detail = e.response?.data?.detail ?? `HTTP ${e.response?.status ?? '?'}`;
        setErrorMsg(mapErrorDetail(detail));
      } else {
        // Non-axios error — e.g. "No refresh token available"
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMsg(`Kesalahan: ${msg}`);
      }
      setStep('error');
    }
  }

  function renderContent() {
    if (step === 'requesting') {
      return (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.stateTitle}>Meminta Izin Kamera…</Text>
        </View>
      );
    }

    if (step === 'preview') {
      return (
        <View style={styles.cameraWrapper}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            facing={facing}
          />
          {/* Oval face guide */}
          <View style={[StyleSheet.absoluteFillObject, styles.ovalContainer]}>
            <View style={styles.faceGuide} />
          </View>
          {/* Floating controls */}
          <View style={styles.cameraControls}>
            <Text style={styles.cameraHint}>Posisikan wajah di dalam lingkaran</Text>
            <Pressable style={styles.shutterBtn} onPress={handleCapture}>
              <View style={styles.shutterInner} />
            </Pressable>
          </View>
        </View>
      );
    }

    if (step === 'reviewing' && photoUri) {
      return (
        <View style={styles.cameraWrapper}>
          <Image
            source={{ uri: photoUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          {/* Floating review controls */}
          <View style={styles.reviewControls}>
            <Text style={styles.reviewHint}>Pastikan wajah terlihat jelas</Text>
            <View style={styles.reviewBtns}>
              <Pressable style={styles.retakeBtn} onPress={handleRetake}>
                <Ionicons name="camera-reverse-outline" size={18} color="#6B7280" />
                <Text style={styles.retakeBtnText}>Ambil Ulang</Text>
              </Pressable>
              <Pressable
                style={[styles.uploadBtn, register.isPending && { opacity: 0.7 }]}
                onPress={handleUpload}
                disabled={register.isPending}
              >
                {register.isPending
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <><Ionicons name="checkmark" size={18} color="#FFFFFF" /><Text style={styles.uploadBtnText}>Gunakan Foto Ini</Text></>}
              </Pressable>
            </View>
          </View>
        </View>
      );
    }

    if (step === 'uploading') {
      return (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.stateTitle}>Mendaftarkan Wajah…</Text>
          <Text style={styles.stateSubtitle}>Sedang diproses, harap tunggu.</Text>
        </View>
      );
    }

    if (step === 'success' && result) {
      return (
        <View style={styles.stateBox}>
          <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="checkmark-circle" size={44} color="#16A34A" />
          </View>
          <Text style={styles.stateTitle}>Wajah Terdaftar!</Text>
          <Text style={styles.stateSubtitle}>{result.message}</Text>
          <Pressable style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Selesai</Text>
          </Pressable>
        </View>
      );
    }

    if (step === 'error') {
      return (
        <View style={styles.stateBox}>
          <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="alert-circle" size={40} color="#DC2626" />
          </View>
          <Text style={styles.stateTitle}>Gagal</Text>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Pressable style={styles.retryBtn} onPress={init}>
            <Ionicons name="refresh-outline" size={18} color="#2563EB" />
            <Text style={styles.retryBtnText}>Coba Lagi</Text>
          </Pressable>
        </View>
      );
    }

    return null;
  }

  const isFullscreen = step === 'preview' || step === 'reviewing';
  const canClose = step !== 'uploading' && step !== 'requesting';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={canClose ? onClose : undefined}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, isFullscreen && styles.sheetFullscreen]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Daftarkan Wajah</Text>
            {canClose && (
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={24} color={isFullscreen ? '#6B7280' : '#6B7280'} />
              </Pressable>
            )}
          </View>

          {renderContent()}
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  // Full-screen mode: sheet fills the entire overlay height
  sheetFullscreen: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  stateBox: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  stateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  // ── Camera ──────────────────────────────────────────────────────────────────
  // cameraWrapper fills all remaining space below the header
  cameraWrapper: {
    flex: 1,
  },
  ovalContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceGuide: {
    width: 240,
    height: 310,
    borderRadius: 120,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.9)',
    borderStyle: 'dashed',
  },
  // Floating controls at the bottom of the camera
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 16,
  },
  cameraHint: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
  },
  // ── Review ──────────────────────────────────────────────────────────────────
  reviewControls: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    alignItems: 'center',
    gap: 12,
  },
  reviewHint: {
    fontSize: 14,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  reviewBtns: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  retakeBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  retakeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  uploadBtn: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // ── Common buttons ───────────────────────────────────────────────────────────
  doneBtn: {
    height: 52,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    marginTop: 8,
    width: '100%',
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  retryBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
  },
});
