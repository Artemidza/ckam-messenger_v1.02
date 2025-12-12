const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Конфигурация для Render
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_RENDER = process.env.RENDER === 'true';

// Пути для Render (используем volume для сохранения данных)
const DATA_DIR = IS_RENDER ? '/data' : __dirname;
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Раздаем статические файлы из client
const clientPath = path.join(__dirname, '../client');
app.use(express.static(clientPath));

// Глобальный массив пользователей
let users = [];

// Загрузка пользователей с обработкой ошибок
async function loadUsers() {
    try {
        console.log(`📂 Загрузка пользователей из: ${ACCOUNTS_FILE}`);
        
        // Проверяем существование файла
        try {
            await fs.access(ACCOUNTS_FILE);
        } catch {
            console.log('📁 Файл не найден, создаем новый...');
            users = [];
            await saveUsers();
            return;
        }
        
        const data = await fs.readFile(ACCOUNTS_FILE, 'utf8');
        const parsed = JSON.parse(data);
        users = parsed.users || [];
        
        console.log(`✅ Загружено ${users.length} пользователей`);
        
        // Автоматическое создание демо пользователей если пусто
        if (users.length === 0 && NODE_ENV === 'production') {
            await createDemoUsers();
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки пользователей:', error);
        users = [];
    }
}

// Создание демо пользователей
async function createDemoUsers() {
    console.log('👥 Создаем демо пользователей...');
    
    const demoUsers = [
        {
            id: uuidv4(),
            displayName: 'Алексей',
            username: 'alexey',
            password: await bcrypt.hash('password123', 10),
            avatar: null,
            theme: 'dark',
            createdAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        },
        {
            id: uuidv4(),
            displayName: 'Мария',
            username: 'maria',
            password: await bcrypt.hash('password123', 10),
            avatar: null,
            theme: 'red',
            createdAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        }
    ];
    
    users.push(...demoUsers);
    await saveUsers();
    console.log('✅ Демо пользователи созданы');
}

// Сохранение пользователей
async function saveUsers() {
    try {
        const data = JSON.stringify({ users }, null, 2);
        await fs.writeFile(ACCOUNTS_FILE, data, 'utf8');
        console.log(`💾 Пользователи сохранены (${users.length} записей)`);
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
    }
}

// API Routes
app.post('/api/register', async (req, res) => {
    try {
        const { displayName, username, password } = req.body;
        
        // Валидация
        if (!displayName?.trim() || !username?.trim() || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Все поля обязательны' 
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'Пароль должен быть не менее 6 символов' 
            });
        }
        
        if (username.length < 3) {
            return res.status(400).json({ 
                success: false, 
                message: 'Юзернейм должен быть не менее 3 символов' 
            });
        }

        // Проверка уникальности
        const existingUser = users.find(u => 
            u.username.toLowerCase() === username.toLowerCase().trim()
        );
        
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'Этот юзернейм уже занят' 
            });
        }

        // Создание пользователя
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: uuidv4(),
            displayName: displayName.trim(),
            username: username.trim(),
            password: hashedPassword,
            avatar: null,
            theme: 'dark',
            createdAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        };

        users.push(newUser);
        await saveUsers();

        // Не возвращаем пароль
        const { password: _, ...userWithoutPassword } = newUser;
        
        res.json({ 
            success: true, 
            user: userWithoutPassword,
            message: 'Регистрация успешна!'
        });
    } catch (error) {
        console.error('❌ Ошибка регистрации:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Внутренняя ошибка сервера' 
        });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Все поля обязательны' 
            });
        }

        const user = users.find(u => 
            u.username.toLowerCase() === username.toLowerCase()
        );
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Пользователь не найден' 
            });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Неверный пароль' 
            });
        }

        // Обновляем время последнего входа
        user.lastSeen = new Date().toISOString();
        await saveUsers();

        const { password: _, ...userWithoutPassword } = user;
        
        res.json({ 
            success: true, 
            user: userWithoutPassword,
            message: 'Вход выполнен успешно!'
        });
    } catch (error) {
        console.error('❌ Ошибка входа:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Внутренняя ошибка сервера' 
        });
    }
});

app.get('/api/users', (req, res) => {
    try {
        const usersWithoutPasswords = users.map(({ password, ...user }) => ({
            ...user,
            isOnline: new Date() - new Date(user.lastSeen) < 5 * 60 * 1000 // 5 минут
        }));
        res.json(usersWithoutPasswords);
    } catch (error) {
        console.error('❌ Ошибка получения пользователей:', error);
        res.status(500).json([]);
    }
});

