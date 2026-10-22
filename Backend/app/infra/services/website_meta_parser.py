"""Conservative head metadata parser; never execute markup or fetch entities."""
import codecs
from email.message import Message
from html.parser import HTMLParser
import re

from app.application.use_cases.website.html import WebsiteHTML
from app.application.use_cases.website.proof import IWebsiteMetaParser

_BLOCKED = {"script", "style", "title", "template", "noscript", "textarea", "iframe", "xmp", "plaintext", "noembed", "noframes"}
_ENCODINGS = {"utf-8", "ascii", "iso8859-1", "cp1252", "utf-16", "utf-16-le", "utf-16-be", "utf-32", "utf-32-le", "utf-32-be"}


class _HeadProof(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_head = self.head_seen = self.head_closed = self.body_seen = self.invalid = False
        self.blocked: list[str] = []
        self.tokens: list[str | None] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if self.blocked:
            if self.blocked[-1] == "noscript" and tag not in {"link", "style", "meta"}:
                self.invalid = True
            if tag in _BLOCKED: self.blocked.append(tag)
            return
        if tag == "head":
            if self.head_seen or self.body_seen: self.invalid = True
            self.in_head = self.head_seen = True
            return
        if not self.in_head:
            if tag != "html" or self.head_seen: self.body_seen = True
            return
        if tag in _BLOCKED:
            if tag not in {"script", "style", "title", "template", "noscript"}:
                self.invalid = True
            self.blocked.append(tag)
            return
        if tag not in {"meta", "link", "base"}:
            self.invalid = True
            return
        if tag == "meta":
            names = [value for key, value in attrs if key == "name"]
            if not any(value is not None and value.lower() == "datano-verification" for value in names): return
            values = [value for key, value in attrs if key == "content"]
            if len(names) != 1 or len(values) != 1:
                self.invalid = True
            self.tokens.append(values[0] if len(values) == 1 else None)

    def handle_endtag(self, tag: str) -> None:
        if self.blocked:
            if tag == self.blocked[-1]: self.blocked.pop()
            return
        if tag == "head" and self.in_head:
            self.in_head = False; self.head_closed = True
        elif tag == "br" and self.in_head:
            self.invalid = True
        elif tag in {"body", "html"}:
            self.body_seen = True
            if self.in_head: self.invalid = True

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag not in {"meta", "link", "base"}:
            self.invalid = True
        self.handle_starttag(tag, attrs)

    def handle_data(self, data: str) -> None:
        if self.blocked and self.blocked[-1] == "noscript" and data.strip("\t\n\f\r "):
            self.invalid = True
        if not self.blocked and data.strip("\t\n\f\r "):
            if self.in_head: self.invalid = True
            elif not self.head_seen: self.body_seen = True

    def unknown_decl(self, data: str) -> None:
        self.invalid = True


class WebsiteMetaParser(IWebsiteMetaParser):
    def extract(self, document: WebsiteHTML) -> str | None:
        if not isinstance(document.body, bytes) or len(document.body) > 5 * 1024 * 1024:
            return None
        metadata = Message(); metadata["content-type"] = document.content_type
        if metadata.get_content_type() not in {"text/html", "application/xhtml+xml"}: return None
        charsets = [value for key, value in metadata.get_params()[1:] if key.lower() == "charset"]
        if len(charsets) > 1: return None
        try:
            encoding = codecs.lookup(charsets[0] if charsets else "utf-8").name
            if encoding not in _ENCODINGS: return None
            # BOM takes precedence, as in an actual document; UTF-7 is never accepted.
            if document.body.startswith((codecs.BOM_UTF32_LE, codecs.BOM_UTF32_BE)): encoding = "utf-32"
            elif document.body.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)): encoding = "utf-16"
            elif document.body.startswith(codecs.BOM_UTF8): encoding = "utf-8-sig"
            parser = _HeadProof(); parser.feed(document.body.decode(encoding)); parser.close()
        except (LookupError, UnicodeError, ValueError, TypeError, AssertionError):
            return None
        if parser.invalid or not parser.head_closed or parser.blocked or len(parser.tokens) != 1: return None
        token = parser.tokens[0]
        return token if isinstance(token, str) and re.fullmatch(r"[A-Za-z0-9_-]{43}", token) else None
