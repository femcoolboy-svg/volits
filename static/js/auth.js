// Generate captcha on page load
function generateCaptcha() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let captcha = '';
    for (let i = 0; i < 6; i++) {
        captcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return captcha;
}

// Update captcha displays
function updateCaptchas() {
    const captcha = generateCaptcha();
    localStorage.setItem('currentCaptcha', captcha);
    document.getElementById('login-captcha-display').textContent = captcha;
    document.getElementById('reg-captcha-display').textContent = captcha;
}

// Toggle between login and register forms
document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const formType = btn.dataset.form;
        
        // Update active button
        document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active form
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        document.getElementById(`${formType}-form`).classList.add('active');
        
        updateCaptchas();
    });
});

// Handle login form submission
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const captcha = document.getElementById('login-captcha').value;
    const remember = document.getElementById('remember-me').checked;
    
    if (!username || !password || !captcha) {
        alert('Заполните все поля');
        return;
    }
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, captcha, remember })
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.location.href = '/chat';
        } else {
            alert(data.message);
            updateCaptchas();
            document.getElementById('login-captcha').value = '';
        }
    } catch (error) {
        alert('Ошибка соединения');
    }
});

// Handle register form submission
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const captcha = document.getElementById('reg-captcha').value;
    
    if (!username || !password || !captcha) {
        alert('Заполните все поля');
        return;
    }
    
    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, captcha })
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.location.href = '/chat';
        } else {
            alert(data.message);
            updateCaptchas();
            document.getElementById('reg-captcha').value = '';
        }
    } catch (error) {
        alert('Ошибка соединения');
    }
});

// Initial captcha generation
updateCaptchas();

// Animated background particles
function createParticles() {
    const particlesContainer = document.querySelector('.particles-bg');
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = '2px';
        particle.style.height = '2px';
        particle.style.background = 'rgba(139, 92, 246, 0.5)';
        particle.style.borderRadius = '50%';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animation = `float ${5 + Math.random() * 10}s linear infinite`;
        particlesContainer.appendChild(particle);
    }
}

// Add floating animation style
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
        }
        50% {
            opacity: 1;
        }
        100% {
            transform: translateY(-100vh) translateX(${Math.random() * 100 - 50}px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

createParticles();