app.get('/api/search', (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.trim() === '') {
            const usersWithoutPasswords = users.map(({ password, ...user }) => user);
            return res.json(usersWithoutPasswords.slice(0, 50)); // Ограничиваем
        }

        const searchTerm = q.toLowerCase();
        const results = users
            .filter(user => 
                user.username.toLowerCase().includes(searchTerm) ||
                user.displayName.toLowerCase().includes(searchTerm)
            )
            .map(({ password, ...user }) => user)
            .slice(0, 20); // Ограничиваем результаты

        res.json(results);
    } catch (error) {
        console.error('❌ Ошибка поиска:', error);
        res.status(500).json([]);
    }
});

app.post('/api/update-profile', async (req, res) => {
    try {
        const { userId, displayName, username, currentPassword, newPassword, avatar } = req.body;
        
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Пользователь не найден' 
            });
        }

        const user = users[userIndex];
        
        // Проверка уникальности юзернейма
        if (username && username !== user.username) {
            const usernameExists = users.some(u => 
                u.username.toLowerCase() === username.toLowerCase() && u.id !== userId
            );
            
            if (usernameExists) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Этот юзернейм уже занят' 
                });
            }
            user.username = username;
        }

        // Смена пароля
        if (newPassword && currentPassword) {
            const isValidPassword = await bcrypt.compare(currentPassword, user.password);
            if (!isValidPassword) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Неверный текущий пароль' 
                });
            }
            
            if (newPassword.length < 6) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Новый пароль должен быть не менее 6 символов' 
                });
            }
            
            user.password = await bcrypt.hash(newPassword, 10);
        }

        // Обновление данных
        if (displayName) user.displayName = displayName;
        
        if (avatar && avatar.startsWith('data:image')) {
            user.avatar = avatar;
        }
        
        user.updatedAt = new Date().toISOString();
        users[userIndex] = user;
        await saveUsers();

        const { password: _, ...userWithoutPassword } = user;
        
        res.json({ 
            success: true, 
            user: userWithoutPassword,
            message: 'Настройки сохранены!'
        });
    } catch (error) {
        console.error('❌ Ошибка обновления:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Внутренняя ошибка сервера' 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'ckam-messenger',
        version: '1.0.0',
        environment: NODE_ENV,
        render: IS_RENDER,
        users: users.length,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Информация о сервере
app.get('/api/info', (req, res) => {
    res.json({
        name: 'CKAM Messenger',
        version: '1.0.0',
        description: 'Быстрый и безопасный мессенджер',
        features: [
            'Регистрация и авторизация',
            'Поиск пользователей',
            'Личные сообщения',
            'Настройки профиля',
            'Темы оформления'
        ],
        stats: {
            totalUsers: users.length,
            onlineUsers: users.filter(u => new Date() - new Date(u.lastSeen) < 5 * 60 * 1000).length,
            environment: NODE_ENV
        }
    });
});

// Все остальные маршруты → клиентское приложение
app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error('🔥 Ошибка сервера:', err);
    res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера',
        error: NODE_ENV === 'development' ? err.message : undefined
    });
});

// Запуск сервера
async function startServer() {
    try {
        await loadUsers();
        
        app.listen(PORT, () => {
            console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    CKAM MESSENGER v1.0.0                    ║
╠══════════════════════════════════════════════════════════════╣
║ 🚀 Сервер запущен на порту: ${PORT}                           ║
║ 🌐 Режим: ${NODE_ENV.padEnd(15)} ${IS_RENDER ? '⚡ RENDER' : '💻 Локально'} ║
║ 👥 Пользователей: ${users.length.toString().padEnd(10)}                   ║
╠══════════════════════════════════════════════════════════════╣
║ 📍 Локальный адрес: http://localhost:${PORT}                 ║
║ 🔗 Health Check: http://localhost:${PORT}/api/health         ║
║ 📊 Информация: http://localhost:${PORT}/api/info            ║
╚══════════════════════════════════════════════════════════════╝
            `);
            
            // Показываем демо данные если есть
            if (users.length > 0) {
                console.log('\n👥 Доступные демо аккаунты:');
                users.slice(0, 3).forEach(user => {
                    console.log(`   👤 ${user.displayName} (@${user.username}) - пароль: password123`);
                });
            }
        });
    } catch (error) {
        console.error('❌ Не удалось запустить сервер:', error);
        process.exit(1);
    }
}

startServer();
