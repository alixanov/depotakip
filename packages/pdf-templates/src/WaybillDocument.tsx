import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "./styles.js";

export interface WaybillDocumentProps {
  qrDataUrl: string;
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
  shipment,
  carrier,
  recipient,
  org,
}: WaybillDocumentProps) {
  return (
    <Document title={`Waybill-${shipment.shortCode}`} author={org.name}>
      <Page size="A5" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{org.name}</Text>
            <Text style={styles.subtitle}>Sevkiyat Belgesi (Waybill)</Text>
            <Text style={styles.subtitle}>
              {shipment.shortCode} · {new Date(shipment.shipmentDate).toLocaleDateString("tr-TR")}
            </Text>
          </View>
          <Image src={qrDataUrl} style={styles.qr} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kargocu</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Ad Soyad</Text>
            <Text style={styles.value}>{carrier.fullName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Telefon</Text>
            <Text style={styles.value}>{carrier.phone}</Text>
          </View>
        </View>

        {recipient && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Alıcı</Text>
            <View style={styles.row}>
              <Text style={styles.label}>İsim</Text>
              <Text style={styles.value}>{recipient.name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Telefon</Text>
              <Text style={styles.value}>{recipient.phone}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Adres (TR)</Text>
              <Text style={styles.value}>{recipient.addressTr}</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İçerik</Text>
          {shipment.items.map((it, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.label}>{it.label}</Text>
              <Text style={styles.value}>{it.qty} adet</Text>
            </View>
          ))}
          <View style={[styles.row, { marginTop: 4 }]}>
            <Text style={styles.label}>Toplam</Text>
            <Text style={styles.value}>{shipment.totalItems} adet</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Kargocu ücreti</Text>
            <Text style={styles.value}>
              {(shipment.carrierFee.amount / 100).toFixed(2)} {shipment.carrierFee.currency}
            </Text>
          </View>
        </View>

        {shipment.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notlar</Text>
            <Text>{shipment.notes}</Text>
          </View>
        )}

        <View style={styles.section}>
          <View style={[styles.row, { marginTop: 16 }]}>
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
