// AI Academic Chatbot Controller
let studentId = 1;

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth();
  if (!user) return;
  initLayout();

  studentId = user.studentId || 1;

  if (user.role === 'admin' || user.role === 'faculty') {
    document.getElementById('sidebar-role-badge').textContent = 'ADMIN CONSOLE';
  }

  await loadChatHistory();

  // Bind Form Submit
  const form = document.getElementById('chat-input-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-user-input');
    const msg = input.value.trim();
    if (!msg) return;

    input.value = '';
    await sendMessage(msg);
  });
});

async function loadChatHistory() {
  const box = document.getElementById('chat-messages-box');
  try {
    const res = await apiCall(`/chatbot/history/${studentId}`);
    if (res.success && res.data.length > 0) {
      box.innerHTML = '';
      res.data.forEach(item => {
        appendMessageBubble(item.sender, item.message);
      });
      scrollToBottom();
    } else {
      // Welcome bubble
      box.innerHTML = '';
      appendMessageBubble('bot', `Hello! I am your AI Academic Assistant 🤖. I have real-time access to your semester marks, subject attendance compliance, institutional fee status, faculty mentor details, and verified achievements.\n\nClick any of the suggested prompt chips below or type a custom question to get started!`);
      scrollToBottom();
    }
  } catch (err) {
    console.error('[Chat History Error]', err);
    appendMessageBubble('bot', 'Hello! How can I assist you with your academic performance today?');
  }
}

function sendPrompt(promptText) {
  const input = document.getElementById('chat-user-input');
  input.value = promptText;
  sendMessage(promptText);
  input.value = '';
}

async function sendMessage(text) {
  appendMessageBubble('user', text);
  scrollToBottom();

  const typing = document.getElementById('typing-indicator');
  const btnSend = document.getElementById('btn-chat-send');
  
  typing.style.display = 'block';
  btnSend.disabled = true;

  try {
    const res = await apiCall('/chatbot/message', 'POST', {
      student_id: studentId,
      message: text
    });

    if (res.success) {
      setTimeout(() => {
        typing.style.display = 'none';
        btnSend.disabled = false;
        appendMessageBubble('bot', res.reply);
        scrollToBottom();
      }, 400);
    }
  } catch (err) {
    typing.style.display = 'none';
    btnSend.disabled = false;
    appendMessageBubble('bot', 'I encountered an issue retrieving your academic records. Please try asking again.');
    scrollToBottom();
  }
}

function appendMessageBubble(sender, content) {
  const box = document.getElementById('chat-messages-box');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;

  // Format bold markdown (**text**) and bullet points
  let formatted = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');

  bubble.innerHTML = formatted;
  box.appendChild(bubble);
}

function scrollToBottom() {
  const box = document.getElementById('chat-messages-box');
  box.scrollTop = box.scrollHeight;
}

async function clearChat() {
  if (confirm('Clear all conversation history?')) {
    try {
      const res = await apiCall(`/chatbot/history/${studentId}`, 'DELETE');
      if (res.success) {
        showToast('Chat history cleared.', 'info');
        const box = document.getElementById('chat-messages-box');
        box.innerHTML = '';
        appendMessageBubble('bot', 'Chat history has been cleared. How can I help you today?');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}
