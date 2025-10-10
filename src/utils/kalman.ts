export class SimpleKalman {
  private q: number
  private r: number
  private x: number
  private p: number
  private k: number
  constructor(q = 0.01, r = 0.1, initial = 0) {
    this.q = q
    this.r = r
    this.x = initial
    this.p = 1
    this.k = 0
  }
  filter(measurement: number) {
    // prediction
    this.p = this.p + this.q
    // update
    this.k = this.p / (this.p + this.r)
    this.x = this.x + this.k * (measurement - this.x)
    this.p = (1 - this.k) * this.p
    return this.x
  }
}