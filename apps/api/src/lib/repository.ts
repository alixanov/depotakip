/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types, type FilterQuery, type Model } from "mongoose";
import type { PaginatedResponse } from "@sadiyakargo/shared";

/** Build a tenant filter that excludes soft-deleted documents. */
export function tenantFilter(orgId: string, extra?: Record<string, unknown>): FilterQuery<any> {
  return {
    orgId: new Types.ObjectId(orgId),
    deletedAt: null,
    ...(extra || {}),
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
}

/** Helper to run a paginated, soft-delete-aware list query.
 *  `map` may be sync (`doc → R`) or async (`doc → Promise<R>`) — async case is
 *  parallelised through `Promise.all`. Use async when the row needs a second
 *  lookup (e.g. denormalised role for `User`).
 */
export async function paginate<R>(
  model: Model<any>,
  filter: FilterQuery<any>,
  pagination: PaginationParams,
  map: (doc: any) => R | Promise<R>,
  defaultSort: Record<string, 1 | -1> = { createdAt: -1 }
): Promise<PaginatedResponse<R>> {
  const page = pagination.page ?? 1;
  const limit = pagination.limit ?? 20;
  const sort = parseSort(pagination.sort) || defaultSort;

  const [docs, total] = await Promise.all([
    model
      .find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    model.countDocuments(filter),
  ]);

  return {
    data: await Promise.all(docs.map(map)),
    pagination: { page, limit, total, hasMore: page * limit < total },
  };
}

function parseSort(input: string | undefined): Record<string, 1 | -1> | null {
  if (!input) return null;
  return input.split(",").reduce<Record<string, 1 | -1>>((acc, raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return acc;
    const desc = trimmed.startsWith("-");
    const key = desc ? trimmed.slice(1) : trimmed;
    acc[key] = desc ? -1 : 1;
    return acc;
  }, {});
}

/** Soft-delete by id within the tenant; returns the (now-deleted) doc or null. */
export async function softDeleteOne(
  model: Model<any>,
  orgId: string,
  id: string
): Promise<unknown> {
  return model.findOneAndUpdate(
    tenantFilter(orgId, { _id: new Types.ObjectId(id) }),
    { $set: { deletedAt: new Date() } },
    { new: true }
  );
}
