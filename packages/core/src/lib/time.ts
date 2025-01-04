const timePeriodFormatter = new Intl.RelativeTimeFormat("en", {
  localeMatcher: "best fit",
  numeric: "auto",
});

export function timeSince(date: Date) {
  if (isNaN(date.getTime())) {
    throw Error("Invalid date");
  }
  const seconds = Math.floor((date.getTime() - Date.now()) / 1000);

  let interval = seconds / 31536000;

  if (interval < -1) {
    return timePeriodFormatter.format(Math.trunc(interval), "year");
  }
  interval = seconds / 2592000;
  if (interval < -1) {
    return timePeriodFormatter.format(Math.trunc(interval), "month");
  }
  interval = seconds / 86400;
  if (interval < -1) {
    return timePeriodFormatter.format(Math.trunc(interval), "day");
  }
  interval = seconds / 3600;
  if (interval < -1) {
    return timePeriodFormatter.format(Math.trunc(interval), "hours");
  }
  interval = seconds / 60;
  if (interval < -1) {
    return timePeriodFormatter.format(Math.trunc(interval), "minutes");
  }
  return timePeriodFormatter.format(Math.trunc(interval), "seconds");
}
