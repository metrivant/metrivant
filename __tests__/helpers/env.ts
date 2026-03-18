// Set test environment variables before any module imports read process.env.
// Import this file first in every test file.

process.env.CRON_SECRET = 'test-secret';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.NODE_ENV = 'test';
