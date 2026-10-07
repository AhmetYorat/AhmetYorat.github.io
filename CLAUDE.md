# Portfolyo: BMO Macera Sahnesi

Ahmet'in kişisel portfolyosu. Tek sayfa: Adventure Time'daki ağaç evde oturan 3D bir BMO, etrafında projeleri temsil eden kartuşlar. Bir kartuşa tıklanınca BMO'ya takılır, kamera BMO'nun ekranına dalar ve projenin detay sayfası açılır.

Kullanıcıyla Türkçe konuş. Kod yorumları da Türkçe.

## Yapı

İki mod var (adarkeser.com'daki gibi): **normal mod** (sade kaydırmalı sayfa, **varsayılan**; ilk gelen ziyaretçi bununla başlar) ve **macera modu** (BMO sahnesi). `src/main.js` seçimi `localStorage` `mode` ile hatırlar; `?mode=normal` ile de açılır. Macera modunda "Normal mod" düğmesi **sol üstte** (sağ üstteki oyun kontrolleri Geç/pil/ses'ten ayrı dursun diye); normal modun sağ üstünde "Macera modu" düğmesi var.

- `src/data.js`: bütün içerik (profil, projeler, arka plan, karakterin arka plandaki yeri). İçerik değişikliği önce buraya.
- `src/adventure/scene.js`: Three.js sahnesi; BMO modeli, kartuşlar, animasyonlar, yüz ifadeleri, etkileşim.
- `src/adventure/sound.js`: tüm sesler WebAudio ile koddan üretiliyor, ses dosyası yok.
- `src/normal/normal.js`: normal mod. Solda giriş (ad, değişen proje adı, tanıtım), her proje için bir bölüm, en sonda hakkımda + yetenekler + iletişim. Sağda kaydırırken sabit 3D ikon çarkı (proje logoları); kaydırınca aktif proje öne döner, arkadaki ışık onun rengini alır; sürüklenince döner, ikona tıklayınca o bölüme kayar. Telefonda çark üstte sabit şerit. İkonlar ince, köşeleri yuvarlak levhalar; öne gelen ikon parlak, arkadakiler karanlık; yerdeki ışık havuzu, arka plan ve girişteki "Yaptıklarımdan biri: X" yazısı **öne gelen ikona göre** değişir (girişte 2.6 sn'de bir sıradaki öne döner). Kamera ~10° yukarıdan bakar, fareyle hafifçe kayar. Yazı tipleri adarkeser.com ile aynı (başlık Bricolage Grotesque, metin/etiket sistem sans/mono). "Macera modu" düğmesinin stili onun koduyla birebir; içindeki BMO resmi de onun sitesinden (`public/bmo-mode.webp`, kullanıcı istedi). "???" gibi linksiz/görselsiz projeler gösterilmez.
- `src/style.css`: diyalog kutusu, TV/detay katmanı, köşe düğmeleri; en altta normal mod stilleri (`.nm-*`).
- `public/adventure-bg.jpg`: kullanılan arka plan. `public/treehouse-bg.webp`: alternatif arka plan (ayarı `data.js` içinde yorum olarak duruyor).

Çalıştırma: `npm run dev` (Vite, port 5173; `.claude/launch.json` içinde tanımlı).

Yayın: GitHub Pages, **https://ahmetyorat.github.io** (repo `AhmetYorat/AhmetYorat.github.io`, herkese açık). `main`'e her push'ta `.github/workflows/pages.yml` derleyip yayınlar. (Eski `ahmetyorat.com.tr` alan adının süresi doldu; Vercel artık kullanılmıyor.)

## BMO modeli: alınmış kararlar

BMO, kullanıcının verdiği referans görsellerden **piksel ölçülerek** yapıldı. Değiştirmeden önce bunları bil:

- Gövde `W=1.14, H=1.7, D=0.74`, köşe yarıçapı `0.1`. Ön yüz yerleşimi `W=1.32` için ölçüldü; `K = W / 1.32` ile yatayda ölçekleniyor.
- Renkler ışıktan bağımsız, normal yönüne göre 3 ton (vertex color, `MeshBasicMaterial`): üst `#89bca9`, ön `#7ead9c`, yan `#6a9485`. Toon ışıklandırma yan yüzü aydınlattığı için bu yola geçildi.
- Duruş: `BASE_YAW = 0.48`, kamera yükseklik açısı `ELEV = 2°`. Referansta yan yüz / ön yüz ≈ 0.43, üst yüz boyun ≈ %4'ü.
- Ekran: `SCREEN_W = W*0.747`, `SCREEN_H = 0.64`, `SCREEN_Y = 0.385`. Ekran kanvası (`canvasTex(512, h)`) en/boy oranı ekranla aynı tutulmalı, yoksa yüz basık çıkar.
- Yüz: koyu yeşil‑siyah `#1e3a31`, dik oval gözler (yatay %29/%71, dikey %31), derin "U" gülümseme. Ekran dokusu hafif çapraz çizgiler.
- Kol/bacak: ince tüpler (`r=0.03`), uçları basık top; sol kol yan yüzdeki "BMO" yazısının "O" harfinden çıkıyor.

## Davranış kuralları (kullanıcı istedi)

- BMO, kamera ve kartuşlar fareyle **hareket etmez**. Fare sadece yüz ifadesini değiştirir: gözler takip eder; BMO'nun üstünde "sevilme", kartuşun üstünde "merak", hızlı sallamada "şaşkınlık", ~7 sn hareketsizlikte uyku.
- Kartuşun üstüne gelince yerinde yumuşakça büyür (%14), rengi değişmez (eskiden yeşil parlıyordu, kullanıcı istemedi).
- Kartuşun üstüne gelince diyalog "<isim>! Oynamak ister misin?" der.
- 5 kartuş, referans düzen: sol üst, sağ üst, sol alt, sağ alt, sol orta (`AROUND` dizisi).
- Dar ekranda (telefon) kartuşlar 3 sütunlu ızgarada, okunur boyutta (`GRID_*`, `gridCell`); Hakkımda üst sıranın ortasında.
- Animasyonlar yumuşak (`ease.soft`, `ease.settle`); kartuş alt kenarı proje renginde, yuvaya girerken renk kesintisiz devam eder.
- BMO'nun tuşları basılabilir (`buttons`, `pressButton`): basınca gömülür, küçülür, koyulaşır; her tuşun kendi tık sesi var; bırakınca yeşil ve üçgen şaşırtır, diğerleri sevindirir.
- Açılış sahnesi (dizideki pil değiştirme sahnesi): oda loş, BMO'nun pili bitik. Ziyaretçi ekrana tıklayınca başlar (kullanıcı kendiliğinden başlamasını denedi, ses çalmadığı için tıklamaya döndük); BMO'nun üstünde nabız gibi atan "Pilleri takmak için tıkla" etiketi var, ekranın her yeri tıklanabilir (`.adv-start`). Sonra BMO yerinde dönüp sırtını gösterir (sırtta havalandırma yarıkları + menteşeli pil kapağı), yeni piller yuvarlanıp arkasına dizilir, kapak açılır, eski piller fırlayıp yanlara düşer (BMO kapanır), BMO sırtüstü yenilerin üstüne düşer ve piller tam yuvaya oturur; doğrulup önünü döner, pil dolar, ışıklar yanar, kartuşlar ekrandan sırayla süzülür. Sağ üstteki pil düğmesi (`.adv-battery`) sahneyi istenince baştan oynatır (`resetOldBats` eski pilleri yerine koyar). Oturumda kendiliğinden bir kez oynar (`sessionStorage` `intro-seen`), "Geç"/Esc ile atlanır, hareket azaltma açıksa oynamaz. Denemek için `/?intro`. Kod: `scene.js` içinde "Açılış: pil değiştirme" bölümü (`setupIntro`, `playIntro`, `endIntro`).
- "Hakkımda" kartuşu (`data.js` > `about`, `kind: 'about'`): projelerin sonuna eklenir, altın gövdeli, kendi kendine parlar, etrafında yıldızlar döner, %12 daha büyük. Detay sayfası `profile`'dan dolar (isim, tanıtım, okul, `skills` grupları, GitHub; e-posta/LinkedIn örnek değerdeyken gizli). Görseller `public/about/` (8-bit avatar; gerçek fotoğrafla değiştirilebilir). Yetenekler RPG envanteri gibi: her teknoloji bir eşya kartı (piksel rozet, ad, nadirlik, seviye, XP çubuğu; hepsi doğrudan görünür, üstüne gelmek gerekmez). Seviyeler `profile.levels` (10 üzerinden); 8+ Efsanevi (altın, parıltılı), 7 Destansı, 6 Nadir, altı Sıradan. Envanter oyun penceresi çerçevesinde (altın iç çizgi, perçinler, "ENVANTER" sekmesi); eşyanın üstüne gelince kalkar, parlar, rozet zıplar, XP kareleri yanıp söner, köşede yıldız + 8-bit ses. E-posta/LinkedIn okul etiketinin yanında. Sayfa tek ekrana sığar.
- `.adv` kabı `overflow: clip`: odak/scrollIntoView ile bile kaymasın (önceden detay katmanı kayabiliyordu).
- Detay sayfasında A (link) yeşil, B (çıkar) kırmızı.
- Projelerde isteğe bağlı `logo` alanı: kartuş ikon kutusunda ve açılış ekranında kullanılır.

## Sesler

`sound.js`, kullanıcının arkadaşının (adarkeser.com) ses tasarımına göre yeniden yazıldı: 8‑bit pulse dalgası, oda yankısı, sıkıştırıcı + sınırlayıcı, sağ‑sol (pan) yönü, 2 sn sessizlikte motor uykuya geçer. Olaylar: açılış için `roll`, `tilt`, `hatch`, `clink`, `snap`, `thud`, `charge`; ayrıca `hover`, `fly`, `slideIn`, `boot`, `type`, `ready`, `zoomIn`, `jingle`, `zoomOut`, `pop`, `mood`, `press`, `release`, `on/off`, `deny`. Diyalog yazarken `talk` çalar: çok kısık yumuşak sinüs "pıt", her 3 harfte bir (kullanıcı önce kapattırdı, sonra daha az dikkat dağıtıcı haliyle geri istedi).

## Doğrulama yöntemi

- Ekran görüntüsü aracı renkleri olduğundan açık gösterir; renk kontrolü için canvas'tan `gl.readPixels` ile piksel oku.
- Oran karşılaştırmasında referans görselden PIL ile ölç, sahnede readPixels ile aynı oranı ölç; göz kararı değiştirme.
- Küçük detaylar için canvas'ın bir bölgesini kırpıp sayfaya geçici overlay olarak koy, ekran görüntüsü al, sonra kaldır. JS çalıştırırken `tabId`'yi açıkça ver; başka sekmeye sızmasın.

## Bekleyen işler

- Kullanıcı GitHub linklerini tek tek gönderiyor; her proje için README'den kısa özet, buton GitHub'a gider. Gizli repo linki ziyaretçide 404 verir, kullanıcıya hatırlat. Logo/kapak yoksa SVG çizilebilir (`public/projects/<id>/`).
- Arkadaşının sitesinden ilham alınabilecek diğerleri: kesintisiz kontur (birleştirilmiş normallerle), ayak altı gölgesi, `prefers-reduced-motion` desteği, sekme gizliyken çizimi durdurma.
