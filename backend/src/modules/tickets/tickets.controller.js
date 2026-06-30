const { query } = require('../../shared/db');

const ticketsController = {
  getAll: async (req, res) => {
    try {
      const result = await query('SELECT * FROM tickets ORDER BY created_at DESC');
      res.json({ data: result.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await query('SELECT * FROM tickets WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      res.json({ data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  create: async (req, res) => {
    try {
      const { title, description, priority, assigned_to } = req.body;
      const result = await query(
        'INSERT INTO tickets (title, description, priority, assigned_to, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [title, description, priority, assigned_to, 'open']
      );
      res.status(201).json({ data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, priority, assigned_to, status } = req.body;
      const result = await query(
        'UPDATE tickets SET title = $1, description = $2, priority = $3, assigned_to = $4, status = $5, updated_at = NOW() WHERE id = $6 RETURNING *',
        [title, description, priority, assigned_to, status, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      res.json({ data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await query('DELETE FROM tickets WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      res.json({ message: 'Ticket deleted' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  assign: async (req, res) => {
    try {
      const { id } = req.params;
      const { assigned_to } = req.body;
      const result = await query(
        'UPDATE tickets SET assigned_to = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
        [assigned_to, 'in_progress', id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      res.json({ data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  complete: async (req, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const noteText = notes ? '\n\nملاحظات الإكمال: ' + notes : '';
      const result = await query(
        'UPDATE tickets SET status = $1, completed_at = NOW(), updated_at = NOW(), description = description || $2 WHERE id = $3 RETURNING *',
        ['completed', noteText, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      res.json({ data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = ticketsController;
