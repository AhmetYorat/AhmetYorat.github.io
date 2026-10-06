// Sitedeki tüm içerik burada. Metinleri, projeleri ve linkleri buradan düzenle.

export const profile = {
  name: 'Ahmet',
  fullName: 'Ahmet Yorat',
  tagline: 'Fikirden yayına kadar uçtan uca ürün geliştiren bir yazılım mühendisi adayıyım.',
  note: 'Yazılım Mühendisliği · 4. sınıf',
  about:
    'Flutter ile mobil, Next.js ve FastAPI ile web uygulamaları geliştiriyor, yapay zekâyı iş süreçlerini otomatikleştirmek için kullanıyorum. bura.da ve İş Takip gibi projelerim sahada gerçek kullanıcılarla çalışıyor. Önceliğim sade arayüz, sağlam mimari ve gerçekten işe yarayan yazılım.',
  stack: 'Flutter, Firebase, React ve Three.js. Gerisini Claude Code ile birlikte hallediyoruz.',
  // Hakkımda kartuşunda grup grup gösterilir
  skills: [
    ['Mobil', 'Flutter · Firebase'],
    ['Web', 'React · Next.js · Three.js'],
    ['Backend', 'Python · FastAPI · Node.js · PostgreSQL'],
  ],
  // Hakkımda kartuşunda piksel çubuklarla gösterilir: seviye 10 üzerinden (tahmini, istediğin gibi değiştir)
  levels: {
    Flutter: 8, Firebase: 8,
    React: 6, 'Next.js': 6, 'Three.js': 5,
    Python: 7, FastAPI: 7, 'Node.js': 6, PostgreSQL: 6,
  },
  email: 'ahmetyorat0@gmail.com',
  github: 'https://github.com/AhmetYorat',
  linkedin: 'https://www.linkedin.com/in/ahmetyorat/',
};

// Hakkımda kartuşu: altın renkli, parıltılı; diğer kartuşlardan ayrı durur.
// Detay sayfası profile'dan doldurulur. image/logo: 8-bit avatar (gerçek fotoğrafla değiştirilebilir).
export const about = {
  id: 'about',
  kind: 'about',
  name: 'Hakkımda',
  short: 'A',
  color: '#F7C948',
  surface: '#2a1d05',
  ink: '#2a1d05',
  image: '/about/cover.svg',
  logo: '/about/logo.svg',
};

// Macera modu ayarları
export const adventure = {
  // Kendi arka plan resmini kullanmak istersen public/ klasörüne koy ve yolunu yaz,
  // örn: '/adventure-bg.webp'. null bırakırsan 3D ağaç ev çizilir.
  background: '/adventure-bg.jpg',
  // Karakterin arka plan resmindeki yeri, resmin kendi oranlarıyla (sol üst 0,0 · sağ alt 1,1):
  // x,y ayaklarının değdiği zemin noktası, h resimdeki boyu.
  characterSpot: { x: 0.45, y: 0.82, h: 0.30 },
  // Alternatif arka plan (yeşil çerçeveli ağaç ev, robot + el + Peppermint Butler'lı).
  // Denemek için yukarıdaki iki satırı bunlarla değiştir:
  //   background: '/treehouse-bg.webp',
  //   characterSpot: { x: 0.45, y: 0.75, h: 0.2 },
};


