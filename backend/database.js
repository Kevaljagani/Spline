const sqlite3 = require('sqlite3').verbose();

class Database {
  constructor() {
    this.db = new sqlite3.Database(':memory:');
    this.initTables();
  }

  initTables() {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE requests (
          id INTEGER PRIMARY KEY,
          method TEXT NOT NULL,
          url TEXT NOT NULL,
          headers TEXT NOT NULL,
          body TEXT,
          host TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      this.db.run(`
        CREATE TABLE responses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          request_id INTEGER NOT NULL,
          status_code INTEGER NOT NULL,
          headers TEXT NOT NULL,
          body TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (request_id) REFERENCES requests(id)
        )
      `);

      this.db.run(`
        CREATE TABLE chat_messages (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT
        )
      `);
    });
  }

  saveRequest(requestModel) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO requests (id, method, url, headers, body, host)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        requestModel.id,
        requestModel.method,
        requestModel.url,
        JSON.stringify(requestModel.headers),
        requestModel.body,
        requestModel.host,
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
      
      stmt.finalize();
    });
  }

  saveResponse(requestId, response) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO responses (request_id, status_code, headers, body)
        VALUES (?, ?, ?, ?)
      `);
      
      stmt.run(
        requestId,
        response.statusCode,
        JSON.stringify(response.headers),
        response.body,
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
      
      stmt.finalize();
    });
  }

  getRequests() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM requests ORDER BY timestamp DESC', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            ...row,
            headers: JSON.parse(row.headers)
          })));
        }
      });
    });
  }

  getResponses(requestId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM responses WHERE request_id = ? ORDER BY timestamp DESC',
        [requestId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => ({
              ...row,
              headers: JSON.parse(row.headers)
            })));
          }
        }
      );
    });
  }

  saveChatMessage(message) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO chat_messages (id, type, content, status)
        VALUES (?, ?, ?, ?)
      `);
      
      stmt.run(
        message.id,
        message.type,
        message.content,
        message.status,
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
      
      stmt.finalize();
    });
  }

  getChatMessages() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM chat_messages ORDER BY timestamp ASC', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            ...row,
            timestamp: new Date(row.timestamp)
          })));
        }
      });
    });
  }

  clearAllData() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('DELETE FROM chat_messages');
        this.db.run('DELETE FROM responses');
        this.db.run('DELETE FROM requests', (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  }

  close() {
    this.db.close();
  }
}

module.exports = new Database();