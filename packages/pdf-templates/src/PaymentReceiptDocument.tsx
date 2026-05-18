/** @jsxRuntime automatic */
// see WaybillDocument.tsx for rationale.
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "./styles.js";
import { createPdfT, formatPdfDateTime, formatPdfMoney, type PdfLocale } from "./lib/i18n.js";

export interface PaymentReceiptDocumentProps {
  qrDataUrl: string;
  /** UI language to render the document in. Defaults to `tr`. */
  language?: PdfLocale;
  tx: {
    id: string;
    kind: string;
    amount: number;
    currency: string;
    direction: "debit" | "credit";
    txDate: string;
    method: string;
    notes?: string;
    amountUsdSnapshot: number;
    exchangeRateToUsd: number;
  };
  counterparty: {
    type: "carrier" | "sender";
    name: string;
  };
  org: { name: string };
}

const KIND_KEY: Record<string, string> = {
  carrier_charge: "kind_carrier_charge",
  carrier_payment: "kind_carrier_payment",
  sender_charge: "kind_sender_charge",
  sender_payment: "kind_sender_payment",
  adjustment: "kind_adjustment",
};

export function PaymentReceiptDocument({
  qrDataUrl,
  language = "tr",
  tx,
  counterparty,
  org,
}: PaymentReceiptDocumentProps) {
  const t = createPdfT(language);
  const kindKey = (KIND_KEY[tx.kind] ?? tx.kind) as Parameters<typeof t>[0];
  const usdRate = Number(tx.exchangeRateToUsd) || 1;
  return (
    <Document title={`Receipt-${tx.id}`} author={org.name}>
      <Page size="A5" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{org.name}</Text>
            <Text style={styles.subtitle}>{t("payment_title")}</Text>
            <Text style={styles.subtitle}>
              {tx.id.slice(-8)} · {formatPdfDateTime(tx.txDate, language)}
            </Text>
          </View>
          <Image src={qrDataUrl} style={styles.qr} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("counterparty")}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t("party_type")}</Text>
            <Text style={styles.value}>
              {counterparty.type === "carrier" ? t("party_carrier") : t("party_sender")}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t("party_name")}</Text>
            <Text style={styles.value}>{counterparty.name}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("operation")}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t("op_kind")}</Text>
            <Text style={styles.value}>{t(kindKey)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t("direction")}</Text>
            <Text style={styles.value}>{tx.direction === "debit" ? t("debit") : t("credit")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t("amount")}</Text>
            <Text style={styles.value}>
              {formatPdfMoney({ amount: tx.amount, currency: tx.currency }, language)}
            </Text>
          </View>
          {tx.currency !== "USD" && (
            <View style={styles.row}>
              <Text style={styles.label}>{t("usd_equivalent")}</Text>
              <Text style={styles.value}>
                ≈ {formatPdfMoney({ amount: tx.amountUsdSnapshot, currency: "USD" }, language)} (1{" "}
                {tx.currency} ≈ {usdRate.toFixed(6)} USD)
              </Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>{t("method")}</Text>
            <Text style={styles.value}>{tx.method}</Text>
          </View>
          {tx.notes && (
            <View style={styles.row}>
              <Text style={styles.label}>{t("notes")}</Text>
              <Text style={styles.value}>{tx.notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
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
