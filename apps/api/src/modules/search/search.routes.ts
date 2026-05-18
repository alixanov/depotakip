import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { unauthorized } from "../../lib/errors.js";
import { search } from "./search.service.js";

const router = Router();
router.use(requireAuth);

const querySchema = z.object({
  q: z.string().min(1).max(120),
  limit: z.coerce.number().int().positive().max(20).optional(),
});

router.get("/", validate({ query: querySchema }), async (req, res) => {
  if (!req.orgId) throw unauthorized();
  const q = req.query as unknown as { q: string; limit?: number };
  res.json(await search(req.orgId, q.q, q.limit ?? 8));
});

export default router;
