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

  close() {
    this.db.close();
  }
}

module.exports = new Database();