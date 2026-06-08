/** Join truthy class names with a space. */
export const cx = (...xs: (string | undefined)[]): string =>
  xs.filter(Boolean).join(" ");
