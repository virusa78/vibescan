import {
  scannerAvailabilityLabels,
  scannerHealthLabels,
  scannerResultLabels,
} from './productVocabulary';

export type ScannerAvailabilityStatus = "available" | "cooling_down" | "unavailable";

export const scannerSelectionLabels = {
  selected: "Selected",
  available: scannerAvailabilityLabels.available,
  cooling_down: scannerAvailabilityLabels.cooling_down,
  unavailable: scannerAvailabilityLabels.unavailable,
} as const;

export function getScannerAvailabilityLabel(status: ScannerAvailabilityStatus | null | undefined): string {
  return scannerAvailabilityLabels[status ?? "unavailable"];
}

export function getScannerSelectionLabel({
  selected,
  status,
}: {
  selected: boolean;
  status: ScannerAvailabilityStatus | null | undefined;
}): string {
  if (selected) {
    return scannerSelectionLabels.selected;
  }

  return getScannerAvailabilityLabel(status);
}

export function getScannerResultLabel(status: keyof typeof scannerResultLabels): string {
  return scannerResultLabels[status];
}

export function getScannerHealthLabel(healthy: boolean | null): string {
  if (healthy === true) {
    return scannerHealthLabels.healthy;
  }

  if (healthy === false) {
    return scannerHealthLabels.unhealthy;
  }

  return scannerHealthLabels.unknown;
}
