import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Job, Message } from '@gepeto/types';
import { supabase, channelName } from '@/lib/supabase';
import { rowToCamel } from '@/lib/transform';
import { useMessages } from '@/context/messages';
import { ChatThread, isOptimistic, type ChatMessage } from '@/components/chat-thread';

const QUICK_REPLIES = ['On my way', 'Running ~10 min late', 'Left at front desk', 'Call me'];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { setActiveChat, markRead } = useMessages();

  const [job, setJob] = useState<Job | null>(null);
  const [jobMissing, setJobMissing] = useState(false);
  const [officeName, setOfficeName] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  // No signal when it last tried (as opposed to the job no longer being theirs).
  const [offline, setOffline] = useState(false);
  const [loadTry, setLoadTry] = useState(0);

  // While this screen is in front, new messages here count as read.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      setActiveChat(id);
      return () => setActiveChat(null);
    }, [id, setActiveChat])
  );

  // The job and its messages. An error means no signal (try again soon); no
  // row means it isn't this driver's anymore.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    supabase
      .from('jobs')
      .select('*, offices(name)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        if (!data) {
          // Rejected or reassigned: row-level security hides it now.
          setJobMissing(true);
          return;
        }
        setJobMissing(false);
        setJob(rowToCamel<Job>(data));
        setOfficeName((data.offices as { name?: string } | null)?.name ?? null);
      });

    supabase
      .from('messages')
      .select('*')
      .eq('job_id', id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          const list = data.map((row) => rowToCamel<Message>(row));
          // Keep a message still on its way until its send finishes.
          setMessages((prev) => [...list, ...prev.filter((m) => isOptimistic(m) && !list.some((r) => r.id === m.id))]);
        }
        setOffline(!!error);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [id, loadTry]);

  // Couldn't load for lack of signal: keep trying, so it fills in on its own.
  useEffect(() => {
    if (!offline) return;
    const timer = setInterval(() => setLoadTry((n) => n + 1), 10_000);
    return () => clearInterval(timer);
  }, [offline]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(channelName(`chat-${id}`))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${id}` }, (payload) => {
        setJob(rowToCamel<Job>(payload.new as Record<string, unknown>));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `job_id=eq.${id}` }, (payload) => {
        const msg = rowToCamel<Message>(payload.new as Record<string, unknown>);
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        if (msg.senderRole !== 'driver') Haptics.selectionAsync();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Everything on screen has been seen: mark read up to the newest message.
  // Skips the optimistic copy, whose time is the phone's clock, not the server's.
  const newestAt = messages.findLast((m) => !isOptimistic(m))?.createdAt ?? null;
  useEffect(() => {
    if (id && newestAt) markRead(id, newestAt);
  }, [id, newestAt, markRead]);

  const closed = jobMissing || job?.status === 'delivered' || job?.driverResponse === 'rejected';
  const closedNote = !closed
    ? null
    : jobMissing
      ? "This job isn't yours anymore, so its messages are hidden."
      : 'This job is delivered. Messages are read-only.';

  return (
    <ChatThread
      title={job?.caseId}
      subtitle={job ? officeName ?? job.deliveryAddress : null}
      messages={messages}
      setMessages={setMessages}
      loaded={loaded}
      hideEmpty={jobMissing}
      sendPath={`/api/jobs/${id}/messages`}
      closedNote={closedNote}
      quickReplies={QUICK_REPLIES}
      emptyTitle={offline ? "Couldn't load messages" : undefined}
      emptyText={offline ? "Check your signal. It'll keep trying on its own." : undefined}
    />
  );
}
