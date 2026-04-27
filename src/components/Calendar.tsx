import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { getTodayStr, toLocalDateStr } from '../utils/date';

interface CalendarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const MONTH_NAMES = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];
const DAY_HEADERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function Calendar({ selectedDate, onSelectDate }: CalendarProps) {
  const todayStr = getTodayStr();
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const maxDate = new Date(todayDate);
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  const maxDateStr = toLocalDateStr(maxDate);

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const dateToShow = selectedDate || todayStr;
    const [y, m] = dateToShow.split('-').map(Number);
    return { year: y, month: m - 1 };
  });

  const canGoPrev = () => {
    return calendarMonth.year > todayDate.getFullYear() ||
      (calendarMonth.year === todayDate.getFullYear() && calendarMonth.month > todayDate.getMonth());
  };

  const canGoNext = () => {
    return calendarMonth.year < maxDate.getFullYear() ||
      (calendarMonth.year === maxDate.getFullYear() && calendarMonth.month < maxDate.getMonth());
  };

  const goToPrevMonth = () => {
    if (!canGoPrev()) return;
    setCalendarMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  };

  const goToNextMonth = () => {
    if (!canGoNext()) return;
    setCalendarMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  const generateMonthWeeks = () => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1);

    // Start from Monday of the week containing the 1st
    const startDate = new Date(firstDay);
    const dow = startDate.getDay();
    startDate.setDate(startDate.getDate() - (dow === 0 ? 6 : dow - 1));

    const weeks: Array<Array<{
      date: string; day: number; disabled: boolean;
      isToday: boolean; isCurrentMonth: boolean;
    }>> = [];

    const current = new Date(startDate);
    for (let w = 0; w < 6; w++) {
      const week: typeof weeks[0] = [];
      let hasCurrentMonth = false;
      for (let d = 0; d < 7; d++) {
        const dateStr = toLocalDateStr(current);
        const isCurrentMonth = current.getMonth() === month;
        if (isCurrentMonth) hasCurrentMonth = true;
        const isBeyondMax = dateStr > maxDateStr;
        const isBeforeToday = dateStr < todayStr;
        week.push({
          date: dateStr,
          day: current.getDate(),
          disabled: isBeyondMax || isBeforeToday || !isCurrentMonth,
          isToday: dateStr === todayStr,
          isCurrentMonth,
        });
        current.setDate(current.getDate() + 1);
      }
      if (hasCurrentMonth) weeks.push(week);
    }
    return weeks;
  };

  const weeks = generateMonthWeeks();

  return (
    <View style={styles.calendar}>
      {/* Month navigation */}
      <View style={styles.calendarNav}>
        <TouchableOpacity
          onPress={goToPrevMonth}
          style={[styles.navBtn, !canGoPrev() && styles.navBtnDisabled]}
          disabled={!canGoPrev()}
        >
          <Ionicons name="chevron-back" size={20} color={canGoPrev() ? Colors.text : Colors.borderLight} />
        </TouchableOpacity>
        <Text style={styles.calendarMonth}>
          {MONTH_NAMES[calendarMonth.month]} {calendarMonth.year}
        </Text>
        <TouchableOpacity
          onPress={goToNextMonth}
          style={[styles.navBtn, !canGoNext() && styles.navBtnDisabled]}
          disabled={!canGoNext()}
        >
          <Ionicons name="chevron-forward" size={20} color={canGoNext() ? Colors.text : Colors.borderLight} />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={styles.row}>
        {DAY_HEADERS.map((d, i) => (
          <View key={i} style={styles.cell}>
            <Text style={styles.dayHeader}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map((day) => {
            const isSelected = day.date === selectedDate;
            return (
              <TouchableOpacity
                key={day.date}
                style={[
                  styles.cell,
                  isSelected && styles.cellSelected,
                  day.isToday && !isSelected && styles.cellToday,
                ]}
                onPress={() => !day.disabled && onSelectDate(day.date)}
                disabled={day.disabled}
              >
                <Text
                  style={[
                    styles.dayText,
                    day.disabled && styles.dayDisabled,
                    !day.isCurrentMonth && styles.dayOtherMonth,
                    isSelected && styles.daySelected,
                    day.isToday && !isSelected && styles.dayTodayText,
                  ]}
                >
                  {day.day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  calendarNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  navBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.borderLight,
  },
  navBtnDisabled: { opacity: 0.4 },
  calendarMonth: {
    fontSize: 16, fontWeight: '700', color: Colors.text, textAlign: 'center',
  },
  row: { flexDirection: 'row' },
  cell: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: 8,
  },
  cellSelected: { backgroundColor: '#E3001B' },
  cellToday: { borderWidth: 1.5, borderColor: Colors.border },
  dayHeader: { fontSize: 12, fontWeight: '700', color: Colors.textLight },
  dayText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  dayDisabled: { color: Colors.borderLight },
  dayOtherMonth: { color: Colors.borderLight },
  daySelected: { color: '#FFF', fontWeight: '700' },
  dayTodayText: { color: '#E3001B', fontWeight: '700' },
});
