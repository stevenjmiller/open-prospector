import { parseCanonical, type Json } from './index.js';
/** Raw LF framing: readline would hide forbidden CRLF. */
export class FrameDecoder {
  private pending = Buffer.alloc(0);
  constructor(private readonly maxBytes = 4 * 1024 * 1024) {}
  push(chunk: Buffer): Json[] {
    this.pending = Buffer.concat([this.pending, chunk]);
    const frames: Json[] = [];
    let newline: number;
    while ((newline = this.pending.indexOf(10)) !== -1) {
      if (newline > this.maxBytes) throw new Error('Frame too large');
      const line = this.pending.subarray(0, newline);
      this.pending = this.pending.subarray(newline + 1);
      frames.push(parseCanonical(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(line)));
    }
    if (this.pending.length > this.maxBytes) throw new Error('Frame too large');
    return frames;
  }
  end(): void { if (this.pending.length) throw new Error('Truncated frame'); }
}
