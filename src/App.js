import { useState, useEffect } from "react";
import styled, { keyframes } from "styled-components";

const TABS = ["Ana Sayfa", "Kargocular", "Mal Girişi", "Gönderiler", "Raporlar"];

const STATUS_LABELS = {
  yolda: { label: "Yolda", color: "#F59E0B", bg: "#FEF3C7" },
  teslim: { label: "Teslim Edildi", color: "#10B981", bg: "#D1FAE5" },
  kayip: { label: "Kayıp", color: "#EF4444", bg: "#FEE2E2" },
  borclu: { label: "Borçlu", color: "#8B5CF6", bg: "#EDE9FE" },
  iptal: { label: "İptal/İflas", color: "#6B7280", bg: "#F3F4F6" },
};

const MAL_CESITLERI = [
  "Elektronik", "Giyim", "Kozmetik", "Gıda", "Oyuncak",
  "Ev Eşyası", "Aksesuar", "Kitap", "Spor", "Diğer"
];

// Animations
const spin = keyframes`
  to { transform: rotate(360deg) }
`;

// Styled Components
const AppContainer = styled.div`
  font-family: 'Segoe UI', Tahoma, sans-serif;
  background: #F1F5F9;
  min-height: 100vh;
  width: 100%;
  position: relative;
  
  * {
    box-sizing: border-box;
  }
  
  button:active {
    opacity: 0.75;
  }
`;

const MobileContainer = styled.div`
  max-width: 100%;
  margin: 0 auto;
  background: #F1F5F9;
  min-height: 100vh;
  
  @media (min-width: 768px) {
    max-width: 90%;
    margin: 20px auto;
    border-radius: 24px;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }
  
  @media (min-width: 1024px) {
    max-width: 900px;
  }
`;

const Header = styled.div`
  background: linear-gradient(135deg, #1E40AF 0%, #2563EB 100%);
  padding: 20px 16px 0;
  color: #fff;
`;

const HeaderBadge = styled.div`
  font-size: 10px;
  opacity: 0.75;
  font-weight: 600;
  letter-spacing: 1px;
  margin-bottom: 4px;
`;

const Title = styled.h1`
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 900;
  
  @media (min-width: 768px) {
    font-size: 22px;
  }
`;

const TabBar = styled.div`
  display: flex;
  gap: 2px;
  overflow-x: auto;
  padding-bottom: 0;
  scrollbar-width: none;
  -ms-overflow-style: none;
  
  &::-webkit-scrollbar {
    display: none;
  }
  
  @media (min-width: 480px) {
    gap: 4px;
  }
`;

const TabButton = styled.button`
  background: ${props => props.active ? "#fff" : "transparent"};
  color: ${props => props.active ? "#1E40AF" : "rgba(255,255,255,0.75)"};
  border: none;
  border-radius: 8px 8px 0 0;
  padding: 6px 10px;
  font-weight: 700;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s ease;
  
  @media (min-width: 480px) {
    padding: 8px 14px;
    font-size: 13px;
    border-radius: 10px 10px 0 0;
  }
  
  &:hover {
    background: ${props => props.active ? "#fff" : "rgba(255,255,255,0.1)"};
  }
`;

const Content = styled.div`
  padding: 16px;
  padding-bottom: 32px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
  
  @media (min-width: 768px) {
    grid-template-columns: repeat(4, 1fr);
  }
`;

const StatCard = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const StatIcon = styled.div`
  font-size: 24px;
`;

const StatValue = styled.div`
  font-size: 28px;
  font-weight: 900;
  color: ${props => props.color};
  line-height: 1.1;
`;

const StatLabel = styled.div`
  font-size: 12px;
  color: #64748B;
  font-weight: 600;
  margin-top: 2px;
`;

const WhiteCard = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
`;

const WarningCard = styled.div`
  background: #FEF3C7;
  border-radius: 16px;
  padding: 16px;
  border: 1.5px solid #FDE68A;
`;

const Badge = styled.span`
  background: ${props => STATUS_LABELS[props.status]?.bg || STATUS_LABELS.yolda.bg};
  color: ${props => STATUS_LABELS[props.status]?.color || STATUS_LABELS.yolda.color};
  border-radius: 20px;
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3px;
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`;

const ModalContainer = styled.div`
  background: #fff;
  border-radius: 20px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
  margin-bottom: 20px;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: #1E293B;
