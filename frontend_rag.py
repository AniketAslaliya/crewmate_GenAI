# frontend_database.py
import streamlit as st
import uuid
import json
import logging
from pathlib import Path
from langchain_core.messages import HumanMessage

# existing backend (quick analyze only, deep removed)
from backend_rag import (
    chatbot,
    ingest_file,
    thread_has_ingested_file,
    retrieve_all_threads,
    associate_thread_with_user,
    create_user_if_not_exists,
    get_user_for_thread,
    quick_analyze,
    get_term_context,
    _read_ingested_filepath,
    # newly imported flags for UI display
    RERANKER_AVAILABLE,
    ANN_TOP_K,
    FINAL_TOP_K,
    CROSS_ENCODER_MODEL,
    VISION_AVAILABLE,  # newly used flag
)

# Upload directory (local)
UPLOAD_DIR = Path("/tmp/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ---- safe rerun helper (compat for multiple Streamlit versions) ----
def safe_rerun():
    rerun_fn = getattr(st, "experimental_rerun", None)
    if callable(rerun_fn):
        try:
            return rerun_fn()
        except Exception:
            pass
    try:
        from streamlit.runtime.scriptrunner import RerunException
        raise RerunException()
    except Exception:
        try:
            from streamlit.script_runner import RerunException
            raise RerunException()
        except Exception:
            pass
    st.stop()

def generate_thread_id():
    return str(uuid.uuid4())

def reset_chat():
    thread_id = generate_thread_id()
    st.session_state['thread_id'] = thread_id
    add_thread(thread_id)
    if st.session_state.get('user_id'):
        try:
            associate_thread_with_user(st.session_state['user_id'], thread_id)
        except Exception:
            pass
    st.session_state['message_history'] = []
    # clear analysis cache for the new thread
    st.session_state.get('analysis_cache', {}).pop(thread_id, None)

def add_thread(thread_id: str):
    if thread_id not in st.session_state['chat_threads']:
        st.session_state['chat_threads'].append(thread_id)

def load_conversation(thread_id):
    try:
        state = chatbot.get_state(config={'configurable': {'thread_id': thread_id}})
        return state.values.get('messages', [])
    except Exception:
        return []

# ---------------- Session init ----------------
if 'message_history' not in st.session_state:
    st.session_state['message_history'] = []

if 'thread_id' not in st.session_state:
    st.session_state['thread_id'] = generate_thread_id()

if 'chat_threads' not in st.session_state:
    st.session_state['chat_threads'] = []

if 'authenticated' not in st.session_state:
    st.session_state['authenticated'] = False

# analysis cache: store quick analysis per thread
if 'analysis_cache' not in st.session_state:
    st.session_state['analysis_cache'] = {}

add_thread(st.session_state['thread_id'])

# ----------------- LOGIN GATE (show this first) -----------------
if not st.session_state.get('authenticated'):
    st.title("Welcome — Please identify yourself")
    st.write(
        "Enter a username to continue. "
        "This will create a user id for this session and then you'll see your conversations."
    )
    with st.form("main_login_form"):
        username_main = st.text_input("Username (leave blank for random anonymous id)", value="")
        submitted = st.form_submit_button("Continue")
    if submitted:
        uname = username_main.strip()
        if uname == "":
            new_user_id = str(uuid.uuid4())
            st.session_state['user_id'] = new_user_id
            st.session_state['username'] = f"user_{new_user_id[:8]}"
        else:
            new_user_id = uname
            st.session_state['user_id'] = new_user_id
            st.session_state['username'] = uname
        try:
            create_user_if_not_exists(st.session_state['user_id'], st.session_state.get('username'))
        except Exception:
            pass
        try:
            st.session_state['chat_threads'] = retrieve_all_threads(user_id=st.session_state['user_id'])
        except Exception:
            st.session_state['chat_threads'] = []
        st.session_state['authenticated'] = True
        safe_rerun()
    else:
        st.stop()

# ---------------- Sidebar login controls ----------------
st.sidebar.title('RAG Chatbot')
st.sidebar.subheader("Login / User")
if 'user_id' not in st.session_state:
    st.session_state['user_id'] = None
if 'username' not in st.session_state:
    st.session_state['username'] = None

username_input = st.sidebar.text_input("Username (any name)", value=st.session_state.get('username') or "")
if st.sidebar.button("Login"):
    uname = username_input.strip()
    if uname == "":
        new_user_id = str(uuid.uuid4())
        st.session_state['user_id'] = new_user_id
        st.session_state['username'] = f"user_{new_user_id[:8]}"
    else:
        new_user_id = uname
        st.session_state['user_id'] = new_user_id
        st.session_state['username'] = uname
    try:
        create_user_if_not_exists(st.session_state['user_id'], st.session_state.get('username'))
    except Exception:
        pass
    try:
        st.session_state['chat_threads'] = retrieve_all_threads(user_id=st.session_state['user_id'])
    except Exception:
        pass
    st.session_state['authenticated'] = True
    st.sidebar.success(f"Logged in as: {st.session_state['username']}")

if st.session_state.get('user_id'):
    st.sidebar.markdown(f"**Signed in:** {st.session_state.get('username')}  \n(user_id: `{st.session_state.get('user_id')}`)")
    if st.sidebar.button("Logout"):
        st.session_state['user_id'] = None
        st.session_state['username'] = None
        st.session_state['chat_threads'] = []
        st.session_state['authenticated'] = False
        safe_rerun()

st.sidebar.markdown("---")
st.sidebar.subheader("Thread controls")
if st.session_state.get('user_id') and st.sidebar.button('New Chat'):
    reset_chat()

st.sidebar.header('My Conversations')
try:
    if st.session_state.get('user_id'):
        threads_to_show = retrieve_all_threads(user_id=st.session_state['user_id'])
    else:
        threads_to_show = []
except Exception:
    threads_to_show = st.session_state['chat_threads']

for tid in list(dict.fromkeys([*threads_to_show, *st.session_state['chat_threads']]))[::-1]:
    if st.sidebar.button(str(tid)):
        st.session_state['thread_id'] = tid
        msgs = load_conversation(tid)
        converted = []
        for m in msgs:
            try:
                cls_name = m.__class__.__name__
                role = 'user' if cls_name == 'HumanMessage' else 'assistant'
                converted.append({'role': role, 'content': m.content})
            except Exception:
                pass
        if converted:
            st.session_state['message_history'] = converted

# Show Vision availability in sidebar with guidance
with st.sidebar.expander("Retrieval & OCR configuration", expanded=True):
    st.write(f"ANN_TOP_K: **{ANN_TOP_K}**")
    st.write(f"FINAL_TOP_K: **{FINAL_TOP_K}**")
    st.write(f"CROSS_ENCODER_MODEL: **{CROSS_ENCODER_MODEL or '(not set)'}**")
    if RERANKER_AVAILABLE:
        st.success("Reranker: available")
    else:
        st.warning("Reranker: not available (falling back to ANN-only)")
    st.markdown("---")
    if VISION_AVAILABLE:
        st.success("Google Vision: available")
        st.caption("Images and scanned PDFs will be OCR'd using Google Vision (document_text_detection).")
    else:
        st.error("Google Vision: not available")
        st.markdown(
            "If you want OCR (images / scanned PDFs / handwriting) via Google Vision, set "
            "`GOOGLE_APPLICATION_CREDENTIALS` in your `.env` to the absolute path of your service-account JSON "
            "and ensure `google-cloud-vision` is installed and the Vision API is enabled."
        )

# ---------------- Main UI ----------------
st.title("Chat (RAG per-user-per-chat)")

for message in st.session_state['message_history']:
    with st.chat_message(message['role']):
        st.write(message['content'])

current_thread = str(st.session_state['thread_id'])
current_user = st.session_state.get('user_id')

# File uploader + immediate ingest + quick analyze
st.markdown("---")
st.markdown("**Upload a file for this user & this thread (one file only).**")
if thread_has_ingested_file(current_thread, user_id=current_user):
    try:
        base = Path(__file__).parent / "vectors" / (current_user or "anonymous") / current_thread
        record = base / "ingested_file.json"
        if record.exists():
            rec = json.loads(record.read_text(encoding='utf-8'))
            fname = rec.get("file_name", "attached file")
            owner = rec.get("user_id")
            owner_text = f" (owner: {owner})" if owner else ""
            st.info(f"Chat already has uploaded file: **{fname}**{owner_text}\n\nAdditional uploads are disabled.")
        else:
            st.info("Chat already has an uploaded file. Additional uploads disabled.")
    except Exception:
        st.info("Chat already has an uploaded file. Additional uploads disabled.")
    uploaded_file = None
else:
    # allow image types + .doc/.docx + pdf/txt/md
    uploaded_file = st.file_uploader(
        "Upload a document for this chat",
        type=["pdf", "txt", "md", "docx", "doc", "png", "jpg", "jpeg", "tiff", "bmp"]
    )

# keep save_path in scope if uploaded this run
save_path = None
if uploaded_file is not None:
    save_name = f"{current_thread}_{uploaded_file.name}"
    save_path = UPLOAD_DIR / save_name
    with open(save_path, "wb") as f:
        f.write(uploaded_file.getbuffer())

    # attach thread to user if logged-in
    if current_user:
        try:
            associate_thread_with_user(current_user, current_thread)
        except Exception:
            pass

    # call backend ingest (pass user_id)
    try:
        result = ingest_file(str(save_path), file_name=uploaded_file.name, thread_id=current_thread, user_id=current_user)
    except TypeError:
        result = ingest_file(str(save_path), file_name=uploaded_file.name, thread_id=current_thread)

    # If ingestion succeeded
    if result.get("success"):
        # show extracted source if available
        src = result.get("source")
        if src:
            st.success(f"{result.get('message')}  (extracted_from: {src})")
        else:
            st.success(result.get("message"))

        add_thread(current_thread)
        try:
            if current_user:
                st.session_state['chat_threads'] = retrieve_all_threads(user_id=current_user)
            else:
                st.session_state['chat_threads'] = []
        except Exception:
            pass

        # *** QUICK ANALYZE AUTOMATICALLY AFTER INGEST ***
        with st.spinner("Analyzing document (quick)..."):
            try:
                quick = quick_analyze(str(save_path), current_user, current_thread)
                st.session_state['analysis_cache'][current_thread] = {"quick": quick}
            except Exception as e:
                st.session_state['analysis_cache'][current_thread] = {"quick": {"success": False, "message": str(e)}}

        # show quick analysis
        quick = st.session_state['analysis_cache'][current_thread].get("quick", {})
        if quick.get("success"):
            st.subheader("Quick summary")
            st.write(quick.get("summary"))
            if quick.get("legal_like"):
                st.warning("This document appears to be legal in nature.")
            with st.expander("Sample snippets"):
                sp = quick.get("sample_snippets", {})
                for k, v in sp.items():
                    st.markdown(f"**{k.capitalize()}**")
                    st.code(v[:1000])
            # show keywords
            kw = quick.get("keywords", [])
            if kw:
                st.subheader("Keywords (common words)")
                st.write(", ".join(kw[:30]))
        else:
            st.error("Quick analysis failed: " + str(quick.get("message")))
            # if quick analysis provides diagnostics, show them
            if isinstance(quick.get("diagnostics"), dict):
                with st.expander("Quick analysis diagnostics (extraction)"):
                    st.json(quick.get("diagnostics"))

    else:
        # Ingestion failed: show message and diagnostics (if present)
        st.error(result.get("message") or "Ingestion failed.")
        diag = result.get("diagnostics")
        source = result.get("source")
        if source:
            st.info(f"Attempted extraction source: {source}")
        if isinstance(diag, dict):
            with st.expander("Extraction diagnostics (click to expand)"):
                # pretty-print diagnostics for visibility
                st.json(diag)
        # helpful troubleshooting hints
        st.markdown(
            "Troubleshooting tips:\n"
            "- If uploading images / scanned PDFs / handwriting, make sure Google Vision is enabled and `GOOGLE_APPLICATION_CREDENTIALS` points to a valid service-account JSON in your `.env`.\n"
            "- Check Streamlit logs for warnings printed by the backend.\n"
            "- Try converting PDFs to images (300 DPI) to improve OCR results."
        )

st.markdown("---")

# Message input & send (always present)
st.markdown("You can now chat with the assistant about the uploaded document or anything else.")
st.markdown("Messages are tagged with your user and thread ID so the assistant can use the uploaded document when relevant.")

st.markdown("---")
user_input = st.chat_input("Type your message here...")

if user_input:
    st.session_state['message_history'].append({'role': 'user', 'content': user_input})
    with st.chat_message('user'):
        st.write(user_input)

    # Tag message with both USER_ID and THREAD_ID
    uid_tag = current_user or "anonymous"
    tagged_content = f"[USER_ID:{uid_tag}][THREAD_ID:{current_thread}]\n{user_input}"
    human_msg = HumanMessage(content=tagged_content)

    with st.chat_message('assistant'):
        assistant_text = ""
        try:
            for chunk, meta in chatbot.stream({'messages': [human_msg]}, config={'configurable': {'thread_id': current_thread}}, stream_mode='messages'):
                try:
                    content = getattr(chunk, 'content', str(chunk))
                except Exception:
                    content = str(chunk)
                assistant_text += content
                st.write(content)
            st.session_state['message_history'].append({'role': 'assistant', 'content': assistant_text})
        except TypeError:
            try:
                resp = chatbot.invoke({'messages': [human_msg]}, config={'configurable': {'thread_id': current_thread}})
                content = getattr(resp, 'content', str(resp))
                st.write(content)
                st.session_state['message_history'].append({'role': 'assistant', 'content': content})
            except Exception as e:
                st.write("Error calling chatbot:", e)
