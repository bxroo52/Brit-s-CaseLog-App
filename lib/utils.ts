import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Small billing helper (used across components)
export function formatId(prefix: string, id: string) {
  return `${prefix}-${id.slice(0, 8).toUpperCase()}`;
}

/**
 * Announces a message to screen readers via ARIA live regions.
 * Use polite for non-urgent (status, sync updates).
 * Use assertive for urgent (errors, success of important actions like billing).
 */
export function announce(message: string, assertive = false) {
  if (typeof document === 'undefined') return;

  const regionId = assertive ? 'live-region-assertive' : 'live-region-polite';
  const region = document.getElementById(regionId);

  if (region) {
    // Clear first so the same message can be re-announced
    region.textContent = '';
    // Small delay ensures the DOM update is picked up by SR
    setTimeout(() => {
      if (region) {
        region.textContent = message;
      }
    }, 50);
  }
}