`;

const CloseButton = styled.button`
  background: #F1F5F9;
  border: none;
  border-radius: 50px;
  width: 32px;
  height: 32px;
  cursor: pointer;
  font-size: 18px;
  color: #64748B;
  transition: background 0.2s ease;
  
  &:hover {
    background: #E2E8F0;
  }
`;

const ModalBody = styled.div`
  padding: 0 24px 24px;
`;

const InputGroup = styled.div`
  margin-bottom: 14px;
`;

const Label = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 5px;
`;

const StyledInput = styled.input`
  width: 100%;
  padding: 11px 14px;
  border-radius: 10px;
  border: 1.5px solid #E2E8F0;
  font-size: 15px;
  outline: none;
  background: #F8FAFC;
  box-sizing: border-box;
  transition: border-color 0.2s ease;
  
  &:focus {
    border-color: #2563EB;
  }
`;

const StyledSelect = styled.select`
  width: 100%;
  padding: 11px 14px;
  border-radius: 10px;
  border: 1.5px solid #E2E8F0;
  font-size: 15px;
  background: #F8FAFC;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s ease;
  
  &:focus {
    border-color: #2563EB;
  }
`;

const Button = styled.button`
  background: ${props => props.outline ? "transparent" : props.color || "#2563EB"};
  color: ${props => props.outline ? props.color || "#2563EB" : "#fff"};
  border: ${props => props.outline ? `2px solid ${props.color || "#2563EB"}` : "none"};
  border-radius: 12px;
  padding: ${props => props.small ? "8px 16px" : "13px 22px"};
  font-weight: 700;
  font-size: ${props => props.small ? "13px" : "15px"};
  cursor: pointer;
  width: ${props => props.full ? "100%" : "auto"};
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    filter: brightness(0.95);
  }
  
  &:active {
    transform: translateY(0);
    opacity: 0.75;
  }
`;

const KargoCard = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const KargoHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const KargoInfo = styled.div`
  flex: 1;
`;

const KargoName = styled.div`
  font-weight: 800;
  font-size: 16px;
  color: #1E293B;
`;

const KargoPhone = styled.div`
  font-size: 13px;
  color: #2563EB;
  margin-top: 2px;
`;

const KargoAddress = styled.div`
  font-size: 12px;
  color: #64748B;
  margin-top: 3px;
`;

const KargoNote = styled.div`
  font-size: 12px;
  color: #94A3B8;
  margin-top: 3px;
`;

const KargoMeta = styled.div`
  font-size: 12px;
  color: #94A3B8;
  margin-top: 6px;
`;

const DeleteButton = styled.button`
  background: #FEE2E2;
  border: none;
  color: #EF4444;
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 14px;
  margin-left: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    background: #FECACA;
    transform: scale(1.05);
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  color: #94A3B8;
`;

const MalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const AddMalButton = styled.button`
  background: #EFF6FF;
  color: #2563EB;
  border: none;
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #DBEAFE;
    transform: scale(1.02);
  }
`;

const MalRow = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
`;

const MalSelect = styled.select`
  flex: 2;
  padding: 10px 10px;
  border-radius: 10px;
  border: 1.5px solid #E2E8F0;
  background: #F8FAFC;
  font-size: 14px;
  transition: border-color 0.2s ease;
  
  &:focus {
    border-color: #2563EB;
    outline: none;
  }
`;

const MalInput = styled.input`
  flex: 1;
  padding: 10px 8px;
  border-radius: 10px;
  border: 1.5px solid #E2E8F0;
  background: #F8FAFC;
  font-size: 14px;
  transition: border-color 0.2s ease;
  
  &:focus {
    border-color: #2563EB;
    outline: none;
  }
`;

const RemoveMalButton = styled.button`
  background: #FEE2E2;
  border: none;
  color: #EF4444;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #FECACA;
    transform: scale(1.05);
  }
`;

const GonderiCard = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const GonderiHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 8px;
`;

const GonderiKargoInfo = styled.div`
  font-weight: 800;
  font-size: 15px;
  color: #1E293B;
`;

