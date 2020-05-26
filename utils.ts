export type DiscriminateUnion<T, K extends keyof T, V extends T[K]> = T extends
  Record<K, V> ? T : never;

export function prettyPrint(obj: any) {
  return JSON.stringify(obj, null, 2);
}
