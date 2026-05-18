/** @jsxRuntime automatic */
// see WaybillDocument.tsx for rationale.
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "./styles.js";
import { createPdfT, formatPdfDateTime, formatPdfMoney, type PdfLocale } from "./lib/i18n.js";

export interface ReceiptDocumentProps {
  /** Pre-rendered QR code as a data URL (PNG). */
  qrDataUrl: string;
  /** UI language to render the document in. Defaults to `tr`. */
  language?: PdfLocale;
  lot: {
    id: string;
    label?: string;
    receivedAt: string;
    qtyIn: number;
    unitPrice?: { amount: number; currency: "USD" | "UZS" | "TRY" } | null;
    notes?: string;
  };
  sender: {
    fullName: string;
    phone: string;
  };
  org: {
    name: string;
  };
}

export function ReceiptDocument({
  qrDataUrl,
  language = "tr",
  lot,
  sender,
  org,
}: ReceiptDocumentProps) {
  const t = createPdfT(language);
  return (
    <Document title={`Receipt-${lot.id}`} author={org.name}>
      <Page size="A5" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{org.name}</Text>
            <Text style={styles.subtitle}>{t("receipt_title")}</Text>
            <Text style={styles.subtitle}>
              {t("no")}: {lot.id} · {formatPdfDateTime(lot.receivedAt, language)}
            </Text>
          </View>
          <Image src={qrDataUrl} style={styles.qr} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("sender")}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t("fullName")}</Text>
            <Text style={styles.value}>{sender.fullName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t("phone")}</Text>
            <Text style={styles.value}>{sender.phone}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("goods")}</Text>
          {lot.label && (
            <View style={styles.row}>
              <Text style={styles.label}>{t("lot_name")}</Text>
              <Text style={styles.value}>{lot.label}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>{t("qty")}</Text>
            <Text style={styles.value}>{lot.qtyIn}</Text>
          </View>
          {lot.unitPrice && (
            <View style={styles.row}>
              <Text style={styles.label}>{t("unit_price")}</Text>
              <Text style={styles.value}>{formatPdfMoney(lot.unitPrice, language)}</Text>
            </View>
          )}
          {lot.unitPrice && (
            <View style={styles.row}>
              <Text style={styles.label}>{t("total")}</Text>
              <Text style={styles.value}>
                {formatPdfMoney(
                  { amount: lot.unitPrice.amount * lot.qtyIn, currency: lot.unitPrice.currency },
                  language
                )}
              </Text>
            </View>
          )}
          {lot.notes && (
            <View style={styles.row}>
              <Text style={styles.label}>{t("notes")}</Text>
              <Text style={styles.value}>{lot.notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("signatures")}</Text>
          <View style={[styles.row, { marginTop: 24 }]}>
            <Text style={styles.label}>{t("delivered_by")}: _______________</Text>
            <Text style={styles.label}>{t("received_by")}: _______________</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {t("footer")}
        </Text>
      </Page>
    </Document>
  );
}
