class Request {
  constructor(id, method, url, headers, body = null, host = null) {
    this.id = id;
    this.method = method;
    this.url = url;
    this.headers = headers;
    this.body = body;
    this.host = host;
    this.timestamp = new Date().toISOString();
    this.status = 'pending';
  }

  toJSON() {
    return {
      id: this.id,
      method: this.method,
      url: this.url,
      headers: this.headers,
      body: this.body,
      host: this.host,
      timestamp: this.timestamp,
      status: this.status
    };
  }

  markForwarded() {
    this.status = 'forwarded';
  }

  markDropped() {
    this.status = 'dropped';
  }
}

module.exports = Request;