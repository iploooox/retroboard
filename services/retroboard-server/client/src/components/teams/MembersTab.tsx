import { useEffect, useState, type FormEvent } from 'react';
import { Plus, AlertCircle, Copy, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';

interface Member {
  user: {
    id: string;
    email: string;
    display_name: string;
    avatar_url: string | null;
  };
  role: string;
  joined_at: string;
}

interface Invitation {
  id: string;
  code: string;
  invite_url: string;
  role: string;
  expires_at: string;
  max_uses: number | null;
  use_count: number;
  created_at: string;
}

interface MembersTabProps {
  teamId: string;
  userRole: string;
}

const roleBadgeVariant = {
  admin: 'purple' as const,
  facilitator: 'blue' as const,
  member: 'gray' as const,
};

export function MembersTab({ teamId, userRole }: MembersTabProps) {
  const currentUser = useAuthStore((s) => s.user);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const isAdmin = userRole === 'admin';

  const fetchMembers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<{ members: Member[] }>(`/teams/${teamId}/members`);
      setMembers(data.members);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load members');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInvitations = async () => {
    if (!isAdmin) return;
    try {
      const data = await api.get<{ invitations: Invitation[] }>(`/teams/${teamId}/invitations`);
      setInvitations(data.invitations);
    } catch {
      // Non-critical; silently fail
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchInvitations();
  }, [teamId]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.put(`/teams/${teamId}/members/${userId}`, { role: newRole });
      toast.success('Role updated');
      fetchMembers();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update role');
    }
  };

  const handleRemove = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from the team?`)) return;
    try {
      await api.delete(`/teams/${teamId}/members/${userId}`);
      toast.success('Member removed');
      fetchMembers();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to remove member');
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await api.delete(`/teams/${teamId}/invitations/${inviteId}`);
      toast.success('Invitation revoked');
      fetchInvitations();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to revoke invitation');
    }
  };

  const adminCount = members.filter((m) => m.role === 'admin').length;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6 text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
        <div>
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={fetchMembers} className="text-sm text-red-600 underline mt-1">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Members ({members.length})
        </h3>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowInviteModal(true)}>
            <Plus className="h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {members.map((member) => {
          const initials = member.user.display_name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
          const isSelf = member.user.id === currentUser?.id;
          const isLastAdmin = member.role === 'admin' && adminCount <= 1;

          return (
            <div key={member.user.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-medium shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {member.user.display_name}
                      {isSelf && <span className="text-slate-400 ml-1">(you)</span>}
                    </span>
                    <Badge variant={roleBadgeVariant[member.role as keyof typeof roleBadgeVariant] || 'gray'}>
                      {member.role}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500 truncate">{member.user.email}</p>
                </div>
              </div>

              {isAdmin && !isSelf && (
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.user.id, e.target.value)}
                    disabled={isLastAdmin && member.role === 'admin'}
                    className="text-sm border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="facilitator">Facilitator</option>
                    <option value="member">Member</option>
                  </select>
                  <button
                    onClick={() => handleRemove(member.user.id, member.user.display_name)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"
                    aria-label={`Remove ${member.user.display_name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && invitations.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Active Invitations
          </h4>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-4">
                <div className="text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={roleBadgeVariant[inv.role as keyof typeof roleBadgeVariant] || 'gray'}>
                      {inv.role}
                    </Badge>
                    <span className="text-slate-500">
                      {inv.max_uses ? `${inv.use_count}/${inv.max_uses} uses` : `${inv.use_count} uses`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Expires {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inv.invite_url);
                      toast.success('Invite link copied!');
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    aria-label="Copy invite link"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleRevokeInvite(inv.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"
                    aria-label="Revoke invitation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <InviteModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        teamId={teamId}
        onCreated={() => { setShowInviteModal(false); fetchInvitations(); }}
      />
    </div>
  );
}

function InviteModal({
  open,
  onClose,
  teamId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  teamId: string;
  onCreated: () => void;
}) {
  const [role, setRole] = useState('member');
  const [expiresInHours, setExpiresInHours] = useState('168');
  const [maxUses, setMaxUses] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = await api.post<{ invitation: Invitation }>(`/teams/${teamId}/invitations`, {
        role,
        expires_in_hours: parseInt(expiresInHours),
        max_uses: maxUses ? parseInt(maxUses) : null,
      });
      setCreatedLink(data.invitation.invite_url);
      navigator.clipboard.writeText(data.invitation.invite_url);
      toast.success('Invite link created and copied!');
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCreatedLink(null);
    setRole('member');
    setExpiresInHours('168');
    setMaxUses('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Invite Members">
      {createdLink ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Share this link to invite members:</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={createdLink}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(createdLink);
                toast.success('Copied!');
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="secondary" onClick={handleClose} className="w-full">Done</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="invite-role" className="block text-sm font-medium text-slate-700">Role</label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="member">Member</option>
              <option value="facilitator">Facilitator</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="invite-expires" className="block text-sm font-medium text-slate-700">Expires in</label>
            <select
              id="invite-expires"
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="24">1 day</option>
              <option value="168">7 days</option>
              <option value="720">30 days</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="invite-max-uses" className="block text-sm font-medium text-slate-700">
              Max uses (optional)
            </label>
            <input
              id="invite-max-uses"
              type="number"
              min="1"
              max="1000"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Unlimited"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Create Invite</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
