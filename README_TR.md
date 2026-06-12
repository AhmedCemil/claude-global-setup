# Claude Global Setup

Taşınabilir, PC'den bağımsız bir **Claude Code** yapılandırması — herhangi bir Windows
makinesine taşıyın ve her yerde aynı şekilde çalışın. İçinde global bir `CLAUDE.md` kural
seti, bağlamı koruyan alt ajanlar, bir kontrol noktası becerisi, çift yönlü bir çizim tuvali
ve Claude kullanım limitiniz için Python'suz bir masaüstü widget'ı bulunur.

> **Tam, koyu temalı anlatım için [`GUIDE_TR.html`](GUIDE_TR.html) dosyasını açın.**
> Bu README hızlı sürümdür. (İngilizce: [`GUIDE.html`](GUIDE.html) · [`README.md`](README.md))

## İçinde neler var

```
claude_global_setup/
├─ GUIDE.html / GUIDE_TR.html # koyu temalı kılavuz (buradan başlayın)
├─ README.md / README_TR.md   # hızlı metin sürümü
├─ .gitignore                 # kimlik bilgileri & makine durumunu git'ten uzak tutar
├─ .claude/                   # herhangi bir PC'de ~/.claude ile birleştirin
│  ├─ CLAUDE.md               #   global çalışma kuralları
│  ├─ CLAUDE - Python.md      #   Python ortak proje kuralları
│  ├─ settings.json           #   tema / efor / model
│  ├─ claude_usage.env.example#   kimlik bilgisi ŞABLONU (gerçek anahtar yok)
│  ├─ agents/                 #   co-explorer, co-tester alt ajanları
│  ├─ skills/                 #   save-session-state kontrol noktası becerisi
│  ├─ scripts/                #   claude_limit_percent.py (5s limit %)
│  └─ tools/                  #   shared-canvas.html (görsel kanal)
└─ usage-widget/              # Python'suz masaüstü kullanım widget'ı (Win10/11)
   ├─ usage-widget.ps1
   ├─ cuw.vbs · cuw.bat       #   gizli başlatma, konsol parlaması yok
   └─ README.md
```

## Kurulum (herhangi bir PC, kurulum programı yok, yönetici yok)

1. **Yapılandırmayı ana dizininize birleştirin:**
   ```powershell
   Copy-Item .\.claude\* $HOME\.claude\ -Recurse -Force
   ```
2. **Kimlik bilgilerinizi ekleyin** *(isteğe bağlı — yalnızca kullanım % özellikleri için)*:
   ```powershell
   Copy-Item $HOME\.claude\claude_usage.env.example $HOME\.claude\claude_usage.env
   # sonra SESSION_KEY / DEVICE_ID / ORG_ID değerlerini doldurun
   ```
3. **Claude Code'u başlatın.** `CLAUDE.md` otomatik yüklenir; ajanlar, beceri ve tuval globaldir.
4. **(İsteğe bağlı) kullanım widget'ı:** `usage-widget\cuw.bat` dosyasına çift tıklayın. README'sine bakın.

## Tasarım ilkeleri

- **Sabit kodlanmış yol yok.** Her şey `$HOME` / `~` veya dosyanın kendi konumundan çözülür.
  Ağaçta sürücü harfi arayın → yalnızca dokümantasyon yer tutucuları, gerçek bir şey yok.
- **Herkese açık repo için güvenli.** İsim, e-posta veya sır yok. Gerçek `.env` git-ignore'ludur;
  yalnızca `claude_usage.env.example` gönderilir. `CLAUDE.md`'deki kullanıcı satırını kendinize göre uyarlayın.
- **Mümkün olan yerde kurulumsuz.** Kullanım widget'ı yalnızca Windows 10/11 ile gelen WinForms +
  `curl.exe` kullanır. Limit betiği Python ister; widget istemez.
- **Windows 10/11 + PowerShell** hedeftir. Mac/Linux henüz kapsanmadı.

## Kimlik bilgileri & gizlilik

Kullanım özellikleri `~/.claude/claude_usage.env` dosyasından üç değer okur:
`SESSION_KEY`, `DEVICE_ID`, `ORG_ID` — kişisel claude.ai oturumunuz.

**Doldurulmuş `.env`'i asla commit etmeyin veya paylaşılan bir zip'e koymayın.** `.gitignore`
bunu zaten engeller; yalnızca boş `.example` şablonu izlenir. Her değerin nereden geldiğini görmek
için [`claude_usage.env.example`](.claude/claude_usage.env.example) dosyasına bakın.

## Lisans

Özgürce paylaşın. Garanti yok — bunlar şablon olarak sunulan kişisel dotfile'lardır.
