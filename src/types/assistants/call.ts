export interface ConnectionDetails {
  serverUrl: string;
  roomName: string;
  token: string;
  mode?: 'dev' | 'live';
}
