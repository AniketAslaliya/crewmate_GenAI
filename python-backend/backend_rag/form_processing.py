
# backend_rag/form_processing.py
from __future__ import annotations
import json
import re
# Near the top of api_server.py
from typing import List, Optional, Dict, Any # Ensure List is included


from .models import model, call_model_system_then_user

# --- Required Imports ---
from docx import Document
from PyPDF2 import PdfReader, PdfWriter # Keep for placeholder/future use

# --- Assuming these are available from your existing setup ---
from .models import call_model_system_then_user
from .retrieval import retrieve_similar_chunks # For context
# Assuming OcrResult class is defined or you handle OCR output directly
# from .ocr import OcrResult # Example if defined elsewhere

# Placeholder Class Definitions (if not defined elsewhere)
from typing import List # Make sure List is imported
from pydantic import BaseModel 
class OcrWord(BaseModel):
    text: str
    bbox: List[int] # [xmin, ymin, xmax, ymax] coordinates

class OcrPage(BaseModel):
    page_number: int
    width: int
    height: int
    words: List[OcrWord]

class DetailedOcrResult(BaseModel):
    pages: List[OcrPage]

# --- Field Detection & Classification ---

# In backend_rag/form_processing.py

# --- (Keep existing imports: json, re, typing, LLM call, etc.) ---
# --- (Ensure DetailedOcrResult, OcrPage, OcrWord classes are defined/imported) ---
# --- (Ensure find_word_bbox and find_nearby_blank_bbox helpers are present) ---

def _generate_field_description(field_label: str, field_type: str) -> str:
    """Uses LLM to generate a short, helpful description for a form field."""
    print(f"--- [Form Description] Generating description for: {field_label} ({field_type}) ---")
    
    # Simple prompt for description
    system_prompt = (
        "You provide concise, helpful descriptions for form fields. "
        "Based on the field label and type, provide a one-sentence description "
        "explaining what the user should enter.\n"
        "Example Input: Label='Date of Birth', Type='date'\n"
        "Example Output: Enter the date you were born, usually in DD/MM/YYYY format.\n"
        "Example Input: Label='PAN No.', Type='pan'\n"
        "Example Output: Enter your 10-character Permanent Account Number (PAN).\n"
        "Rules:\n"
        "- Keep it under 20 words.\n"
        "- Be user-friendly.\n"
        "- Output ONLY the description string."
    )
    user_prompt = f"Field Label: \"{field_label}\"\nField Type: \"{field_type}\"\n\nDescription:"
    
    try:
        description = call_model_system_then_user(system_prompt, user_prompt, temperature=0.1)
        return description.strip()
    except Exception as e:
        print(f"--- [Form Description] Failed: {e} ---")
        return "Enter the required information for this field." # Fallback

# In backend_rag/form_processing.py

def find_word_bbox(text_to_find: str, ocr_pages: List[OcrPage]) -> Optional[List[int]]:
    """Helper: Finds the bbox of the first occurrence of a specific text label (more robust)."""
    if not text_to_find: return None
    search_text_lower = ' '.join(text_to_find.lower().split()) # Normalize whitespace
    if not search_text_lower: return None

    for page in ocr_pages:
        page_words = page.words
        # Try finding exact multi-word matches first
        search_words = search_text_lower.split()
        num_search_words = len(search_words)
        for i in range(len(page_words) - num_search_words + 1):
            phrase_match = True
            phrase_bbox = None
            current_bbox = [float('inf'), float('inf'), float('-inf'), float('-inf')] # min_x, min_y, max_x, max_y

            for j in range(num_search_words):
                ocr_word = page_words[i+j].text.lower().strip()
                search_word = search_words[j]
                if ocr_word != search_word:
                    phrase_match = False
                    break
                # Combine bounding boxes for the phrase
                word_bbox = page_words[i+j].bbox
                current_bbox[0] = min(current_bbox[0], word_bbox[0])
                current_bbox[1] = min(current_bbox[1], word_bbox[1])
                current_bbox[2] = max(current_bbox[2], word_bbox[2])
                current_bbox[3] = max(current_bbox[3], word_bbox[3])

            if phrase_match:
                print(f"--- [find_word_bbox] Found exact phrase match for '{text_to_find}'")
                return [int(c) for c in current_bbox] # Return combined bbox

        # Fallback: Find first word if exact phrase fails
        first_search_word = search_words[0]
        for word in page_words:
            if first_search_word == word.text.lower().strip():
                print(f"--- [find_word_bbox] Found first word match for '{text_to_find}'")
                return word.bbox # Return first word's bbox as approximation
    print(f"--- [find_word_bbox] Could not find bbox for '{text_to_find}'")
    return None

