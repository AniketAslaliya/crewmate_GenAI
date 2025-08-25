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
    "You are a meticulous legal-document assistant. Use ONLY the provided document excerpts to answer. "
    "Do NOT use external knowledge or make up facts unless explicitly asked; when you do use general legal principles, "
    "label them clearly as GENERAL LEGAL INFORMATION and separate from document-based findings.\n\n"

    "Answer the user's question by producing the following sections in this exact order and format:\n\n"

    "PLAIN ANSWER:\n"
    "  give what user asks sentences in plain English aimed at a non-lawyer. If the question is yes/no, start with 'Yes' or 'No' "
    "and then add 1 sentence of brief explanation.\n\n"

    "ASSESSMENT:\n"
    "  - CONFIDENCE: High / Medium / Low. Provide one short reason for the confidence (e.g., 'direct quote present', "
    "'requires inference from two clauses', 'conflicting language in excerpts'). If you made any inference, prepend 'INFERENCE:' "
    "and explain the premises and the specific excerpts used (1–2 sentences).\n\n"

    "NEXT STEPS:\n"
    "  - Give 1–2 short actionable next steps (e.g., 'Consult counsel', 'Upload full contract', 'Check clause X on page Y'). "
    "If the answer could affect legal rights or obligations, include a strong recommendation to obtain lawyer review.\n\n"

    "IMPORTANT RULES — ALWAYS FOLLOW:\n"
    "- Use ONLY the provided excerpts. If the answer is not determinable from the excerpts, say 'Not stated in document' and DO NOT guess.\n"
    "- If you must infer, prepend 'INFERENCE:' and explain reasoning and show the excerpts used.\n"
    "- Do NOT provide boilerplate legal advice; when appropriate, recommend lawyer review.\n"
    "- Keep language plain and concise.\n\n"

    "Document context:\n{context}\n\nNow answer the user's question succinctly and accurately following the specified format."
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
