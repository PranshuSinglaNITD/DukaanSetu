import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store'; 

const SOCKET_URL = 'http://192.168.1.8:3000'; 

class SocketClient {
  private socket: Socket | null = null;

  public async connect(): Promise<void> {
    if (this.socket) return; 
    const token = await SecureStore.getItemAsync('userToken');
    
    if (!token) {
      console.warn("Socket blocked: No auth token found in SecureStore.");
      return; 
    }
    
    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'] 
    });

    this.socket.on('connect', () => console.log('🟢 Socket Connected!'));
    this.socket.on('disconnect', () => console.log('🔴 Socket Disconnected'));
    this.socket.on('connect_error', (err: Error) => {
      console.error('Socket Connection Error:', err.message);
    });
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default new SocketClient();