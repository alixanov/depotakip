import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "./styles.js";

export interface PaymentReceiptDocumentProps {
  qrDataUrl: string;
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

const KIND_LABEL: Record<string, string> = {
  carrier_charge: "Kargocu ücreti",
  carrier_payment: "Kargocuya ödeme",
  sender_charge: "Gönderici ücreti",
  sender_payment: "Göndericiden tahsilat",
  adjustment: "Düzeltme",
};

export function PaymentReceiptDocument({
  qrDataUrl,
  tx,
  counterparty,
  org,
}: PaymentReceiptDocumentProps) {
  return (
    <Document title={`Receipt-${tx.id}`} author={org.name}>
      <Page size="A5" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{org.name}</Text>
            <Text style={styles.subtitle}>Ödeme / Tahakkuk Belgesi</Text>
            <Text style={styles.subtitle}>
              {tx.id.slice(-8)} · {new Date(tx.txDate).toLocaleString("tr-TR")}
            </Text>
          </View>
          <Image src={qrDataUrl} style={styles.qr} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Karşı taraf</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Tür</Text>
            <Text style={styles.value}>
              {counterparty.type === "carrier" ? "Kargocu" : "Gönderici"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>İsim</Text>
            <Text style={styles.value}>{counterparty.name}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İşlem</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Türü</Text>
            <Text style={styles.value}>{KIND_LABEL[tx.kind] || tx.kind}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Yön</Text>
            <Text style={styles.value}>{tx.direction === "debit" ? "borç" : "alacak"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tutar</Text>
            <Text style={styles.value}>
              {(tx.amount / 100).toFixed(2)} {tx.currency}
            </Text>
          </View>
          {tx.currency !== "USD" && (
            <View style={styles.row}>
              <Text style={styles.label}>USD karşılığı</Text>
              <Text style={styles.value}>
                ≈ {(tx.amountUsdSnapshot / 100).toFixed(2)} USD (1 {tx.currency} ≈{" "}
                {tx.exchangeRateToUsd.toFixed(6)} USD)
              </Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Yöntem</Text>
            <Text style={styles.value}>{tx.method}</Text>
          </View>
          {tx.notes && (
            <View style={styles.row}>
              <Text style={styles.label}>Notlar</Text>
              <Text style={styles.value}>{tx.notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={[styles.row, { marginTop: 24 }]}>
            <Text style={styles.label}>Teslim eden: _______________</Text>
            <Text style={styles.label}>Teslim alan: _______________</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          Bu belge sistemde otomatik oluşturulmuştur. QR kodu doğrulama için kullanın.
        </Text>
      </Page>
    </Document>
  );
}
