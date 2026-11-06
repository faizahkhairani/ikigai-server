const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000; // WIB
const DAY_MS = 24 * 60 * 60 * 1000;

export const startOfTodayJakarta = (now = new Date()) => {
  const jakartaMs = now.getTime() + JAKARTA_OFFSET_MS;
  const startOfDayJakartaMs = Math.floor(jakartaMs / DAY_MS) * DAY_MS;
  return new Date(startOfDayJakartaMs - JAKARTA_OFFSET_MS);
};

export const startOfMonthJakarta = (now = new Date()) => {
  const jakarta = new Date(now.getTime() + JAKARTA_OFFSET_MS); 
  return new Date(Date.UTC(jakarta.getUTCFullYear(), jakarta.getUTCMonth(), 1) - JAKARTA_OFFSET_MS);
};

export const getPresetStart = (preset) => {
  if (preset === 'today') return startOfTodayJakarta();
  if (preset === 'month') return startOfMonthJakarta();
  return undefined;
};