from __future__ import annotations

import re
import uuid
from typing import List, Tuple


def _is_heading(line: str) -> bool:
    line = line.strip()
    if not line:
        return False
    if re.match(r"^(section|article|chapter|clause)\b", line, flags=re.I):
        return True
    if re.match(r"^\d+(\.\d+)\s[-:]?", line):
        return True
    if line.isupper() and 1 <= len(line.split()) <= 8:
        return True
    return False


def semantic_chunk_text(text: str, target_chars: int = 1000, overlap: int = 200) -> List[Tuple[str, str]]:
    if not text or not text.strip():
        return []
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    paras = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]

    # Merge headings with their following paragraph when sensible
    blocks: List[str] = []
    i = 0
    while i < len(paras):
        p = paras[i]
        first_line = p.split("\n", 1)[0].strip()
        if _is_heading(first_line) and (i + 1) < len(paras):
            combined = first_line + "\n\n" + paras[i + 1].strip()
            blocks.append(combined)
            i += 2
        else:
            blocks.append(p)
            i += 1

    # Degenerate case: huge text but too few blocks → sliding window
    if len(blocks) <= 2 and len(text) > target_chars * 1.5:
        chunks = []
        idx = 0
        n = len(text)
        while idx < n:
            end = min(idx + target_chars, n)
            chunk = text[idx:end].strip()
            if chunk:
                chunks.append((str(uuid.uuid4()), chunk))
            idx += max(1, target_chars - overlap)
        return chunks

    # Merge blocks up to ~target_chars
    merged: List[str] = []
    current = ""
    for b in blocks:
        if not current:
            current = b
        elif len(current) + len(b) + 2 <= target_chars:
            current = current + "\n\n" + b
        else:
            merged.append(current.strip())
            current = b
            # If a single block is still very long, split on sentence ends
            if len(current) > target_chars * 1.5:
                subs = re.split(r"(?<=[\.\?\!])\s+", current)
                acc = ""
                for s in subs:
                    if len(acc) + len(s) + 1 <= target_chars:
                        acc = (acc + " " + s).strip() if acc else s
                    else:
                        if acc:
                            merged.append(acc.strip())
                        acc = s
                current = acc
    if current:
        merged.append(current.strip())

    # Final sliding window for any oversized leftovers
    chunks_text: List[str] = []
    for m in merged:
        if len(m) <= target_chars:
            chunks_text.append(m)
        else:
            idx = 0
            n = len(m)
            while idx < n:
                end = min(idx + target_chars, n)
                chunk = m[idx:end].strip()
                if chunk:
                    chunks_text.append(chunk)
                idx += max(1, target_chars - overlap)

    # Deduplicate by prefix and attach UUIDs
    out: List[Tuple[str, str]] = []
    seen = set()
    for c in chunks_text:
        key = c[:300]
        if key in seen:
            continue
        seen.add(key)
        out.append((str(uuid.uuid4()), c))
    return out


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[Tuple[str, str]]:
    return semantic_chunk_text(text, target_chars=chunk_size, overlap=overlap)
