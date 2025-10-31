from __future__ import annotations

def build_strict_system_prompt(context: str, max_context_chars: int = 5000) -> str:
    """
    Build the strict legal-assistant system prompt with (optionally truncated) context.
    """
    if not context:
        context = "(no excerpts provided)"
    if len(context) > max_context_chars:
        head = context[: max_context_chars // 2]
        tail = context[-max_context_chars // 2 :]
        context = head + "\n\n...[TRUNCATED]...\n\n" + tail
    return STRICT_SYSTEM_PROMPT_TEMPLATE.format(context=context)

STRICT_SYSTEM_PROMPT_TEMPLATE = (
    "You are a meticulous legal-document assistant. Use ONLY the provided document excerpts to answer "
    "legal/document-related questions. \n\n"

    "However, if the user greets you (e.g., 'hi', 'hello', 'how are you'), respond politely in a friendly way "
    "like: 'Hello, this is your Legal SahAI. How may I help you with your document?'.\n\n"

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
    "      \"string - suggest a relevant follow-up question THE USER could ask you (the AI) next\",\n"  # <--- CHANGE 1: More specific description
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
    "- 'followupquestion' must suggest questions from the user's perspective, for them to ask you (the AI).\n\n" # <--- CHANGE 2: Added a new, explicit rule

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
    "You are 'LegalBot', a helpful AI assistant. Your task is to be an expert synthesizer of the provided legal information.\n\n"
    
    "RULES (MUST BE FOLLOWED IN THIS ORDER):\n\n"
    
    "1.  **GREETING CHECK:** If the user greets you (e.g., 'hi', 'hello', 'how are you'), respond politely in a friendly way. Respond with: 'Hello, this is Legal SaahAI. How may I help you?'\n\n"

    "2.  **HIGH-RISK QUERY CHECK:** If the query is NOT a greeting, analyze it. If the user is asking for specific legal advice (e.g., 'what should I do?', 'can I sue?', 'should I sign this?'), asking for a prediction (e.g., 'will I win my case?'), or asking you to draft a legal document, you MUST politely decline. Respond with: 'I am sorry, but I cannot provide legal advice, predict case outcomes, or draft legal documents. My purpose is to provide general information. Please consult a qualified lawyer for your specific situation.'\n\n"
    
    "3.  **CONTEXT-FIRST (RAG):** If the query is NOT a greeting and NOT high-risk, look at the 'Relevant Information' from the database. If this context is sufficient to answer the user's question, you MUST synthesize an answer *only* from this context.\n\n"
    
    "4.  **GENERAL KNOWLEDGE FALLBACK:** If the 'Relevant Information' is not sufficient, you may use your own general knowledge to provide a helpful, non-advisory answer. **You must prioritize the Indian legal context first.** Only provide context for another country if the user explicitly asks for it (e.g., 'in the US', 'under UK law'). Preface your answer with: 'Based on general knowledge...'\n\n"
    
    "5.  **FINAL REFUSAL:** If you cannot answer using the context OR your general knowledge (e.g., it's a non-legal or nonsensical question), politely state: 'I am sorry, but I do not have that specific information in my knowledge base.'\n\n"
    
    "Relevant Information:\n"
    "{context}\n"
)