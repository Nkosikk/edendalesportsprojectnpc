import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDate = (date: string | Date) => {
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
};

export const formatTime = (value: string | Date) => {
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
  }

  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) {
    // Fallback: return the original string to avoid runtime errors
    return typeof value === 'string' ? value : '';
  }
  return new Intl.DateTimeFormat('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
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

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(amount);
};

export const getInitials = (firstName: string, lastName: string) => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

export const truncateText = (text: string, maxLength: number = 100) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};