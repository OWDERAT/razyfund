import { createFileRoute } from '@tanstack/react-router';
// Retired: public server routes verify administrator sessions in their own handlers.
export const Route = createFileRoute('/api/admin')({ server: { handlers: {
 GET: () => new Response('Not found', { status: 404 }),
 POST: () => new Response('Not found', { status: 404 }),
} } });
