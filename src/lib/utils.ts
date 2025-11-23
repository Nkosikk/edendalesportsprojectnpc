import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  } catch (error) {
    console.warn('Invalid date format:', date);
    return '—';
  }
};

export const formatTime = (value: string | Date | null | undefined) => {
  if (!value) return '—';
  
  try {
    // Handle plain HH:MM time strings directly
    if (typeof value === 'string') {
      const s = value.trim();
      // e.g., "21:00"
      if (/^\d{2}:\d{2}$/.test(s)) return s;
      // Some backends send "YYYY-MM-DD HH:MM"; convert to ISO-like for Date parsing
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) {
        const iso = s.replace(' ', 'T');
        const d = new Date(iso);
        if (!isNaN(d.getTime())) {
          return new Intl.DateTimeFormat('en-ZA', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(d);
        }
      }
      // Direct string fallback
      return s;
    }

    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) {
      // Fallback: return the original string to avoid runtime errors
      return typeof value === 'string' ? value : '—';
    }
    return new Intl.DateTimeFormat('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch (error) {
    console.warn('Invalid time format:', value);
    return '—';
  }
};

export const formatDateTime = (date: string | Date) => {
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(date));
};

export const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'R0.00';
  }
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  } catch (error) {
    console.warn('Invalid currency amount:', amount);
    return `R${Number(amount || 0).toFixed(2)}`;
  }
};

export const getInitials = (firstName: string, lastName: string) => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

export const truncateText = (text: string, maxLength: number = 100) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const safeNumber = (value: any, defaultValue: number = 0): number => {
  if (typeof value === 'number' && !isNaN(value)) return value;
  const parsed = Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
};