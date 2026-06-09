import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  Dimensions,
  Pressable,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Audio } from 'expo-av';
import api, { SOCKET_URL, getImageUrl, appendFileToFormData } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../src/constants/theme';
import {
  encryptMessage,
  decryptMessage,
  getOrCreateKeyPair,
  isEncrypted,
} from '../../src/services/crypto';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Message {
  _id: string;
  sender: { _id: string; name: string };
  text: string;
  type?: 'text' | 'image' | 'video' | 'audio' | 'icebreaker';
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
  read?: boolean;
  readAt?: string;
  createdAt: string;
}

const REPORT_REASONS = [
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'harassment', label: 'Harassment' },
  { key: 'spam', label: 'Spam' },
  { key: 'fake_profile', label: 'Fake profile' },
  { key: 'other', label: 'Other' },
];

function VideoMessageBubble({ videoUrl }: { videoUrl: string }) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
  });

  return (
    <View style={{ width: 220, height: 160, borderRadius: 12, overflow: 'hidden', marginBottom: 4 }}>
      <VideoView
        player={player}
        style={{ width: 220, height: 160 }}
        contentFit="cover"
        nativeControls
      />
    </View>
  );
}

function AudioMessageBubble({ audioUrl, duration, isOwn }: { audioUrl: string; duration?: number; isOwn: boolean }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => { sound?.unloadAsync(); };
  }, [sound]);

  const togglePlayback = async () => {
    try {
      if (sound && isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
        return;
      }

      if (sound) {
        await sound.playAsync();
        setIsPlaying(true);
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: getImageUrl(audioUrl) },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setPosition(status.positionMillis);
          setTotalDuration(status.durationMillis || (duration ? duration * 1000 : 0));
          if (status.durationMillis) {
            const pct = status.positionMillis / status.durationMillis;
            progressAnim.setValue(pct);
          }
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
            progressAnim.setValue(0);
          }
        }
      );
      setSound(newSound);
      setIsPlaying(true);
    } catch (e) {
      console.error('Audio playback error:', e);
    }
  };

  const formatTime = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <TouchableOpacity onPress={togglePlayback} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 160 }}>
      <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color={isOwn ? COLORS.white : COLORS.primary} />
      <View style={{ flex: 1, height: 4, backgroundColor: isOwn ? 'rgba(255,255,255,0.3)' : COLORS.border, borderRadius: 2, overflow: 'hidden' }}>
        <Animated.View style={{
          height: '100%',
          backgroundColor: isOwn ? COLORS.white : COLORS.primary,
          borderRadius: 2,
          width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }} />
      </View>
      <Text style={{ fontSize: 11, color: isOwn ? 'rgba(255,255,255,0.7)' : COLORS.textLight }}>
        {isPlaying ? formatTime(position) : formatTime(totalDuration * 1000)}
      </Text>
    </TouchableOpacity>
  );
}

