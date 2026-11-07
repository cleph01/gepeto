import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { apiGet } from '@/lib/api';
import { returnLabel, type ReturnCase } from '@/lib/returns';
import { useMessages } from '@/context/messages';
import { ChatThread, isOptimistic, type ChatMessage } from '@/components/chat-thread';

const QUICK_REPLIES = ['On my way', 'Running ~10 min late', "Can't find the cases", 'Call me'];
// The signal can be missed, so an open conversation also checks on its own.
const POLL_MS = 8_000;

export default function ReturnChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { setActiveReturnChat, markReturnRead, returnMessageTick } = useMessages();

  const [ret, setRet] = useState<ReturnCase | null>(null);
  const [missing, setMissing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const seen = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [msgs, rets] = await Promise.all([
        apiGet<ChatMessage[]>(`/api/returns/${id}/messages`),
        apiGet<ReturnCase[]>('/api/returns'),
      ]);
      setLoaded(true);
      if (!msgs.data) {
        // Rejected, unassigned or given to another driver.
        setMissing(true);
        return;
      }
      setMissing(false);
      const list = msgs.data;
      const known = seen.current;
      if (known && list.some((m) => !known.has(m.id) && m.senderRole !== 'driver')) Haptics.selectionAsync();
      seen.current = new Set(list.map((m) => m.id));
      // Keep a message still on its way until its send finishes.
      setMessages((prev) => [...list, ...prev.filter(isOptimistic)]);
      setRet(rets.data?.find((r) => r.id === id) ?? null);
    } catch {
      // Offline: keep what's on screen.
      setLoaded(true);
    }
  }, [id]);

  // While this screen is in front, new messages here count as read.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      setActiveReturnChat(id);
      load();
      const timer = setInterval(load, POLL_MS);
      return () => {
        clearInterval(timer);
        setActiveReturnChat(null);
      };
    }, [id, load, setActiveReturnChat])
  );

  useEffect(() => {
    // load only sets state after its fetches resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (returnMessageTick > 0) load();
  }, [returnMessageTick, load]);

  const newestAt = messages.findLast((m) => !isOptimistic(m))?.createdAt ?? null;
  useEffect(() => {
    if (id && newestAt) markReturnRead(id, newestAt);
  }, [id, newestAt, markReturnRead]);

  const closedNote = missing
    ? "This pickup isn't yours anymore, so its messages are hidden."
    : ret?.status === 'checked_in'
      ? 'This return is checked in. Messages are read-only.'
      : null;

  return (
    <ChatThread
      title={ret ? returnLabel(ret) : null}
      subtitle={ret?.officeName ?? null}
      messages={missing ? [] : messages}
      setMessages={setMessages}
      loaded={loaded}
      hideEmpty={missing}
      sendPath={`/api/returns/${id}/messages`}
      closedNote={closedNote}
      quickReplies={QUICK_REPLIES}
    />
  );
}
