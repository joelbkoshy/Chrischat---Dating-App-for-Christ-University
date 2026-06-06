import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../src/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

interface Profile {
  _id: string;
  name: string;
  age: number;
  department: string;
  bio: string;
  photos: string[];
  interests: string[];
  year: string;
  campus: string;
}

export default function DiscoverScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchPopup, setMatchPopup] = useState<{ name: string } | null>(null);
  const position = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const data = await api.getDiscoverProfiles();
      setProfiles(data);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-12deg', '0deg', '12deg'],
    extrapolate: 'clamp',
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, SCREEN_WIDTH / 4],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 4, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const nextCardScale = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: [1, 0.92, 1],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          swipeRight();
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          swipeLeft();
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  const swipeRight = async () => {
    const profile = profiles[currentIndex];
    Animated.timing(position, {
      toValue: { x: SCREEN_WIDTH + 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      advanceCard();
    });

    try {
      const result = await api.likeUser(profile._id);
      if (result.matched) {
        setMatchPopup({ name: result.matchedUser.name });
        setTimeout(() => setMatchPopup(null), 3000);
      }
    } catch (error) {
      console.error('Like failed:', error);
    }
  };

  const swipeLeft = async () => {
    const profile = profiles[currentIndex];
    Animated.timing(position, {
      toValue: { x: -SCREEN_WIDTH - 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      advanceCard();
    });

    try {
      await api.dislikeUser(profile._id);
    } catch (error) {
      console.error('Dislike failed:', error);
    }
  };

  const advanceCard = () => {
    setCurrentIndex((prev) => prev + 1);
    position.setValue({ x: 0, y: 0 });
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
      friction: 5,
    }).start();
  };

  const renderCard = (profile: Profile, index: number) => {
    if (index < currentIndex) return null;

    const isCurrentCard = index === currentIndex;

    if (isCurrentCard) {
      return (
        <Animated.View
          key={profile._id}
          style={[
            styles.card,
            {
              transform: [
                { translateX: position.x },
                { translateY: position.y },
                { rotate },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Animated.View style={[styles.likeStamp, { opacity: likeOpacity }]}>
            <Text style={styles.likeStampText}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.nopeStamp, { opacity: nopeOpacity }]}>
            <Text style={styles.nopeStampText}>NOPE</Text>
          </Animated.View>
          <CardContent profile={profile} />
        </Animated.View>
      );
    }

    if (index === currentIndex + 1) {
      return (
        <Animated.View
          key={profile._id}
          style={[styles.card, styles.nextCard, { transform: [{ scale: nextCardScale }] }]}
        >
          <CardContent profile={profile} />
        </Animated.View>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Finding people near you...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const noMoreProfiles = currentIndex >= profiles.length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="heart-circle" size={32} color={COLORS.primary} />
        <Text style={styles.headerTitle}>ChrisChat</Text>
      </View>

      <View style={styles.cardContainer}>
        {noMoreProfiles ? (
          <View style={styles.centered}>
            <Ionicons name="search-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No more profiles</Text>
            <Text style={styles.emptySubtitle}>Check back later for new people!</Text>
            <TouchableOpacity style={styles.refreshButton} onPress={loadProfiles}>
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          profiles.map((profile, index) => renderCard(profile, index)).reverse()
        )}
      </View>

      {!noMoreProfiles && (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionButton, styles.dislikeButton]} onPress={swipeLeft}>
            <Ionicons name="close" size={32} color={COLORS.error} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.likeButton]} onPress={swipeRight}>
            <Ionicons name="heart" size={32} color={COLORS.success} />
          </TouchableOpacity>
        </View>
      )}

      {matchPopup && (
        <View style={styles.matchPopup}>
          <View style={styles.matchPopupContent}>
            <Ionicons name="heart" size={48} color={COLORS.secondary} />
            <Text style={styles.matchTitle}>It's a Match!</Text>
            <Text style={styles.matchSubtitle}>You and {matchPopup.name} liked each other</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function CardContent({ profile }: { profile: Profile }) {
  return (
    <View style={styles.cardInner}>
      <View style={styles.cardImageContainer}>
        {profile.photos && profile.photos.length > 0 ? (
          <Image source={{ uri: profile.photos[0] }} style={styles.cardImage} />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Ionicons name="person" size={80} color={COLORS.textLight} />
          </View>
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>
          {profile.name}, {profile.age}
        </Text>
        <View style={styles.cardDetail}>
          <Ionicons name="school-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.cardDetailText}>{profile.department} • {profile.year}</Text>
        </View>
        <View style={styles.cardDetail}>
          <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.cardDetailText}>{profile.campus}</Text>
        </View>
        <Text style={styles.cardBio} numberOfLines={3}>{profile.bio}</Text>
        {profile.interests && profile.interests.length > 0 && (
          <View style={styles.interestRow}>
            {profile.interests.slice(0, 4).map((interest) => (
              <View key={interest} style={styles.interestBadge}>
                <Text style={styles.interestText}>{interest}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  headerTitle: {
    ...FONTS.h2,
    color: COLORS.primary,
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  card: {
    position: 'absolute',
    width: SCREEN_WIDTH - SPACING.lg * 2,
    height: '90%',
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface,
    ...SHADOWS.large,
    overflow: 'hidden',
  },
  nextCard: {
    top: 10,
  },
  cardInner: {
    flex: 1,
  },
  cardImageContainer: {
    flex: 1,
    backgroundColor: COLORS.border,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  cardInfo: {
    padding: SPACING.md,
  },
  cardName: {
    ...FONTS.h2,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  cardDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 2,
  },
  cardDetailText: {
    ...FONTS.caption,
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  cardBio: {
    ...FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
  interestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  interestBadge: {
    backgroundColor: COLORS.primaryLight + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  interestText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  likeStamp: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
    borderWidth: 3,
    borderColor: COLORS.success,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    transform: [{ rotate: '-15deg' }],
  },
  likeStampText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.success,
  },
  nopeStamp: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    borderWidth: 3,
    borderColor: COLORS.error,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    transform: [{ rotate: '15deg' }],
  },
  nopeStampText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.error,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    ...SHADOWS.medium,
  },
  dislikeButton: {},
  likeButton: {},
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
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
  refreshButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  refreshButtonText: {
    ...FONTS.bold,
    color: COLORS.white,
  },
  matchPopup: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  matchPopupContent: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.large,
  },
  matchTitle: {
    ...FONTS.h1,
    color: COLORS.secondary,
    marginTop: SPACING.md,
  },
  matchSubtitle: {
    ...FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});
