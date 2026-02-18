import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStatus } from '@/contexts/GuestContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, LogOut, LogIn, GraduationCap, Clock, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/EmptyState';

interface Major {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  major_id: string | null;
  last_activity: string | null;
}

function ActivityIndicator({ lastActivity }: { lastActivity: string | null }) {
  const getStatus = () => {
    if (!lastActivity) return { label: 'Quiet', color: 'bg-muted-foreground' };
    const diff = Date.now() - new Date(lastActivity).getTime();
    const fiveMin = 5 * 60 * 1000;
    const twentyFourHrs = 24 * 60 * 60 * 1000;
    if (diff <= fiveMin) return { label: 'Active Now', color: 'bg-green-500' };
    if (diff <= twentyFourHrs) return { label: 'Recently Active', color: 'bg-amber-500' };
    return { label: 'Quiet', color: 'bg-muted-foreground' };
  };
  const { label, color } = getStatus();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function GuestCountdown({ expiresAt }: { expiresAt: Date }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const tick = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Expired');
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <Card className="border-dashed border-amber-500/40 bg-amber-500/5">
      <CardContent className="flex items-center gap-3 py-4">
        <Clock className="h-5 w-5 text-amber-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Guest Session</p>
          <p className="text-xs text-muted-foreground">
            Time remaining: <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{remaining}</span>
          </p>
        </div>
      </CardContent>
    </Card>
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

  // Fetch majors + user's current majors
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
        const ids = userMajorsRes.data.map((r) => r.major_id);
        setUserMajorIds(ids);
        if (ids.length > 0 && !selectedMajorId) setSelectedMajorId(ids[0]);
      }
      if (membershipRes.data) {
        setJoinedGroupIds(new Set(membershipRes.data.map((r) => r.group_id)));
      }
    };

    fetchData();
  }, [user]);

  // Fetch groups when selected major changes
  useEffect(() => {
    if (!selectedMajorId) {
      setGroups([]);
      return;
    }

    supabase
      .from('groups')
      .select('id, name, major_id, last_activity')
      .eq('major_id', selectedMajorId)
      .order('name')
      .then(({ data }) => {
        if (data) setGroups(data);
      });
  }, [selectedMajorId]);

  const associateMajor = useCallback(async (majorId: string) => {
    if (!user || userMajorIds.includes(majorId)) return;
    setLoading(true);
    const { error } = await supabase
      .from('user_major_map')
      .insert({ user_id: user.id, major_id: majorId });
    if (error) {
      toast({ title: 'Error', description: 'Failed to add major.', variant: 'destructive' });
    } else {
      setUserMajorIds((prev) => [...prev, majorId]);
      toast({ title: 'Major added', description: 'You are now associated with this major.' });
    }
    setLoading(false);
  }, [user, userMajorIds, toast]);

  const removeMajor = useCallback(async (majorId: string) => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from('user_major_map')
      .delete()
      .eq('user_id', user.id)
      .eq('major_id', majorId);
    if (error) {
      toast({ title: 'Error', description: 'Failed to remove major.', variant: 'destructive' });
    } else {
      setUserMajorIds((prev) => prev.filter((id) => id !== majorId));
      if (selectedMajorId === majorId) setSelectedMajorId('');
      toast({ title: 'Major removed' });
    }
    setLoading(false);
  }, [user, selectedMajorId, toast]);

  const joinGroup = useCallback(async (groupId: string) => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from('group_members')
      .insert({ user_id: user.id, group_id: groupId });
    if (error) {
      toast({ title: 'Error', description: 'Failed to join group.', variant: 'destructive' });
    } else {
      setJoinedGroupIds((prev) => new Set(prev).add(groupId));
      toast({ title: 'Joined group!' });
    }
    setLoading(false);
  }, [user, toast]);

  const leaveGroup = useCallback(async (groupId: string) => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('user_id', user.id)
      .eq('group_id', groupId);
    if (error) {
      toast({ title: 'Error', description: 'Failed to leave group.', variant: 'destructive' });
    } else {
      setJoinedGroupIds((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
      toast({ title: 'Left group' });
    }
    setLoading(false);
  }, [user, toast]);

  const handleMajorSelect = (majorId: string) => {
    setSelectedMajorId(majorId);
    if (!userMajorIds.includes(majorId)) {
      associateMajor(majorId);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            Academic Groups
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a major to see related groups, then join to start chatting.
          </p>
        </div>

        {/* Guest countdown + restriction notice */}
        {isGuest && expiresAt && (
          <div className="space-y-3">
            <GuestCountdown expiresAt={expiresAt} />
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/50 p-3">
              <ShieldAlert className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                As a guest you can browse and join groups, but <strong>posting is disabled</strong>. Register to unlock full access.
              </p>
            </div>
          </div>
        )}

        {/* Major selector */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Majors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedMajorId} onValueChange={handleMajorSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a major…" />
              </SelectTrigger>
              <SelectContent>
                {majors.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {userMajorIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {userMajorIds.map((mid) => {
                  const major = majors.find((m) => m.id === mid);
                  if (!major) return null;
                  return (
                    <Badge
                      key={mid}
                      variant={selectedMajorId === mid ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => setSelectedMajorId(mid)}
                    >
                      {major.name}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeMajor(mid); }}
                        className="ml-1.5 text-xs opacity-60 hover:opacity-100"
                        aria-label={`Remove ${major.name}`}
                      >
                        ×
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Groups list */}
        {selectedMajorId && (
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Groups for {majors.find((m) => m.id === selectedMajorId)?.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                {groups.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No groups available"
                    description="No groups have been created for this major yet."
                  />
                ) : (
                  <div className="space-y-2">
                    {groups.map((g) => {
                      const isMember = joinedGroupIds.has(g.id);
                      return (
                        <div
                          key={g.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                              <Users className="h-4 w-4 text-secondary-foreground" />
                            </div>
                            <div className="min-w-0">
                              <Link to={`/groups/${g.id}`} className="font-medium text-sm text-foreground truncate hover:underline">{g.name}</Link>
                              <ActivityIndicator lastActivity={g.last_activity} />
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={isMember ? 'outline' : 'default'}
                            disabled={loading}
                            onClick={() => isMember ? leaveGroup(g.id) : joinGroup(g.id)}
                          >
                            {isMember ? (
                              <><LogOut className="h-3.5 w-3.5 mr-1" /> Leave</>
                            ) : (
                              <><LogIn className="h-3.5 w-3.5 mr-1" /> Join</>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
