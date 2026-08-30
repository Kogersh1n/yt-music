#!/usr/bin/env python3
"""cookies.txt → browser.json для ytmusicapi.

Зачем. `ytmusicapi browser` просит вставить заголовки запроса из DevTools,
но браузер не всегда отдаёт полный `Cookie`: куки входа помечены HttpOnly,
и в отображаемых заголовках их может не оказаться. Тогда файл получается
формально валидным, а библиотека ругается на отсутствие __Secure-3PAPISID.

Расширение для экспорта cookies (Get cookies.txt LOCALLY) читает куки
напрямую из хранилища браузера и HttpOnly ему не мешает. Этот скрипт
собирает из такого файла ровно то, что нужно ytmusicapi.

    python tools/cookies_to_ytmusic.py cookies.txt browser.json
"""

import hashlib
import json
import sys
import time
from pathlib import Path

# Без них ytmusicapi не сможет подписать запрос: Authorization он считает
# сам, беря за основу __Secure-3PAPISID.
REQUIRED = ("__Secure-3PAPISID",)

# Полезные, но не обязательные — чем полнее набор, тем стабильнее сессия.
WANTED = (
    "SID", "HSID", "SSID", "APISID", "SAPISID",
    "__Secure-1PSID", "__Secure-3PSID",
    "__Secure-1PAPISID", "__Secure-3PAPISID",
    "LOGIN_INFO", "PREF", "VISITOR_INFO1_LIVE", "YSC",
    "SIDCC", "__Secure-1PSIDCC", "__Secure-3PSIDCC",
    "__Secure-1PSIDTS", "__Secure-3PSIDTS",
)

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

ORIGIN = "https://music.youtube.com"


def sapisid_hash(sapisid: str) -> str:
    """Подпись запроса в формате Google.

    Нужна не только для самого запроса. ytmusicapi по умолчанию считает
    файл авторизации OAuth-конфигом и переключается на браузерный режим,
    только увидев заголовок Authorization с SAPISIDHASH
    (см. determine_auth_type в auth/auth_parse.py). Без него библиотека
    отвергнет файл, даже если куки в нём полные.

    Сама подпись короткоживущая — ytmusicapi пересчитывает её на каждый
    запрос из куки, так что здесь она нужна как признак формата.
    """
    stamp = int(time.time())
    digest = hashlib.sha1(f"{stamp} {sapisid} {ORIGIN}".encode()).hexdigest()
    return f"SAPISIDHASH {stamp}_{digest}"


def parse_netscape(path: Path) -> dict[str, str]:
    """Разбирает cookies.txt формата Netscape: 7 полей через табуляцию."""
    cookies: dict[str, str] = {}

    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("#") or not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) < 7:
            continue
        domain, name, value = parts[0], parts[5], parts[6]
        # Берём только куки ютуба и гугла: остальные к делу не относятся.
        if "youtube.com" in domain or "google.com" in domain:
            cookies[name] = value

    return cookies


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit(__doc__)

    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    if not src.is_file():
        sys.exit(f"Не найден файл: {src}")

    cookies = parse_netscape(src)
    if not cookies:
        sys.exit("В файле нет кук youtube.com — не тот файл или пустой экспорт")

    missing = [name for name in REQUIRED if name not in cookies]
    if missing:
        print(f"В файле есть {len(cookies)} кук: {', '.join(sorted(cookies))}\n")
        sys.exit(
            "Не хватает: " + ", ".join(missing) + "\n"
            "Экспортируй заново на youtube.com или music.youtube.com "
            "залогиненным, обычным окном."
        )

    selected = {n: v for n, v in cookies.items() if n in WANTED}
    cookie_header = "; ".join(f"{n}={v}" for n, v in selected.items())

    sapisid = cookies.get("__Secure-3PAPISID") or cookies.get("SAPISID") or ""

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/json",
        "X-Goog-AuthUser": "0",
        "origin": ORIGIN,
        "x-origin": ORIGIN,
        "Authorization": sapisid_hash(sapisid),
        "Cookie": cookie_header,
    }

    dst.write_text(json.dumps(headers, indent=2, ensure_ascii=False), encoding="utf-8")
    dst.chmod(0o600)

    print(f"Записан {dst} (права 600)")
    print(f"  кук перенесено: {len(selected)} из {len(cookies)}")
    print(f"  длина Cookie:   {len(cookie_header)} символов")
    print("  ключевые:      ", ", ".join(n for n in REQUIRED if n in selected))


if __name__ == "__main__":
    main()
