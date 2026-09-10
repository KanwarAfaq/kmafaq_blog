from __future__ import annotations

import argparse
import json
import time
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from agent.config import Settings
from agent.line_digests import LineSubscriberDigestWorker
from agent.premium_alerts import PremiumAlertWorker
from agent.user_digests import UserDigestWorker


def run_once(settings: Settings, force: bool = False) -> dict:
    return {
        "account_digests": UserDigestWorker(settings).run(force=force),
        "line_subscriber_digests": LineSubscriberDigestWorker(settings).run(force=force),
        "premium_alerts": PremiumAlertWorker(settings).run(force=force),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run KM Afaq local notification workers")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    parser.add_argument("--force", action="store_true", help="Ignore digest schedule / use alert lookback")
    parser.add_argument("--interval", type=int, default=300, help="Seconds between runs (default: 300)")
    args = parser.parse_args()
    settings = Settings()
    while True:
        print(json.dumps(run_once(settings, force=args.force), indent=2, ensure_ascii=False))
        if args.once:
            return 0
        time.sleep(max(60, args.interval))


if __name__ == "__main__":
    raise SystemExit(main())
