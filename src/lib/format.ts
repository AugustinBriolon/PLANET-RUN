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

const percentFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Formats a 0–1 share, rounding down so a city never shows 100% before every street is covered. */
export function formatPercent(share: number): string {
  return `${percentFormatter.format(Math.floor(share * 1000) / 10)}%`;
}
