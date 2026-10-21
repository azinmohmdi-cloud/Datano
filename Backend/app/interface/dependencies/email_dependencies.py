from fastapi import Request

from app.application.use_cases.auth.email import EmailDeliveryError, EmailFailure, IEmailSender


def get_email_sender(request: Request) -> IEmailSender:
    sender = getattr(request.app.state, "email_sender", None)
    if sender is None:
        # Never silently replace a disabled/unavailable real transport with a fake.
        raise EmailDeliveryError(EmailFailure.CONFIGURATION)
    return sender
