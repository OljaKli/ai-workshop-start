// The part of gifenc (MIT, no types of its own) that gif.ts uses.
declare module 'gifenc' {
  const gifenc: { quantize: typeof quantize; applyPalette: typeof applyPalette; GIFEncoder: typeof GIFEncoder };
  export default gifenc;
  export type Palette = number[][];
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number): Palette;
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette): Uint8Array;
  export function GIFEncoder(): {
    writeFrame(index: Uint8Array, width: number, height: number, options: { palette: Palette; delay: number }): void;
    finish(): void;
    bytes(): Uint8Array;
  };
}
