export function endTime(start: string) {
  const [hour, minute] = start.split(":").map(Number);
  return `${String(hour + Math.floor((minute + 30) / 60)).padStart(2, "0")}:${String((minute + 30) % 60).padStart(2, "0")}`;
}
