import { Types } from "mongoose";
import { Sender } from "../senders/sender.model.js";
import { Carrier } from "../carriers/carrier.model.js";
import { Shipment } from "../shipments/shipment.model.js";

export interface SearchHit {
  type: "sender" | "carrier" | "shipment";
  id: string;
  title: string;
  subtitle: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Multi-collection text search. Uses Mongo `$text` indexes when present and
 * falls back to a case-insensitive `$regex` so partial matches still work
 * during typing.
 */
export async function search(orgId: string, q: string, limit = 8): Promise<SearchHit[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];
  const orgFilter = { orgId: new Types.ObjectId(orgId), deletedAt: null };
  const rx = new RegExp(escapeRegex(trimmed), "i");

  const [senders, carriers, shipments] = await Promise.all([
    Sender.find({
      ...orgFilter,
      $or: [{ fullName: rx }, { phone: rx }],
    })
      .select("_id fullName phone")
      .limit(limit),
    Carrier.find({
      ...orgFilter,
      $or: [{ firstName: rx }, { lastName: rx }, { phone: rx }],
    })
      .select("_id firstName lastName phone")
      .limit(limit),
    Shipment.find({
      ...orgFilter,
      $or: [{ shortCode: rx }, { "recipient.name": rx }, { "recipient.phone": rx }],
    })
      .select("_id shortCode recipient status")
      .limit(limit),
  ]);

  const hits: SearchHit[] = [];

  for (const s of senders) {
    hits.push({
      type: "sender",
      id: s._id.toString(),
      title: s.fullName,
      subtitle: s.phone,
    });
  }
  for (const c of carriers) {
    hits.push({
      type: "carrier",
      id: c._id.toString(),
      title: `${c.firstName} ${c.lastName}`.trim(),
      subtitle: c.phone,
    });
  }
  for (const s of shipments) {
    hits.push({
      type: "shipment",
      id: s._id.toString(),
      title: s.shortCode,
      subtitle: `${s.status} · ${s.recipient?.name || "—"}`,
    });
  }
  return hits;
}
