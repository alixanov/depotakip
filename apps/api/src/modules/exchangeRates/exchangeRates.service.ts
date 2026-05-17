import type { CreateExchangeRateInput, Currency } from "@sadiyakargo/shared";
import { conflict, notFound } from "../../lib/errors.js";
import { ExchangeRate } from "./exchangeRate.model.js";

interface ListQuery {
  currency?: Currency;
  from?: string;
  to?: string;
}

export async function list(query: ListQuery = {}) {
  const filter: Record<string, unknown> = {};
  if (query.currency) filter.currency = query.currency;
  if (query.from || query.to) {
    filter.rateDate = {};
    if (query.from) (filter.rateDate as Record<string, Date>).$gte = new Date(query.from);
    if (query.to) (filter.rateDate as Record<string, Date>).$lte = new Date(query.to);
  }
  const docs = await ExchangeRate.find(filter).sort({ rateDate: -1 }).limit(500);
  return docs.map((d) => d.toClient());
}

export async function create(input: CreateExchangeRateInput) {
  try {
    const doc = await ExchangeRate.create({
      currency: input.currency,
      rateToUsd: input.rateToUsd,
      rateDate: new Date(input.rateDate),
      source: "manual",
    });
    return doc.toClient();
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      throw conflict("Bu tarihte zaten kur var");
    }
    throw err;
  }
}

export async function remove(id: string) {
  const doc = await ExchangeRate.findByIdAndDelete(id);
  if (!doc) throw notFound("Kur kaydı bulunamadı");
}

/** Convert an amount from any supported currency to USD, using the closest
 *  exchange rate on or before `date`. USD is treated as 1:1. */
const CACHE = new Map<string, number>();

export async function convertToUsd(
  amount: number,
  currency: Currency,
  date: Date
): Promise<{ amountUsd: number; rate: number }> {
  if (currency === "USD") return { amountUsd: amount, rate: 1 };

  const key = `${currency}:${date.toISOString().slice(0, 10)}`;
  if (CACHE.has(key)) {
    const rate = CACHE.get(key)!;
    return { amountUsd: Math.round(amount * rate), rate };
  }

  const doc = await ExchangeRate.findOne({ currency, rateDate: { $lte: date } })
    .sort({ rateDate: -1 })
    .lean();
  if (!doc) {
    throw notFound(`${currency} için kur bulunamadı`);
  }

  CACHE.set(key, doc.rateToUsd);
  // `rateToUsd` is "1 unit of <currency> in USD" → multiply.
  return { amountUsd: Math.round(amount * doc.rateToUsd), rate: doc.rateToUsd };
}
