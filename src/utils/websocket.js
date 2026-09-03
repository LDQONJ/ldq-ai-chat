class WebSocketManager {
  constructor() {
    this.ws = null;
    this.wsId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 3000;
    this.messageListeners = new Set();
  }

  onMessage(callback) {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  getWsUrl() {
    const host = window.location.origin;
    // Replace http:// or https:// with ws:// or wss://
    let wsUrl = host.replace(/^http/, 'ws');
    // Ensure it ends with /ws
    if (!wsUrl.endsWith('/ws')) {
      wsUrl = wsUrl.replace(/\/$/, '') + '/ws';
    }
    return wsUrl;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = this.getWsUrl();
    console.log('Connecting to WebSocket:', url);
    
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('WebSocket connection established');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        let parsedData = null;
        try {
          parsedData = JSON.parse(event.data);
          if (parsedData && parsedData.wsId) {
            this.wsId = parsedData.wsId;
            console.log('Received wsId:', this.wsId);
          }
        } catch (e) {
          // 如果不是 JSON，且当前还没有 wsId，则将整个消息视为 wsId
          if (!this.wsId && typeof event.data === 'string' && event.data.trim()) {
            this.wsId = event.data.trim();
            console.log('Received wsId:', this.wsId);
          }
        }

        // 通知所有监听者
        this.messageListeners.forEach(listener => {
          try {
            listener(parsedData || event.data);
          } catch (err) {
            console.error('Error in WebSocket listener:', err);
          }
        });
      };

      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.wsId = null;
        this.reconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // onclose will be called after onerror
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.reconnect();
    }
  }

  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms...`);
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
    } else {
      console.error('Max WebSocket reconnection attempts reached');
    }
  }

  getWsId() {
    return this.wsId;
  }
}

export const wsManager = new WebSocketManager();
