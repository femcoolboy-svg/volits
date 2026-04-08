let socket;
let currentRecipient = null;
let users = [];

// Initialize socket connection
socket = io();

socket.on('connect', () => {
    console.log('Connected to server');
    socket.emit('join');
    loadUsers();
});

socket.on('new_message', (data) => {
    if ((data.from === currentRecipient || data.to === currentRecipient) || 
        (data.from === currentUser && data.to === currentRecipient)) {
        displayMessage(data.from, data.text, data.time);
    }
    
    // Update last message in sidebar
    updateLastMessage(data.from, data.text);
});

socket.on('status_update', (data) => {
    updateUserStatus(data.user, data.status);
    if (currentRecipient === data.user) {
        updateChatStatus(data.status);
    }
});

// Load users list
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        users = await response.json();
        displayUsers(users);
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function displayUsers(usersList) {
    const usersContainer = document.getElementById('usersList');
    usersContainer.innerHTML = '';
    
    usersList.forEach(user => {
        const userElement = createUserElement(user);
        usersContainer.appendChild(userElement);
    });
}

function createUserElement(user) {
    const div = document.createElement('div');
    div.className = 'user-item';
    div.dataset.username = user.username;
    div.onclick = () => selectUser(user.username);
    
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.textContent = user.username[0].toUpperCase();
    
    const info = document.createElement('div');
    info.className = 'user-info-text';
    
    const name = document.createElement('div');
    name.className = 'user-name';
    name.textContent = user.username;
    
    const status = document.createElement('div');
    status.className = 'user-status-text';
    status.innerHTML = getStatusIcon(user.status);
    
    info.appendChild(name);
    info.appendChild(status);
    div.appendChild(avatar);
    div.appendChild(info);
    
    return div;
}

function getStatusIcon(status) {
    const icons = {
        'online': '🟢 Онлайн',
        'away': '🌙 Не активен',
        'busy': '🔴 Занят',
        'offline': '⚫ Офлайн'
    };
    return icons[status] || '⚫ Офлайн';
}

function updateUserStatus(username, status) {
    const userItem = document.querySelector(`.user-item[data-username="${username}"]`);
    if (userItem) {
        const statusElement = userItem.querySelector('.user-status-text');
        if (statusElement) {
            statusElement.innerHTML = getStatusIcon(status);
        }
    }
}

async function selectUser(username) {
    currentRecipient = username;
    
    // Update active state
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.username === username) {
            item.classList.add('active');
        }
    });
    
    // Update chat header
    document.getElementById('chatUsername').textContent = username;
    document.getElementById('chat-avatar').textContent = username[0].toUpperCase();
    document.getElementById('messageInput').disabled = false;
    document.getElementById('sendBtn').disabled = false;
    
    // Load messages
    await loadMessages(username);
    
    // Update status
    const user = users.find(u => u.username === username);
    if (user) {
        updateChatStatus(user.status);
    }
}

function updateChatStatus(status) {
    const statusElement = document.getElementById('chatStatus');
    statusElement.textContent = getStatusIcon(status);
}

async function loadMessages(recipient) {
    try {
        const response = await fetch(`/api/messages/${recipient}`);
        const messages = await response.json();
        
        const messagesArea = document.getElementById('messagesArea');
        messagesArea.innerHTML = '';
        
        messages.forEach(msg => {
            displayMessage(msg.from, msg.text, msg.time);
        });
        
        scrollToBottom();
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function displayMessage(sender, text, time) {
    const messagesArea = document.getElementById('messagesArea');
    
    // Remove welcome message if present
    if (messagesArea.querySelector('.welcome-message')) {
        messagesArea.innerHTML = '';
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-bubble ${sender === currentUser ? 'message-sent' : 'message-received'}`;
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = text;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date(time).toLocaleTimeString();
    
    messageDiv.appendChild(textDiv);
    messageDiv.appendChild(timeDiv);
    messagesArea.appendChild(messageDiv);
    
    scrollToBottom();
}

function updateLastMessage(sender, text) {
    // Update last message in sidebar if needed
    const userItem = document.querySelector(`.user-item[data-username="${sender}"]`);
    if (userItem && sender !== currentUser) {
        // You can add last message display here if desired
    }
}

function scrollToBottom() {
    const messagesArea = document.getElementById('messagesArea');
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// Send message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message || !currentRecipient) return;
    
    socket.emit('send_message', {
        recipient: currentRecipient,
        message: message
    });
    
    input.value = '';
}

// Search users
document.getElementById('searchUsers').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredUsers = users.filter(user => 
        user.username.toLowerCase().includes(searchTerm)
    );
    displayUsers(filteredUsers);
});

// Send on Enter
document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

document.getElementById('sendBtn').addEventListener('click', sendMessage);

// Profile panel
document.getElementById('current-avatar').addEventListener('click', () => {
    document.getElementById('profilePanel').classList.add('active');
});

document.getElementById('closeProfile').addEventListener('click', () => {
    document.getElementById('profilePanel').classList.remove('active');
});

// Status update
document.getElementById('statusSelect').addEventListener('change', async (e) => {
    const newStatus = e.target.value;
    
    try {
        await fetch('/api/update_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        // Update local display
        const statusText = document.getElementById('user-status');
        const statusIcons = {
            'online': '🟢 Онлайн',
            'away': '🌙 Не активен',
            'busy': '🔴 Занят'
        };
        statusText.textContent = statusIcons[newStatus];
    } catch (error) {
        console.error('Error updating status:', error);
    }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    window.location.href = '/logout';
});

// Mobile menu
document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.getElementById('menuBtn');
    
    if (window.innerWidth <= 768 && 
        sidebar.classList.contains('active') &&
        !sidebar.contains(e.target) &&
        !menuBtn.contains(e.target)) {
        sidebar.classList.remove('active');
    }
});

// Initial load
loadUsers();
