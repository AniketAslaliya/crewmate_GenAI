from __future__ import annotations
import pdfplumber
import re
from typing import List, Dict, Any

def _normalize_text(text: str) -> str:
    """
    Normalizes text by removing excessive whitespace and lowercasing.
    """
    return re.sub(r'\s+', ' ', text).strip().lower()

def _merge_words_into_rects(words: List[Dict]) -> List[Dict]:
    """
    SMART MERGE LOGIC:
    Takes a list of word objects and merges them into rectangles based on lines.
    - If words are on the same line (y-axis close), they become ONE box.
    - If words wrap to the next line, they become a NEW box.
    """
    if not words:
        return []

    # 1. Group words by their approximate Y-position (Line detection)
    # We use a tolerance of 3 pixels to handle slight misalignments
    lines = {}
    for word in words:
        # Round 'top' to nearest 3px to group words on the same visual line
        y_key = round(word['top'] / 3) * 3
        if y_key not in lines:
            lines[y_key] = []
        lines[y_key].append(word)

    merged_rects = []

    # 2. Create ONE Union-Box per line
    for _, line_words in lines.items():
        # Calculate the union of all words in this specific line
        x0 = min(w['x0'] for w in line_words)
        top = min(w['top'] for w in line_words)
        x1 = max(w['x1'] for w in line_words)
        bottom = max(w['bottom'] for w in line_words)
        
        merged_rects.append({
            "x": x0,
            "y": top,
            "width": x1 - x0,
            "height": bottom - top,
            "bbox": [x0, top, x1, bottom],
            "text_fragment": " ".join([w['text'] for w in line_words])
        })

    return merged_rects

def find_text_coordinates(pdf_path: str, target_texts: List[str]) -> Dict[str, List[Dict]]:
    """
    Finds text coordinates using Fuzzy Word Sequence Matching + Smart Line Merging.
    """
    print(f"--- [Highlighter] Opening PDF with pdfplumber: {pdf_path} ---")
    highlights_map = {}
    
    if not target_texts:
        return {}

    # Pre-process targets
    normalized_targets = { _normalize_text(t): t for t in target_texts if t.strip() }
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_index, page in enumerate(pdf.pages):
                # Extract words with coordinates
                words = page.extract_words(x_tolerance=2, y_tolerance=3, keep_blank_chars=False)
                
                if not words: continue

                # Create normalized list for searching
                page_word_list = [ _normalize_text(w['text']) for w in words ]
                
                # Search for each target
                for norm_target, original_target in normalized_targets.items():
                    target_word_list = norm_target.split()
                    seq_len = len(target_word_list)
                    
                    if seq_len == 0: continue

                    # Sliding window search
                    for i in range(len(page_word_list) - seq_len + 1):
                        # Check if sequence matches
                        if page_word_list[i : i + seq_len] == target_word_list:
                            
                            # --- MATCH FOUND ---
                            matched_words = words[i : i + seq_len]
                            
                            # --- APPLY SMART MERGE ---
                            # This converts the list of words into visual rectangles (1 per line)
                            visual_boxes = _merge_words_into_rects(matched_words)
                            
                            # Add page info and append to results
                            if original_target not in highlights_map:
                                highlights_map[original_target] = []

                            for box in visual_boxes:
                                box["page"] = page_index + 1 # 1-based index for frontend
                                highlights_map[original_target].append(box)

        print(f"--- [Highlighter] Processed {len(target_texts)} targets. Found matches for {len(highlights_map)}. ---")
        return highlights_map

    except Exception as e:
        print(f"--- [Highlighter] Error: {e} ---")
        return {}