def _batch_generate_descriptions(fields_info: List[Dict]) -> Dict[str, str]:
    """Generates descriptions for multiple fields in a single LLM call."""
    if not fields_info:
        return {}
        
    print(f"--- [Form Batch Desc] Generating descriptions for {len(fields_info)} fields... ---")
    
    # Prepare input for the LLM: list of labels and types
    field_list_str = "\n".join([f"- Label: \"{f['label_text']}\", Type: \"{f['semantic_type']}\"" for f in fields_info])
    
    system_prompt = (
        "You provide concise, helpful descriptions for form fields. "
        "For each field in the provided list (Label, Type), provide a one-sentence description "
        "explaining what the user should enter.\n"
        "Return a valid JSON object where keys are the exact 'Label Text' strings from the input, "
        "and values are the generated description strings.\n"
        "Example Input List:\n- Label: \"Date of Birth\", Type: \"date\"\n- Label: \"PAN No.\", Type: \"pan\"\n"
        "Example JSON Output:\n{\n  \"Date of Birth\": \"Enter the date you were born, usually in DD/MM/YYYY format.\",\n  \"PAN No.\": \"Enter your 10-character Permanent Account Number (PAN).\"\n}\n"
        "Rules:\n"
        "- Descriptions should be under 20 words and user-friendly.\n"
        "- Output ONLY the JSON object."
    )
    user_prompt = f"Field List:\n{field_list_str}\n\nJSON Output:"
    
    descriptions = {}
    try:
        response = call_model_system_then_user(
            system_prompt, user_prompt, temperature=0.1, model_instance=model
        )
        # --- DEBUG: Print raw response ---
        print(f"--- [Form Batch Desc] Raw LLM Response:\n{response}\n---")
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            descriptions = json.loads(match.group(0))
            print(f"--- [Form Batch Desc] Generated {len(descriptions)} descriptions. ---")
        else:
            print("--- [Form Batch Desc] Failed: LLM did not return valid JSON object.")
    except Exception as e:
        print(f"--- [Form Batch Desc] Failed: {e} ---")
        # Provide default descriptions on error
        descriptions = {f['label_text']: "Enter the required information." for f in fields_info}
        
    return descriptions

def find_nearby_blank_bbox(label_bbox: List[int], ocr_pages: List[OcrPage], max_x_distance: int = 300, y_tolerance: int = 10) -> List[int]:
    """
    Improved Heuristic: Tries to find empty space to the right on the same line.
    Falls back to estimating or returning label bbox if no clear blank is found.
    """
    if not label_bbox or len(label_bbox) != 4: return [0, 0, 0, 0] # Default empty

    label_xmin, label_ymin, label_xmax, label_ymax = label_bbox
    label_y_mid = (label_ymin + label_ymax) / 2

    # Define search area primarily to the right, within vertical tolerance
    search_xmin = label_xmax + 5 # Small gap after label
    search_xmax_limit = label_xmax + max_x_distance
    search_ymin = label_y_mid - y_tolerance
    search_ymax = label_y_mid + y_tolerance

    closest_word_to_right_xmin = float('inf')

    # Look for any words starting immediately to the right on the same line
    for page in ocr_pages: # Assuming relevant words are on the same page
        for word in page.words:
            word_bbox = word.bbox
            word_y_mid = (word_bbox[1] + word_bbox[3]) / 2

            # Check if word starts to the right and is vertically aligned
            if word_bbox[0] >= search_xmin and \
               word_bbox[0] < search_xmax_limit and \
               abs(word_y_mid - label_y_mid) <= y_tolerance:
                 closest_word_to_right_xmin = min(closest_word_to_right_xmin, word_bbox[0])

    # Estimate blank bbox based on findings
    blank_xmin = label_xmax + 10 # Start slightly after label
    blank_ymin = label_ymin
    blank_ymax = label_ymax

    if closest_word_to_right_xmin != float('inf'):
        # Found a word to the right, blank ends just before it
        blank_xmax = closest_word_to_right_xmin - 5
    else:
        # No word found nearby to the right, estimate a default width
        blank_xmax = blank_xmin + 200 # Default width guess

    # Basic validation
    if blank_xmax <= blank_xmin:
        print(f"--- [find_nearby_blank_bbox] Could not estimate valid blank. Returning label bbox for label at {label_bbox}")
        return label_bbox # Return LABEL bbox as fallback if estimation fails

    estimated_bbox = [int(c) for c in [blank_xmin, blank_ymin, blank_xmax, blank_ymax]]
    print(f"--- [find_nearby_blank_bbox] Estimated blank bbox: {estimated_bbox} for label at {label_bbox}")
    return estimated_bbox

