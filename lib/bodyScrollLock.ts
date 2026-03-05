let refCount = 0;
let savedOverflow: string | null = null;

/**
 * Locks body scroll (overflow: hidden). Ref-counted: first lock saves and sets;
 * last unlock restores.
 */
export function lockBodyScroll(): void {
  refCount += 1;
  if (refCount === 1) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
}

/**
 * Unlocks body scroll. Restores previous overflow when ref count reaches 0.
 */
export function unlockBodyScroll(): void {
  if (refCount <= 0) return;
  refCount -= 1;
  if (refCount === 0) {
    document.body.style.overflow = savedOverflow ?? "";
    savedOverflow = null;
  }
}
