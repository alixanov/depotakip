/** @jsxRuntime automatic */
// tsx/tsup (esbuild) ignores this package's tsconfig when resolving .tsx
// from outside, so without the pragma JSX would compile as classic
// `React.createElement(...)` and crash at runtime with "React is not defined".
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "./styles.js";
import { createPdfT, formatPdfDate, formatPdfMoney, type PdfLocale } from "./lib/i18n.js";

export interface WaybillDocumentProps {
  qrDataUrl: string;
  /** UI language to render the document in. Defaults to `tr`. */
  language?: PdfLocale;
  shipment: {
    id: string;
    shortCode: string;
    shipmentDate: string;
    notes?: string;
    items: { label: string; qty: number }[];
    totalItems: number;
    carrierFee: { amount: number; currency: string };
  };
  carrier: {
    fullName: string;
    phone: string;
  };
  recipient: {
    name: string;
    phone: string;
    addressTr: string;
  } | null;
  org: {
    name: string;
  };
}

export function WaybillDocument({
  qrDataUrl,
  language = "tr",
  shipment,
  carrier,
  recipient,
  org,
}: WaybillDocumentProps) {
  const t = createPdfT(language);
  return (
    <Document title={`Waybill-${shipment.shortCode}`} author={org.name}>
      <Page size="A5" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{org.name}</Text>
            <Text style={styles.subtitle}>{t("waybill_title")}</Text>
            <Text style={styles.subtitle}>
              {shipment.shortCode} · {formatPdfDate(shipment.shipmentDate, language)}
            </Text>
          </View>
          <Image src={qrDataUrl} style={styles.qr} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("carrier")}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t("fullName")}</Text>
            <Text style={styles.value}>{carrier.fullName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t("phone")}</Text>
            <Text style={styles.value}>{carrier.phone}</Text>
          </View>
        </View>

        {recipient && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("recipient")}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>{t("recipient_name")}</Text>
              <Text style={styles.value}>{recipient.name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{t("phone")}</Text>
              <Text style={styles.value}>{recipient.phone}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{t("address_tr")}</Text>
              <Text style={styles.value}>{recipient.addressTr}</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("content")}</Text>
          {shipment.items.map((it, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.label}>{it.label}</Text>
              <Text style={styles.value}>
                {it.qty} {t("pcs")}
              </Text>
            </View>
          ))}
          <View style={[styles.row, { marginTop: 4 }]}>
            <Text style={styles.label}>{t("total_pcs")}</Text>
            <Text style={styles.value}>
              {shipment.totalItems} {t("pcs")}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t("carrier_fee")}</Text>
            <Text style={styles.value}>{formatPdfMoney(shipment.carrierFee, language)}</Text>
          </View>
        </View>

        {shipment.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("notes")}</Text>
            <Text>{shipment.notes}</Text>
          </View>
        )}

        <View style={styles.section}>
          <View style={[styles.row, { marginTop: 16 }]}>
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
