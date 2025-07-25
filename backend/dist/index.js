"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const path_1 = __importDefault(require("path"));
const auth_1 = __importDefault(require("@/routes/auth"));
const users_1 = __importDefault(require("@/routes/users"));
const posts_1 = __importDefault(require("@/routes/posts"));
const comments_1 = __importDefault(require("@/routes/comments"));
const media_1 = __importDefault(require("@/routes/media"));
const mediaServe_1 = __importDefault(require("@/routes/mediaServe"));
const galleries_1 = __importDefault(require("@/routes/galleries"));
const search_1 = __importDefault(require("@/routes/search"));
const friends_1 = __importDefault(require("@/routes/friends"));
const errorHandler_1 = require("@/middleware/errorHandler");
const auth_2 = require("@/middleware/auth");
dotenv_1.default.config();
exports.prisma = new client_1.PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8088;
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 50000,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(limiter);
app.use((0, morgan_1.default)('combined'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
}, express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
app.use('/api/auth', auth_1.default);
app.use('/api/users', auth_2.authMiddleware, users_1.default);
app.use('/api/posts', posts_1.default);
app.use('/api/comments', comments_1.default);
app.use('/api/media/serve', mediaServe_1.default);
app.use('/api/media', auth_2.authMiddleware, media_1.default);
app.use('/api/galleries', auth_2.authMiddleware, galleries_1.default);
app.use('/api/search', search_1.default);
app.use('/api/friends', friends_1.default);
app.use(errorHandler_1.errorHandler);
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
    });
});
let requestCount = 0;
let errorCount = 0;
setInterval(async () => {
    try {
        await exports.prisma.$queryRaw `SELECT 1`;
        if (Date.now() % 300000 < 1000) {
            console.log(`📊 Database Health: ${requestCount} requests, ${errorCount} errors`);
        }
    }
    catch (error) {
        errorCount++;
        console.error('❌ Database health check failed:', error);
    }
}, 30000);
async function startServer() {
    try {
        await exports.prisma.$connect();
        console.log('✅ Database connected successfully');
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await exports.prisma.$disconnect();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await exports.prisma.$disconnect();
    process.exit(0);
});
startServer();
//# sourceMappingURL=index.js.map