# --- Field Detection & Classification (V2 with Bounding Boxes & Description) ---
# In backend_rag/form_processing.py

# In backend_rag/form_processing.py
def _batch_generate_suggestions(fields_info: List[Dict], context: str) -> Dict[str, List[str]]:
    """Generates suggestions for multiple non-sensitive fields in a single LLM call."""
    if not fields_info:
        return {}

    print(f"--- [Form Batch Suggest] Generating suggestions for {len(fields_info)} fields... ---")

    # Prepare input for the LLM: list of field IDs, labels, and types
    field_list_str = "\n".join([f"- ID: \"{f['id']}\", Label: \"{f['label_text']}\", Type: \"{f['semantic_type']}\"" for f in fields_info])
    safe_context = context[:1500] # Limit context

    system_prompt = (
        "You are a concise assistant that suggests potential values for multiple form fields based on context.\n"
        "For each field in the provided list (ID, Label, Type), provide 1-3 likely candidate values appropriate for the field type.\n"
        "Return a valid JSON object where keys are the exact 'ID' strings from the input list, "
        "and values are lists of suggested string values `[]`.\n"
        "Example Input List:\n- ID: \"field_0\", Label: \"Given Name\", Type: \"name\"\n- ID: \"field_5\", Label: \"City\", Type: \"city\"\n"
        "Example JSON Output:\n{\n  \"field_0\": [\"John\", \"Jane\"],\n  \"field_5\": [\"New York\", \"London\"]\n}\n"
        "Rules:\n"
        "- Keep suggestions short and relevant.\n"
        "- If no good suggestions exist for a field, provide an empty list `[]` for its ID.\n"
        "- Output ONLY the JSON object."
    )
    user_prompt = (
        f"Context Summary: \"{safe_context}\"\n\n"
        f"Field List:\n{field_list_str}\n\n"
        f"JSON Output (Suggestions by Field ID):"
    )

    suggestions_by_id = {}
    try:
        response = call_model_system_then_user(
            system_prompt, user_prompt, temperature=0.4, model_instance=model
        )
        # --- DEBUG: Print raw response ---
        print(f"--- [Form Batch Suggest] Raw LLM Response:\n{response}\n---")
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            raw_suggestions = json.loads(match.group(0))
            # Validate: ensure keys exist in original request and values are lists of strings
            for field_id, sugg_list in raw_suggestions.items():
                if any(f['id'] == field_id for f in fields_info) and isinstance(sugg_list, list):
                    suggestions_by_id[field_id] = [str(s) for s in sugg_list if isinstance(s, (str, int, float))][:3]
            print(f"--- [Form Batch Suggest] Generated suggestions for {len(suggestions_by_id)} fields.")
        else:
             print("--- [Form Batch Suggest] Failed: LLM did not return valid JSON object.")
    except Exception as e:
        print(f"--- [Form Batch Suggest] Failed: {e} ---")
        # Return empty dict on error, fields will just have no suggestions

    return suggestions_by_id

