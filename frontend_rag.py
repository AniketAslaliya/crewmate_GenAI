# frontend_database.py
import streamlit as st
import uuid
import json
from pathlib import Path
from langchain_core.messages import HumanMessage
from backend_rag import (
    chatbot,
    ingest_file,
    thread_has_ingested_file,
    retrieve_all_threads,
    associate_thread_with_user,
    create_user_if_not_exists,
    get_user_for_thread,
)

# Upload directory (local)
UPLOAD_DIR = Path("/tmp/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

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

def add_thread(thread_id: str):
    if thread_id not in st.session_state['chat_threads']:
        st.session_state['chat_threads'].append(thread_id)

def load_conversation(thread_id):
    try:
        state = chatbot.get_state(config={'configurable': {'thread_id': thread_id}})
        return state.values.get('messages', [])
    except Exception:
        return []

# Session init
if 'message_history' not in st.session_state:
    st.session_state['message_history'] = []

if 'thread_id' not in st.session_state:
    st.session_state['thread_id'] = generate_thread_id()

if 'chat_threads' not in st.session_state:
    try:
        if st.session_state.get('user_id'):
            st.session_state['chat_threads'] = retrieve_all_threads(user_id=st.session_state['user_id'])
        else:
            st.session_state['chat_threads'] = retrieve_all_threads()
    except Exception:
        st.session_state['chat_threads'] = []
add_thread(st.session_state['thread_id'])

# Sidebar login controls
st.sidebar.title('RAG Chatbot')
st.sidebar.subheader("Login / User")
if 'user_id' not in st.session_state:
    st.session_state['user_id'] = None
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
    st.sidebar.success(f"Logged in as: {st.session_state['username']}")

if st.session_state.get('user_id'):
    st.sidebar.markdown(f"**Signed in:** {st.session_state.get('username')}  \n(user_id: `{st.session_state.get('user_id')}`)")
    if st.sidebar.button("Logout"):
        st.session_state['user_id'] = None
        st.session_state['username'] = None
        try:
            st.session_state['chat_threads'] = retrieve_all_threads()
        except Exception:
            pass

st.sidebar.markdown("---")
st.sidebar.subheader("Thread controls")
if st.sidebar.button('New Chat'):
    reset_chat()

st.sidebar.header('My Conversations')
try:
    if st.session_state.get('user_id'):
        threads_to_show = retrieve_all_threads(user_id=st.session_state['user_id'])
    else:
        threads_to_show = retrieve_all_threads()
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

# Main UI
st.title("Chat (RAG per-user-per-chat)")

for message in st.session_state['message_history']:
    with st.chat_message(message['role']):
        st.write(message['content'])

current_thread = str(st.session_state['thread_id'])
current_user = st.session_state.get('user_id')

# File uploader
st.markdown("---")
st.markdown("**Upload a file for this user & this thread (one file only).**")
# Check per-user-per-chat
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
    uploaded_file = st.file_uploader("Upload a document for this chat", type=["pdf", "txt", "md", "docx"])

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

    if result.get("success"):
        st.success(result.get("message"))
        add_thread(current_thread)
        try:
            if current_user:
                st.session_state['chat_threads'] = retrieve_all_threads(user_id=current_user)
            else:
                st.session_state['chat_threads'] = retrieve_all_threads()
        except Exception:
            pass
    else:
        st.error(result.get("message"))

st.markdown("---")

# Message input & send
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
