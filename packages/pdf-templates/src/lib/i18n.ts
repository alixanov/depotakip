/**
 * Tiny i18n layer for the PDF templates. We don't pull in `i18next` here
 * because these docs are rendered server-side by @react-pdf/renderer and we
 * want the smallest possible dependency surface. A flat dict per language
 * (extend as needed) + `createPdfT(lang)` factory.
 */

export type PdfLocale = "tr" | "ru" | "uz";

export const PDF_LOCALE_BCP47: Record<PdfLocale, string> = {
  tr: "tr-TR",
  ru: "ru-RU",
  uz: "uz-UZ",
};

type Dict = Record<string, string>;

const tr: Dict = {
  // shared
  no: "No",
  sender: "Gönderici",
  fullName: "Ad Soyad",
  phone: "Telefon",
  notes: "Notlar",
  signatures: "İmzalar",
  delivered_by: "Teslim eden",
  received_by: "Teslim alan",
  footer: "Bu belge sistemde otomatik oluşturulmuştur. QR kodu doğrulama için kullanın.",
  // receipt
  receipt_title: "Teslim Alındı Belgesi",
  goods: "Mal",
  lot_name: "Parti adı",
  qty: "Adet",
  unit_price: "Birim fiyat",
  total: "Toplam",
  // waybill
  waybill_title: "Sevkiyat Belgesi (Waybill)",
  carrier: "Kargocu",
  recipient: "Alıcı",
  recipient_name: "İsim",
  address_tr: "Adres (TR)",
  content: "İçerik",
  pcs: "adet",
  carrier_fee: "Kargocu ücreti",
  total_pcs: "Toplam",
  // payment receipt
  payment_title: "Ödeme / Tahakkuk Belgesi",
  counterparty: "Karşı taraf",
  party_type: "Tür",
  party_carrier: "Kargocu",
  party_sender: "Gönderici",
  party_name: "İsim",
  operation: "İşlem",
  op_kind: "Türü",
  direction: "Yön",
  debit: "borç",
  credit: "alacak",
  amount: "Tutar",
  usd_equivalent: "USD karşılığı",
  method: "Yöntem",
  kind_carrier_charge: "Kargocu ücreti",
  kind_carrier_payment: "Kargocuya ödeme",
  kind_sender_charge: "Gönderici ücreti",
  kind_sender_payment: "Göndericiden tahsilat",
  kind_adjustment: "Düzeltme",
};

const ru: Dict = {
  no: "№",
  sender: "Отправитель",
  fullName: "ФИО",
  phone: "Телефон",
  notes: "Примечания",
  signatures: "Подписи",
  delivered_by: "Сдал",
  received_by: "Принял",
  footer: "Документ сформирован системой автоматически. Используйте QR-код для проверки.",
  receipt_title: "Расписка о приёмке",
  goods: "Товар",
  lot_name: "Название партии",
  qty: "Количество",
  unit_price: "Цена за единицу",
  total: "Итого",
  waybill_title: "Транспортная накладная",
  carrier: "Перевозчик",
  recipient: "Получатель",
  recipient_name: "Имя",
  address_tr: "Адрес (TR)",
  content: "Содержимое",
  pcs: "шт.",
  carrier_fee: "Оплата перевозчику",
  total_pcs: "Всего",
  payment_title: "Платёжный документ",
  counterparty: "Контрагент",
  party_type: "Тип",
  party_carrier: "Перевозчик",
  party_sender: "Отправитель",
  party_name: "Имя",
  operation: "Операция",
  op_kind: "Тип",
  direction: "Направление",
  debit: "дебет",
  credit: "кредит",
  amount: "Сумма",
  usd_equivalent: "Эквивалент в USD",
  method: "Способ",
  kind_carrier_charge: "Начисление перевозчику",
  kind_carrier_payment: "Оплата перевозчику",
  kind_sender_charge: "Начисление отправителю",
  kind_sender_payment: "Поступление от отправителя",
  kind_adjustment: "Корректировка",
};

const uz: Dict = {
  no: "№",
  sender: "Jo'natuvchi",
  fullName: "F.I.Sh.",
  phone: "Telefon",
  notes: "Izohlar",
  signatures: "Imzolar",
  delivered_by: "Topshirdi",
  received_by: "Qabul qildi",
  footer: "Hujjat tizim tomonidan avtomatik yaratilgan. Tekshirish uchun QR kodidan foydalaning.",
  receipt_title: "Qabul qilish dalolatnomasi",
  goods: "Mahsulot",
  lot_name: "Partiya nomi",
  qty: "Soni",
  unit_price: "Birlik narxi",
  total: "Jami",
  waybill_title: "Yuk xati",
  carrier: "Tashuvchi",
  recipient: "Qabul qiluvchi",
  recipient_name: "Ism",
  address_tr: "Manzil (TR)",
  content: "Tarkibi",
  pcs: "dona",
  carrier_fee: "Tashuvchi haqi",
  total_pcs: "Jami",
  payment_title: "To'lov hujjati",
  counterparty: "Kontragent",
  party_type: "Turi",
  party_carrier: "Tashuvchi",
  party_sender: "Jo'natuvchi",
  party_name: "Ism",
  operation: "Operatsiya",
  op_kind: "Turi",
  direction: "Yo'nalishi",
  debit: "qarz",
  credit: "kredit",
  amount: "Summa",
  usd_equivalent: "USDdagi ekvivalent",
  method: "Usul",
  kind_carrier_charge: "Tashuvchiga hisoblash",
  kind_carrier_payment: "Tashuvchiga to'lov",
  kind_sender_charge: "Jo'natuvchiga hisoblash",
  kind_sender_payment: "Jo'natuvchidan tushum",
  kind_adjustment: "Tuzatish",
};

const DICTS: Record<PdfLocale, Dict> = { tr, ru, uz };

/** Returns a `t(key)` function bound to `lang`; falls back to `tr` and the
 *  raw key when nothing matches, so missing translations are visible but
 *  don't crash the render. */
export function createPdfT(lang: PdfLocale): (key: keyof typeof tr) => string {
  const dict = DICTS[lang] ?? DICTS.tr;
  return (key) => dict[key] ?? tr[key] ?? String(key);
}

export function formatPdfDate(iso: string | Date, lang: PdfLocale): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(PDF_LOCALE_BCP47[lang]);
}

export function formatPdfDateTime(iso: string | Date, lang: PdfLocale): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString(PDF_LOCALE_BCP47[lang]);
}

/**
 * Money formatter that matches the web client's `formatMoney`: UZS rounds to
 * whole soums (printing "12500000.00 UZS" on a receipt looks broken), USD/TRY
 * keep two decimals. Pass `lang` for locale-aware thousands separators.
 */
export function formatPdfMoney(m: { amount: number; currency: string }, lang: PdfLocale): string {
  const major = (Number(m.amount) || 0) / 100;
  if (m.currency === "UZS") {
    return `${Math.round(major).toLocaleString(PDF_LOCALE_BCP47[lang])} ${m.currency}`;
  }
  return `${major.toFixed(2)} ${m.currency}`;
}
