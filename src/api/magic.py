"""Pure-Python container magic-byte verification for ingress media files per RELY-02."""

from __future__ import annotations


def validate_magic_bytes(header_bytes: bytes, allowed_formats: set[str] | list[str]) -> bool:
    """Validate container magic bytes against allowed format signatures.

    Supported formats:
    - png: \x89PNG\r\n\x1a\n
    - jpeg / jpg: \xff\xd8\xff
    - webm: \x1a\x45\xdf\xa3 (EBML ID)
    - mp4: 'ftyp' at offset 4..8
    - gif: GIF87a or GIF89a
    - wav: 'RIFF' at 0..4 and 'WAVE' at 8..12
    - mp3: 'ID3' tag header or MPEG sync frames (\xff\xfb, \xff\xf3, \xff\xf2, or 11 sync bits)
    """
    if not header_bytes:
        return False

    allowed = {fmt.lower().strip() for fmt in allowed_formats}

    for fmt in allowed:
        if fmt == "png":
            if header_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
                return True
        elif fmt in {"jpeg", "jpg"}:
            if header_bytes.startswith(b"\xff\xd8\xff"):
                return True
        elif fmt == "webm":
            if header_bytes.startswith(b"\x1a\x45\xdf\xa3"):
                return True
        elif fmt == "mp4":
            if len(header_bytes) >= 8 and header_bytes[4:8] == b"ftyp":
                return True
        elif fmt == "gif":
            if header_bytes.startswith(b"GIF87a") or header_bytes.startswith(b"GIF89a"):
                return True
        elif fmt == "wav":
            if (
                len(header_bytes) >= 12
                and header_bytes.startswith(b"RIFF")
                and header_bytes[8:12] == b"WAVE"
            ):
                return True
        elif fmt == "mp3":
            if header_bytes.startswith(b"ID3"):
                return True
            if len(header_bytes) >= 2:
                # Check direct common sync frames or MPEG 11-bit frame sync (0xFFE0 mask)
                if header_bytes[:2] in {b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"}:
                    return True
                if header_bytes[0] == 0xFF and (header_bytes[1] & 0xE0) == 0xE0 and (header_bytes[1] & 0x18) != 0x08:
                    return True

    return False
