import logging
from collections.abc import Callable

import httpx

from app.config import settings

RESEND_URL = "https://api.resend.com/emails"

log = logging.getLogger(__name__)


class EmailFailed(Exception):
    pass


def send_email(to: str, subject: str, text: str) -> None:
    try:
        response = httpx.post(
            RESEND_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={"from": settings.email_from, "to": [to], "subject": subject, "text": text},
        )
        response.raise_for_status()
    except httpx.HTTPError as e:
        raise EmailFailed from e


def send_login_code(to: str, code: str) -> None:
    send_email(
        to,
        f"Your Overlap code: {code}",
        f"Your Overlap login code is {code}.\n\n"
        "It expires in 10 minutes. If you didn't request it, you can ignore this email.",
    )


Mailer = Callable[[str, str], None]
Notifier = Callable[[str, str, str], None]


def get_mailer() -> Mailer:
    return send_login_code


def print_email(to: str, subject: str, text: str) -> None:
    print(f"Email to {to}: {subject}\n{text}")


def get_notifier() -> Notifier:
    return print_email if settings.dev_mode else send_email


def try_send(send: Notifier, to: str, subject: str, text: str) -> None:
    try:
        send(to, subject, text)
    except EmailFailed:
        log.warning("Couldn't send %r", subject)
