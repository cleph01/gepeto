import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { apiGet } from '@/lib/api';
import { useMessages } from '@/context/messages';
import { ChatThread, isOptimistic, type ChatMessage } from '@/components/chat-thread';

// The driver's private conversation with dispatch, opened from the Dispatch
// button on Jobs. Offices never see it. For anything about a case that the
// office should see too, the job's own Messages is still the place.

const QUICK_REPLIES = ['Running ~10 min late', 'Heading back to the lab', 'Can you call me?', 'OK, thanks'];
// The signal can be missed, so an open conversation also checks on its own.
const POLL_MS = 8_000;

export default function DispatchChatScreen() {
  const { setDispatchOpen, markDispatchRead, dispatchMessageTick } = useMessages();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const seen = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<ChatMessage[]>('/api/driver/dispatch');
      setLoaded(true);
      if (!res.data) return;
      const list = res.data;
      const known = seen.current;
      if (known && list.some((m) => !known.has(m.id) && m.senderRole !== 'driver')) Haptics.selectionAsync();
      seen.current = new Set(list.map((m) => m.id));
      // Keep a message still on its way until its send finishes.
      setMessages((prev) => [...list, ...prev.filter(isOptimistic)]);
    } catch {
      // Offline: keep what's on screen.
      setLoaded(true);
    }
  }, []);

  // While this screen is in front, new messages here count as read.
  useFocusEffect(
    useCallback(() => {
      setDispatchOpen(true);
      load();
      const timer = setInterval(load, POLL_MS);
      return () => {
        clearInterval(timer);
        setDispatchOpen(false);
      };
    }, [load, setDispatchOpen])
  );

  useEffect(() => {
    // load only sets state after its fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (dispatchMessageTick > 0) load();
  }, [dispatchMessageTick, load]);

  const newestAt = messages.findLast((m) => !isOptimistic(m))?.createdAt ?? null;
  useEffect(() => {
    if (newestAt) markDispatchRead(newestAt);
  }, [newestAt, markDispatchRead]);

  return (
    <ChatThread
      title="Dispatch"
      subtitle="Private · offices don't see this"
      messages={messages}
      setMessages={setMessages}
      loaded={loaded}
      hideEmpty={false}
      sendPath="/api/driver/dispatch"
      closedNote={null}
      quickReplies={QUICK_REPLIES}
      labLabel="Dispatch"
      emptyText="Only the lab's dispatch sees what you send here. Offices don't."
    />
  );
}
