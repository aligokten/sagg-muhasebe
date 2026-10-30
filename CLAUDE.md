# SAGG Muhasebe — çalışma kuralları

## Yayınlama

**Her yenilikte masaüstü uygulaması da güncellenir.** Kullanıcıya özellik
teslim eden her değişiklikten sonra, ayrıca istenmesini beklemeden:

1. Değişiklikleri `claude/defter-app-clone-60gaoh` dalında geliştir, commit'le
   ve `main`'e birleştir. `main`'e push, GitHub Pages web yayınını tetikler.
2. `package.json` + `package-lock.json` içindeki sürümü bir minor artır
   (örn. 0.15.0 → 0.16.0) ve artışın semver açısından doğru olduğunu
   **push'tan önce** doğrula; electron-updater yalnızca artan sürümleri görür.
3. Sürüm commit'ini `main`'e birleştir, ardından `desktop-release.yml`
   iş akışını tetikle.
4. Yayını doğrula: GitHub Releases'te `.exe`, `.blockmap` ve `latest.yml`
   varlıklarının tamamı yüklenmiş olmalı. `latest.yml` olmadan masaüstü
   istemcileri güncellemeyi göremez.

Yalnızca yeniden düzenleme (refactor), test veya belge değişikliklerinde
masaüstü sürümü çıkarmaya gerek yoktur.

## Dil

Arayüz metinleri, commit mesajları ve kod yorumları Türkçedir.

## Tasarım

Görsel dil **SWISS DATA POP** yönergesine dayanır. Jetonlar
`src/index.css` (`:root` CSS değişkenleri) ve `tailwind.config.js` içinde
tanımlıdır; bileşenler `src/components/ui.js` dosyasında toplanır.
Yeni ekranlar doğrudan hex renk veya gölge kullanmak yerine bu jetonları
ve paylaşılan bileşenleri kullanmalıdır.

Not: Tailwind'in `orange` rampası tek vurgu rengine (vermilyon `#F43B04`)
bağlanmıştır; `*-orange-*` sınıfları vurgu rengini verir.

İstisna: yazdırma/PDF alanları (`#receipt-print-area`, `#doc-print-area`,
`#zreport-print-area`) her zaman beyaz zeminli ve koyu yazılı kalır —
koyu modda bile. Baskı doğruluğu tasarım tutarlılığından önce gelir.
