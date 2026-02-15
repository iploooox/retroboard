import { usePresenceStore } from '@/stores/presence';

export function PresenceBar() {
  const getUserList = usePresenceStore((s) => s.getUserList);
  const users = getUserList();

  if (users.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-slate-200">
      <span className="text-sm text-slate-600 font-medium">Online ({users.length}):</span>
      <div className="flex -space-x-2">
        {users.map((user) => (
          <div
            key={user.userId}
            className="relative inline-block"
            title={user.userName}
          >
            {user.userAvatar ? (
              <img
                src={user.userAvatar}
                alt={user.userName}
                className="h-8 w-8 rounded-full ring-2 ring-white object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full ring-2 ring-white bg-indigo-500 flex items-center justify-center text-white text-xs font-medium">
                {user.userName.charAt(0).toUpperCase()}
              </div>
            )}
            {/* Online status dot */}
            <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 border-2 border-white rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
