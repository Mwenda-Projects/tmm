import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStatus } from '@/contexts/GuestContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, LogOut, LogIn, GraduationCap, Clock, ShieldAlert, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/utils';

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      'relative rounded-[20px] border overflow-hidden backdrop-blur-xl',
      'bg-white/70 dark:bg-white/[0.04]',
      'border-white/60 dark:border-white/[0.08]',
      'shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_32px_rgba(0,0,0,0.4)]',
      className,
    )}>
      {children}
    </div>
  );
}

interface Major { id: string; name: string; }
interface Group { id: string; name: string; major_id: string | null; last_activity: string | null; }

function ActivityIndicator({ lastActivity }: { lastActivity: string | null }) {
  const getStatus = () => {
    if (!lastActivity) return { label: 'Quiet', color: 'bg-zinc-400 dark:bg-zinc-600' };
    const diff = Date.now() - new Date(lastActivity).getTime();
    if (diff <= 5 * 60 * 1000) return { label: 'Active now', color: 'bg-emerald-500' };
    if (diff <= 24 * 60 * 60 * 1000) return { label: 'Recently active', color: 'bg-amber-500' };
    return { label: 'Quiet', color: 'bg-zinc-400 dark:bg-zinc-600' };
  };
  const { label, color } = getStatus();
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${color}`} />
      {label}
    </span>
  );
}

function GuestCountdown({ expiresAt }: { expiresAt: Date }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setRemaining(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return (
    <GlassCard className="flex items-center gap-3 p-4 border-amber-500/20 dark:border-amber-500/15">
      <Clock style={{ width: 15, height: 15 }} className="text-amber-500 shrink-0" />
      <div className="flex-1">
        <p className="text-[13px] font-semibold text-foreground">Guest Session</p>
        <p className="text-[11px] text-muted-foreground">Time remaining: <span className="font-mono font-semibold text-amber-500">{remaining}</span></p>
      </div>
    </GlassCard>
  );
}

export default function Groups() {
  const { user } = useAuth();
  const { isGuest, expiresAt } = useGuestStatus();
  const { toast } = useToast();

  const [majors, setMajors] = useState<Major[]>([]);
  const [userMajorIds, setUserMajorIds] = useState<string[]>([]);
  const [selectedMajorId, setSelectedMajorId] = useState<string>('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [joinedGroupIds, setJoinedGroupIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [majorsRes, userMajorsRes, membershipRes] = await Promise.all([
        supabase.from('majors').select('id, name').order('name'),
        supabase.from('user_major_map').select('major_id').eq('user_id', user.id),
        supabase.from('group_members').select('group_id').eq('user_id', user.id),
      ]);
      if (majorsRes.data) setMajors(majorsRes.data);
      if (userMajorsRes.data) {
        const ids = userMajorsRes.data.map(r => r.major_id);
        setUserMajorIds(ids);
        if (ids.length > 0 && !selectedMajorId) setSelectedMajorId(ids[0]);
      }
      if (membershipRes.data) setJoinedGroupIds(new Set(membershipRes.data.map(r => r.group_id)));
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (!selectedMajorId) { setGroups([]); return; }
    const fetchGroups = () => {
      supabase.from('groups').select('id, name, major_id, last_activity')
        .eq('major_id', selectedMajorId).order('name')
        .then(({ data }) => { if (data) setGroups(data); });
    };
    fetchGroups();

    // Realtime — new groups, deletions, activity updates
    const channel = supabase.channel(`groups-${selectedMajorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: `major_id=eq.${selectedMajorId}` }, fetchGroups)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedMajorId]);

  const associateMajor = useCallback(async (majorId: string) => {
    if (!user || userMajorIds.includes(majorId)) return;
    setLoading(true);
    const { error } = await supabase.from('user_major_map').insert({ user_id: user.id, major_id: majorId });
    if (error) toast({ title: 'Error', description: 'Failed to add major.', variant: 'destructive' });
    else { setUserMajorIds(p => [...p, majorId]); toast({ title: 'Major added.' }); }
    setLoading(false);
  }, [user, userMajorIds, toast]);

  const removeMajor = useCallback(async (majorId: string) => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from('user_major_map').delete().eq('user_id', user.id).eq('major_id', majorId);
    if (error) toast({ title: 'Error', description: 'Failed to remove major.', variant: 'destructive' });
    else {
      setUserMajorIds(p => p.filter(id => id !== majorId));
      if (selectedMajorId === majorId) setSelectedMajorId('');
      toast({ title: 'Major removed.' });
    }
    setLoading(false);
  }, [user, selectedMajorId, toast]);

  const joinGroup = useCallback(async (groupId: string) => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from('group_members').insert({ user_id: user.id, group_id: groupId });
    if (error) toast({ title: 'Error', description: 'Failed to join group.', variant: 'destructive' });
    else { setJoinedGroupIds(p => new Set(p).add(groupId)); toast({ title: 'Joined!' }); }
    setLoading(false);
  }, [user, toast]);

  const leaveGroup = useCallback(async (groupId: string) => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from('group_members').delete().eq('user_id', user.id).eq('group_id', groupId);
    if (error) toast({ title: 'Error', description: 'Failed to leave group.', variant: 'destructive' });
    else {
      setJoinedGroupIds(p => { const n = new Set(p); n.delete(groupId); return n; });
      toast({ title: 'Left group.' });
    }
    setLoading(false);
  }, [user, toast]);

  const handleMajorSelect = (majorId: string) => {
    setSelectedMajorId(majorId);
    if (!userMajorIds.includes(majorId)) associateMajor(majorId);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Mesh background */}
      <div className="fixed inset-0 dark:hidden pointer-events-none">
        <div className="absolute inset-0 bg-[#f0f2f5]" />
        <div className="absolute top-[-200px] left-[-100px] w-[600px] h-[600px] rounded-full blur-[120px] opacity-60" style={{ background: 'radial-gradient(circle, #dbeafe, transparent)' }} />
        <div className="absolute top-[100px] right-[-100px] w-[500px] h-[500px] rounded-full blur-[120px] opacity-50" style={{ background: 'radial-gradient(circle, #ede9fe, transparent)' }} />
        <div className="absolute bottom-[-100px] left-[30%] w-[500px] h-[400px] rounded-full blur-[120px] opacity-40" style={{ background: 'radial-gradient(circle, #dcfce7, transparent)' }} />
      </div>
      <div className="fixed inset-0 hidden dark:block pointer-events-none">
        <div className="absolute inset-0 bg-[#0d0d0f]" />
        <div className="absolute top-[-200px] left-[-100px] w-[700px] h-[700px] rounded-full blur-[160px] opacity-30" style={{ background: 'radial-gradient(circle, #312e81, transparent)' }} />
        <div className="absolute top-[200px] right-[-100px] w-[500px] h-[500px] rounded-full blur-[140px] opacity-20" style={{ background: 'radial-gradient(circle, #134e4a, transparent)' }} />
        <div className="absolute bottom-[-50px] left-[40%] w-[600px] h-[400px] rounded-full blur-[140px] opacity-25" style={{ background: 'radial-gradient(circle, #1e1b4b, transparent)' }} />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-16 space-y-5">

        <div>
          <h1 className="text-[32px] font-semibold text-foreground tracking-tight flex items-center gap-3">
            <GraduationCap style={{ width: 28, height: 28 }} className="text-primary" />
            Academic Groups
          </h1>
          <p className="text-[14px] text-muted-foreground mt-1">Select a major to see related groups, then join to start chatting.</p>
        </div>

        {isGuest && expiresAt && (
          <div className="space-y-3">
            <GuestCountdown expiresAt={expiresAt} />
            <GlassCard className="flex items-start gap-3 p-4 border-amber-500/15">
              <ShieldAlert style={{ width: 14, height: 14 }} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[12px] text-muted-foreground">
                As a guest you can browse and join groups, but <strong className="text-foreground">posting is disabled</strong>. Register to unlock full access.
              </p>
            </GlassCard>
          </div>
        )}

        {/* Major selector */}
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap style={{ width: 13, height: 13 }} className="text-primary" />
            </div>
            <h2 className="text-[13px] font-semibold text-foreground">Your Majors</h2>
          </div>
          <Select value={selectedMajorId} onValueChange={handleMajorSelect}>
            <SelectTrigger className="rounded-xl text-[13px] bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.08] dark:border-white/[0.08]">
              <SelectValue placeholder="Select a major…" />
            </SelectTrigger>
            <SelectContent>
              {majors.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {userMajorIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {userMajorIds.map(mid => {
                const major = majors.find(m => m.id === mid);
                if (!major) return null;
                const active = selectedMajorId === mid;
                return (
                  <button key={mid} onClick={() => setSelectedMajorId(mid)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-black/[0.05] dark:bg-white/[0.07] text-foreground hover:bg-black/[0.08] dark:hover:bg-white/[0.10]',
                    )}>
                    {major.name}
                    <span onClick={e => { e.stopPropagation(); removeMajor(mid); }}
                      className="ml-0.5 opacity-60 hover:opacity-100 text-[13px] leading-none"
                      aria-label={`Remove ${major.name}`}>×</span>
                  </button>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Groups list */}
        {selectedMajorId && (
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-7 w-7 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Users style={{ width: 13, height: 13 }} className="text-violet-500" />
              </div>
              <h2 className="text-[13px] font-semibold text-foreground">
                Groups for {majors.find(m => m.id === selectedMajorId)?.name}
              </h2>
            </div>
            {groups.length === 0 ? (
              <EmptyState icon={Users} title="No groups available" description="No groups have been created for this major yet." />
            ) : (
              <div className="space-y-2">
                {groups.map(g => {
                  const isMember = joinedGroupIds.has(g.id);
                  return (
                    <div key={g.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-[12px] font-bold text-primary">
                            {g.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <Link to={`/groups/${g.id}`}
                            className="text-[13px] font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-0.5">
                            {g.name}
                            <ChevronRight style={{ width: 12, height: 12 }} className="text-muted-foreground/40 shrink-0" />
                          </Link>
                          <ActivityIndicator lastActivity={g.last_activity} />
                        </div>
                      </div>
                      <Button size="sm" disabled={loading}
                        variant={isMember ? 'outline' : 'default'}
                        onClick={() => isMember ? leaveGroup(g.id) : joinGroup(g.id)}
                        className="rounded-xl text-[12px] h-8 px-3 gap-1.5 shrink-0">
                        {isMember
                          ? <><LogOut style={{ width: 12, height: 12 }} /> Leave</>
                          : <><LogIn style={{ width: 12, height: 12 }} /> Join</>}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        )}
      </div>
    </div>
  );
}