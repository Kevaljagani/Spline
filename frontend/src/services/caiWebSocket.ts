export interface CAIMessage {
  type: 'user_input' | 'command' | 'interrupt'
  session_id: string
  content?: string
  command?: string
  args?: string[]
  payload_paths?: string[]
  timestamp?: number
}

export interface CAIResponse {
  type: 'status' | 'stream_event' | 'error'
  session_id: string
  status?: string
  message?: string
  event?: {
    type: string
    data?: unknown
    name?: string
    item?: unknown
    agent_name?: string
  }
  timestamp: number
}

export interface StreamEvent {
  type: 'raw_response' | 'run_item' | 'agent_updated'
  data?: {
    event_type?: string
    delta?: string
    text?: string
  }
  name?: string
  item?: unknown
  agent_name?: string
}

export class CAIWebSocketService {
  private ws: WebSocket | null = null
  private sessionId: string = ''
  private isConnected: boolean = false
  private messageQueue: CAIMessage[] = []
  
  public onStatusChange: (status: string, message?: string) => void = () => {}
  public onStreamEvent: (event: StreamEvent) => void = () => {}
  public onError: (error: string, details?: unknown) => void = () => {}
  public onConnectionChange: (connected: boolean) => void = () => {}

  constructor() {
    this.sessionId = this.generateSessionId()
  }

  private generateSessionId(): string {
    return crypto.randomUUID()
  }

  connect(url: string = 'ws://localhost:8765'): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url)
        
        this.ws.onopen = () => {
          this.isConnected = true
          this.onConnectionChange(true)
          this.processMessageQueue()
          resolve()
        }
        
        this.ws.onmessage = (event) => {
          try {
            const response: CAIResponse = JSON.parse(event.data)
            this.handleResponse(response)
          } catch (error) {
            this.onError('Failed to parse WebSocket message', error)
          }
        }
        
        this.ws.onclose = () => {
          this.isConnected = false
          this.onConnectionChange(false)
          this.attemptReconnect()
        }
        
        this.ws.onerror = (error) => {
          this.onError('WebSocket connection error', error)
          reject(error)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  private handleResponse(response: CAIResponse) {
    switch (response.type) {
      case 'status':
        this.onStatusChange(response.status || 'unknown', response.message)
        break
      case 'stream_event':
        if (response.event) {
          this.onStreamEvent(response.event as StreamEvent)
        }
        break
      case 'error':
        this.onError(response.message || 'Unknown error occurred')
        break
    }
  }

  private attemptReconnect() {
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect().catch(console.error)
      }
    }, 3000)
  }

  private processMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift()
      if (message) {
        this.sendMessage(message)
      }
    }
  }

  sendUserInput(content: string, payloadPaths?: string[]) {
    const message: CAIMessage = {
      type: 'user_input',
      session_id: this.sessionId,
      content,
      payload_paths: payloadPaths,
      timestamp: Date.now()
    }
    this.sendMessage(message)
  }

  sendCommand(command: string, args: string[] = []) {
    const message: CAIMessage = {
      type: 'command',
      session_id: this.sessionId,
      command,
      args,
      timestamp: Date.now()
    }
    this.sendMessage(message)
  }

  interrupt() {
    const message: CAIMessage = {
      type: 'interrupt',
      session_id: this.sessionId,
      timestamp: Date.now()
    }
    this.sendMessage(message)
  }

  private sendMessage(message: CAIMessage) {
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify(message))
    } else {
      this.messageQueue.push(message)
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
    this.onConnectionChange(false)
  }

  getConnectionStatus(): boolean {
    return this.isConnected
  }

  getSessionId(): string {
    return this.sessionId
  }
}