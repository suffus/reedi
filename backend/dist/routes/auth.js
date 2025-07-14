"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const index_1 = require("@/index");
const errorHandler_1 = require("@/middleware/errorHandler");
const auth_1 = require("@/middleware/auth");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    email: zod_1.z.string().email('Invalid email address'),
    username: zod_1.z.string().min(3, 'Username must be at least 3 characters').optional(),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters')
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required')
});
const generateToken = (userId) => {
    return jsonwebtoken_1.default.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};
router.post('/register', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { name, email, username, password } = registerSchema.parse(req.body);
    const existingUser = await index_1.prisma.user.findFirst({
        where: {
            OR: [
                { email },
                ...(username ? [{ username }] : [])
            ]
        }
    });
    if (existingUser) {
        res.status(409).json({
            success: false,
            error: 'User with this email or username already exists'
        });
        return;
    }
    const hashedPassword = await bcryptjs_1.default.hash(password, 12);
    const user = await index_1.prisma.user.create({
        data: {
            name,
            email,
            username,
            password: hashedPassword
        },
        select: {
            id: true,
            name: true,
            email: true,
            username: true,
            avatar: true,
            bio: true,
            location: true,
            website: true,
            isPrivate: true,
            isVerified: true,
            createdAt: true,
            updatedAt: true
        }
    });
    const token = generateToken(user.id);
    res.status(201).json({
        success: true,
        data: {
            user,
            token
        },
        message: 'User registered successfully'
    });
}));
router.post('/login', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await index_1.prisma.user.findUnique({
        where: { email }
    });
    if (!user) {
        res.status(401).json({
            success: false,
            error: 'Invalid email or password'
        });
        return;
    }
    const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
    if (!isPasswordValid) {
        res.status(401).json({
            success: false,
            error: 'Invalid email or password'
        });
        return;
    }
    const token = generateToken(user.id);
    const { password: _, ...userData } = user;
    res.json({
        success: true,
        data: {
            user: userData,
            token
        },
        message: 'Login successful'
    });
}));
router.get('/me', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    if (!user) {
        res.status(401).json({
            success: false,
            error: 'User not found'
        });
        return;
    }
    res.json({
        success: true,
        data: { user }
    });
}));
router.put('/profile', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { name, username, bio, location, website, isPrivate } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    if (username) {
        const existingUser = await index_1.prisma.user.findFirst({
            where: {
                username,
                NOT: { id: userId }
            }
        });
        if (existingUser) {
            res.status(409).json({
                success: false,
                error: 'Username already taken'
            });
            return;
        }
    }
    const updatedUser = await index_1.prisma.user.update({
        where: { id: userId },
        data: {
            name,
            username,
            bio,
            location,
            website,
            isPrivate
        },
        select: {
            id: true,
            name: true,
            email: true,
            username: true,
            avatar: true,
            bio: true,
            location: true,
            website: true,
            isPrivate: true,
            isVerified: true,
            createdAt: true,
            updatedAt: true
        }
    });
    res.json({
        success: true,
        data: { user: updatedUser },
        message: 'Profile updated successfully'
    });
}));
router.put('/change-password', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: 'User not authenticated'
        });
        return;
    }
    if (!currentPassword || !newPassword) {
        res.status(400).json({
            success: false,
            error: 'Current password and new password are required'
        });
        return;
    }
    if (newPassword.length < 6) {
        res.status(400).json({
            success: false,
            error: 'New password must be at least 6 characters'
        });
        return;
    }
    const user = await index_1.prisma.user.findUnique({
        where: { id: userId }
    });
    if (!user) {
        res.status(404).json({
            success: false,
            error: 'User not found'
        });
        return;
    }
    const isCurrentPasswordValid = await bcryptjs_1.default.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
        res.status(401).json({
            success: false,
            error: 'Current password is incorrect'
        });
        return;
    }
    const hashedNewPassword = await bcryptjs_1.default.hash(newPassword, 12);
    await index_1.prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword }
    });
    res.json({
        success: true,
        message: 'Password changed successfully'
    });
}));
exports.default = router;
//# sourceMappingURL=auth.js.map