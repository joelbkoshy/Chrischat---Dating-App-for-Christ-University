import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../src/constants/theme';

interface MatchItem {
  _id: string;
  user: {
    _id: string;
    name: string;
    photos: string[];
    department: string;
    bio: string;
    campus?: string;
  };
  matchedAt: string;
  isSuperLike?: boolean;
  expiresAt?: string;
  hasMessages?: boolean;
  sameCampus?: boolean;
  lastMessage?: {
    text: string;
    createdAt: string;
    isOwn: boolean;
  } | null;
  unreadCount?: number;
}

export default function MatchesScreen() {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadMatches();
    }, [])
  );

  const loadMatches = async () => {
    try {
      setLoading(true);
      const data = await api.getMatches();
      setMatches(data);
    } catch (error) {
      console.error('Failed to load matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const openChat = (match: MatchItem) => {
    router.push({
      pathname: '/chat/[matchId]',
      params: {
        matchId: match._id,
        userName: match.user.name,
        userId: match.user._id,
      },
    });
  };

  const handleUnmatch = (match: MatchItem) => {
    Alert.alert('Unmatch', `Unmatch with ${match.user.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unmatch',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.unmatch(match._id);
            setMatches((prev) => prev.filter((m) => m._id !== match._id));
          } catch {
            Alert.alert('Error', 'Failed to unmatch');
          }
        },
      },
    ]);
  };

  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const getExpiryText = (match: MatchItem) => {
    if (match.hasMessages) return null;
    if (!match.expiresAt) return null;
    const expires = new Date(match.expiresAt);
    const now = new Date();
    const hoursLeft = Math.max(0, Math.floor((expires.getTime() - now.getTime()) / 3600000));
    if (hoursLeft <= 0) return 'Expiring soon';
    return `${hoursLeft}h left to chat`;
  };

  const renderMatch = ({ item }: { item: MatchItem }) => {
    const expiryText = getExpiryText(item);

    return (
      <TouchableOpacity style={styles.matchCard} onPress={() => openChat(item)} onLongPress={() => handleUnmatch(item)}>
        <View style={styles.avatar}>
          {item.user.photos && item.user.photos.length > 0 ? (
            <Image source={{ uri: item.user.photos[0] }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={28} color={COLORS.textLight} />
          )}
          {item.isSuperLike && (
            <View style={styles.superLikeDot}>
              <Ionicons name="star" size={10} color={COLORS.white} />
            </View>
          )}
        </View>
        <View style={styles.matchInfo}>
          <View style={styles.matchTopRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
              <Text style={styles.matchName}>{item.user.name}</Text>
              {item.sameCampus && (
                <Text style={styles.campusLabel}>📍</Text>
              )}
            </View>
            {item.lastMessage && (
              <Text style={styles.timeAgo}>{getTimeAgo(item.lastMessage.createdAt)}</Text>
            )}
          </View>
          <Text style={styles.matchDept}>{item.user.department}</Text>
          {item.lastMessage ? (
            <Text style={[styles.lastMessage, item.unreadCount && item.unreadCount > 0 && styles.unreadMessage]} numberOfLines={1}>
              {item.lastMessage.isOwn ? 'You: ' : ''}{item.lastMessage.text}
            </Text>
          ) : (
            <Text style={styles.matchBio} numberOfLines={1}>
              {expiryText ? `⏳ ${expiryText}` : 'Say hello!'}
            </Text>
          )}
        </View>
        <View style={styles.matchAction}>
          {item.unreadCount && item.unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unreadCount}</Text>
            </View>
          ) : (
            <Ionicons name="chatbubble-outline" size={20} color={COLORS.primary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Matches</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matches</Text>
        <Text style={styles.matchCount}>{matches.length} connections</Text>
      </View>

      {matches.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="heart-dislike-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.emptySubtitle}>Keep swiping to find your match!</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item._id}
          renderItem={renderMatch}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  headerTitle: { ...FONTS.h1, color: COLORS.text },
  matchCount: { ...FONTS.caption, color: COLORS.textSecondary, marginTop: SPACING.xs },
  list: { paddingHorizontal: SPACING.lg },
  matchCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.small,
  },
  avatar: {
    width: 56, height: 56, borderRadius: RADIUS.full, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: RADIUS.full },
  superLikeDot: {
    position: 'absolute', bottom: 0, right: 0, width: 18, height: 18,
    borderRadius: 9, backgroundColor: COLORS.accent, justifyContent: 'center',
    alignItems: 'center', borderWidth: 2, borderColor: COLORS.surface,
  },
  matchInfo: { flex: 1, marginLeft: SPACING.md },
  matchTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchName: { ...FONTS.bold, color: COLORS.text, fontSize: 16 },
  campusLabel: { fontSize: 12 },
  timeAgo: { ...FONTS.caption, color: COLORS.textLight, fontSize: 11 },
  matchDept: { ...FONTS.caption, color: COLORS.primary, marginTop: 1 },
  lastMessage: { ...FONTS.caption, color: COLORS.textSecondary, marginTop: 2 },
  unreadMessage: { color: COLORS.text, fontWeight: '600' },
  matchBio: { ...FONTS.caption, color: COLORS.textSecondary, marginTop: 2 },
  matchAction: { padding: SPACING.sm },
  unreadBadge: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full, minWidth: 22, height: 22,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  unreadCount: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { ...FONTS.h3, color: COLORS.text, marginTop: SPACING.md },
  emptySubtitle: { ...FONTS.regular, color: COLORS.textSecondary, marginTop: SPACING.xs },
});
