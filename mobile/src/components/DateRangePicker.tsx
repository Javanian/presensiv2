/**
 * Shared date-range picker components used across HistoryScreen,
 * SubordinateAttendanceScreen, and OvertimeScreen.
 *
 * Exports:
 *   Calendar          — month-grid calendar (reusable)
 *   DatePickerModal   — full-screen modal wrapping Calendar
 *   DateRangeBar      — two-button row (Dari / Sampai) + clear
 */

import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getTodayStr(tz: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(new Date());
}

export function fmtDateShort(dateStr: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(`${dateStr}T12:00:00Z`));
}

// ── Calendar ──────────────────────────────────────────────────────────────────

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export interface CalendarProps {
  todayStr: string;
  selected: string | null;
  onSelect: (d: string) => void;
  /** Default false — all dates selectable. Set true for "future-only" pickers. */
  disablePast?: boolean;
  minDate?: string | null;
  maxDate?: string | null;
}

export function Calendar({
  todayStr, selected, onSelect,
  disablePast = false, minDate, maxDate,
}: CalendarProps) {
  const [year, setYear] = useState(() => parseInt(todayStr.slice(0, 4)));
  const [month, setMonth] = useState(() => parseInt(todayStr.slice(5, 7)) - 1);

  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function goMonth(delta: number) {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  }

  function toDateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View>
      {/* Month nav */}
      <View style={cal.nav}>
        <TouchableOpacity style={cal.navBtn} onPress={() => goMonth(-1)}>
          <Ionicons name="chevron-back" size={20} color="#2563EB" />
        </TouchableOpacity>
        <Text style={cal.navTitle}>{MONTHS_ID[month]} {year}</Text>
        <TouchableOpacity style={cal.navBtn} onPress={() => goMonth(1)}>
          <Ionicons name="chevron-forward" size={20} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* Day-of-week labels */}
      <View style={cal.row}>
        {DAY_LABELS.map((l) => <Text key={l} style={cal.dayLabel}>{l}</Text>)}
      </View>

      {/* Date grid */}
      {weeks.map((week, wi) => (
        <View key={wi} style={cal.row}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={cal.cell} />;
            const ds = toDateStr(day);
            const disabled =
              (disablePast && ds < todayStr) ||
              (minDate != null && ds < minDate) ||
              (maxDate != null && ds > maxDate);
            const isSelected = ds === selected;
            const isToday = ds === todayStr;
            return (
              <TouchableOpacity
                key={di}
                style={[
                  cal.cell,
                  isSelected && cal.cellSelected,
                  isToday && !isSelected && cal.cellToday,
                ]}
                onPress={() => !disabled && onSelect(ds)}
                disabled={disabled}
                activeOpacity={disabled ? 1 : 0.7}
              >
                <Text style={[
                  cal.cellText,
                  disabled && cal.cellTextDisabled,
                  isSelected && cal.cellTextSelected,
                  isToday && !isSelected && cal.cellTextToday,
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const cal = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { padding: 8 },
  navTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  row: { flexDirection: 'row', marginBottom: 2 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 12, color: '#6B7280', fontWeight: '600', paddingVertical: 4 },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  cellSelected: { backgroundColor: '#2563EB' },
  cellToday: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#2563EB' },
  cellText: { fontSize: 14, color: '#111827', fontWeight: '500' },
  cellTextDisabled: { color: '#D1D5DB' },
  cellTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  cellTextToday: { color: '#2563EB', fontWeight: '700' },
});

// ── DatePickerModal ───────────────────────────────────────────────────────────

export interface DatePickerModalProps {
  visible: boolean;
  title: string;
  selected: string | null;
  todayStr: string;
  /** Calls onSelect('__clear__') when the user clears the current date. */
  onSelect: (d: string) => void;
  onClose: () => void;
  minDate?: string | null;
  maxDate?: string | null;
}

export function DatePickerModal({
  visible, title, selected, todayStr,
  onSelect, onClose, minDate, maxDate,
}: DatePickerModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={dpm.safe} edges={['top', 'bottom']}>
        <View style={dpm.header}>
          <Text style={dpm.title}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView style={dpm.body}>
          {selected ? (
            <View style={dpm.selectedBadge}>
              <Ionicons name="calendar" size={15} color="#2563EB" />
              <Text style={dpm.selectedText}>{fmtDateShort(selected)}</Text>
              <TouchableOpacity onPress={() => onSelect('__clear__')} style={dpm.clearIcon}>
                <Ionicons name="close-circle" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={dpm.calBox}>
            <Calendar
              todayStr={todayStr}
              selected={selected}
              onSelect={onSelect}
              disablePast={false}
              minDate={minDate}
              maxDate={maxDate}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const dpm = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  selectedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
  },
  selectedText: { fontSize: 14, fontWeight: '600', color: '#2563EB', flex: 1 },
  clearIcon: { marginLeft: 'auto' },
  calBox: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16,
  },
});

// ── DateRangeBar ──────────────────────────────────────────────────────────────

export interface DateRangeBarProps {
  fromDate: string | null;
  toDate: string | null;
  onFromDate: (d: string | null) => void;
  onToDate: (d: string | null) => void;
  tz: string;
}

export function DateRangeBar({
  fromDate, toDate, onFromDate, onToDate, tz,
}: DateRangeBarProps) {
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);
  const todayStr = getTodayStr(tz);
  const hasFilter = fromDate !== null || toDate !== null;

  return (
    <View style={drb.row}>
      <Ionicons name="calendar-outline" size={14} color="#6B7280" style={{ marginRight: 8 }} />

      <TouchableOpacity
        style={[drb.btn, !!fromDate && drb.btnActive]}
        onPress={() => setShowFrom(true)}
      >
        <Ionicons
          name="arrow-forward-outline"
          size={12}
          color={fromDate ? '#2563EB' : '#9CA3AF'}
          style={{ marginRight: 4 }}
        />
        <Text style={[drb.btnText, !!fromDate && drb.btnTextActive]} numberOfLines={1}>
          {fromDate ? fmtDateShort(fromDate) : 'Dari tanggal'}
        </Text>
      </TouchableOpacity>

      <Text style={drb.sep}>–</Text>

      <TouchableOpacity
        style={[drb.btn, !!toDate && drb.btnActive]}
        onPress={() => setShowTo(true)}
      >
        <Ionicons
          name="arrow-back-outline"
          size={12}
          color={toDate ? '#2563EB' : '#9CA3AF'}
          style={{ marginRight: 4 }}
        />
        <Text style={[drb.btnText, !!toDate && drb.btnTextActive]} numberOfLines={1}>
          {toDate ? fmtDateShort(toDate) : 'Sampai tanggal'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => { onFromDate(null); onToDate(null); }}
        style={[drb.clearBtn, !hasFilter && drb.clearBtnHidden]}
        disabled={!hasFilter}
      >
        <Ionicons name="close-circle" size={18} color="#9CA3AF" />
      </TouchableOpacity>

      <DatePickerModal
        visible={showFrom}
        title="Dari Tanggal"
        selected={fromDate}
        todayStr={todayStr}
        onSelect={(d) => {
          if (d === '__clear__') { onFromDate(null); }
          else { onFromDate(d); if (toDate && d > toDate) onToDate(null); }
          setShowFrom(false);
        }}
        onClose={() => setShowFrom(false)}
        maxDate={toDate}
      />

      <DatePickerModal
        visible={showTo}
        title="Sampai Tanggal"
        selected={toDate}
        todayStr={todayStr}
        onSelect={(d) => {
          if (d === '__clear__') { onToDate(null); }
          else { onToDate(d); if (fromDate && d < fromDate) onFromDate(null); }
          setShowTo(false);
        }}
        onClose={() => setShowTo(false)}
        minDate={fromDate}
      />
    </View>
  );
}

const drb = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  btnActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  btnText: { fontSize: 12, color: '#6B7280', flexShrink: 1 },
  btnTextActive: { color: '#2563EB', fontWeight: '600' },
  sep: { marginHorizontal: 6, color: '#9CA3AF', fontSize: 13 },
  clearBtn: { marginLeft: 8 },
  clearBtnHidden: { opacity: 0 },
});
