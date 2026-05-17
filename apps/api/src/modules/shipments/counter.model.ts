import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface CounterDoc extends Document<string> {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter: Model<CounterDoc> =
  (mongoose.models.Counter as Model<CounterDoc>) ||
  mongoose.model<CounterDoc>("Counter", counterSchema);

/**
 * Atomic, monotonically-increasing sequence per key. Used to generate
 * human-readable shipment codes like `SH-2026-00123`.
 */
export async function nextSequence(key: string, session?: mongoose.ClientSession): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session }
  );
  return doc.seq;
}
