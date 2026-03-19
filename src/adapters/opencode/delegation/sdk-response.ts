export function unwrapSdkResponse<T>(value: T | { data: T }): T {
  if (typeof value === "object" && value !== null && "data" in value) {
    return value.data;
  }

  return value;
}
