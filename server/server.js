const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Автоматическое определение порта
const PORT = process.env.PORT || 3000;

// Используем переменные окружения
const NODE_ENV = process.env.NODE_ENV || 'development';
const ACCOUNTS_FILE = process.env.ACCOUNTS_FILE || path.join(__dirname, 'accounts.json');

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Раздаем статические файлы из client
app.use(express.static(path.join(__dirname, '../client')));

// Глобальный массив пользователей
let users = [];

// Загрузка пользователей
async function loadUsers() {
    try {
        const data = await fs.readFile(ACCOUNTS_FILE, 'utf8');
        users = JSON.parse(data).users || [];
        console.log(`✅ Загружено ${users.length} пользователей`);
    } catch (error) {
        console.log('📁 Создаем новый файл пользователей...');
        users = [];
        await saveUsers();
    }
}

// Сохранение пользователей
async function saveUsers() {
    try {
        await fs.writeFile(ACCOUNTS_FILE, JSON.stringify({ users }, null, 2));
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
    }
}

// API Routes
app.post('/api/register', async (req, res) => {
    try {
        const { displayName, username, password } = req.body;
        
        // Валидация
        if (!displayName || !username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Все поля обязательны' 
            });
        }

        // Проверка уникальности
        const existingUser = users.find(u => 
            u.username.toLowerCase() === username.toLowerCase()
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
            displayName,
            username,
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
            user: userWithoutPassword 
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
            user: userWithoutPassword 
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
        const usersWithoutPasswords = users.map(({ password, ...user }) => user);
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
            return res.json(usersWithoutPasswords);
        }

        const searchTerm = q.toLowerCase();
        const results = users
            .filter(user => 
                user.username.toLowerCase().includes(searchTerm) ||
                user.displayName.toLowerCase().includes(searchTerm)
            )
            .map(({ password, ...user }) => user);

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
        if (username !== user.username) {
            const usernameExists = users.some(u => 
                u.username.toLowerCase() === username.toLowerCase() && u.id !== userId
            );
            
            if (usernameExists) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Этот юзернейм уже занят' 
                });
            }
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
            
            user.password = await bcrypt.hash(newPassword, 10);
        }

        // Обновление данных
        user.displayName = displayName || user.displayName;
        user.username = username || user.username;
        
        if (avatar && avatar.startsWith('data:image')) {
            user.avatar = avatar;
        }
        
        user.updatedAt = new Date().toISOString();
        users[userIndex] = user;
        await saveUsers();

        const { password: _, ...userWithoutPassword } = user;
        
        res.json({ 
            success: true, 
            user: userWithoutPassword 
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
        users: users.length,
        environment: NODE_ENV
    });
});

// Все остальные маршруты → клиентское приложение
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Запуск сервера
async function startServer() {
    await loadUsers();
    
    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════════════════════╗
║                    CKAM MESSENGER                       ║
╠══════════════════════════════════════════════════════════╣
║ 🚀 Сервер запущен на порту: ${PORT}                        ║
║ 🌐 Режим: ${NODE_ENV}                                       ║
║ 👥 Пользователей: ${users.length}                           ║
╠══════════════════════════════════════════════════════════╣
║ 📍 Локально:    http://localhost:${PORT}                    ║
║ 🔗 API Health:  http://localhost:${PORT}/api/health        ║
╚══════════════════════════════════════════════════════════╝
        `);
    });
}

startServer().catch(console.error);
