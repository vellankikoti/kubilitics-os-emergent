import { useEffect, useRef, useState, useCallback } from 'react';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface WSMessage {
  type: 'text' | 'tool' | 'error' | 'complete' | 'heartbeat';
  content?: string;
  tool?: any;
  error?: string;
  timestamp: string;
}

export interface UseWebSocketOptions {
  url: string;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  autoConnect?: boolean;
}

export interface SendMessageOptions {
  messages: Message[];
  tools?: any[];
  stream?: boolean;
  context?: {
    namespace?: string;
    resource_type?: string;
    resource_name?: string;
    screen?: string;
  };
}

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    url,
    onOpen,
    onClose,
    onError,
    autoConnect = true,
  } = options;

  const ws = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);

    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        onOpen?.();
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setIsConnecting(false);
        onClose?.();

        // Attempt to reconnect after 3 seconds
        reconnectTimer.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 3000);
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnecting(false);
        onError?.(error);
      };

      ws.current.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);

          switch (msg.type) {
            case 'text':
              if (msg.content) {
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  // Append to last assistant message if it exists
                  if (last?.role === 'assistant') {
                    return [
                      ...prev.slice(0, -1),
                      {
                        ...last,
                        content: last.content + msg.content,
                      },
                    ];
                  }
                  // Otherwise create new assistant message
                  return [
                    ...prev,
                    {
                      role: 'assistant',
                      content: msg.content,
                      timestamp: new Date(msg.timestamp),
                    },
                  ];
                });
              }
              break;

            case 'tool':
              // Handle tool calls (could be displayed as special messages)
              console.log('Tool call received:', msg.tool);
              break;

            case 'error':
              console.error('Server error:', msg.error);
              setMessages((prev) => [
                ...prev,
                {
                  role: 'system',
                  content: `Error: ${msg.error}`,
                  timestamp: new Date(msg.timestamp),
                },
              ]);
              break;

            case 'complete':
              console.log('Response complete');
              break;

            case 'heartbeat':
              // Heartbeat received, connection is alive
              break;

            default:
              console.warn('Unknown message type:', msg.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setIsConnecting(false);
    }
  }, [url, onOpen, onClose, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const sendMessage = useCallback(
    (options: SendMessageOptions) => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        console.error('WebSocket is not connected');
        return false;
      }

      try {
        const payload = {
          messages: options.messages,
          tools: options.tools || [],
          stream: options.stream !== undefined ? options.stream : true,
          context: options.context || {},
        };

        ws.current.send(JSON.stringify(payload));
        return true;
      } catch (error) {
        console.error('Failed to send message:', error);
        return false;
      }
    },
    []
  );

  const sendUserMessage = useCallback(
    (content: string, context?: SendMessageOptions['context']) => {
      // Add user message to local state
      const userMessage: Message = {
        role: 'user',
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // Send to WebSocket
      return sendMessage({
        messages: [{ role: 'user', content }],
        stream: true,
        context,
      });
    },
    [sendMessage]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    messages,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    sendMessage,
    sendUserMessage,
    clearMessages,
  };
}