export default function ChatScreen() {
  const { matchId, userName, userId } = useLocalSearchParams<{
    matchId: string;
    userName: string;
    userId: string;
  }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [icebreakers, setIcebreakers] = useState<string[]>([]);
  const [showIcebreakers, setShowIcebreakers] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myPrivateKeyRef = useRef<string>('');
  const peerPublicKeyRef = useRef<string>('');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    initE2EE().then(() => {
      loadMessages();
      setupSocket();
    });
    loadIcebreakers();
    return () => { socketRef.current?.disconnect(); };
  }, []);

  const initE2EE = async () => {
    try {
      const keyPair = await getOrCreateKeyPair();
      myPrivateKeyRef.current = keyPair.privateKey;
      if (userId) {
        const { publicKey } = await api.getPeerPublicKey(userId);
        peerPublicKeyRef.current = publicKey || '';
      }
    } catch (e) {
      console.warn('E2EE init failed:', e);
    }
  };

  const tryDecrypt = (msg: Message): Message => {
    if (msg.type !== 'text' || !msg.text) return msg;
    if (!isEncrypted(msg.text)) return msg;
    if (!myPrivateKeyRef.current || !peerPublicKeyRef.current) {
      // Keys not available — show placeholder instead of ciphertext
      return { ...msg, text: '🔒 Encrypted message' };
    }
    const decrypted = decryptMessage(msg.text, myPrivateKeyRef.current, peerPublicKeyRef.current);
    if (!decrypted) {
      // Decryption failed (different device/key pair) — show placeholder
      return { ...msg, text: '🔒 Encrypted message' };
    }
    return { ...msg, text: decrypted };
  };

  const tryEncrypt = (plaintext: string): string => {
    // Only encrypt on native; web sessions use different keys and can't cross-decrypt
    if (Platform.OS === 'web') return plaintext;
    if (!myPrivateKeyRef.current || !peerPublicKeyRef.current) return plaintext;
    try {
      return encryptMessage(plaintext, myPrivateKeyRef.current, peerPublicKeyRef.current);
    } catch {
      return plaintext;
    }
  };

  const setupSocket = () => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;
    socket.on('connect', () => { if (user?._id) socket.emit('user_online', user._id); });
    socket.on('receive_message', (data: Message) => {
      if (data.sender._id !== user?._id) {
        setMessages((prev) => [...prev, tryDecrypt(data)]);
        api.markMessagesRead(matchId!);
        socket.emit('message_read', { matchId, senderId: data.sender._id, readBy: user?._id });
      }
    });
    socket.on('user_typing', (data: { userId: string; matchId: string; isTyping: boolean }) => {
      if (data.matchId === matchId && data.userId === userId) setPeerTyping(data.isTyping);
    });
    socket.on('messages_read', (data: { matchId: string; readAt: string }) => {
      if (data.matchId === matchId) {
        setMessages((prev) => prev.map((msg) =>
          msg.sender._id === user?._id ? { ...msg, read: true, readAt: data.readAt } : msg
        ));
      }
    });
    // Handle incoming video call
    socket.on('incoming_call', (data: { callerId: string; callerName: string; matchId: string; offer: any }) => {
      Alert.alert(
        'Incoming Video Call',
        `${data.callerName} is calling you`,
        [
          {
            text: 'Decline',
            style: 'cancel',
            onPress: () => {
              socket.emit('reject_call', { callerId: data.callerId, reason: 'rejected' });
            },
          },
          {
            text: 'Answer',
            onPress: () => {
              router.push({
                pathname: '/call/[matchId]',
                params: {
                  matchId: data.matchId,
                  userId: data.callerId,
                  userName: data.callerName,
                  isIncoming: 'true',
                  offer: JSON.stringify(data.offer),
                },
              });
            },
          },
        ],
      );
    });
  };

  const loadMessages = async () => {
    try {
      const data = await api.getMessages(matchId!);
      setMessages(data.map(tryDecrypt));
      api.markMessagesRead(matchId!);
    } catch (error) { console.error('Failed to load messages:', error); }
    finally { setLoading(false); }
  };

  const loadIcebreakers = async () => {
    try { const data = await api.getIcebreakers(); setIcebreakers(data); } catch { }
  };

  const handleTextChange = (value: string) => {
    setText(value);
    if (!isTyping) {
      setIsTyping(true);
      socketRef.current?.emit('typing', { senderId: user?._id, receiverId: userId, matchId, isTyping: true });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketRef.current?.emit('typing', { senderId: user?._id, receiverId: userId, matchId, isTyping: false });
    }, 2000);
  };

  const sendMessage = async () => {
    if (!text.trim() || sending) return;
    const messageText = text.trim();
    setText('');
    setSending(true);
    setIsTyping(false);
    socketRef.current?.emit('typing', { senderId: user?._id, receiverId: userId, matchId, isTyping: false });
    try {
      const encryptedText = tryEncrypt(messageText);
      const isE2EE = encryptedText !== messageText;
      const newMessage = await api.sendMessage(matchId!, encryptedText, isE2EE);
      // Show decrypted text locally
      setMessages((prev) => [...prev, { ...newMessage, text: messageText }]);
      socketRef.current?.emit('send_message', { ...newMessage, receiverId: userId });
    } catch (error) { console.error('Failed to send:', error); setText(messageText); }
    finally { setSending(false); }
  };

  const pickMedia = async (source: 'library' | 'camera') => {
    setShowAttach(false);
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission required', 'Camera access is needed.'); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, videoMaxDuration: 60 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission required', 'Media library access is needed.'); return; }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, videoMaxDuration: 60 });
      }
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      await sendMediaMessage(asset);
    } catch (error) {
      console.error('Media pick failed:', error);
      Alert.alert('Error', 'Failed to pick media');
    }
  };

  const sendMediaMessage = async (asset: ImagePicker.ImagePickerAsset) => {
    setSending(true);
    try {
      const isVideo = asset.type === 'video';
      const mimeType = asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');
      const extFromMime = mimeType.split('/').pop() || (isVideo ? 'mp4' : 'jpg');
      const fieldName = isVideo ? 'video' : 'image';
      const fileName = `${fieldName}-${Date.now()}.${extFromMime}`;

      let newMessage;
      if (Platform.OS === 'web') {
        const formData = new FormData();
        await appendFileToFormData(formData, fieldName, asset.uri, fileName, mimeType);
        newMessage = isVideo
          ? await api.sendVideoMessage(matchId!, formData)
          : await api.sendImageMessage(matchId!, formData);
      } else {
        newMessage = isVideo
          ? await api.sendVideoMessage(matchId!, asset.uri, fileName, mimeType)
          : await api.sendImageMessage(matchId!, asset.uri, fileName, mimeType);
      }
      setMessages((prev) => [...prev, newMessage]);
      socketRef.current?.emit('send_message', { ...newMessage, receiverId: userId });
    } catch (error) {
      console.error('Failed to send media:', error);
      Alert.alert('Error', 'Failed to send media');
    } finally {
      setSending(false);
    }
  };

  // --- Voice recording ---
  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Microphone access is needed to record voice messages.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (e) {
      console.error('Failed to start recording:', e);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const cancelRecording = async () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
    try {
      await recordingRef.current?.stopAndUnloadAsync();
    } catch {}
    recordingRef.current = null;
  };

  const stopAndSendRecording = async () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    const duration = recordingDuration;
    setRecordingDuration(0);

    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) return;

      setSending(true);
      const fileName = `voice-${Date.now()}.m4a`;
      const mimeType = 'audio/m4a';

      let newMessage;
      if (Platform.OS === 'web') {
        const formData = new FormData();
        await appendFileToFormData(formData, 'audio', uri, fileName, mimeType);
        formData.append('duration', String(duration));
        newMessage = await api.sendAudioMessage(matchId!, formData);
      } else {
        newMessage = await api.sendAudioMessage(matchId!, uri, fileName, mimeType, duration);
      }
      setMessages((prev) => [...prev, newMessage]);
      socketRef.current?.emit('send_message', { ...newMessage, receiverId: userId });
    } catch (error) {
      console.error('Failed to send voice message:', error);
      Alert.alert('Error', 'Failed to send voice message');
    } finally {
      setSending(false);
    }
  };

  const handleUnmatch = () => {
    Alert.alert('Unmatch', `Unmatch with ${userName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unmatch', style: 'destructive', onPress: async () => { try { await api.unmatch(matchId!); router.back(); } catch { Alert.alert('Error', 'Failed'); } } },
    ]);
  };

  const handleBlock = () => {
    Alert.alert('Block', `Block ${userName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: async () => { try { await api.blockUser(userId!); router.back(); } catch { Alert.alert('Error', 'Failed'); } } },
    ]);
  };

  const handleReport = (reason: string) => {
    setShowMenu(false);
    Alert.alert('Report Sent', 'Thank you for reporting.');
    api.reportUser(userId!, reason).catch(() => {});
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.sender._id === user?._id;
    const showRead = isOwn && index === messages.length - 1 && item.read;
    return (
      <View>
        <View style={[styles.messageBubble, isOwn ? styles.ownMessage : styles.otherMessage]}>
          {item.type === 'image' && item.imageUrl && (
            <TouchableOpacity onPress={() => setFullscreenImage(getImageUrl(item.imageUrl!))}>
              <Image source={{ uri: getImageUrl(item.imageUrl) }} style={styles.messageImage} resizeMode="cover" />
            </TouchableOpacity>
          )}
          {item.type === 'video' && item.videoUrl && (
            <VideoMessageBubble videoUrl={getImageUrl(item.videoUrl)} />
          )}
          {item.type === 'audio' && item.audioUrl && (
            <AudioMessageBubble audioUrl={item.audioUrl} duration={item.audioDuration} isOwn={isOwn} />
          )}
          {item.text ? <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>{item.text}</Text> : null}
          <Text style={[styles.messageTime, isOwn && styles.ownMessageTime]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {showRead && <Text style={styles.readReceipt}>✓✓ Read</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.headerName}>{userName}</Text>
            {peerPublicKeyRef.current ? (
              <Ionicons name="lock-closed" size={12} color={COLORS.success || '#4CAF50'} />
            ) : null}
          </View>
          {peerTyping && <Text style={styles.typingText}>typing...</Text>}
        </View>
        <TouchableOpacity
          onPress={() => {
            router.push({
              pathname: '/call/[matchId]',
              params: { matchId: matchId!, userId: userId!, userName: userName! },
            });
          }}
          style={styles.menuButton}
        >
          <Ionicons name="videocam-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={styles.chatContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={10}>
        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : messages.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="chatbubble-ellipses-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>Say hello to {userName}!</Text>
            {icebreakers.length > 0 && (
              <TouchableOpacity style={styles.icebreakerBtn} onPress={() => setShowIcebreakers(true)}>
                <Ionicons name="bulb-outline" size={16} color={COLORS.accent} />
                <Text style={styles.icebreakerBtnText}>Need an icebreaker?</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList ref={flatListRef} data={messages} keyExtractor={(item) => item._id} renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false} />
        )}
        {peerTyping && messages.length > 0 && (
          <View style={styles.typingIndicator}>
            <View style={styles.typingDots}><View style={styles.dot} /><View style={[styles.dot, { opacity: 0.7 }]} /><View style={[styles.dot, { opacity: 0.4 }]} /></View>
          </View>
        )}
        {isRecording ? (
          <View style={styles.inputBar}>
            <TouchableOpacity onPress={cancelRecording} style={{ paddingHorizontal: SPACING.md, paddingBottom: 7 }}>
              <Ionicons name="trash-outline" size={24} color={COLORS.error} />
            </TouchableOpacity>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingBottom: 7 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.error }} />
              <Text style={{ ...FONTS.regular, color: COLORS.error, fontWeight: '600' }}>
                {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
              </Text>
              <Text style={{ ...FONTS.caption, color: COLORS.textSecondary }}>Recording...</Text>
            </View>
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: COLORS.success || '#10B981' }]}
              onPress={stopAndSendRecording}
            >
              <Ionicons name="send" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputBar}>
            <TouchableOpacity style={styles.attachButton} onPress={() => setShowAttach(true)}>
              <Ionicons name="add-circle" size={28} color={COLORS.primary} />
            </TouchableOpacity>
            <TextInput style={styles.textInput} placeholder="Type a message..." placeholderTextColor={COLORS.textLight}
              value={text} onChangeText={handleTextChange} multiline maxLength={1000} />
            {text.trim() ? (
              <TouchableOpacity style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                onPress={sendMessage} disabled={sending}>
                <Ionicons name="send" size={20} color={COLORS.white} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.sendButton, { backgroundColor: COLORS.secondary || '#F43F5E' }]}
                onPress={startRecording} disabled={sending}>
                <Ionicons name="mic" size={22} color={COLORS.white} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal visible={showMenu} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={styles.menuContent}>
            <TouchableOpacity style={styles.menuItem} onPress={handleUnmatch}>
              <Ionicons name="heart-dislike-outline" size={20} color={COLORS.error} />
              <Text style={[styles.menuItemText, { color: COLORS.error }]}>Unmatch</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleBlock}>
              <Ionicons name="ban-outline" size={20} color={COLORS.error} />
              <Text style={[styles.menuItemText, { color: COLORS.error }]}>Block</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <Text style={styles.menuLabel}>Report</Text>
            {REPORT_REASONS.map((r) => (
              <TouchableOpacity key={r.key} style={styles.menuItem} onPress={() => handleReport(r.key)}>
                <Ionicons name="flag-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.menuItemText}>{r.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.menuItem, { marginTop: SPACING.sm }]} onPress={() => setShowMenu(false)}>
              <Text style={[styles.menuItemText, { color: COLORS.primary, fontWeight: '600' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showIcebreakers} animationType="slide" transparent>
        <View style={styles.menuOverlay}>
          <View style={styles.menuContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
              <Text style={{ ...FONTS.h3, color: COLORS.text }}>Icebreakers</Text>
              <TouchableOpacity onPress={() => setShowIcebreakers(false)}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
            </View>
            {icebreakers.map((prompt, i) => (
              <TouchableOpacity key={i} style={styles.icebreakerItem} onPress={() => { setShowIcebreakers(false); setText(prompt); }}>
                <Ionicons name="chatbubble-outline" size={16} color={COLORS.primary} />
                <Text style={styles.icebreakerItemText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Attachment Modal */}
      <Modal visible={showAttach} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowAttach(false)}>
          <View style={styles.menuContent}>
            <Text style={{ ...FONTS.h3, color: COLORS.text, marginBottom: SPACING.md }}>Send Media</Text>
            <TouchableOpacity style={styles.menuItem} onPress={() => pickMedia('library')}>
              <Ionicons name="images" size={22} color={COLORS.primary} />
              <Text style={styles.menuItemText}>Photo & Video Library</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => pickMedia('camera')}>
              <Ionicons name="camera" size={22} color={COLORS.primary} />
              <Text style={styles.menuItemText}>Take Photo or Video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { marginTop: SPACING.sm }]} onPress={() => setShowAttach(false)}>
              <Text style={[styles.menuItemText, { color: COLORS.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Fullscreen Image Viewer */}
      <Modal visible={!!fullscreenImage} animationType="fade" transparent>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setFullscreenImage(null)}
        >
          <TouchableOpacity
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 }}
            onPress={() => setFullscreenImage(null)}
          >
            <Ionicons name="close" size={30} color={COLORS.white} />
          </TouchableOpacity>
          {fullscreenImage && (
            <Image
              source={{ uri: fullscreenImage }}
              style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.75 }}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backButton: { padding: SPACING.sm },
  headerInfo: { flex: 1, marginLeft: SPACING.sm },
  headerName: { ...FONTS.bold, color: COLORS.text, fontSize: 18 },
  typingText: { ...FONTS.caption, color: COLORS.success, fontStyle: 'italic' },
  menuButton: { padding: SPACING.sm },
  chatContainer: { flex: 1 },
  messagesList: { padding: SPACING.md },
  messageBubble: { maxWidth: '75%', padding: SPACING.md, borderRadius: RADIUS.lg, marginBottom: SPACING.sm },
  ownMessage: { alignSelf: 'flex-end', backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  otherMessage: { alignSelf: 'flex-start', backgroundColor: COLORS.surface, borderBottomLeftRadius: 4, ...SHADOWS.small },
  messageText: { ...FONTS.regular, color: COLORS.text, lineHeight: 20 },
  ownMessageText: { color: COLORS.white },
  messageImage: { width: 200, height: 200, borderRadius: RADIUS.md, marginBottom: SPACING.xs },
  messageTime: { ...FONTS.caption, fontSize: 10, marginTop: SPACING.xs, color: COLORS.textLight },
  ownMessageTime: { color: 'rgba(255,255,255,0.7)' },
  readReceipt: { ...FONTS.caption, fontSize: 10, color: COLORS.primary, alignSelf: 'flex-end', marginBottom: SPACING.sm },
  typingIndicator: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xs },
  typingDots: { flexDirection: 'row', gap: 4, backgroundColor: COLORS.surface, alignSelf: 'flex-start', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.lg, ...SHADOWS.small },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.textLight },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  attachButton: { justifyContent: 'center', alignItems: 'center', paddingRight: SPACING.sm, paddingBottom: 7 },
  textInput: { flex: 1, minHeight: 42, maxHeight: 100, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, marginRight: SPACING.sm, ...FONTS.regular, backgroundColor: COLORS.background },
  sendButton: { width: 42, height: 42, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { backgroundColor: COLORS.textLight },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { ...FONTS.regular, color: COLORS.textSecondary, marginTop: SPACING.md },
  icebreakerBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.md, backgroundColor: COLORS.accent + '15', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full },
  icebreakerBtnText: { ...FONTS.regular, color: COLORS.accent, fontWeight: '600', fontSize: 13 },
  menuOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  menuContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md },
  menuItemText: { ...FONTS.regular, color: COLORS.text, fontSize: 15 },
  menuDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },
  menuLabel: { ...FONTS.caption, color: COLORS.textSecondary, marginBottom: SPACING.xs, textTransform: 'uppercase' },
  icebreakerItem: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  icebreakerItemText: { ...FONTS.regular, color: COLORS.text, flex: 1, lineHeight: 20 },
});
