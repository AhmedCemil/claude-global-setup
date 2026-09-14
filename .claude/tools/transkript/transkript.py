# -*- coding: utf-8 -*-
"""
transkript.py — Toplantı kaydını metne çevirir.

TAMAMEN YEREL ÇALIŞIR. Ses hiçbir yere gönderilmez; model bir kez
indirilip diske yazılır, sonrasında internet bile gerekmez.

Kullanım:
    python transkript.py "kayit.mp4"
    python transkript.py "kayit.mp4" --model medium     # daha hızlı, biraz daha az isabetli
    python transkript.py "kayit.mp4" --cpu              # GPU sorun çıkarırsa

Çıktılar (kaydın yanına):
    <ad>.txt   — düz metin, okumak ve maile temel almak için
    <ad>.srt   — zaman damgalı, "şu dakikada ne dedi" diye bakmak için
"""

import argparse
import os
import subprocess
import sys
import time

# Konsola Türkçe karakter basarken Windows'ta patlamasın
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def cuda_dll_yolu_ekle() -> bool:
    """pip ile kurulan NVIDIA DLL'lerini arama yoluna ekler.

    nvidia-cublas-cu12 / nvidia-cudnn-cu12 paketleri DLL'leri site-packages
    altina koyar ama PATH'e EKLEMEZ. CTranslate2 bu yuzden
    "cublas64_12.dll is not found" hatasi verir. Burada elle ekliyoruz.
    """
    import glob
    import site

    koklar = []
    try:
        koklar += list(site.getsitepackages())
    except Exception:
        pass
    try:
        koklar.append(site.getusersitepackages())
    except Exception:
        pass
    # Calisan yorumlayicinin kendi site-packages'i
    koklar.append(os.path.join(os.path.dirname(os.__file__), "site-packages"))

    klasorler = set()
    for sp in koklar:
        nvidia = os.path.join(sp, "nvidia")
        if not os.path.isdir(nvidia):
            continue
        for dll in glob.glob(os.path.join(nvidia, "**", "*.dll"), recursive=True):
            klasorler.add(os.path.dirname(dll))

    for klasor in klasorler:
        if hasattr(os, "add_dll_directory"):
            try:
                os.add_dll_directory(klasor)
            except Exception:
                pass
        os.environ["PATH"] = klasor + os.pathsep + os.environ.get("PATH", "")

    return bool(klasorler)


def ses_cikar(kaynak: str) -> str:
    """mp4/mkv içinden 16 kHz mono wav çıkarır — Whisper'ın beklediği biçim."""
    hedef = os.path.splitext(kaynak)[0] + "_16k.wav"
    if os.path.exists(hedef) and os.path.getsize(hedef) > 0:
        print(f"  ses zaten hazır: {os.path.basename(hedef)}")
        return hedef

    print("  ffmpeg ile ses çıkarılıyor...")
    komut = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", kaynak,
        "-vn",                  # video yok
        "-ac", "1",             # mono
        "-ar", "16000",         # 16 kHz
        "-c:a", "pcm_s16le",
        hedef,
    ]
    sonuc = subprocess.run(komut, capture_output=True, text=True)
    if sonuc.returncode != 0:
        print("HATA — ffmpeg:", sonuc.stderr[:600])
        sys.exit(1)
    mb = os.path.getsize(hedef) / 1e6
    print(f"  hazır: {os.path.basename(hedef)} ({mb:.1f} MB)")
    return hedef


def zaman(saniye: float) -> str:
    s = int(saniye)
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"


