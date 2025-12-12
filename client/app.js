class CKAMMessenger {
    constructor() {
        // Автоматическое определение URL сервера
        this.serverUrl = window.location.origin;
        
        // Проверяем доступность API
        this.checkApiHealth();
    }
    
    async checkApiHealth() {
        try {
            const response = await fetch(`${this.serverUrl}/api/health`);
            const data = await response.json();
            console.log('✅ API доступен:', data);
        } catch (error) {
            console.warn('⚠️ API недоступен, используется fallback');
            this.serverUrl = window.location.origin;
        }
    }

    async init() {
        console.log('🚀 Инициализация CKAM Messenger...');
        
        // Проверяем, на какой странице находимся
        this.checkAuth();
        
        // Для страницы чата загружаем данные
        if (window.location.pathname.includes('chat.html')) {
            await this.loadUsers();
            this.loadCurrentUser();
            this.applySavedTheme();
            this.loadChatsFromStorage();
            this.renderChatsList();
            this.activateChatInterface();
        }
        
        // Для страниц авторизации просто загружаем пользователя
        if (window.location.pathname.includes('login.html') || 
            window.location.pathname.includes('register.html') ||
            window.location.pathname.includes('index.html')) {
            this.loadCurrentUser();
            this.applySavedTheme();
        }
        
        this.bindEvents();
        console.log('✅ CKAM Messenger инициализирован');
    }

    bindEvents() {
        console.log('🔗 Привязка событий...');
        
        // Форма входа
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin(e);
            });
        }

        // Форма регистрации
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister(e);
            });
        }

        // Форма настроек
        const settingsForm = document.getElementById('settingsForm');
        if (settingsForm) {
            settingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSettingsSave(e);
            });
        }

        // Используем делегирование событий для динамических элементов
        document.addEventListener('click', (e) => {
            // Кнопка нового чата
            if (e.target.closest('#newChatBtn')) {
                e.preventDefault();
                this.openNewChatModal();
            }
            
            // Кнопка поиска
            if (e.target.closest('#searchBtn')) {
                e.preventDefault();
                this.openNewChatModal();
            }
            
            // Кнопка настроек
            if (e.target.closest('#settingsBtn')) {
                e.preventDefault();
                this.openSettings();
            }
            
            // Кнопка выхода
            if (e.target.closest('#logoutBtn')) {
                e.preventDefault();
                this.logout();
            }
            
            // Закрытие модальных окон
            if (e.target.classList.contains('close-modal')) {
                e.preventDefault();
                this.closeAllModals();
            }
            
            // Фон модального окна
            if (e.target.classList.contains('modal')) {
                e.preventDefault();
                this.closeAllModals();
            }
            
            // Отправка сообщения
            if (e.target.closest('#sendBtn')) {
                e.preventDefault();
                this.sendMessage();
            }
            
            // Начало первого чата
            if (e.target.closest('#startFirstChat')) {
                e.preventDefault();
                this.openNewChatModal();
            }
            
            // Смена аватарки
            if (e.target.closest('#changeAvatarBtn')) {
                e.preventDefault();
                document.getElementById('avatarUpload').click();
            }
            
            // Выбор темы
            if (e.target.closest('.theme-color')) {
                e.preventDefault();
                const themeColor = e.target.closest('.theme-color');
                if (themeColor) {
                    this.changeTheme(themeColor.dataset.theme);
                }
            }
            
            // Выбор пользователя из результатов поиска
            if (e.target.closest('.search-result-item')) {
                e.preventDefault();
                const userItem = e.target.closest('.search-result-item');
                const username = userItem.dataset.username;
                if (username) {
                    this.startChatWithUser(username);
                }
            }
            
            // Выбор существующего чата
            if (e.target.closest('.chat-item')) {
                e.preventDefault();
                const chatItem = e.target.closest('.chat-item');
                const chatId = chatItem.dataset.chatId;
                if (chatId) {
                    this.openChat(chatId);
                }
            }
        });

        // Ввод в поле поиска
        const searchInput = document.getElementById('searchUsersInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchUsers(e.target.value);
            });
        }

        // Ввод сообщения
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Загрузка аватарки
        const avatarUpload = document.getElementById('avatarUpload');
        if (avatarUpload) {
            avatarUpload.addEventListener('change', (e) => {
                this.handleAvatarUpload(e);
            });
        }
    }

    activateChatInterface() {
        console.log('💬 Активация интерфейса чата...');
        
        // Включаем все кнопки
        const buttons = ['newChatBtn', 'searchBtn', 'settingsBtn', 'logoutBtn', 'sendBtn', 'startFirstChat'];
        buttons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.style.display = 'flex';
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }
        });
        
        // Включаем поле ввода
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.placeholder = 'Введите сообщение...';
        }
    }

    async loadUsers() {
        try {
            const response = await fetch(`${this.serverUrl}/users`);
            this.users = await response.json();
            console.log(`👥 Загружено ${this.users.length} пользователей`);
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
            this.users = [];
        }
    }

    async handleLogin(e) {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showToast('Заполните все поля', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.serverUrl}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showToast('Вход выполнен успешно!', 'success');
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                
                // Загружаем всех пользователей после успешного входа
                await this.loadUsers();
                
                setTimeout(() => {
                    window.location.href = 'chat.html';
                }, 1000);
            } else {
                this.showToast(data.message || 'Неверные учетные данные', 'error');
            }
        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            this.showToast('Ошибка соединения с сервером', 'error');
        }
    }

    async handleRegister(e) {
        const displayName = document.getElementById('displayName').value.trim();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!displayName || !username || !password) {
            this.showToast('Заполните все поля', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showToast('Пароли не совпадают', 'error');
            return;
        }

        if (password.length < 6) {
            this.showToast('Пароль должен быть не менее 6 символов', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.serverUrl}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName, username, password })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showToast('Регистрация успешна! Теперь войдите в аккаунт.', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            } else {
                this.showToast(data.message || 'Ошибка регистрации', 'error');
            }
        } catch (error) {
            console.error('❌ Ошибка регистрации:', error);
            this.showToast('Ошибка соединения с сервером', 'error');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) {
            console.error('❌ Toast элемент не найден');
            return;
        }
        
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    checkAuth() {
        const currentUser = localStorage.getItem('currentUser');
        const currentPath = window.location.pathname;
        
        // Если пользователь авторизован и на главной/индексе - редирект в чат
        if (currentUser && (currentPath.includes('index.html') || currentPath === '/')) {
            window.location.href = 'chat.html';
        }
        
        // Если пользователь не авторизован и в чате - редирект на главную
        if (!currentUser && currentPath.includes('chat.html')) {
            window.location.href = 'index.html';
        }
    }

    loadCurrentUser() {
        const userData = localStorage.getItem('currentUser');
        if (userData) {
            try {
                this.currentUser = JSON.parse(userData);
                this.updateUserDisplay();
            } catch (error) {
                console.error('❌ Ошибка загрузки пользователя:', error);
                localStorage.removeItem('currentUser');
                window.location.href = 'index.html';
            }
        }
    }

    updateUserDisplay() {
        if (!this.currentUser) return;

        // Обновляем имя в боковой панели
        const userNameElements = document.querySelectorAll('#currentUserName');
        userNameElements.forEach(el => {
            el.textContent = this.currentUser.displayName || 'Пользователь';
        });

        // Обновляем юзернейм
        const usernameElements = document.querySelectorAll('#currentUsername');
        usernameElements.forEach(el => {
            el.textContent = `@${this.currentUser.username}`;
        });

        // Обновляем аватар
        const avatarElements = document.querySelectorAll('#userAvatar, #avatarPreview');
        avatarElements.forEach(avatar => {
            this.setAvatar(avatar, this.currentUser);
        });

        // Обновляем поля в настройках
        const displayNameInput = document.getElementById('settingsDisplayName');
        const usernameInput = document.getElementById('settingsUsername');
        
        if (displayNameInput) displayNameInput.value = this.currentUser.displayName || '';
        if (usernameInput) usernameInput.value = this.currentUser.username || '';
    }

    setAvatar(element, user) {
        if (!element) return;
        
        if (user.avatar) {
            element.innerHTML = `<img src="${user.avatar}" alt="${user.displayName}" style="width:100%;height:100%;object-fit:cover;">`;
        } else {
            const initials = (user.displayName || 'U').charAt(0).toUpperCase();
            element.innerHTML = `<span style="font-size:24px;font-weight:bold;">${initials}</span>`;
        }
    }

    applySavedTheme() {
        const savedTheme = localStorage.getItem('appTheme') || 'dark';
        document.body.setAttribute('data-theme', savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        // Обновляем активную тему в палитре
        document.querySelectorAll('.theme-color').forEach(color => {
            color.classList.remove('active');
            if (color.dataset.theme === savedTheme) {
                color.classList.add('active');
            }
        });
    }

    changeTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('appTheme', theme);
        
        document.querySelectorAll('.theme-color').forEach(color => {
            color.classList.remove('active');
            if (color.dataset.theme === theme) {
                color.classList.add('active');
            }
        });
        
        this.showToast(`Тема изменена на: ${theme}`, 'success');
    }

    loadChatsFromStorage() {
        const savedChats = localStorage.getItem('chats');
        if (savedChats) {
            try {
                this.chats = JSON.parse(savedChats);
            } catch (error) {
                console.error('❌ Ошибка загрузки чатов:', error);
                this.chats = {};
            }
        } else {
            this.chats = {};
        }
    }

    renderChatsList() {
        const chatsContainer = document.getElementById('chatsContainer');
        const noChats = document.getElementById('noChats');
        
        if (!chatsContainer) return;
        
        const chatIds = Object.keys(this.chats);
        
        if (chatIds.length === 0) {
            if (noChats) noChats.style.display = 'block';
            chatsContainer.innerHTML = '';
            return;
        }
        
        if (noChats) noChats.style.display = 'none';
        
        chatsContainer.innerHTML = chatIds.map(chatId => {
            const chat = this.chats[chatId];
            const lastMessage = chat.messages && chat.messages.length > 0 
                ? chat.messages[chat.messages.length - 1] 
                : null;
            
            // Находим информацию о пользователе
            const user = this.users.find(u => u.username === chatId) || 
                        { displayName: chat.username || chatId, username: chatId };
            
            return `
                <div class="chat-item" data-chat-id="${chatId}">
                    <div class="chat-avatar">
                        ${this.getAvatarHTML(user)}
                    </div>
                    <div class="chat-info">
                        <div class="chat-name">${user.displayName}</div>
                        <div class="chat-last-msg">${lastMessage?.text || 'Нет сообщений'}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    getAvatarHTML(user) {
        if (user.avatar) {
            return `<img src="${user.avatar}" alt="${user.displayName}">`;
        }
        const initials = (user.displayName || 'U').charAt(0).toUpperCase();
        return `<span>${initials}</span>`;
    }

    async searchUsers(query) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;
        
        if (!query.trim()) {
            resultsContainer.innerHTML = '';
            return;
        }

        const searchTerm = query.toLowerCase();
        
        // Фильтруем пользователей (кроме текущего)
        const results = this.users.filter(user => 
            user.username !== this.currentUser?.username &&
            (user.username.toLowerCase().includes(searchTerm) ||
             user.displayName.toLowerCase().includes(searchTerm))
        );

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">Пользователи не найдены</div>';
            return;
        }

        resultsContainer.innerHTML = results.map(user => `
            <div class="search-result-item" data-username="${user.username}">
                <div class="chat-avatar">
                    ${this.getAvatarHTML(user)}
                </div>
                <div class="chat-info">
                    <div class="chat-name">${user.displayName}</div>
                    <div class="chat-last-msg">@${user.username}</div>
                </div>
                <button class="btn btn-primary btn-small" onclick="messenger.startChatWithUser('${user.username}')">
                    Написать
                </button>
            </div>
        `).join('');
    }

    startChatWithUser(username) {
        const user = this.users.find(u => u.username === username);
        if (!user) {
            this.showToast('Пользователь не найден', 'error');
            return;
        }

        if (username === this.currentUser?.username) {
            this.showToast('Нельзя начать чат с самим собой', 'error');
            return;
        }

        if (!this.chats[username]) {
            this.chats[username] = {
                userId: user.id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                messages: [
                    {
                        id: 'welcome',
                        text: `Вы начали чат с ${user.displayName}`,
                        sender: 'system',
                        time: new Date().toISOString()
                    }
                ],
                createdAt: new Date().toISOString()
            };
            
            this.saveChatsToStorage();
        }

        this.openChat(username);
        this.closeAllModals();
        this.showToast(`Чат с ${user.displayName} начат`, 'success');
    }

    openChat(chatId) {
        this.currentChat = chatId;
        
        // Переключаем отображение
        const welcomeScreen = document.getElementById('welcomeScreen');
        const activeChat = document.getElementById('activeChat');
        
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        if (activeChat) activeChat.style.display = 'flex';
        
        // Обновляем заголовок чата
        const chat = this.chats[chatId];
        const user = this.users.find(u => u.username === chatId) || 
                    { displayName: chatId, username: chatId };
        
        const partnerName = document.getElementById('partnerName');
        const partnerStatus = document.getElementById('partnerStatus');
        const partnerAvatar = document.getElementById('partnerAvatar');
        
        if (partnerName) partnerName.textContent = user.displayName;
        if (partnerStatus) partnerStatus.textContent = 'онлайн';
        if (partnerAvatar) this.setAvatar(partnerAvatar, user);
        
        // Загружаем сообщения
        this.loadMessages(chatId);
        
        // Помечаем чат как активный
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.chatId === chatId) {
                item.classList.add('active');
            }
        });
        
        // Фокус на поле ввода
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.focus();
            messageInput.disabled = false;
        }
    }

    loadMessages(chatId) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const chat = this.chats[chatId];
        if (!chat || !chat.messages) {
            messagesContainer.innerHTML = '';
            return;
        }
        
        messagesContainer.innerHTML = chat.messages.map(msg => {
            const isCurrentUser = msg.sender === 'current';
            const isSystem = msg.sender === 'system';
            
            if (isSystem) {
                return `
                    <div class="system-message">
                        <div class="message-content">${msg.text}</div>
                    </div>
                `;
            }
            
            const time = new Date(msg.time);
            const timeStr = time.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            return `
                <div class="message ${isCurrentUser ? 'user-message' : 'other-message'}">
                    <div class="message-content">${msg.text}</div>
                    <div class="message-time">${timeStr}</div>
                </div>
            `;
        }).join('');
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    sendMessage() {
        const input = document.getElementById('messageInput');
        if (!input || !input.value.trim() || !this.currentChat) {
            return;
        }

        const messageText = input.value.trim();
        
        // Добавляем сообщение от текущего пользователя
        if (!this.chats[this.currentChat].messages) {
            this.chats[this.currentChat].messages = [];
        }
        
        const message = {
            id: Date.now().toString(),
            text: messageText,
            sender: 'current',
            time: new Date().toISOString()
        };
        
        this.chats[this.currentChat].messages.push(message);
        this.saveChatsToStorage();
        
        // Обновляем отображение
        this.loadMessages(this.currentChat);
        
        // Очищаем поле ввода
        input.value = '';
        
        // Обновляем список чатов
        this.renderChatsList();
        
        // Имитируем ответ через 1-3 секунды
        setTimeout(() => {
            this.simulateReply(this.currentChat);
        }, 1000 + Math.random() * 2000);
    }

    simulateReply(chatId) {
        const replies = [
            "Привет! Как дела?",
            "Здорово! Что нового?",
            "Спасибо, принял!",
            "Интересно, расскажи подробнее",
            "Отличная новость!",
            "Давай встретимся на днях",
            "Полностью с тобой согласен",
            "Жду продолжения истории",
            "Как твои успехи?",
            "Было приятно пообщаться!"
        ];
        
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        
        const reply = {
            id: Date.now().toString(),
            text: randomReply,
            sender: 'other',
            time: new Date().toISOString()
        };
        
        this.chats[chatId].messages.push(reply);
        this.saveChatsToStorage();
        
        // Если этот чат активен, обновляем сообщения
        if (this.currentChat === chatId) {
            this.loadMessages(chatId);
        }
        
        // Обновляем список чатов
        this.renderChatsList();
    }

    saveChatsToStorage() {
        localStorage.setItem('chats', JSON.stringify(this.chats));
    }

    openNewChatModal() {
        const modal = document.getElementById('newChatModal');
        if (modal) {
            modal.classList.add('active');
            const searchInput = document.getElementById('searchUsersInput');
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
            }
        }
    }

    openSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    async handleAvatarUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showToast('Пожалуйста, выберите изображение', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.showToast('Изображение должно быть меньше 5MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const avatarData = event.target.result;
            
            if (this.currentUser) {
                this.currentUser.avatar = avatarData;
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                this.updateUserDisplay();
                this.showToast('Аватар успешно изменен!', 'success');
            }
        };
        
        reader.readAsDataURL(file);
    }

    async handleSettingsSave(e) {
        const displayName = document.getElementById('settingsDisplayName').value.trim();
        const username = document.getElementById('settingsUsername').value.trim();
        const currentPassword = document.getElementById('currentPassword')?.value;
        const newPassword = document.getElementById('newPassword')?.value;

        if (!displayName || !username) {
            this.showToast('Заполните основные поля', 'error');
            return;
        }

        try {
            const updateData = { 
                userId: this.currentUser.id,
                displayName, 
                username 
            };
            
            if (newPassword && currentPassword) {
                if (newPassword.length < 6) {
                    this.showToast('Новый пароль должен быть не менее 6 символов', 'error');
                    return;
                }
                updateData.currentPassword = currentPassword;
                updateData.newPassword = newPassword;
            }

            const response = await fetch(`${this.serverUrl}/update-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            const data = await response.json();
            
            if (data.success) {
                this.showToast('Настройки сохранены!', 'success');
                
                // Обновляем текущего пользователя
                if (this.currentUser) {
                    this.currentUser = { ...this.currentUser, ...data.user };
                    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                    this.updateUserDisplay();
                }
                
                setTimeout(() => {
                    this.closeAllModals();
                }, 1000);
            } else {
                this.showToast(data.message || 'Ошибка сохранения', 'error');
            }
        } catch (error) {
            console.error('❌ Ошибка сохранения настроек:', error);
            this.showToast('Ошибка соединения с сервером', 'error');
        }
    }

    logout() {
        if (confirm('Вы уверены, что хотите выйти?')) {
            localStorage.removeItem('currentUser');
            this.showToast('Выход выполнен', 'info');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        }
    }
}

// Создаем глобальный экземпляр приложения
window.messenger = new CKAMMessenger();