def detect_form_fields(ocr_result: DetailedOcrResult) -> List[Dict]:
    """
    V2.2: Detects fields via LLM, maps bbox, calls batch description generation.
    """
    print("--- [Form Processing V2.2] Detecting fields, bbox, getting descriptions... ---")

    full_text = "\n".join(" ".join(word.text for word in page.words) for page in ocr_result.pages)
    context_snippet = full_text[:8000]
    if not context_snippet.strip(): return []

    # 1. LLM Call to Identify Fields (Label ::: Type format)
    system_prompt_detect = (
       "You are an expert form field detector... [Your existing V2.1 prompt asking for 'Label ::: Type' list] ..." # Keep your working V2.1 prompt
    )
    user_prompt_detect = f"OCR Text Snippet:\n---\n{context_snippet}\n---\n\nList detected fields (Label ::: Type):"

    llm_identified_fields_info = [] # Store temporary info for description generation
    detected_fields_final = [] # Store final field dicts

    try:
        response = call_model_system_then_user(
            system_prompt_detect, user_prompt_detect, temperature=0.0, model_instance=model
        )
        llm_lines = [line.strip() for line in response.split('\n') if ':::' in line]
        print(f"--- [Form Processing V2.2] LLM identified {len(llm_lines)} potential fields.")

        # Prepare list for batch description
        temp_field_list_for_desc = []
        parsed_fields_temp = {} # Store intermediate data by label
        for i, line in enumerate(llm_lines):
            parts = line.split(':::')
            if len(parts) == 2:
                label_text_raw = parts[0].strip()
                label_text = label_text_raw[:-1].strip() if label_text_raw.endswith(':') else label_text_raw
                semantic_type = parts[1].strip().lower()
                
                temp_field_list_for_desc.append({"label_text": label_text_raw, "semantic_type": semantic_type}) # Use raw label for dict key
                parsed_fields_temp[label_text_raw] = {'label_clean': label_text, 'type': semantic_type, 'id': f"field_{i}"}

        # 2. Single LLM Call to Generate All Descriptions
        field_descriptions = _batch_generate_descriptions(temp_field_list_for_desc)

        # 3. Map Coordinates and Compile Final Field List
        for label_raw, desc_data in parsed_fields_temp.items():
            label_clean = desc_data['label_clean']
            semantic_type = desc_data['type']
            field_id = desc_data['id']

            label_bbox = find_word_bbox(label_clean, ocr_result.pages) # Use clean label for bbox lookup
            field_bbox = find_nearby_blank_bbox(label_bbox, ocr_result.pages) if label_bbox else [0,0,0,0]
            if field_bbox == [0,0,0,0] and label_bbox: field_bbox = label_bbox

            is_sensitive = semantic_type in ['pan', 'address', 'phone', 'email', 'amount']
            description = field_descriptions.get(label_raw, "Enter the required information.") # Get description using raw label key

            field = {
                'id': field_id, 'label_text': label_clean, 'bbox': field_bbox,
                'semantic_type': semantic_type, 'confidence': 'Medium',
                'is_sensitive': is_sensitive, 'description': description, 'value': ""
            }
            detected_fields_final.append(field)

        print(f"--- [Form Processing V2.2] Processed {len(detected_fields_final)} fields after mapping and descriptions.")

    except Exception as e:
        print(f"--- [Form Processing V2.2] Error during field processing: {e} ---")

    return detected_fields_final
        

# --- Suggestion Generation ---

