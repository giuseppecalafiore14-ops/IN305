const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

  return `${DAYS[date.getDay()]} · ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const hours = date.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(date.getMinutes()).padStart(2, '0')} ${ampm}`;
}

export function formatDateTime(dateStr: string): string {
  return `${formatDateShort(dateStr)} · ${formatTime(dateStr)}`;
}
