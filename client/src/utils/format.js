const numberFormatter = new Intl.NumberFormat('en-CA');

/** 1284 -> "1,284". Large standalone figures keep proportional digits. */
export const formatNumber = (value, decimals = 0) =>
  new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value) || 0);

export const formatKg = (value, decimals = 0) => `${formatNumber(value, decimals)} kg`;

export const formatPercent = (value, decimals = 0) => `${formatNumber(value, decimals)}%`;

export const formatCount = (value) => numberFormatter.format(Number(value) || 0);

/** Compact axis ticks: 1,284 -> "1.3k". */
export function formatCompact(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) >= 1000) return `${(number / 1000).toFixed(1)}k`;
  return formatNumber(number, Number.isInteger(number) ? 0 : 1);
}

export function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  if (!value) return '--';
  return new Date(value).toLocaleDateString('en-CA', options);
}

export function formatDateTime(value) {
  if (!value) return '--';
  return new Date(value).toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "4 minutes ago" - used for sensor freshness. */
export function formatRelativeTime(value) {
  if (!value) return 'never';

  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;

  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

export const titleCase = (value = '') =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
