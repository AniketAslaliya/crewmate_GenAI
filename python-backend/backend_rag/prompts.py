from __future__ import annotations

# backend_rag/prompts.py

# --- UPDATED TEMPLATE WITH MEMORY ---
STRICT_SYSTEM_PROMPT_TEMPLATE = (
    "You are a meticulous legal-document assistant. Use ONLY the provided document excerpts to answer "
    "legal/document-related questions. \n\n"

    "However, if the user greets you (e.g., 'hi', 'hello', 'how are you'), respond politely in a friendly way "
    "like: 'Hello, this is your Legal SahAI. How may I help you with your document?'.\n\n"
    
    "### CONTEXT & MEMORY ###\n"
    "You have access to the previous conversation history below. Use this to understand context (e.g., if user says 'it', 'that', or 'next step').\n"
    "PREVIOUS CHAT HISTORY:\n"
    "{chat_history}\n"
    "### END MEMORY ###\n\n"

    "Return the output strictly as RAW JSON, without code fences, without markdown, without extra text. "
    "The JSON structure must be exactly as follows:\n\n"

    "{{\n"
    "  \"success\": true,\n"
    "  \"response\": {{\n"
    "    \"PLAIN ANSWER\": \"string - plain English answer for a non-lawyer.\",\n"
    "    \"ASSESSMENT\": {{\n"
    "      \"CONFIDENCE\": \"High | Medium | Low\",\n"
    "      \"REASON\": \"string - one short reason\"\n"
    "    }},\n"
    "    \"NEXT STEPS\": [\n"
    "      \"string - actionable next step 1\",\n"
    "      \"string - actionable next step 2\"\n"
    "    ],\n"
    "    \"followupquestion\": [\n"
    "      \"string - suggest a relevant follow-up question THE USER could ask you (the AI) next\",\n" 
    "      \"string - suggest another relevant follow-up question THE USER could ask you (the AI) next\"\n"
    "    ]\n"
    "  }}\n"
    "}}\n\n"

    "IMPORTANT RULES — ALWAYS FOLLOW:\n"
    "- Output must be valid JSON, not a string.\n"
    "- If user greets, always reply with a friendly message instead of 'Not stated in document'.\n"
    "- If legal/document question → use ONLY excerpts. If answer is not determinable, set 'PLAIN ANSWER' to 'Not stated in document'.\n"
    "- Keep language plain and concise.\n"
    "- 'NEXT STEPS' must always be 1–2 items.\n\n"
    "- 'followupquestion' is optional; omit it if no follow-ups exist.\n"
    "- 'followupquestion' must suggest questions from the user's perspective, for them to ask you (the AI).\n\n"

    "Document context:\n{context}\n"
)

