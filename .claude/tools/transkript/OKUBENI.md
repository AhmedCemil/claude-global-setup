# transkript.py — toplantı kaydı → metin

Ses veya video kaydını metne çevirir. **Tamamen yerel çalışır** — kayıt hiçbir yere
gönderilmez. Müşteri toplantıları, gizli proje kayıtları için güvenli.

---

## Kullanım

```bash
python ~/.claude/tools/transkript/transkript.py "kayit.mp4"
```

Kaydın yanına iki dosya bırakır:

| Dosya | Ne için |
|---|---|
| `<ad>.txt` | Düz metin, zaman damgalı satırlar — okumak ve not çıkarmak için |
| `<ad>.srt` | Altyazı — "şu dakikada ne dedi" diye kayda dönmek için |

### Seçenekler

```bash
--model medium    # daha hızlı, biraz daha az isabetli
--model small     # çok hızlı, kısa/net kayıtlar için
--cpu             # GPU sorun çıkarırsa
--dil en          # varsayılan tr
```

---

## Süre beklentisi

30 dakikalık kayıt, `large-v3` ile:

| Donanım | Süre |
|---|---|
| RTX 5070 Ti | ~2 dk |
| RTX 3050 Ti | ~6-8 dk |
| CPU (int8) | ~40-60 dk |

İlk çalıştırmada model indirilir (`large-v3` ≈ 3 GB, bir kez).
Sonraki kullanımlarda o adım yok.

> **Not:** GPU sadece **hızı** değiştirir, çıktı kalitesini değil. Aynı model her
> kartta aynı metni üretir. Kaliteyi `--model` seçimi belirler.

---

## Diksiyon ve teknik terimler

Script üç ayarla bunları iyileştiriyor:

- **`large-v3`** — Türkçe'de belirgin şekilde daha isabetli, hızlı/belirsiz konuşmada toleranslı
- **`initial_prompt`** — modele bağlam veriliyor, teknik terimleri doğru yazıyor
- **`condition_on_previous_text=False`** — uzun kayıtlarda aynı cümleyi tekrarlama sorununu önler

**Farklı bir konu alanında kullanacaksanız** `initial_prompt` satırını düzenleyin.
Şu an MATLAB/Simulink/HPC terimlerine ayarlı:

```python
initial_prompt=(
    "MATLAB, Simulink, HPC, Slurm, sbatch, Scope bloğu, batch mod, "
    "compute node, login node, lisans, toolbox, parallel server, "
    "R2019a, R2023a, XY Graph, nodisplay hakkında teknik bir toplantı."
),
```

Örneğin lisans toplantısı için: *"FlexNet, lmgrd, MLM.opt, license.dat, borrow,
concurrent lisans, seat, checkout hakkında bir toplantı."*

---

## Gereksinimler

```bash
pip install faster-whisper
```

`ffmpeg` PATH'te olmalı (video dosyalarından ses çıkarmak için).

Kurulu olduğu doğrulandı: Python 3.14 · faster-whisper 1.2.1 · CTranslate2 4.8.2

---

## Sorun çıkarsa

| Belirti | Çözüm |
|---|---|
| CUDA hatası, model yüklenmiyor | `--cpu` ekleyin — yavaş ama çalışır |
| Aynı cümle tekrar ediyor | Zaten önlem var; sürerse `--model medium` deneyin |
| Teknik terimler yanlış | `initial_prompt` satırını konuya göre düzenleyin |
| Türkçe karakterler bozuk | Çıktı UTF-8; dosyayı UTF-8 destekleyen editörde açın |

---

*İlk kullanım: 8 Eylül 2026 — TAI/TUSAŞ toplantı kaydı (34 dk).*
