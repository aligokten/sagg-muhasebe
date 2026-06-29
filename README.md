# SAGG Defter — Ön Muhasebe Uygulaması

Defter.net benzeri, bulut tabanlı **ön muhasebe** uygulaması. React + Firebase (Firestore)
ile geliştirilmiştir. Tüm veriler kullanıcıya özel olarak Firestore'da saklanır ve canlı
olarak senkronize edilir.

## Özellikler

### Satış & Alış
- **Faturalar** — Satış ve alış faturaları, durum takibi (ödendi/kısmi/ödenmedi), yazdırma ve PDF
- **Teklifler** — Teklif hazırlama, kabul/ret takibi, tek tıkla faturaya dönüştürme
- **Siparişler** — Satış/alış siparişleri, teslim takibi, faturaya dönüştürme
- **İrsaliyeler** — Sevk ve alış irsaliyeleri, faturaya dönüştürme

### Kayıtlar
- **Cari Hesaplar** — Müşteri/tedarikçi yönetimi, **hesap ekstresi**, borç/alacak bakiyesi,
  tahsilat ve ödeme işlemleri
- **Stok / Ürünler** — Ürün & hizmet kartları, **dinamik stok takibi**, stok hareketleri,
  kritik stok uyarısı
- **Personel** — Çalışan kartları ve maaş ödemesi

### Finans
- **Kasa & Banka** — Hesap yönetimi, para giriş/çıkışı, **hesaplar arası virman**, hesap hareketleri
- **Çek & Senet** — Alınan/verilen çek-senet portföyü, vade takibi, tahsil/ödeme
- **Gelir & Gider** — Fatura dışı gelir ve giderler, KDV ayrımı

### Raporlar & Diğer
- **Raporlar** — KDV raporu, aylık gelir/gider grafiği, gider dağılımı, cari yaşlandırma
- **Gösterge Paneli** — Genel finansal özet, trend grafiği, uyarılar
- **Ajanda** — Görev ve hatırlatıcılar
- **Arsa Paylaştır** — Parsel bölme / arsa paylaştırma aracı
- **Ayarlar** — Şirket profili ve fatura banka bilgileri

## Muhasebe Motoru

Bakiyeler kayıtlardan **dinamik olarak** türetilir (`src/finance.js`); böylece yazma anında
veri tutarsızlığı oluşmaz:

- **Cari bakiye** = Açılış + Satış faturaları (borç) − Alış faturaları (alacak) ± Hareketler ± Çek/Senet
- **Kasa/Banka bakiye** = Açılış + Girişler − Çıkışlar (tahsilat, ödeme, gelir, gider, virman)
- **Stok** = Açılış + Alışlar − Satışlar ± Manuel hareketler

## Proje Yapısı

```
src/
  firebase.js              Firebase yapılandırması ve CRUD veri katmanı
  utils.js                 Biçimlendirme & hesaplama yardımcıları
  finance.js               Bakiye/stok hesaplama motoru
  components/
    ui.js                  Paylaşılan arayüz bileşenleri (Modal, Table, Card...)
    DocumentForm.js        Fatura/teklif/sipariş ortak belge formu
    PrintView.js           Yazdırılabilir belge görünümü (yazdır + PDF)
  modules/                 Dashboard, Customers, Products, Invoices, Quotes,
                           Orders, Waybills, Accounts, Checks, CashFlow,
                           Personnel, Reports, Agenda, Settings
  ArsaPaylastir.js         Arsa paylaştırma modülü
```

## Kurulum

```bash
npm install
npm start      # geliştirme sunucusu (http://localhost:3000)
npm run build  # üretim derlemesi
npm test       # testler
```

### Firebase Notu
Uygulama anonim kimlik doğrulama kullanır. Firebase konsolundan
**Authentication > Sign-in method > Anonymous** sağlayıcısının etkin olması gerekir.

> Raporlar bilgilendirme amaçlıdır. Resmi beyanlar için mali müşavirinize danışınız.