const MallarContainer = styled.div`
  background: #F8FAFC;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 10px;
`;

const MalItem = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 3px;
`;

const MalTotal = styled.div`
  border-top: 1px solid #E2E8F0;
  margin-top: 6px;
  padding-top: 6px;
  display: flex;
  justify-content: space-between;
  font-size: 13px;
`;

const GonderiFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
`;

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  flex-direction: column;
  gap: 16px;
`;

const Spinner = styled.div`
  width: 48px;
  height: 48px;
  border: 4px solid #E2E8F0;
  border-top: 4px solid #2563EB;
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
`;

const StatusButtonGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 20px;
`;

const StatusButton = styled.button`
  background: ${props => props.active ? props.bg : "#F8FAFC"};
  border: ${props => props.active ? `2px solid ${props.borderColor}` : "2px solid #E2E8F0"};
  border-radius: 12px;
  padding: 12px 8px;
  cursor: pointer;
  color: ${props => props.active ? props.color : "#64748B"};
  font-weight: ${props => props.active ? 800 : 600};
  font-size: 13px;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
`;

const Toast = styled.div`
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: ${props => props.ok ? "#10B981" : "#EF4444"};
  color: #fff;
  padding: 12px 24px;
  border-radius: 30px;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  z-index: 200;
  white-space: nowrap;
  
  @media (max-width: 640px) {
    white-space: normal;
    text-align: center;
    max-width: 90%;
  }
`;

const ReportCard = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
`;

const ReportTitle = styled.h3`
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 800;
  color: #1E293B;
`;

const ConfirmModal = styled.div`
  text-align: center;
`;

const ConfirmButtons = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 24px;
`;

// Custom Confirm Dialog Component
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <ModalOverlay onClick={onCancel}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>Onay</ModalTitle>
          <CloseButton onClick={onCancel}>×</CloseButton>
        </ModalHeader>
        <ModalBody>
          <ConfirmModal>
            <p style={{ fontSize: 16, color: "#475569", marginBottom: 8 }}>{message}</p>
            <ConfirmButtons>
              <Button full onClick={onCancel} color="#94A3B8">İptal</Button>
              <Button full onClick={onConfirm} color="#EF4444">Sil</Button>
            </ConfirmButtons>
          </ConfirmModal>
        </ModalBody>
      </ModalContainer>
    </ModalOverlay>
  );
}

