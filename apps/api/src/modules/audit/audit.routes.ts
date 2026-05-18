import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { unauthorized } from "../../lib/errors.js";
import { AuditLog } from "./audit.model.js";

const router = Router();
router.use(requireAuth);

const querySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  entityType: z.string().optional(),
  action: z.string().optional(),
  userId: z.string().optional(),
});

interface AuditAggRow {
  _id: Types.ObjectId;
  userId: Types.ObjectId | null;
  action: string;
  entityType: string;
  entityId: string | null;
  diff: { before?: unknown; after?: unknown } | null;
  ip: string;
  userAgent: string;
  at: Date;
  userFullName: string | null;
  userEmail: string | null;
}

router.get(
  "/",
  requirePermission("audit:read"),
  validate({ query: querySchema }),
  asyncHandler(async (req, res) => {
    if (!req.orgId) throw unauthorized();
    const q = req.query as unknown as {
      page?: number;
      limit?: number;
      entityType?: string;
      action?: string;
      userId?: string;
    };
    const page = q.page ?? 1;
    const limit = q.limit ?? 30;

    const match: Record<string, unknown> = { orgId: new Types.ObjectId(req.orgId) };
    if (q.entityType) match.entityType = q.entityType;
    if (q.action) match.action = q.action;
    if (q.userId) match.userId = new Types.ObjectId(q.userId);

    const [rows, total] = await Promise.all([
      AuditLog.aggregate<AuditAggRow>([
        { $match: match },
        { $sort: { at: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            action: 1,
            entityType: 1,
            entityId: 1,
            diff: 1,
            ip: 1,
            userAgent: 1,
            at: 1,
            userFullName: { $arrayElemAt: ["$user.fullName", 0] },
            userEmail: { $arrayElemAt: ["$user.email", 0] },
          },
        },
      ]),
      AuditLog.countDocuments(match),
    ]);

    res.json({
      data: rows.map((r) => ({
        id: r._id.toString(),
        userId: r.userId ? r.userId.toString() : null,
        userFullName: r.userFullName ?? null,
        userEmail: r.userEmail ?? null,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        diff: r.diff,
        ip: r.ip,
        userAgent: r.userAgent,
        at: r.at.toISOString(),
      })),
      pagination: { page, limit, total, hasMore: page * limit < total },
    });
  })
);

export default router;
