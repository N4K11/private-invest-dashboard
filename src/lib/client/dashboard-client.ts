export function getDashboardTokenFromUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get("token");
}

export function getLocalDateTimeInputValue(date = new Date()) {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

export function getLocalDateKey(date = new Date()) {
  return getLocalDateTimeInputValue(date).slice(0, 10);
}

export function toLocalDateTimeInput(value: string | null | undefined) {
  if (!value) {
    return getLocalDateTimeInputValue();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return getLocalDateTimeInputValue();
  }

  return getLocalDateTimeInputValue(parsed);
}
