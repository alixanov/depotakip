import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "./styles.js";

export interface ReceiptDocumentProps {
  /** Pre-rendered QR code as a data URL (PNG). */
  qrDataUrl: string;
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
  category: {
    name: string;
  };
  org: {
    name: string;
  };
}

/** Format a Money value (minor units → display) for the PDF. */
function formatMoney(m: { amount: number; currency: string }): string {
  const display = (m.amount / 100).toFixed(2);
  return `${display} ${m.currency}`;
}

export function ReceiptDocument({ qrDataUrl, lot, sender, category, org }: ReceiptDocumentProps) {
  return (
    <Document title={`Receipt-${lot.id}`} author={org.name}>
      <Page size="A5" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{org.name}</Text>
            <Text style={styles.subtitle}>Depo Yönetim Sistemi — Teslim Alındı Belgesi</Text>
            <Text style={styles.subtitle}>
              No: {lot.id} · {new Date(lot.receivedAt).toLocaleString("tr-TR")}
            </Text>
          </View>
          <Image src={qrDataUrl} style={styles.qr} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gönderici</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Ad Soyad</Text>
            <Text style={styles.value}>{sender.fullName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Telefon</Text>
            <Text style={styles.value}>{sender.phone}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mal</Text>
          {lot.label && (
            <View style={styles.row}>
              <Text style={styles.label}>Parti adı</Text>
              <Text style={styles.value}>{lot.label}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Kategori</Text>
            <Text style={styles.value}>{category.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Adet</Text>
            <Text style={styles.value}>{lot.qtyIn}</Text>
          </View>
          {lot.unitPrice && (
            <View style={styles.row}>
              <Text style={styles.label}>Birim fiyat</Text>
              <Text style={styles.value}>{formatMoney(lot.unitPrice)}</Text>
            </View>
          )}
          {lot.unitPrice && (
            <View style={styles.row}>
              <Text style={styles.label}>Toplam</Text>
              <Text style={styles.value}>
                {formatMoney({
                  amount: lot.unitPrice.amount * lot.qtyIn,
                  currency: lot.unitPrice.currency,
                })}
              </Text>
            </View>
          )}
          {lot.notes && (
            <View style={styles.row}>
              <Text style={styles.label}>Notlar</Text>
              <Text style={styles.value}>{lot.notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İmzalar</Text>
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
