# Claude Global Setup

Taşınabilir, PC'den bağımsız bir **Claude Code** yapılandırması — herhangi bir Windows
makinesine taşıyın ve her yerde aynı şekilde çalışın. İçinde global bir `CLAUDE.md` kural
seti, bağlamı koruyan alt ajanlar, kontrol noktası ve bağlam okuma becerileri, ortak bir
tarayıcı sürücüsüyle çok örnekli debug-Chrome sistemi ve çift yönlü bir çizim tuvali bulunur.

> **Tam, koyu temalı anlatım için [`GUIDE_TR.html`](GUIDE_TR.html) dosyasını açın.**
> Bu README hızlı sürümdür. (İngilizce: [`GUIDE.html`](GUIDE.html) · [`README.md`](README.md))

## İçinde neler var

```
claude_global_setup/
├─ GUIDE.html / GUIDE_TR.html   # koyu temalı kılavuz (buradan başlayın)
├─ README.md / README_TR.md     # hızlı metin sürümü
├─ .gitignore                   # kimlik bilgileri & makine durumunu git'ten uzak tutar
└─ .claude/                     # herhangi bir PC'de ~/.claude ile birleştirin
   ├─ CLAUDE.md                 #   global çalışma kuralları
   ├─ CLAUDE - Python.md        #   Python ortak proje kuralları
   ├─ settings.json             #   tema / efor / model
   ├─ machines.json.example     #   makineye özel yollar ŞABLONU (gerçek hostname yok)
   ├─ claude_usage.env.example  #   kimlik bilgisi ŞABLONU (gerçek anahtar yok)
   ├─ agents/                   #   co-explorer, co-tester alt ajanları
   ├─ skills/
   │  ├─ debug-chrome/          #     portlar, profiller, başlatıcı + ortak tarayıcı sürücüsü
   │  ├─ debug-browse/          #     sayfa okuma ve site profilli çıkarım
   │  ├─ context-usage/         #     gerçek bağlam penceresi kullanımı, yan etkisiz
   │  ├─ save-session-state/    #     kontrol noktası: 5s limit % + bağlam %
   │  └─ hardening-ui-tests/    #     tarayıcı/e2e testlerini gerçekten güvenilir kılma
   ├─ scripts/
   │  ├─ machine.js             #     bu makine hangisi → makineye özel değerler
   │  ├─ context_usage.ps1      #     transkriptten gerçek token sayıları
   │  └─ claude_limit_percent.py #    5 saatlik limit %
   └─ tools/
      ├─ shared-canvas.html     #     Claude ile çift yönlü görsel kanal
      ├─ browser-test-kit/      #     uygulamadan bağımsız tarayıcı test motoru
      └─ transkript/            #     yerel ses/video → metin (Whisper)
```

## Kurulum (herhangi bir PC, kurulum programı yok, yönetici yok)

1. **Yapılandırmayı ana dizininize birleştirin:**
   ```powershell
   Copy-Item .\.claude\* $HOME\.claude\ -Recurse -Force
   ```
2. **Bu makineyi tanıtın** *(her PC'de bir kez gerekir)*:
   ```powershell
   Copy-Item $HOME\.claude\machines.json.example $HOME\.claude\machines.json
   node -e "console.log(require('os').hostname())"   # bunu dosyaya yazın
   node $HOME\.claude\scripts\machine.js             # doğru çözüldüğünü doğrulayın
   ```
3. **Kimlik bilgilerinizi ekleyin** *(isteğe bağlı — yalnızca kullanım % özellikleri için)*:
   ```powershell
   mkdir $HOME\.claude\claude_env -Force
   Copy-Item $HOME\.claude\claude_usage.env.example "$HOME\.claude\claude_env\claude_usage - <etiket>.env"
   # sonra SESSION_KEY / DEVICE_ID / ORG_ID değerlerini doldurun
   ```
4. **Claude Code'u başlatın.** `CLAUDE.md` otomatik yüklenir; ajanlar, beceriler ve tuval globaldir.

## Tasarım ilkeleri

- **Sabit kodlanmış yol yok.** Her şey `$HOME` / `~`, dosyanın kendi konumu veya
  `machines.json` üzerinden çözülür. Ağaçta sürücü harfi arayın → yalnızca dokümantasyon
  yer tutucuları, gerçek bir şey yok.
- **Makineden bağımsız, ama makineye kör değil.** PC'den PC'ye gerçekten değişen değerler
  (profil kökleri, dev kökleri) tek bir `machines.json` içinde, hostname ile anahtarlanır —
  tıpkı bir çeviri dosyasının dile göre anahtarlanması gibi. Yeni makine eklemek tek bir
  grup eklemektir; hiçbir script değişmez.
- **Herkese açık repoya uygun.** İsim, e-posta, hostname veya sır yok. Gerçek
  `machines.json` ve `.env` git tarafından yok sayılır; yalnızca `.example` şablonları gider.
- **Mümkün olduğunca kurulumsuz.** `context_usage.ps1` transkripti doğrudan okur — süreç
  başlatmaz, yan etkisi yoktur. Limit script'i Python ister.
- **Windows 10/11 + PowerShell** hedeftir. Mac/Linux henüz kapsanmıyor.

## Tarayıcı işleri

`debug-chrome`, yan yana birden çok Chrome örneği çalıştırır — her biri kendi portu ve kendi
profiliyle — böylece paralel oturumlar sekmeler için çekişmez ve günlük Chrome'unuza asla
dokunulmaz. `debug-browse` bu sürücünün üzerine oturur; siteye özel seçicileri
`sites/*.json` içinde tutar, böylece bir site tasarımını değiştirdiğinde düzeltme tek
dosyadadır.

```powershell
node $HOME\.claude\skills\debug-chrome\scripts\status.js        # ne ayrılmış / hangisi canlı
node $HOME\.claude\skills\debug-chrome\scripts\launch.js 9333 general
node $HOME\.claude\skills\debug-browse\scripts\browse.js "https://example.com"
```

Portlar ve profil kökleri makineye özeldir ve **bilerek** senkronize edilmez — kayıt defteri
klasör isimlerinin kendisidir.

## Kimlik bilgileri & gizlilik

Kullanım özellikleri hesap başına `.env` dosyanızdan üç değer okur: `SESSION_KEY`,
`DEVICE_ID`, `ORG_ID` — kişisel claude.ai oturumunuz. `.gitignore` gerçek dosyayı engeller;
yalnızca boş `.example` şablonu izlenir. Her değerin nereden alındığı için
[`claude_usage.env.example`](.claude/claude_usage.env.example) dosyasına bakın.

Aynı şekilde `machines.json` hostname'lerinizi ve klasör düzeninizi tutar, bu yüzden yerel
kalır — bkz. [`machines.json.example`](.claude/machines.json.example).

## Lisans

Özgürce paylaşın. Garanti yok — bunlar şablon olarak sunulan kişisel dotfile'lardır.
