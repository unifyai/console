import { User } from '@/types/user';
import { SettingsView } from './SettingsView';

const Main = ({ user, externalIdentity }: { user: User; externalIdentity: boolean }) => {
  return <SettingsView user={user} externalIdentity={externalIdentity} />;
};

export default Main;
