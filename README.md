# Legal SahAI - Multi-Agent Intelligent Legal Assistant

**Winner of the Google Gen AI Hackathon**

## Problem
Legal documentation and statutes are incredibly dense and filled with jargon, making it difficult for common citizens to understand their rights, procedures, or the implications of specific case laws without expensive legal counsel.

## Approach
I built a multi-agent educational and assistive system to democratize access to legal information. Instead of relying on a standard single-prompt chatbot, I engineered a Retrieval-Augmented Generation (RAG) pipeline orchestrated by specialized AI agents using Python and the Gemini API. 
* **The Researcher Agent:** Queries legal databases to retrieve relevant statutes.
* **The Simplifier Agent:** Translates the retrieved legal jargon into layman's terms.
* **The Strategist Agent:** Outlines potential procedural next steps.

## Iterations
* **Iteration 1 (Baseline):** Started with a basic zero-shot prompt approach using a single LLM. *Result:* High hallucination rate and inability to cite specific laws accurately.
* **Iteration 2 (RAG Implementation):** Integrated a vector database to ground the LLM's responses in actual legal text. *Result:* Improved factual accuracy, but the output was still too complex for average users.
* **Iteration 3 (Multi-Agent Architecture):** Split the cognitive load across distinct agent personas (Researcher, Simplifier, Strategist) operating in a sequence. *Result:* Highly accurate, verifiable, and easy-to-understand legal insights. 

## Key Design Choices
1. **Multi-Agent System:** Chosen over a single monolithic prompt to reduce cognitive overload on the LLM, effectively minimizing hallucinations and ensuring the final output is cross-verified by different agent constraints.
2. **Strict Context Grounding:** The RAG pipeline was designed with explicit boundary instructions forcing the models to rely *only* on retrieved context, which is critical for high-stakes legal data.
3. **Gemini API:** Selected for its reliability in executing complex, multi-step reasoning and maintaining strict adherence to system prompts across a large context window.