// color: ana renk · surface: koyu zemin · ink: ana rengin üstündeki yazı rengi
// short: ikonlarda ve kartuş etiketinde görünen kısa işaret
// bmo: kartuş takılınca BMO'nun söylediği cümle
// image: ekran görüntüsü (public/projects/... gibi), null ise renkli kapak çizilir
// logo: uygulama ikonu (kare), varsa kartuş etiketinde ve açılış ekranında kısa işaretin yerine kullanılır
// titleFont: normal modda proje başlığının (ve girişteki adın) yazı tipi
// linkLabel: link varsa A butonunun yazısı, yoksa 'yakında' etiketi
export const projects = [
  {
    id: 'istakip',
    titleFont: { family: "'Lexend', sans-serif", weight: 800, tracking: '-0.04em' },
    name: 'İş Takip',
    short: 'İT',
    color: '#34D399',
    surface: '#0B1220',
    ink: '#042F1E',
    year: '2025',
    desc: 'Saha ekibiyle çalışan küçük işletmeler için mobil uygulama. Personel iş açar, patron onaylayıp atar; iş bitince alacak kendiliğinden oluşur. Tahsilatlar, giderler ve personel bakiyesi tek yerde, her adımda anlık bildirim.',
    platforms: ['iOS', 'Android'],
    stack: 'Flutter · Riverpod · Firebase',
    link: 'https://github.com/AhmetYorat/is-takip',
    image: '/projects/istakip/cover.svg',
    logo: '/projects/istakip/logo.png',
    linkLabel: 'GitHub',
    bmo: 'Bu bir patron oyunu! İşleri dağıt, tahsilatları topla. Puan yok ama maaşlar hep zamanında yatıyor.',
  },
  {
    id: 'burada',
    titleFont: { family: "'Nunito', sans-serif", weight: 900, tracking: '-0.03em' },
    name: 'bura.da',
    short: '.da',
    color: '#3B82F6',
    surface: '#0a0c10',
    ink: '#061433',
    year: '2026',
    desc: 'Dershaneler için parmak iziyle yoklama sistemi. Öğrenci parmağını okuttuğu an giriş-çıkış kaydedilir, veliye WhatsApp ya da SMS ile anında haber gider. Kurum bütün şubelerini, istatistikleri ve devamsızlıkları tek panelden izler. Ticari ürün; GitHub sayfası vitrin, kaynak kodu gizli.',
    platforms: ['Web', 'Windows'],
    stack: 'FastAPI · Next.js · PostgreSQL',
    link: 'https://github.com/AhmetYorat/burada-showcase',
    image: '/projects/burada/cover.webp',
    logo: '/projects/burada/logo.svg',
    linkLabel: 'GitHub',
    bmo: 'Bip! Parmağını okut... Tamam, buradasın! Annene haber verdim bile.',
  },
  {
    id: 'fatura',
    titleFont: { family: "'Space Mono', monospace", weight: 700, tracking: '-0.05em' },
    name: 'Fatura & Fiş',
    short: 'FF',
    color: '#FB923C',
    surface: '#140b06',
    ink: '#431407',
    year: '2024',
    desc: 'Fatura ya da fişin fotoğrafını yüklüyorsun; yapay zekâ tarihi, tutarı ve kategoriyi kendisi okuyup kaydediyor. Elle veri girişi yok. Kayıtları istediğin zaman detaylıca görüp tek tuşla Excel’e aktarabiliyorsun.',
    platforms: ['Web'],
    stack: 'Next.js · Supabase · n8n · OpenAI',
    link: 'https://github.com/AhmetYorat/Fatura-Fis-App',
    image: '/projects/fatura/cover.svg',
    logo: '/projects/fatura/logo.svg',
    linkLabel: 'GitHub',
    bmo: 'Fişi göster, gerisini ben hallederim! Bip bop... 595 lira 50 kuruş. Sanırım biri çok peynir almış.',
  },
  {
    id: 'mystery',
    name: '???',
    short: '?',
    color: '#A78BFA',
    surface: '#130f1f',
    ink: '#160f2b',
    year: '',
    desc: 'Henüz yazılmamış bir oyun. Ahmet üzerinde çalışıyor.',
    platforms: ['Yakında'],
    stack: 'Gizli',
    link: null,
    image: null,
    linkLabel: 'Yakında',
    bmo: 'Bu kartuş bomboş! Ama Ahmet söz verdi, yakında içi dolacakmış.',
  },
  {
    id: 'antikor',
    titleFont: { family: "'Fraunces', serif", weight: 700, style: 'italic', tracking: '-0.02em' },
    name: 'Antikor Kılavuz',
    short: 'AK',
    color: '#5AB8F0',
    surface: '#0a1520',
    ink: '#06121c',
    year: '2026',
    desc: 'Antikor güvenlik duvarının yönetim panelini otomatik gezip her ekranın görüntüsünü alan, sonra yapay zekâyla bu görüntülerden Türkçe kullanım kılavuzu yazan otomasyon.',
    platforms: ['Node.js'],
    stack: 'Playwright · Görsel dil modeli',
    // repo gizli (kullanıcı açmak istemedi): link yok, buton pasif "Kod gizli" yazar
    link: null,
    image: '/projects/antikor/cover.svg',
    logo: '/projects/antikor/logo.svg',
    linkLabel: 'Kod gizli',
    bmo: 'Bütün paneli tek tek gezdim, her ekranın fotoğrafını çektim, sonra koca bir kılavuz yazdım. Kimse okumaz ama olsun!',
  },
];
