import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { canonical, validate, FrameDecoder, type ObjectValue, type Intent } from '@open-prospector/contracts';

export class ProtocolError extends Error {
  constructor(readonly code: string) { super(code); }
}
interface Pending {
  request: ObjectValue; expected: string; intents: Intent[];
  resolve: (reply: { frame: ObjectValue; intents: Intent[] }) => void;
  reject: (error: Error) => void; timer: NodeJS.Timeout;
}
export class Connection {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly decoder = new FrameDecoder();
  private pending: Pending | undefined;
  private failure: Error | undefined;
  private stopping = false;
  private lastTick = 0;
  private exited: Promise<void>;
  constructor(endpointFile: string, private readonly watchdogMs = 30_000, mode = 'normal') {
    this.child = spawn(process.execPath, [endpointFile, mode], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) }
    });
    this.child.stderr.on('data', () => { /* Diagnostics deliberately excluded from authority. */ });
    this.child.stdout.on('data', (chunk: Buffer) => {
      try { for (const frame of this.decoder.push(chunk)) this.accept(frame as ObjectValue); }
      catch { this.fail(new ProtocolError('protocol:invalid-frame')); }
    });
    this.child.stdout.on('end', () => { try { this.decoder.end(); } catch { this.fail(new ProtocolError('protocol:truncated-frame')); } });
    this.child.stdin.on('error', () => this.fail(new ProtocolError('protocol:write-failed')));
    this.child.on('error', () => this.fail(new ProtocolError('protocol:spawn-failed')));
    this.exited = new Promise(resolve => this.child.on('close', code => {
      if (!this.stopping || code !== 0 || this.pending) this.fail(new ProtocolError('protocol:child-exit'));
      resolve();
    }));
  }
  private fail(error: Error): void {
    this.failure ??= error;
    if (this.pending) {
      clearTimeout(this.pending.timer); this.pending.reject(this.failure); this.pending = undefined;
    }
    this.child.kill();
  }
  private accept(frame: ObjectValue): void {
    validate('ipc-frame', frame);
    const pending = this.pending;
    if (!pending) throw new ProtocolError('protocol:unsolicited-frame');
    if (frame.frame === 'emit') {
      if (pending.request.frame !== 'advance' || pending.intents.length >= 256) throw new ProtocolError('protocol:unexpected-emit');
      const intent = frame.intent as unknown as Intent;
      validate('outbound-intent', intent);
      if (intent.sent_tick !== pending.request.to_tick) throw new ProtocolError('protocol:source-tick');
      pending.intents.push(intent); return;
    }
    if (frame.frame !== pending.expected) throw new ProtocolError('protocol:unexpected-response');
    if (frame.frame === 'ready' && frame.run_id !== (pending.request.run_manifest as ObjectValue).run_id) throw new ProtocolError('protocol:wrong-run');
    if (frame.frame === 'ready') this.lastTick = Number(((pending.request.run_manifest as ObjectValue).clock as ObjectValue).start_tick);
    if (frame.frame === 'stopped' && frame.at_tick !== this.lastTick) throw new ProtocolError('protocol:wrong-stop-tick');
    const atTick = pending.request.to_tick ?? pending.request.at_tick;
    if (atTick !== undefined && frame.at_tick !== atTick) throw new ProtocolError('protocol:wrong-tick');
    if (frame.frame === 'done') this.lastTick = Number(frame.at_tick);
    clearTimeout(pending.timer); this.pending = undefined;
    pending.resolve({ frame, intents: pending.intents });
  }
  async request(request: ObjectValue): Promise<{ frame: ObjectValue; intents: Intent[] }> {
    this.assertHealthy();
    if (this.pending) throw new Error('Concurrent IPC requests');
    validate('ipc-frame', request);
    const expected = { init: 'ready', advance: 'done', checkpoint: 'checkpoint-result', shutdown: 'stopped' }[String(request.frame)];
    if (!expected) throw new Error('Invalid request frame');
    const response = await new Promise<{ frame: ObjectValue; intents: Intent[] }>((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new ProtocolError('protocol:timeout')), this.watchdogMs);
      this.pending = { request, expected, intents: [], resolve, reject, timer };
      this.child.stdin.write(canonical(request) + '\n');
    });
    this.assertHealthy(); // Catches duplicate terminators in the same stdout chunk.
    return response;
  }
  assertHealthy(): void { if (this.failure) throw this.failure; }
  async stop(): Promise<void> {
    this.stopping = true;
    await this.request({ frame: 'shutdown' });
    const timer = setTimeout(() => this.fail(new ProtocolError('protocol:shutdown-timeout')), this.watchdogMs);
    try { await this.exited; this.assertHealthy(); } finally { clearTimeout(timer); }
  }
  async abort(): Promise<void> { this.child.kill(); await this.exited; }
}
