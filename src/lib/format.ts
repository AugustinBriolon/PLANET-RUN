const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatKilometers(meters: number): string {
  return numberFormatter.format(meters / 1000);
}

export function formatWholeNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatHours(seconds: number): string {
  return numberFormatter.format(seconds / 3600);
}
