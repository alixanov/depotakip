"use strict";

const { ObjectId } = require("mongodb");

const TEMPLATES = [
  {
    key: "shipment_yolda",
    channel: "telegram",
    language: "tr",
    body: "Merhaba {{recipientName}}, kargonuz yola çıktı. Takip: {{trackingUrl}}",
  },
  {
    key: "shipment_teslim",
    channel: "telegram",
    language: "tr",
    body: "Kargonuz teslim edildi. Bizi tercih ettiğiniz için teşekkürler!",
  },
  {
    key: "shipment_kayip",
    channel: "telegram",
    language: "tr",
    body: "Kargonuzla ilgili bir sorun var. Lütfen bizimle iletişime geçin.",
  },
  {
    key: "shipment_iptal",
    channel: "telegram",
    language: "tr",
    body: "Kargonuz iptal edildi.",
  },
  {
    key: "payment_received",
    channel: "telegram",
    language: "tr",
    body: "{{amount}} {{currency}} tutarındaki ödemeniz alındı. Teşekkürler.",
  },
  {
    key: "lot_received",
    channel: "telegram",
    language: "tr",
    body: "{{qty}} adet {{label}} depomuza teslim alındı.",
  },
];

module.exports = {
  async up(db) {
    const orgIdHex = process.env.DEFAULT_ORG_ID || "000000000000000000000001";
    const orgId = new ObjectId(orgIdHex);
    const now = new Date();
    for (const tpl of TEMPLATES) {
      await db.collection("notificationTemplates").updateOne(
        { orgId, key: tpl.key, channel: tpl.channel, language: tpl.language },
        {
          $setOnInsert: {
            ...tpl,
            orgId,
            active: true,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true }
      );
    }
  },

  async down(db) {
    const orgIdHex = process.env.DEFAULT_ORG_ID || "000000000000000000000001";
    const orgId = new ObjectId(orgIdHex);
    await db.collection("notificationTemplates").deleteMany({
      orgId,
      key: { $in: TEMPLATES.map((t) => t.key) },
    });
  },
};
