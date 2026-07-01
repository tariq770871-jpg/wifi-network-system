const swaggerJsdoc = require('swagger-jsdoc');
const config = require('./config');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'WiFi Network Management System API',
            version: '1.0.0',
            description: 'نظام إدارة شبكات WiFi - API Documentation',
        },
        servers: [
            {
                url: `http://localhost:${config.port}/api`,
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT token from /api/auth/login',
                },
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        username: { type: 'string' },
                        full_name: { type: 'string' },
                        role: { type: 'string', enum: ['admin', 'support', 'technician'] },
                        phone: { type: 'string' },
                        email: { type: 'string' },
                        is_active: { type: 'boolean' },
                        tracking_enabled: { type: 'boolean' },
                        tracking_veto: { type: 'boolean' },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
                Ticket: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        customer_name: { type: 'string' },
                        customer_phone: { type: 'string' },
                        status: { type: 'string', enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'] },
                        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
                        location_lat: { type: 'number' },
                        location_lng: { type: 'number' },
                        created_by: { type: 'integer' },
                        assigned_to: { type: 'integer' },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        error: { type: 'string' },
                    },
                },
                Success: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        message: { type: 'string' },
                        data: {},
                    },
                },
            },
        },
        tags: [
            { name: 'Auth', description: 'المصادقة' },
            { name: 'Users', description: 'إدارة المستخدمين' },
            { name: 'Tickets', description: 'البلاغات' },
            { name: 'Tracking', description: 'التتبع الحي' },
            { name: 'Map Points', description: 'نقاط الخريطة' },
            { name: 'Reports', description: 'التقارير' },
        ],
    },
    apis: ['./src/modules/*/index.js', './src/modules/*/*.routes.js'],
};

const specs = swaggerJsdoc(options);
module.exports = specs;
