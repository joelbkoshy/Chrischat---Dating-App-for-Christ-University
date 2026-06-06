import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
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
  };
  matchedAt: string;
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

  const renderMatch = ({ item }: { item: MatchItem }) => (
    <TouchableOpacity style={styles.matchCard} onPress={() => openChat(item)}>
      <View style={styles.avatar}>
        {item.user.photos && item.user.photos.length > 0 ? (
          <Image source={{ uri: item.user.photos[0] }} style={styles.avatarImage} />
        ) : (
          <Ionicons name="person" size={28} color={COLORS.textLight} />
        )}
      </View>
      <View style={styles.matchInfo}>
        <Text style={styles.matchName}>{item.user.name}</Text>
        <Text style={styles.matchDept}>{item.user.department}</Text>
        <Text style={styles.matchBio} numberOfLines={1}>
          {item.user.bio || 'Say hello!'}
        </Text>
      </View>
      <View style={styles.matchAction}>
        <Ionicons name="chatbubble-outline" size={20} color={COLORS.primary} />
      </View>
    </TouchableOpacity>
  );

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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    ...FONTS.h1,
    color: COLORS.text,
  },
  matchCount: {
    ...FONTS.caption,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  list: {
    paddingHorizontal: SPACING.lg,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: RADIUS.full,
  },
  matchInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  matchName: {
    ...FONTS.bold,
    color: COLORS.text,
    fontSize: 16,
  },
  matchDept: {
    ...FONTS.caption,
    color: COLORS.primary,
    marginTop: 1,
  },
  matchBio: {
    ...FONTS.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  matchAction: {
    padding: SPACING.sm,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    ...FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});
