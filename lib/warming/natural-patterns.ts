/**
 * Natural patterns for humanizing warming behavior
 */

export function getRandomDelay(minSeconds: number, maxSeconds: number): number {
  return Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;
}

export function getTypingDuration(
  minSeconds: number,
  maxSeconds: number,
  messageLength?: number
): number {
  let duration = getRandomDelay(minSeconds, maxSeconds);

  // Adjust based on message length if provided
  if (messageLength) {
    const charsPerSecond = 5; // Average typing speed
    const estimatedDuration = Math.ceil(messageLength / charsPerSecond);
    // Use the average of random and estimated, capped by max
    duration = Math.min(
      Math.floor((duration + estimatedDuration) / 2),
      maxSeconds
    );
  }

  return duration;
}

export function getRecordingDuration(minSeconds: number, maxSeconds: number): number {
  // Audio messages typically are between 5-30 seconds
  const audioMin = Math.max(minSeconds, 5);
  const audioMax = Math.min(maxSeconds, 30);
  return getRandomDelay(audioMin, audioMax);
}

export function isWithinSchedule(
  config: {
    run_24h: boolean;
    start_time: string;
    end_time: string;
    days_of_week: number[];
    timezone: string;
  }
): boolean {
  const now = new Date();

  // Get current time in the configured timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    weekday: "short",
  });

  // Check day of week (0 = Sunday, 6 = Saturday)
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const currentDayName = dayFormatter.format(now);
  const currentDay = dayMap[currentDayName];

  if (!config.days_of_week.includes(currentDay)) {
    return false;
  }

  // If 24h mode, all hours are valid
  if (config.run_24h) {
    return true;
  }

  // Check time window
  const currentTimeStr = formatter.format(now);
  const [hours, minutes] = currentTimeStr.split(":").map(Number);
  const currentMinutes = hours * 60 + minutes;

  const [startHours, startMinutes] = config.start_time.split(":").map(Number);
  const startTotalMinutes = startHours * 60 + startMinutes;

  const [endHours, endMinutes] = config.end_time.split(":").map(Number);
  const endTotalMinutes = endHours * 60 + endMinutes;

  // Handle overnight schedules (e.g., 22:00 to 06:00)
  if (startTotalMinutes > endTotalMinutes) {
    return currentMinutes >= startTotalMinutes || currentMinutes <= endTotalMinutes;
  }

  return currentMinutes >= startTotalMinutes && currentMinutes <= endTotalMinutes;
}

export function getNextScheduleTime(config: {
  run_24h: boolean;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  timezone: string;
  min_delay_between_actions: number;
  max_delay_between_actions: number;
}): Date {
  const now = new Date();

  // Calculate delay
  const delay = getRandomDelay(
    config.min_delay_between_actions,
    config.max_delay_between_actions
  );

  let nextTime = new Date(now.getTime() + delay * 1000);

  // If within schedule, use the calculated time
  if (isWithinSchedule(config)) {
    return nextTime;
  }

  // Otherwise, find the next valid schedule window
  // For simplicity, just add the delay and let the next check handle it
  // The processor will skip execution if outside schedule
  return nextTime;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Common Brazilian informal reactions
export const COMMON_REACTIONS = [
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "🙏",
  "🔥",
  "👏",
  "💯",
  "😍",
];

export function getRandomReaction(): string {
  return COMMON_REACTIONS[Math.floor(Math.random() * COMMON_REACTIONS.length)];
}

// Status background colors
export const STATUS_COLORS = [
  "#075e54", // WhatsApp green
  "#128c7e",
  "#25d366",
  "#dcf8c6",
  "#ece5dd",
  "#34b7f1",
  "#00a884",
];

export function getRandomStatusColor(): string {
  return STATUS_COLORS[Math.floor(Math.random() * STATUS_COLORS.length)];
}