// Helper functions
function formatDate(ts) {
  if (!ts) return "-";
  return new Date(ts).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Components
function Modal({ title, onClose, children }) {
  return (
    <ModalOverlay onClick={onClose}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          <CloseButton onClick={onClose}>×</CloseButton>
        </ModalHeader>
        <ModalBody>{children}</ModalBody>
      </ModalContainer>
    </ModalOverlay>
  );
}

function Input({ label, ...props }) {
  return (
    <InputGroup>
      {label && <Label>{label}</Label>}
      <StyledInput {...props} />
    </InputGroup>
  );
}

function Select({ label, children, ...props }) {
  return (
    <InputGroup>
      {label && <Label>{label}</Label>}
      <StyledSelect {...props}>{children}</StyledSelect>
    </InputGroup>
  );
}

function Btn({ children, color = "#2563EB", onClick, full, small, outline }) {
  return (
    <Button color={color} onClick={onClick} full={full} small={small} outline={outline}>
      {children}
    </Button>
  );
}

// Mock storage for demo (replace with your actual storage)
const mockStorage = {
  async get(key, sync) {
    const data = localStorage.getItem(key);
    return data ? { value: data } : null;
  },
  async set(key, value, sync) {
    localStorage.setItem(key, value);
  }
};

// Main App
export default function App() {
  const [tab, setTab] = useState(0);
  const [kargocular, setKargocular] = useState([]);
  const [gonderiler, setGonderiler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);
  const [kForm, setKForm] = useState({ ad: "", soyad: "", telefon: "", adres: "", not: "" });
  const [gForm, setGForm] = useState({ kargocuId: "", mallar: [{ cesit: "Elektronik", adet: 1 }], ucret: "", tarih: new Date().toISOString().split("T")[0], not: "" });
  const [yeniDurum, setYeniDurum] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Use mock storage or real storage
  const storage = window.storage || mockStorage;

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [kr, go] = await Promise.all([
        storage.get("kargocular", true).catch(() => null),
        storage.get("gonderiler", true).catch(() => null),
      ]);
      setKargocular(kr ? JSON.parse(kr.value) : []);
      setGonderiler(go ? JSON.parse(go.value) : []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  }

  async function saveKargocular(list) {
    setKargocular(list);
    await storage.set("kargocular", JSON.stringify(list), true);
  }

  async function saveGonderiler(list) {
    setGonderiler(list);
    await storage.set("gonderiler", JSON.stringify(list), true);
  }

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  }

  async function kargoculKaydet() {
    if (!kForm.ad || !kForm.soyad || !kForm.telefon) return showToast("Ad, soyad ve telefon zorunlu!", false);
    const yeni = { ...kForm, id: Date.now().toString(), tarih: Date.now() };
    await saveKargocular([...kargocular, yeni]);
    setKForm({ ad: "", soyad: "", telefon: "", adres: "", not: "" });
    setModal(null);
    showToast("Kargocu eklendi ✓");
  }

  async function gonderiKaydet() {
    if (!gForm.kargocuId) return showToast("Kargocu seçin!", false);
    if (!gForm.ucret) return showToast("Ücret girin!", false);
    const yeni = {
      ...gForm, 
      id: Date.now().toString(),
      durum: "yolda", 
      olusturma: Date.now()
    };
    await saveGonderiler([...gonderiler, yeni]);
    setGForm({ kargocuId: "", mallar: [{ cesit: "Elektronik", adet: 1 }], ucret: "", tarih: new Date().toISOString().split("T")[0], not: "" });
    setModal(null);
    showToast("Gönderi oluşturuldu ✓");
  }

  async function durumGuncelle() {
    if (!yeniDurum) return;
    const list = gonderiler.map(g => g.id === selected.id ? { ...g, durum: yeniDurum, guncelleme: Date.now() } : g);
    await saveGonderiler(list);
    setModal(null);
    showToast("Durum güncellendi ✓");
  }

  async function kargoculSil(id) {
    setConfirmDialog({
      message: "Bu kargocuyu silmek istediğinize emin misiniz?",
      onConfirm: async () => {
        await saveKargocular(kargocular.filter(k => k.id !== id));
        showToast("Silindi");
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  }

  const toplamGonderi = gonderiler.length;
  const teslimSayisi = gonderiler.filter(g => g.durum === "teslim").length;
  const yoldaSayisi = gonderiler.filter(g => g.durum === "yolda").length;
  const kayipSayisi = gonderiler.filter(g => g.durum === "kayip").length;
  const borcluSayisi = gonderiler.filter(g => g.durum === "borclu").length;
  const toplamUcret = gonderiler.reduce((s, g) => s + (parseFloat(g.ucret) || 0), 0);
  const toplamMal = gonderiler.reduce((s, g) => s + (g.mallar?.reduce((sum, m) => sum + (parseInt(m.adet) || 0), 0) || 0), 0);

  function getKargocu(id) { return kargocular.find(k => k.id === id); }

  const malEkle = () => setGForm(f => ({ ...f, mallar: [...f.mallar, { cesit: "Elektronik", adet: 1 }] }));
  const malSil = i => setGForm(f => ({ ...f, mallar: f.mallar.filter((_, idx) => idx !== i) }));
  const malDegistir = (i, field, val) => setGForm(f => ({
    ...f, mallar: f.mallar.map((m, idx) => idx === i ? { ...m, [field]: val } : m)
  }));

  if (loading) return (
    <LoadingContainer>
      <Spinner />
      <p style={{ color: "#64748B", fontWeight: 600 }}>Yükleniyor...</p>
    </LoadingContainer>
  );

  return (
    <AppContainer>
      <MobileContainer>
        <Header>
          <HeaderBadge>DEPO TAKİP SİSTEMİ</HeaderBadge>
          <Title>📦 Özbekistan → Türkiye</Title>
          <TabBar>
            {TABS.map((t, i) => (
              <TabButton key={i} active={tab === i} onClick={() => setTab(i)}>
                {t}
              </TabButton>
            ))}
          </TabBar>
        </Header>

        <Content>
          {/* ANA SAYFA */}
          {tab === 0 && (
            <div>
              <StatsGrid>
                {[
                  { label: "Toplam Gönderi", val: toplamGonderi, icon: "📦", color: "#2563EB" },
                  { label: "Yolda", val: yoldaSayisi, icon: "🚚", color: "#F59E0B" },
                  { label: "Teslim Edildi", val: teslimSayisi, icon: "✅", color: "#10B981" },
                  { label: "Kayıp / Borçlu", val: kayipSayisi + borcluSayisi, icon: "⚠️", color: "#EF4444" },
                ].map((s, i) => (
                  <StatCard key={i}>
                    <StatIcon>{s.icon}</StatIcon>
                    <StatValue color={s.color}>{s.val}</StatValue>
                    <StatLabel>{s.label}</StatLabel>
                  </StatCard>
                ))}
              </StatsGrid>

              <WhiteCard>
                <StatLabel>Toplam Ödenen Ücret</StatLabel>
                <StatValue color="#1E40AF" style={{ fontSize: 32 }}>${toplamUcret.toFixed(0)}</StatValue>
                <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>Toplam <b>{toplamMal}</b> adet mal gönderildi</div>
              </WhiteCard>

              <WarningCard>
                <div style={{ fontWeight: 800, color: "#92400E", marginBottom: 8 }}>📋 Son Gönderiler</div>
                {gonderiler.length === 0 && <p style={{ color: "#B45309", fontSize: 14 }}>Henüz gönderi yok</p>}
                {gonderiler.slice(-3).reverse().map(g => {
                  const k = getKargocu(g.kargocuId);
                  return (
                    <div key={g.id} style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{k ? `${k.ad} ${k.soyad}` : "?"}</div>
                        <div style={{ fontSize: 12, color: "#64748B" }}>{formatDate(g.olusturma)} · ${g.ucret}</div>
                      </div>
                      <Badge status={g.durum} />
                    </div>
                  );
                })}
              </WarningCard>
            </div>
          )}

          {/* KARGOCULAR */}
          {tab === 1 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Kargocular ({kargocular.length})</h2>
                <Btn small onClick={() => setModal("kargocu")}>+ Ekle</Btn>
              </div>
              {kargocular.length === 0 && (
                <EmptyState>
                  <div style={{ fontSize: 48 }}>👤</div>
                  <p>Henüz kargocu eklenmedi</p>
                </EmptyState>
              )}
              {kargocular.map(k => {
                const goCount = gonderiler.filter(g => g.kargocuId === k.id).length;
                return (
                  <KargoCard key={k.id}>
                    <KargoHeader>
                      <KargoInfo>
                        <KargoName>{k.ad} {k.soyad}</KargoName>
                        <KargoPhone>📞 {k.telefon}</KargoPhone>
                        {k.adres && <KargoAddress>📍 {k.adres}</KargoAddress>}
                        {k.not && <KargoNote>💬 {k.not}</KargoNote>}
                        <KargoMeta>{goCount} gönderi · Eklenme: {formatDate(k.tarih)}</KargoMeta>
                      </KargoInfo>
                      <DeleteButton onClick={() => kargoculSil(k.id)}>🗑</DeleteButton>
                    </KargoHeader>
                  </KargoCard>
                );
              })}
            </div>
          )}

          {/* MAL GİRİŞİ */}
          {tab === 2 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Yeni Gönderi</h2>
              </div>
              <WhiteCard>
                <Select label="Kargocu Seç" value={gForm.kargocuId} onChange={e => setGForm(f => ({ ...f, kargocuId: e.target.value }))}>
                  <option value="">-- Kargocu Seçin --</option>
                  {kargocular.map(k => <option key={k.id} value={k.id}>{k.ad} {k.soyad} · {k.telefon}</option>)}
                </Select>

                <Input label="Gönderim Tarihi" type="date" value={gForm.tarih} onChange={e => setGForm(f => ({ ...f, tarih: e.target.value }))} />

                <div style={{ marginBottom: 14 }}>
                  <MalHeader>
                    <Label>Mallar</Label>
                    <AddMalButton onClick={malEkle}>+ Mal Ekle</AddMalButton>
                  </MalHeader>
                  {gForm.mallar.map((m, i) => (
                    <MalRow key={i}>
                      <MalSelect value={m.cesit} onChange={e => malDegistir(i, "cesit", e.target.value)}>
                        {MAL_CESITLERI.map(c => <option key={c}>{c}</option>)}
                      </MalSelect>
                      <MalInput type="number" value={m.adet} min="1" onChange={e => malDegistir(i, "adet", parseInt(e.target.value) || 1)} placeholder="Adet" />
                      {gForm.mallar.length > 1 && (
                        <RemoveMalButton onClick={() => malSil(i)}>×</RemoveMalButton>
                      )}
                    </MalRow>
                  ))}
                </div>

                <Input label="Ücret (USD)" type="number" placeholder="0" value={gForm.ucret} onChange={e => setGForm(f => ({ ...f, ucret: e.target.value }))} />
                <Input label="Not (isteğe bağlı)" placeholder="Açıklama..." value={gForm.not} onChange={e => setGForm(f => ({ ...f, not: e.target.value }))} />

                <Btn full onClick={() => { 
                  if (!gForm.kargocuId) { 
                    showToast("Kargocu seçin!", false); 
                    return; 
                  } 
                  if (!gForm.ucret) { 
                    showToast("Ücret girin!", false); 
                    return; 
                  } 
                  gonderiKaydet(); 
                }}>📦 Gönderiye Al</Btn>
              </WhiteCard>
            </div>
          )}

          {/* GÖNDERİLER */}
          {tab === 3 && (
            <div>
              <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 800 }}>Tüm Gönderiler ({gonderiler.length})</h2>
              {gonderiler.length === 0 && (
                <EmptyState>
                  <div style={{ fontSize: 48 }}>📭</div>
                  <p>Henüz gönderi yok</p>
                </EmptyState>
              )}
              {[...gonderiler].reverse().map(g => {
                const k = getKargocu(g.kargocuId);
                const toplamAdet = (g.mallar?.reduce((sum, m) => sum + (parseInt(m.adet) || 0), 0) || 0);
                return (
                  <GonderiCard key={g.id}>
                    <GonderiHeader>
                      <div>
                        <GonderiKargoInfo>
                          {k ? `${k.ad} ${k.soyad}` : "Bilinmeyen Kargocu"}
                        </GonderiKargoInfo>
                        {k && <KargoPhone>📞 {k.telefon}</KargoPhone>}
                        {k && k.adres && <KargoAddress>📍 {k.adres}</KargoAddress>}
                      </div>
                      <Badge status={g.durum} />
                    </GonderiHeader>

                    <MallarContainer>
                      {(g.mallar || []).map((m, i) => (
                        <MalItem key={i}>
                          <span style={{ color: "#475569" }}>{m.cesit}</span>
                          <span style={{ fontWeight: 700 }}>{m.adet} adet</span>
                        </MalItem>
                      ))}
                      <MalTotal>
                        <span style={{ color: "#64748B" }}>Toplam: <b>{toplamAdet} adet</b></span>
                        <span style={{ color: "#1E40AF", fontWeight: 800 }}>${g.ucret}</span>
                      </MalTotal>
                    </MallarContainer>

                    <GonderiFooter>
                      <span style={{ fontSize: 12, color: "#94A3B8" }}>{formatDate(g.olusturma)}</span>
                      <Btn small outline color="#2563EB" onClick={() => { setSelected(g); setYeniDurum(g.durum); setModal("durum"); }}>
                        Durum Güncelle
                      </Btn>
                    </GonderiFooter>

                    {g.not && <KargoNote style={{ marginTop: 6 }}>💬 {g.not}</KargoNote>}
                  </GonderiCard>
                );
              })}
            </div>
          )}

          {/* RAPORLAR */}
          {tab === 4 && (
            <div>
              <ReportCard>
                <ReportTitle>📊 Kargo Durumu Dağılımı</ReportTitle>
                <div style={{ marginBottom: 16 }}>
                  {Object.entries(STATUS_LABELS).map(([key, s]) => {
                    const count = gonderiler.filter(g => g.durum === key).length;
                    const percent = toplamGonderi ? (count / toplamGonderi * 100).toFixed(1) : 0;
                    return (
                      <div key={key} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                          <span>{s.label}</span>
                          <span style={{ fontWeight: 700 }}>{count} ({percent}%)</span>
                        </div>
                        <div style={{ background: "#E2E8F0", borderRadius: 10, height: 8, overflow: "hidden" }}>
                          <div style={{ width: `${percent}%`, background: s.color, height: "100%", borderRadius: 10 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>Toplam Ücret</span>
                    <span style={{ fontWeight: 800, color: "#1E40AF" }}>${toplamUcret.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600 }}>Toplam Mal Adedi</span>
                    <span style={{ fontWeight: 800, color: "#1E40AF" }}>{toplamMal}</span>
                  </div>
                </div>
              </ReportCard>

              <ReportCard>
                <ReportTitle>📦 En Çok Gönderilen Ürünler</ReportTitle>
                {(() => {
                  const malSay = {};
                  gonderiler.forEach(g => {
                    (g.mallar || []).forEach(m => {
                      malSay[m.cesit] = (malSay[m.cesit] || 0) + (parseInt(m.adet) || 0);
                    });
                  });
                  const entries = Object.entries(malSay).sort((a, b) => b[1] - a[1]);
                  return entries.length === 0 ? <p style={{ color: "#94A3B8", fontSize: 14 }}>Veri yok</p> :
                    entries.map(([cesit, adet]) => (
                      <div key={cesit} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #F1F5F9", fontSize: 14 }}>
                        <span style={{ color: "#475569" }}>{cesit}</span>
                        <span style={{ fontWeight: 800, color: "#1E40AF" }}>{adet} adet</span>
                      </div>
                    ));
                })()}
              </ReportCard>
            </div>
          )}
        </Content>

        {/* MODALS */}
        {modal === "kargocu" && (
          <Modal title="Yeni Kargocu Ekle" onClose={() => setModal(null)}>
            <Input label="Ad *" placeholder="Adı" value={kForm.ad} onChange={e => setKForm(f => ({ ...f, ad: e.target.value }))} />
            <Input label="Soyad *" placeholder="Soyadı" value={kForm.soyad} onChange={e => setKForm(f => ({ ...f, soyad: e.target.value }))} />
            <Input label="Telefon *" placeholder="+998..." value={kForm.telefon} onChange={e => setKForm(f => ({ ...f, telefon: e.target.value }))} />
            <Input label="Adres" placeholder="Türkiye'deki teslimat adresi" value={kForm.adres} onChange={e => setKForm(f => ({ ...f, adres: e.target.value }))} />
            <Input label="Not" placeholder="Ek bilgi..." value={kForm.not} onChange={e => setKForm(f => ({ ...f, not: e.target.value }))} />
            <Btn full onClick={kargoculKaydet}>✓ Kaydet</Btn>
          </Modal>
        )}

        {modal === "durum" && selected && (
          <Modal title="Durum Güncelle" onClose={() => setModal(null)}>
            <p style={{ color: "#64748B", fontSize: 14, marginTop: 0 }}>
              {getKargocu(selected.kargocuId)?.ad} {getKargocu(selected.kargocuId)?.soyad} · ${selected.ucret}
            </p>
            <StatusButtonGrid>
              {Object.entries(STATUS_LABELS).map(([key, s]) => (
                <StatusButton
                  key={key}
                  active={yeniDurum === key}
                  bg={s.bg}
                  borderColor={s.color}
                  color={s.color}
                  onClick={() => setYeniDurum(key)}
                >
                  {s.label}
                </StatusButton>
              ))}
            </StatusButtonGrid>
            <Btn full onClick={durumGuncelle}>✓ Güncelle</Btn>
          </Modal>
        )}

        {/* Custom Confirm Dialog */}
        {confirmDialog && (
          <ConfirmDialog
            message={confirmDialog.message}
            onConfirm={confirmDialog.onConfirm}
            onCancel={confirmDialog.onCancel}
          />
        )}

        {/* Toast */}
        {toast && (
          <Toast ok={toast.ok}>{toast.msg}</Toast>
        )}
      </MobileContainer>
    </AppContainer>
  );
}