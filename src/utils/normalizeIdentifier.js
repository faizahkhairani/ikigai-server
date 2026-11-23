// " @Adhya 0160 " -> "adhya0160"
export const normalizeIdentifier = (identifier) =>
  identifier.toLowerCase().replace(/[\s@]/g, '');
