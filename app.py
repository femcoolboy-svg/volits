from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
import sqlite3
import hashlib
import os
import random
import string
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
socketio = SocketIO(app, cors_allowed_origins="*")

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'index'

# Database setup
def init_db():
    conn = sqlite3.connect('volits.db')
    c = conn.cursor()
    
    # Users table
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT UNIQUE NOT NULL,
                  password TEXT NOT NULL,
                  status TEXT DEFAULT 'online',
                  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    # Messages table
    c.execute('''CREATE TABLE IF NOT EXISTS messages
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  from_user TEXT NOT NULL,
                  to_user TEXT NOT NULL,
                  message TEXT NOT NULL,
                  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    # Check if bot exists
    c.execute("SELECT * FROM users WHERE username = 'VOlits Assistant'")
    if not c.fetchone():
        c.execute("INSERT INTO users (username, password, status) VALUES (?, ?, ?)",
                  ('VOlits Assistant', hashlib.sha256('botpass123'.encode()).hexdigest(), 'online'))
    
    conn.commit()
    conn.close()

init_db()

class User(UserMixin):
    def __init__(self, id, username, status):
        self.id = id
        self.username = username
        self.status = status

@login_manager.user_loader
def load_user(user_id):
    conn = sqlite3.connect('volits.db')
    c = conn.cursor()
    c.execute("SELECT id, username, status FROM users WHERE id = ?", (user_id,))
    user = c.fetchone()
    conn.close()
    if user:
        return User(user[0], user[1], user[2])
    return None

def generate_captcha():
    captcha = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    session['captcha'] = captcha
    return captcha

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('chat'))
    return render_template('index.html')

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    captcha_input = data.get('captcha')
    
    if not username or not password:
        return jsonify({'success': False, 'message': 'Заполните все поля'})
    
    if captcha_input != session.get('captcha'):
        return jsonify({'success': False, 'message': 'Неверная капча'})
    
    conn = sqlite3.connect('volits.db')
    c = conn.cursor()
    
    try:
        hashed_password = hash_password(password)
        c.execute("INSERT INTO users (username, password) VALUES (?, ?)", 
                 (username, hashed_password))
        user_id = c.lastrowid
        
        # Send welcome message from bot
        welcome_msg = "Привет! Я VOlits Assistant. Чем могу помочь? 😊"
        c.execute("INSERT INTO messages (from_user, to_user, message) VALUES (?, ?, ?)",
                 ('VOlits Assistant', username, welcome_msg))
        
        conn.commit()
        
        user = User(user_id, username, 'online')
        login_user(user, remember=False)
        
        return jsonify({'success': True, 'message': 'Регистрация успешна!'})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': 'Пользователь уже существует'})
    finally:
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    captcha_input = data.get('captcha')
    remember = data.get('remember', False)
    
    if not username or not password:
        return jsonify({'success': False, 'message': 'Заполните все поля'})
    
    if captcha_input != session.get('captcha'):
        return jsonify({'success': False, 'message': 'Неверная капча'})
    
    conn = sqlite3.connect('volits.db')
    c = conn.cursor()
    
    hashed_password = hash_password(password)
    c.execute("SELECT id, username, status FROM users WHERE username = ? AND password = ?",
             (username, hashed_password))
    user = c.fetchone()
    
    if user:
        login_user(User(user[0], user[1], user[2]), remember=remember)
        c.execute("UPDATE users SET status = 'online', last_seen = CURRENT_TIMESTAMP WHERE id = ?", (user[0],))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Вход выполнен!'})
    
    conn.close()
    return jsonify({'success': False, 'message': 'Неверный логин или пароль'})

@app.route('/logout')
@login_required
def logout():
    conn = sqlite3.connect('volits.db')
    c = conn.cursor()
    c.execute("UPDATE users SET status = 'offline', last_seen = CURRENT_TIMESTAMP WHERE id = ?", 
             (current_user.id,))
    conn.commit()
    conn.close()
    logout_user()
    return redirect(url_for('index'))

@app.route('/chat')
@login_required
def chat():
    return render_template('chat.html', username=current_user.username, user_id=current_user.id)

@app.route('/api/users')
@login_required
def get_users():
    conn = sqlite3.connect('volits.db')
    c = conn.cursor()
    c.execute("SELECT username, status FROM users WHERE username != ?", (current_user.username,))
    users = [{'username': row[0], 'status': row[1]} for row in c.fetchall()]
    conn.close()
    return jsonify(users)

@app.route('/api/messages/<recipient>')
@login_required
def get_messages(recipient):
    conn = sqlite3.connect('volits.db')
    c = conn.cursor()
    c.execute("""SELECT from_user, message, timestamp 
                 FROM messages 
                 WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
                 ORDER BY timestamp ASC""",
              (current_user.username, recipient, recipient, current_user.username))
    messages = [{'from': row[0], 'text': row[1], 'time': row[2]} for row in c.fetchall()]
    conn.close()
    return jsonify(messages)

@app.route('/api/update_status', methods=['POST'])
@login_required
def update_status():
    data = request.json
    new_status = data.get('status')
    
    conn = sqlite3.connect('volits.db')
    c = conn.cursor()
    c.execute("UPDATE users SET status = ? WHERE id = ?", (new_status, current_user.id))
    conn.commit()
    conn.close()
    
    socketio.emit('status_update', {'user': current_user.username, 'status': new_status}, broadcast=True)
    return jsonify({'success': True})

@socketio.on('send_message')
def handle_send_message(data):
    recipient = data['recipient']
    message = data['message']
    
    conn = sqlite3.connect('volits.db')
    c = conn.cursor()
    c.execute("INSERT INTO messages (from_user, to_user, message) VALUES (?, ?, ?)",
             (current_user.username, recipient, message))
    conn.commit()
    conn.close()
    
    # Check if bot response needed
    if recipient == current_user.username:
        if any(word in message.lower() for word in ['привет', 'hi', 'hello', 'здравствуй']):
            bot_response = "Привет! Рад видеть тебя в VOlits! 🌟"
        elif 'как дела' in message.lower():
            bot_response = "У меня всё отлично! А как твои дела? 😊"
        elif 'помощь' in message.lower():
            bot_response = "Я могу ответить на простые вопросы или просто поболтать с тобой!"
        else:
            bot_response = "Интересно! Расскажи подробнее? 🤔"
        
        socketio.emit('new_message', {
            'from': current_user.username,
            'to': recipient,
            'message': message,
            'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }, room=current_user.username)
        
        socketio.sleep(0.5)
        socketio.emit('new_message', {
            'from': 'VOlits Assistant',
            'to': current_user.username,
            'message': bot_response,
            'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }, room=current_user.username)
    else:
        socketio.emit('new_message', {
            'from': current_user.username,
            'to': recipient,
            'message': message,
            'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }, room=recipient)

@socketio.on('join')
def handle_join():
    join_room(current_user.username)

@socketio.on('disconnect')
def handle_disconnect():
    if current_user.is_authenticated:
        conn = sqlite3.connect('volits.db')
        c = conn.cursor()
        c.execute("UPDATE users SET status = 'offline', last_seen = CURRENT_TIMESTAMP WHERE id = ?",
                 (current_user.id,))
        conn.commit()
        conn.close()
        socketio.emit('status_update', {'user': current_user.username, 'status': 'offline'}, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)