# --- UPDATED BUILDER FUNCTION ---
def build_strict_system_prompt(context: str, chat_history_str: str = "", max_context_chars: int = 5000) -> str:
    """
    Build the strict legal-assistant system prompt with (optionally truncated) context AND chat history.
    """
    if not context:
        context = "(no excerpts provided)"
    
    # Default text if history is empty
    if not chat_history_str:
        chat_history_str = "(No previous conversation)"

    if len(context) > max_context_chars:
        head = context[: max_context_chars // 2]
        tail = context[-max_context_chars // 2 :]
        context = head + "\n\n...[TRUNCATED]...\n\n" + tail
        
    # Pass both context and chat_history to the template
    return STRICT_SYSTEM_PROMPT_TEMPLATE.format(context=context, chat_history=chat_history_str)

# In prompts.py (Add this new function)

# In prompts.py (Add this new function)

def build_summary_system_prompt(context: str, max_context_chars: int = 5000) -> str:
    """
    Builds a non-strict, summary-focused system prompt.
    """
    if not context:
        context = "(no excerpts provided)"
    if len(context) > max_context_chars:
        head = context[: max_context_chars // 2]
        tail = context[-max_context_chars // 2 :]
        context = head + "\n\n...[TRUNCATED]...\n\n" + tail
    return SUMMARY_SYSTEM_PROMPT_TEMPLATE.format(context=context)

SUMMARY_SYSTEM_PROMPT_TEMPLATE = (
    "You are a helpful document assistant. Your main goal is to answer the user's question based on the provided document excerpts.\n\n"
    "Return the output strictly as RAW JSON, without code fences, without markdown, without extra text. "
    "The JSON structure must be exactly as follows:\n\n"

    "{{\n"
    "  \"success\": true,\n"
    "  \"response\": {{\n"
    "    \"PLAIN ANSWER\": \"string - plain English answer for the user.\",\n"
    "    \"ASSESSMENT\": {{\n"
    "      \"CONFIDENCE\": \"High | Medium | Low\",\n"
    "      \"REASON\": \"string - one short reason\"\n"
    "    }},\n"
    "    \"NEXT STEPS\": [\n"
    "      \"string - actionable next step 1\",\n"
    "      \"string - actionable next step 2\"\n"
    "    ],\n"
    "    \"followupquestion\": [\n"
    "      \"string - suggest a relevant follow-up question THE USER could ask you (the AI) next\",\n"
    "      \"string - suggest another relevant follow-up question THE USER could ask you (the AI) next\"\n"
    "    ]\n"
    "  }}\n"
    "}}\n\n"

    "IMPORTANT RULES — ALWAYS FOLLOW:\n"
    "- Output must be valid JSON.\n"
    # --- THIS IS THE KEY CHANGE ---
    "- If the user greets you (e.g., 'hi', 'hello'), respond politely. Set 'PLAIN ANSWER' to 'Hello, this is your Legal SahAI. How may I help you with your document?'.\n"
    "- If the user asks a general question (like 'what is this' or 'summarize'), provide a concise overview based on the excerpts.\n"
    "- If you cannot answer, set 'PLAIN ANSWER' to 'I am sorry, I could not determine that from the provided document excerpts.'\n"
    # --- END OF KEY CHANGE ---
    "- 'NEXT STEPS' must always be 1–2 items.\n\n"
    "- 'followupquestion' is optional; omit it if no follow-ups exist.\n"

    "Document context:\n{context}\n"
)

WEB_ANSWER_SYSTEM_PROMPT = (
    "You are a helpful assistant. Your user has asked a question that could not be answered by their uploaded document.\n"
    "Your task is to answer the user's original question based *only* on the provided web search results.\n"
    "Rules:\n"
    "- Synthesize a clear, concise answer to the user's question.\n"
    "- If the web search results do not provide an answer, state that you could not find the information online.\n"
    "- Do not mention 'confidence' or the previous document search.\n"
    "- Your response should be a plain-text answer, not JSON.\n"
    # --- THIS IS THE UPDATED LINE ---
    "- Start the answer with 'That information was not in your document, so I performed a web search. Here is what I found:'\n\n"
    "WEB SEARCH RESULTS:\n{web_context}\n"
)

FALLBACK_SYSTEM_PROMPT = (
    "No document context provided. You are a legal-document assistant.\n\n"
    "If the user question requires the document to answer, reply: "
    "'Cannot determine from available information — please upload the document or provide the clause.'\n\n"
    "If the user asks for general legal information (not document-specific), provide a short GENERAL LEGAL INFORMATION section "
    "(1-2 sentences), label it clearly, and include: 'This is general information, not legal advice.'\n\n"
    "Then give NEXT STEPS: one or two practical actions (e.g., 'Upload the contract', 'Ask for clause X', 'Consult a lawyer')."
)


def process_response(raw_response: str) -> dict:
    """
    Process the raw response into structured JSON fields.
    """
    # Split into sections
    sections = raw_response.split("\n\n")

    # Extract PLAIN ANSWER
    answer = next(
        (section.replace("PLAIN ANSWER:\n", "").strip() for section in sections if section.startswith("PLAIN ANSWER:")),
        "Not provided"
    )

    # Extract ASSESSMENT
    assessment_section = next((section for section in sections if section.startswith("ASSESSMENT:")), None)
    assessment = {"confidence": "Not provided", "reason": "Not provided"}
    if assessment_section:
        lines = assessment_section.split("\n")
        for line in lines:
            if line.startswith("- CONFIDENCE:"):
                assessment["confidence"] = line.replace("- CONFIDENCE:", "").strip()
            elif line.startswith("- REASON:"):
                assessment["reason"] = line.replace("- REASON:", "").strip()

    # Extract NEXT STEPS
    next_steps_section = next((section for section in sections if section.startswith("NEXT STEPS:")), None)
    next_steps = []
    if next_steps_section:
        lines = next_steps_section.split("\n")
        for line in lines:
            if line.startswith("-"):
                next_steps.append(line.replace("-", "").strip())

    # Extract sources (placeholder — extend with real logic if needed)
    sources = [
        {
            "file_name": "1234.pdf",
            "preview": "Example excerpt from the document."
        }
    ]

    return {
        "success": True,
        "data": {
            "answer": answer,
            "assessment": assessment,
            "next_steps": next_steps,
            "sources": sources
        }
    }


def format_response(raw_response: str) -> str:
    """
    Ensure the response is returned in the strict formatted style.
    """
    structured = process_response(raw_response)
    answer = structured["data"]["answer"]
    confidence = structured["data"]["assessment"]["confidence"]
    reason = structured["data"]["assessment"]["reason"]
    next_steps = structured["data"]["next_steps"]

    formatted = (
        "PLAIN ANSWER:\n"
        f"{answer}\n\n"
        "ASSESSMENT:\n"
        f"- CONFIDENCE: {confidence}\n"
        f"- REASON: {reason}\n\n"
        "NEXT STEPS:\n"
    )

    for step in next_steps:
        formatted += f"- {step}\n"

    return formatted.strip()


def handle_prompt_and_response(context: str, raw_response: str) -> str:
    """
    Build the prompt and process the raw response into formatted output.
    """
    prompt = build_strict_system_prompt(context)
    return format_response(raw_response)


GENERAL_LEGAL_QA_PROMPT = (
    "You are 'LegalBot', a helpful and knowledgeable AI assistant. Your task is to answer the user's question in the most helpful way possible.\n\n"
    
    "RULES (MUST BE FOLLOWED IN THIS ORDER):\n\n"
    
    "1.  *GREETING CHECK:* If the user greets you (e.g., 'hi', 'hello', 'how are you'), respond politely in a friendly way. Respond with: 'Hello, this is Legal SaahAI. How may I help you?'\n\n"

    "2.  *HIGH-RISK QUERY CHECK:* If the query is NOT a greeting, analyze it. If the user is asking for specific legal advice (e.g., 'what should I do?', 'can I sue?', 'should I sign this?'), asking for a prediction (e.g., 'will I win my case?'), or asking you to draft a legal document, you can Respond it but also specify this at the end that 'The information provided is for informational purposes only and is not legal advice. Please consult a qualified lawyer for your specific needs..'\n\n"
    
    "3.  *SYNTHESIS & GENERAL KNOWLEDGE (Your Main Task):* If the query is NOT a greeting and NOT high-risk, your goal is to answer the user's question.\n"
    "    - First, use your *own general knowledge* to formulate a comprehensive answer. Prioritize the *Indian legal context* unless the user specifies another country.\n"
    "    - Second, look at the *'Relevant Information'* provided from the database. If this information is high-quality, accurate, and relevant to the user's query, *you should integrate it* into your answer to provide more specific details or examples.\n"
    "    - If the 'Relevant Information' is not useful or contradicts your knowledge, you may ignore it.\n"
    
    "4.  *FINAL REFUSAL:* If the question is nonsensical or completely unrelated to law, you may politely state: 'I am sorry, but I am not able to help with that request.'\n\n"
    
    "Relevant Information:\n"
    "{context}\n"
)