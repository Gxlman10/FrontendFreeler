export const buildQueryParams = (params: Record<string, unknown> = {}) =>
  Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => {
        if (typeof value === 'boolean') {
          return [key, value ? 'true' : 'false'];
        }
        return [key, value];
      }),
  );