def srt_zaman(saniye: float) -> str:
    ms = int((saniye - int(saniye)) * 1000)
    s = int(saniye)
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d},{ms:03d}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("kayit", help="mp4 / mkv / wav / mp3 dosyası")
    ap.add_argument("--model", default="large-v3",
                    help="large-v3 (varsayılan, en isabetli) | medium | small")
    ap.add_argument("--cpu", action="store_true", help="GPU yerine CPU kullan")
    ap.add_argument("--dil", default="tr")
    args = ap.parse_args()

    if not os.path.exists(args.kayit):
        print(f"HATA — dosya yok: {args.kayit}")
        sys.exit(1)

    from faster_whisper import WhisperModel

    print("=" * 62)
    print("TOPLANTI KAYDI → METİN   (tamamen yerel)")
    print("=" * 62)
    print(f"Kayıt : {os.path.basename(args.kayit)}")

    ses = ses_cikar(args.kayit)

    cihaz = "cpu" if args.cpu else "cuda"
    tip = "int8" if args.cpu else "float16"
    print(f"Model : {args.model}  ·  {cihaz} / {tip}")
    print("  (model ilk kullanımda indirilir — large-v3 ~3 GB, bir kez)")

    if cihaz == "cuda":
        if cuda_dll_yolu_ekle():
            print("  CUDA kütüphaneleri arama yoluna eklendi")
        else:
            print("  UYARI: NVIDIA DLL'leri bulunamadı")
            print("  Gerekirse: pip install nvidia-cublas-cu12 nvidia-cudnn-cu12")

    t0 = time.time()
    try:
        model = WhisperModel(args.model, device=cihaz, compute_type=tip)
    except Exception as e:
        print(f"\n{cihaz} ile yüklenemedi: {e}")
        if not args.cpu:
            print("CPU'ya düşülüyor (daha yavaş ama çalışır)...")
            model = WhisperModel(args.model, device="cpu", compute_type="int8")
        else:
            raise
    print(f"  model yüklendi ({time.time() - t0:.0f} sn)")

    print("\nÇözümleniyor — ilerledikçe aşağıya yazılır:\n")
    t1 = time.time()

    def cozumle(m):
        return m.transcribe(
            ses,
            language=args.dil,
            beam_size=5,
            vad_filter=True,                                  # sessizlikleri atla
            vad_parameters=dict(min_silence_duration_ms=500),
            condition_on_previous_text=False,                 # tekrar döngüsünü önler
            initial_prompt=(
                "MATLAB, Simulink, HPC, Slurm, sbatch, Scope bloğu, batch mod, "
                "compute node, login node, lisans, toolbox, parallel server, "
                "R2019a, R2023a, XY Graph, nodisplay hakkında teknik bir toplantı."
            ),
        )

    segmentler, bilgi = cozumle(model)

    # Segmentler tembel uretilir; CUDA hatasi ilk segment istenince patlar.
    # Ilk segmenti burada zorlayip, gerekirse CPU ile bastan basliyoruz.
    import itertools
    try:
        segmentler = iter(segmentler)
        ilk = next(segmentler, None)
        if ilk is not None:
            segmentler = itertools.chain([ilk], segmentler)
    except RuntimeError as e:
        if cihaz == "cuda" and not args.cpu:
            print(f"\n  CUDA çalışma zamanı hatası: {e}")
            print("  CPU ile baştan deneniyor — ÇIKTI AYNI, sadece daha yavaş.\n")
            model = WhisperModel(args.model, device="cpu", compute_type="int8")
            segmentler, bilgi = cozumle(model)
        else:
            raise

    print(f"  algılanan dil: {bilgi.language} ({bilgi.language_probability:.0%})")
    if bilgi.duration:
        print(f"  kayıt süresi : {zaman(bilgi.duration)}\n")

    kok = os.path.splitext(args.kayit)[0]
    yol_txt, yol_srt = kok + ".txt", kok + ".srt"

    with open(yol_txt, "w", encoding="utf-8") as ftxt, \
         open(yol_srt, "w", encoding="utf-8") as fsrt:

        ftxt.write(f"Kayıt: {os.path.basename(args.kayit)}\n")
        ftxt.write(f"Model: {args.model}\n")
        ftxt.write("=" * 62 + "\n\n")

        for i, seg in enumerate(segmentler, 1):
            metin = seg.text.strip()
            if not metin:
                continue

            satir = f"[{zaman(seg.start)}] {metin}"
            ftxt.write(satir + "\n")
            ftxt.flush()

            fsrt.write(f"{i}\n{srt_zaman(seg.start)} --> {srt_zaman(seg.end)}\n{metin}\n\n")
            fsrt.flush()

            # canlı takip
            print(satir[:118])

    sure = time.time() - t1
    print("\n" + "=" * 62)
    print(f"BİTTİ — {sure / 60:.1f} dakika")
    print(f"  metin : {os.path.basename(yol_txt)}")
    print(f"  altyazı: {os.path.basename(yol_srt)}")
    print("=" * 62)


if __name__ == "__main__":
    main()
