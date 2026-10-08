"""Converte as fotos das instituições para WebP e liga cada uma ao campo "foto" do JSON.

Lê assets/instituicoes-originais/ (arquivos como "7 - @acasadosgatossanguetsu", com ou sem
extensão), usa o número no início do nome, grava assets/instituicoes/NN.webp (lado maior até
1200 px) e preenche só o campo "foto" em data/instituicoes.json.

Uso: python scripts/otimizar-fotos-instituicoes.py
"""
import json
import os
import re
import sys

from PIL import Image, ImageOps

try:
    import pillow_heif

    pillow_heif.register_heif_opener()
except ImportError:
    pass

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGINAIS = os.path.join(RAIZ, "assets", "instituicoes-originais")
DESTINO = os.path.join(RAIZ, "assets", "instituicoes")
JSON_PATH = os.path.join(RAIZ, "data", "instituicoes.json")
LADO_MAXIMO = 1200


def main():
    with open(JSON_PATH, encoding="utf-8") as f:
        instituicoes = json.load(f)
    por_numero = {i["numero"]: i for i in instituicoes}
    antes = json.dumps(
        [{k: v for k, v in i.items() if k != "foto"} for i in instituicoes], sort_keys=True
    )

    os.makedirs(DESTINO, exist_ok=True)
    feitos, sem_registro, com_erro = [], [], []

    for nome in sorted(os.listdir(ORIGINAIS)):
        m = re.match(r"^\s*0*(\d+)\s*-", nome)
        if not m:
            continue
        numero = int(m.group(1))
        if numero not in por_numero:
            sem_registro.append(nome)
            continue
        try:
            with Image.open(os.path.join(ORIGINAIS, nome)) as im:
                im = ImageOps.exif_transpose(im)
                tem_alpha = im.mode in ("RGBA", "LA", "P") and (
                    im.mode != "P" or "transparency" in im.info
                )
                im = im.convert("RGBA" if tem_alpha else "RGB")
                if max(im.size) > LADO_MAXIMO:
                    fator = LADO_MAXIMO / max(im.size)
                    im = im.resize((round(im.width * fator), round(im.height * fator)), Image.LANCZOS)
                destino = os.path.join(DESTINO, "%02d.webp" % numero)
                im.save(destino, "WEBP", quality=82, method=6)
            por_numero[numero]["foto"] = "assets/instituicoes/%02d.webp" % numero
            feitos.append(numero)
        except Exception as erro:
            com_erro.append((nome, str(erro)))

    depois = json.dumps(
        [{k: v for k, v in i.items() if k != "foto"} for i in instituicoes], sort_keys=True
    )
    if antes != depois:
        sys.exit("Algum campo além de 'foto' mudou. Nada foi gravado.")

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(instituicoes, f, ensure_ascii=False, indent=2)
        f.write("\n")

    faltando = sorted(set(por_numero) - set(feitos))
    print("Convertidas: %d de %d" % (len(feitos), len(por_numero)))
    if faltando:
        print("Sem foto (números):", faltando)
    if sem_registro:
        print("Arquivos sem instituição correspondente:", sem_registro)
    for nome, erro in com_erro:
        print("Erro em %s: %s" % (nome, erro))


if __name__ == "__main__":
    main()
