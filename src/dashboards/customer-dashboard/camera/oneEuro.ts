/**
 * One Euro filter (Casiez, Roussel, Vogel, CHI 2012).
 *
 * Raw landmarks jitter by a pixel or two every frame. A fixed low-pass filter
 * hides that but makes the hair lag behind a quick head turn; this one lowers
 * its cutoff while the head is still (kills jitter) and raises it as the head
 * speeds up (kills lag). It is the standard answer for face anchored AR, and
 * the reason a filter feels glued on rather than floating.
 */

const smoothingFactor = (cutoffHz: number, dtSeconds: number): number => {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSeconds);
};

export class OneEuroFilter {
  private value: number | null = null;
  private derivative = 0;
  private lastTime = 0;

  /**
   * @param minCutoff  Hz at rest. Lower is steadier and laggier.
   * @param beta       How fast the cutoff rises with speed. Higher is more responsive.
   * @param dCutoff    Hz for the speed estimate itself.
   */
  constructor(
    private readonly minCutoff = 1.2,
    private readonly beta = 0.02,
    private readonly dCutoff = 1,
  ) {}

  filter(input: number, timestampMs: number): number {
    if (this.value === null) {
      this.value = input;
      this.lastTime = timestampMs;
      this.derivative = 0;
      return input;
    }

    // Floor on dt so two samples with the same timestamp cannot divide by zero.
    const dt = Math.max((timestampMs - this.lastTime) / 1000, 1e-3);
    this.lastTime = timestampMs;

    const rawDerivative = (input - this.value) / dt;
    const dAlpha = smoothingFactor(this.dCutoff, dt);
    this.derivative = dAlpha * rawDerivative + (1 - dAlpha) * this.derivative;

    const cutoff = this.minCutoff + this.beta * Math.abs(this.derivative);
    const alpha = smoothingFactor(cutoff, dt);
    this.value = alpha * input + (1 - alpha) * this.value;
    return this.value;
  }

  reset(): void {
    this.value = null;
    this.derivative = 0;
  }
}
