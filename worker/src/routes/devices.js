import { Hono } from 'hono';
import { generateId } from '../middleware/auth.js';

const devices = new Hono();

// List devices
devices.get('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('user_id');
  const rows = await db.query('SELECT id, name, platform, role, last_seen, created_at FROM devices WHERE user_id = ? ORDER BY last_seen DESC', [userId]);
  return c.json({ devices: rows });
});

// Register device
devices.post('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('user_id');
  const selfHosted = c.get('self_hosted');
  const { name, platform } = await c.req.json();

  if (!name) return c.json({ error: 'Device name required' }, 400);

  // Check device limit (10 for hosted, unlimited for self-hosted)
  if (!selfHosted) {
    const existing = await db.query('SELECT COUNT(*) as count FROM devices WHERE user_id = ?', [userId]);
    if (existing[0]?.count >= 10) {
      return c.json({ error: 'Device limit reached (10). Remove a device first.' }, 403);
    }
  }

  // First device = admin, subsequent = client
  const existingDevices = await db.query('SELECT COUNT(*) as count FROM devices WHERE user_id = ?', [userId]);
  const role = existingDevices[0]?.count > 0 ? 'client' : 'admin';

  const deviceId = generateId();
  const now = new Date().toISOString();

  await db.run(
    'INSERT INTO devices (id, user_id, name, platform, role, last_seen, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [deviceId, userId, name, platform || 'unknown', role, now, now]
  );

  return c.json({ device_id: deviceId, role });
});

// Change device role
devices.patch('/:id/role', async (c) => {
  const db = c.get('db');
  const userId = c.get('user_id');
  const targetDeviceId = c.req.param('id');
  const { role, requester_device_id } = await c.req.json();

  if (!['admin', 'client'].includes(role)) return c.json({ error: 'Invalid role' }, 400);

  // Verify requester is an admin device
  const requester = await db.query('SELECT role FROM devices WHERE id = ? AND user_id = ?', [requester_device_id, userId]);
  if (!requester.length || requester[0].role !== 'admin') {
    return c.json({ error: 'Only admin devices can change roles' }, 403);
  }

  // Prevent demoting the last admin
  if (role === 'client') {
    const admins = await db.query("SELECT COUNT(*) as count FROM devices WHERE user_id = ? AND role = 'admin'", [userId]);
    const target = await db.query('SELECT role FROM devices WHERE id = ? AND user_id = ?', [targetDeviceId, userId]);
    if (target[0]?.role === 'admin' && admins[0]?.count <= 1) {
      return c.json({ error: 'Cannot demote the last admin device' }, 400);
    }
  }

  await db.run('UPDATE devices SET role = ? WHERE id = ? AND user_id = ?', [role, targetDeviceId, userId]);
  return c.json({ ok: true });
});

// Remove device
devices.delete('/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('user_id');
  const deviceId = c.req.param('id');

  await db.run('DELETE FROM devices WHERE id = ? AND user_id = ?', [deviceId, userId]);
  return c.json({ ok: true });
});

export default devices;
