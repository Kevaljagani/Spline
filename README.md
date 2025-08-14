# Spline

A comprehensive HTTP/HTTPS proxy manager with request interception, analysis, and security testing capabilities.

## Overview

Spline is a full-stack application designed for security professionals and developers to intercept, analyze, and manipulate HTTP/HTTPS traffic. It provides real-time request monitoring, manual proxy decisions, and advanced features for security testing and vulnerability assessment.

## Demo

[![Spline Demo](https://img.youtube.com/vi/MgkkTlUIxsU/0.jpg)](https://www.youtube.com/watch?v=MgkkTlUIxsU)

Watch the demo video to see Spline in action and learn how to use its key features.

## Features

- **HTTP/HTTPS Proxy Server**: Intercepts all web traffic on port 8080
- **SSL Certificate Generation**: Dynamic SSL certificate generation for HTTPS interception
- **Request Interception**: Real-time interception with manual forward/drop decisions
- **Scope Management**: Target specific domains for monitoring and analysis
- **Request Storage**: SQLite database for storing intercepted requests and responses
- **WebSocket Real-time Updates**: Live updates between backend and frontend
- **Modern Web UI**: React/Next.js frontend with shadcn/ui components
- **Payload Management**: Built-in payload system for security testing
- **Export Capabilities**: Generate curl commands from intercepted requests

## Architecture

### Backend (`/backend`)
- **Node.js/Express** server with WebSocket support
- **Proxy Controller**: Handles HTTP/HTTPS interception and SSL termination
- **Database**: SQLite in-memory storage for requests/responses
- **Certificate Management**: Dynamic SSL certificate generation using node-forge

### Frontend (`/frontend`)
- **Next.js 15** with TypeScript
- **React 19** with modern hooks and context
- **shadcn/ui** component library
- **Tailwind CSS** for styling
- **Real-time WebSocket** communication

## Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn package manager

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Spline
   ```

2. **Install dependencies and start both servers**
   ```bash
   ./start.sh
   ```

   This script will:
   - Install dependencies for both backend and frontend
   - Start the backend server on http://localhost:3001
   - Start the frontend server on http://localhost:3000

### Manual Setup

If you prefer to run servers individually:

1. **Backend Setup**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Configuration

### Browser Proxy Settings

To intercept traffic, configure your browser to use the proxy:

1. **Firefox (Recommended)**
   - Settings → Network Settings → Manual proxy configuration
   - HTTP Proxy: `localhost:8080`
   - HTTPS Proxy: `localhost:8080`

2. **Chrome/Edge**
   - Settings → Advanced → System → Open proxy settings
   - Manual proxy setup: `localhost:8080`

### SSL Certificate Installation

For HTTPS interception, install the CA certificate:

1. The CA certificate is automatically generated at `backend/certs/ca-cert.pem`
2. Import this certificate into your browser's trusted root certificates
3. This allows the proxy to decrypt and analyze HTTPS traffic

## Usage

### Basic Proxy Operation

1. **Start the application** using `./start.sh`
2. **Configure your browser** to use `localhost:8080` as proxy
3. **Navigate to** `http://localhost:3000` to access the web interface
4. **Enable interception** using the toggle in the proxy interface
5. **Browse the web** and see requests appear in real-time

### Key Features

#### Request Interception
- Toggle intercept mode on/off
- Real-time request queue with numbered indicators
- Manual forward/drop decisions for each request
- Bulk "Drop All" functionality

#### Scope Management
- Add domains to scope for focused analysis
- Only scoped domains are stored in the database
- Efficient filtering of relevant traffic

#### Request Analysis
- View complete HTTP requests with headers and body
- Syntax-highlighted display for better readability
- Export requests as curl commands
- Add requests to context for further analysis

### Navigation

The application includes several modules:

- **Proxy**: Main interception interface
- **Replay**: Replay captured requests
- **Patterns**: Security pattern analysis
- **Payloads**: Payload management system
- **Xploiter**: Security testing interface

## API Endpoints

### Backend API (`http://localhost:3001/api`)

- `POST /add-to-scope` - Add domain to monitoring scope
- `GET /requests` - Retrieve stored requests
- `GET /responses/:requestId` - Get responses for specific request
- `POST /clear-data` - Clear all stored data

### WebSocket Events

- `new_request` - Real-time request notifications
- `response` - Response data for intercepted requests
- `proxy_decision` - Send forward/drop decisions

## File Structure

```
Spline/
├── backend/
│   ├── controllers/
│   │   ├── ProxyController.js    # Main proxy logic
│   │   └── WebSocketController.js # WebSocket handling
│   ├── models/
│   │   └── Request.js            # Request data model
│   ├── routes/
│   │   └── api.js               # API routes
│   ├── certs/                   # SSL certificates
│   ├── payloads/                # Test payloads
│   ├── database.js              # SQLite database
│   ├── server.js               # Main server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js app router
│   │   ├── components/          # React components
│   │   ├── contexts/            # React contexts
│   │   ├── hooks/               # Custom hooks
│   │   ├── lib/                 # Utilities
│   │   └── services/            # API services
│   └── package.json
├── start.sh                     # Quick start script
└── README.md
```

## Security Considerations

This tool is designed for **defensive security purposes only**:

- Use only in controlled environments
- Ensure proper authorization before intercepting traffic
- The CA certificate should be kept secure
- Regular security audits of intercepted data are recommended

## Development

### Backend Development
```bash
cd backend
npm run dev  # Starts with nodemon for auto-reload
```

### Frontend Development
```bash
cd frontend
npm run dev  # Starts Next.js with hot reload
```

### Building for Production
```bash
# Frontend build
cd frontend
npm run build
npm start

# Backend production
cd backend
npm start
```

## Dependencies

### Backend
- **express**: Web framework
- **ws**: WebSocket implementation
- **node-forge**: SSL certificate generation
- **sqlite3**: Database storage
- **http-proxy**: Proxy functionality
- **cors**: Cross-origin resource sharing

### Frontend
- **next**: React framework
- **react**: UI library
- **@radix-ui**: Component primitives
- **tailwindcss**: CSS framework
- **lucide-react**: Icons
- **react-syntax-highlighter**: Code highlighting

## Troubleshooting

### Common Issues

1. **Certificate Errors**
   - Ensure CA certificate is properly installed in browser
   - Regenerate certificates if needed: `node backend/generate-certs.js`

2. **Proxy Connection Failed**
   - Verify proxy is running on port 8080
   - Check firewall settings
   - Ensure browser proxy settings are correct

3. **Frontend Not Loading**
   - Verify both servers are running
   - Check for port conflicts
   - Review browser console for errors

### Logs and Debugging

- Backend logs are displayed in the terminal
- Frontend development logs in browser console
- WebSocket connection status visible in UI

## License

This project is intended for educational and defensive security purposes. Please ensure compliance with applicable laws and regulations when using this software.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review logs for error messages
3. Create an issue with detailed information about the problem