# AGENTS.md

Bu projedeki ajanlar için kurallar `CLAUDE.md` dosyasında. Oradaki her şey burada da geçerli; tek kaynak olsun diye içerik orada tutuluyor.

Kısa özet:

- Kullanıcıyla Türkçe konuş, kod yorumları Türkçe.
- İki mod: macera (`src/adventure/scene.js`, sesler `src/adventure/sound.js`) ve normal (`src/normal/normal.js`); seçim `src/main.js`'te. İçerik ikisi için de `src/data.js`.
- BMO'nun ölçü ve renkleri referans görsellerden piksel ölçülerek belirlendi; değiştirmeden önce `CLAUDE.md` içindeki "BMO modeli" bölümünü oku.
- BMO, kamera ve kartuşlar fareyle hareket etmez; fare sadece yüz ifadesini değiştirir.
- Görsel değişiklikleri tarayıcıda doğrula; renkleri ekran görüntüsünden değil `gl.readPixels` ile kontrol et.
