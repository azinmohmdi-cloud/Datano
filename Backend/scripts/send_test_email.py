"""Private, one-message SMTP smoke check. Never an HTTP/debug endpoint."""

import argparse
import asyncio
import sys
from pathlib import Path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate SMTP or explicitly submit one test message")
    parser.add_argument("--env-file", type=Path, required=True, help="Private backend settings file; never commit credentials")
    parser.add_argument("--to", help="One owner-approved test mailbox, required with --send")
    parser.add_argument("--send", action="store_true", help="Explicitly submit one message; no automatic retries")
    args = parser.parse_args(argv)
    if args.send and not args.to:
        parser.error("--send requires --to with an approved test recipient")
    if not args.env_file.is_file():
        print("SMTP configuration unavailable: private settings file is missing", file=sys.stderr)
        return 2
    # Import inside the safe boundary so even invalid environment configuration
    # cannot dump a Pydantic/provider traceback or private inputs to the terminal.
    try:
        from app.application.use_cases.auth.email import EmailDeliveryError, OutboundEmail
        from app.infra.core.config import Config
        from app.infra.services.smtp_email_service import SMTPEmailSender
        from pydantic import ValidationError
    except Exception:
        print("SMTP configuration could not be loaded", file=sys.stderr)
        return 2
    try:
        sender = SMTPEmailSender(Config(_env_file=args.env_file))
        if not args.send:
            print("SMTP configuration valid; no connection or message attempted")
            return 0
        asyncio.run(sender.send(OutboundEmail(args.to, "آزمایش تنظیمات ایمیل دیتانو",
            "این پیام برای بررسی کنترل‌شدهٔ تنظیمات ارسال ایمیل دیتانو ارسال شده است.\n"
            "این پیام کد تأیید یا مجوز ورود به حساب ندارد.")))
    except (ValidationError, OSError):
        print("SMTP configuration could not be loaded", file=sys.stderr)
        return 2
    except EmailDeliveryError as error:
        print(f"SMTP check failed: {error.reason.value}; delivery_unknown={error.delivery_unknown}; retryable={error.retryable}", file=sys.stderr)
        return 3
    print("SMTP relay accepted one test message; inbox receipt must be confirmed separately")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