def generate_field_suggestions(field: Dict, context: str) -> List[str]:
    """
    Generates potential values for a specific form field using Gemini/LLM.
    """
    field_type = field.get('semantic_type', 'other')
    field_label = field.get('label_text', '')
    is_sensitive = field.get('is_sensitive', False)

    if is_sensitive or field_type in ['signature', 'pan', 'other']:
         print(f"--- [Form Suggestion] Skipping suggestions for sensitive/unsuitable field: {field_label} ({field_type}) ---")
         return []

    print(f"--- [Form Suggestion] Generating suggestions for: {field_label} ({field_type}) ---")
    safe_context = context # TODO: Implement proper redaction for sensitive context

    system_prompt = (
        "You are a concise assistant that suggests potential values for a form field.\n"
        "Rules:\n"
        "- Based on the field type, label, and context, provide 1-3 likely candidate values.\n"
        "- Return a valid JSON list of strings `[]`.\n"
        "- Keep suggestions short and appropriate for the field type.\n"
        "- Output ONLY the JSON list."
    )
    user_prompt = (
        f"Field Label: \"{field_label}\"\n"
        f"Field Type: \"{field_type}\"\n"
        f"Context Summary: \"{safe_context[:1000]}\"\n\n"
        f"Task: Provide 1-3 candidate values as a JSON list:"
    )

    suggestions = []
    try:
        response = call_model_system_then_user(system_prompt, user_prompt, temperature=0.4)
        match = re.search(r'\[.*\]', response, re.DOTALL)
        if match:
            raw_suggestions = json.loads(match.group(0))
            suggestions = [str(s) for s in raw_suggestions if isinstance(s, (str, int, float))][:3]
            print(f"--- [Form Suggestion] Generated suggestions: {suggestions} ---")
    except Exception as e:
        print(f"--- [Form Suggestion] Error generating suggestions: {e} ---")

    return suggestions

# --- Form Export ---

# --- Option 1: Filling PDFs (Placeholder - Requires PDF with AcroForm fields) ---
def fill_pdf_form(template_path: str, output_path: str, field_data: Dict[str, str]):
    """Placeholder: Fills a PDF form template with interactive fields."""
    print(f"Placeholder: Filling PDF {template_path} -> {output_path}. Needs implementation if PDF AcroForms are used.")
    # Basic implementation using PyPDF2 (commented out):
    # try:
    #     reader = PdfReader(template_path)
    #     writer = PdfWriter()
    #     for page in reader.pages:
    #         writer.add_page(page)
    #     form_fields = reader.get_fields()
    #     if form_fields:
    #         writer.update_page_form_field_values(writer.pages[0], field_data)
    #         with open(output_path, "wb") as output_stream:
    #             writer.write(output_stream)
    #         print(f"--- [Form Export] Successfully created filled PDF: {output_path} ---")
    #     else:
    #         print(f"--- [Form Export] WARNING: No interactive fields found in PDF {template_path}.")
    #         # Copy original if no fields
    #         with open(template_path, "rb") as f_in, open(output_path, "wb") as f_out: f_out.write(f_in.read())
    # except Exception as e:
    #     print(f"--- [Form Export] ERROR filling PDF: {e} ---")
    #     raise
    pass # Keep as pass if not implemented

# --- Option 2: Filling DOCX (Functional Implementation) ---
def fill_docx_form(template_path: str, output_path: str, field_data: Dict[str, str]):
    """
    Fills a DOCX template by replacing placeholder text like {{field_id}}.
    """
    print(f"--- [Form Export] Filling DOCX {template_path} -> {output_path} ---")
    try:
        document = Document(template_path)
        
        # Replace placeholders in paragraphs
        for para in document.paragraphs:
            for key, value in field_data.items():
                placeholder = f"{{{{{key}}}}}" # e.g., {{complainant_name}}
                if placeholder in para.text:
                    # Simple replacement logic (might need refinement for complex cases)
                    inline = para.runs
                    for run in inline:
                        if placeholder in run.text:
                            run.text = run.text.replace(placeholder, str(value))

        # Replace placeholders in tables
        for table in document.tables:
            for row in table.rows:
                for cell in row.cells:
                    for para in cell.paragraphs:
                        for key, value in field_data.items():
                             placeholder = f"{{{{{key}}}}}"
                             if placeholder in para.text:
                                 inline = para.runs
                                 for run in inline:
                                     if placeholder in run.text:
                                         run.text = run.text.replace(placeholder, str(value))

        document.save(output_path)
        print(f"--- [Form Export] Successfully created filled DOCX: {output_path} ---")

    except Exception as e:
        print(f"--- [Form Export] ERROR filling DOCX: {e} ---")
        raise # Re-raise the exception to be caught by the API