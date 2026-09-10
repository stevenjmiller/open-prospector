import { clone, hash, validate, type ObjectValue } from '@open-prospector/contracts';
import type { State } from './state.js';

export interface ClassifierInput { observation_id: string; sensor_id: string; artifact_hash: string }
export interface ClassifierOutput extends ObjectValue {
  model_id: string;
  label: 'rock' | 'not-rock' | 'indeterminate';
  confidence_ppm: number;
}
export interface ClassifierResult extends ObjectValue {
  seam_id: string;
  input_hash: string;
  output_hash: string;
  output: ClassifierOutput;
}

/** Run-local, recorded response injection. It has no provider, callback or network fallback. */
export class RecordedClassifier {
  #record: ClassifierResult;
  #consumed = false;

  constructor(records: readonly unknown[]) {
    if (!Array.isArray(records)) throw new Error('Recorded classifier results must be an array');
    const validated = records.map(record => {
      validate('protocol-payload#/$defs/ClassifierResult', record);
      const result = clone(record) as ClassifierResult;
      if (hash(result.output) !== result.output_hash) throw new Error('Recorded classifier output hash mismatch');
      return result;
    });
    const matches = validated.filter(record => record.seam_id === 'seam:rock-classifier-v0');
    if (matches.length !== 1) throw new Error('Exactly one recorded rock classifier result is required');
    this.#record = matches[0]!;
  }

  consume(state: State, input: ClassifierInput): ClassifierResult {
    if (state !== 'safe-hold') throw new Error('Classifier requires safely stopped safe-hold state');
    if (this.#consumed) throw new Error('Classifier already consumed for this run');
    if (input === null || typeof input !== 'object' ||
        Object.keys(input).length !== 3 ||
        !Object.hasOwn(input, 'observation_id') || !Object.hasOwn(input, 'sensor_id') ||
        !Object.hasOwn(input, 'artifact_hash')) throw new Error('Invalid classifier input members');
    validate('common#/$defs/Id', input.observation_id);
    validate('common#/$defs/Id', input.sensor_id);
    validate('common#/$defs/Hash', input.artifact_hash);
    if (hash(input) !== this.#record.input_hash) throw new Error('Recorded classifier input hash mismatch');
    this.#consumed = true;
    return clone(this.#record);
  }

  snapshot(): { consumed: boolean; record_hash: string; result: ClassifierResult | null } {
    return { consumed: this.#consumed, record_hash: hash(this.#record), result: this.#consumed ? clone(this.#record) : null };
  }
}

export function createRecordedClassifier(records: readonly unknown[]): RecordedClassifier {
  return new RecordedClassifier(records);
}
