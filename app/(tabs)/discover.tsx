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
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../src/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

const DEPARTMENTS = [
  '', 'Computer Science', 'Commerce', 'Management', 'Law',
  'Sciences', 'Arts', 'Social Sciences', 'Engineering',
  'Media Studies', 'Hotel Management', 'Education', 'Other',
];
const YEARS = ['', '1st Year', '2nd Year', '3rd Year', '4th Year', 'PG 1st Year', 'PG 2nd Year', 'PhD'];
const CAMPUSES = ['', 'Main Campus', 'Kengeri Campus', 'Bannerghatta Road Campus', 'Lavasa Campus', 'NCR Campus', 'Pune Campus'];

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
  compatibility?: number;
  isBoosted?: boolean;
  profilePrompts?: { question: string; answer: string }[];
  isVerified?: boolean;
}

export default function DiscoverScreen() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchPopup, setMatchPopup] = useState<{ name: string; matchId?: string } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [dailyPick, setDailyPick] = useState<Profile | null>(null);
  const [showDailyPick, setShowDailyPick] = useState(false);
  const [superLikesLeft, setSuperLikesLeft] = useState(3);
  const [canUndo, setCanUndo] = useState(false);
  const [lastSwiped, setLastSwiped] = useState<Profile | null>(null);
  const position = useRef(new Animated.ValueXY()).current;

  // Filters
  const [filterDept, setFilterDept] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterCampus, setFilterCampus] = useState('');
  const [filterMode, setFilterMode] = useState('');

  useEffect(() => {
    loadProfiles();
    loadDailyPick();
  }, []);

  const loadProfiles = async (filters?: any) => {
    try {
      setLoading(true);
      const data = await api.getDiscoverProfiles(filters);
      setProfiles(data);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDailyPick = async () => {
    try {
      const pick = await api.getDailyPick();
      setDailyPick(pick);
    } catch {
      // No daily pick available
    }
  };

  const applyFilters = () => {
    setShowFilters(false);
    loadProfiles({
      department: filterDept || undefined,
      year: filterYear || undefined,
      campus: filterCampus || undefined,
      mode: filterMode || undefined,
    });
  };

  const clearFilters = () => {
    setFilterDept('');
    setFilterYear('');
    setFilterCampus('');
    setFilterMode('');
    setShowFilters(false);
    loadProfiles();
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
        } else if (gesture.dy < -SWIPE_THRESHOLD) {
          handleSuperLike();
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  const swipeRight = async () => {
    const profile = profiles[currentIndex];
    setLastSwiped(profile);
    setCanUndo(true);

    Animated.timing(position, {
      toValue: { x: SCREEN_WIDTH + 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => advanceCard());

    try {
      const result = await api.likeUser(profile._id);
      if (result.matched) {
        setMatchPopup({ name: result.matchedUser.name, matchId: result.matchId });
        setTimeout(() => setMatchPopup(null), 3000);
      }
    } catch (error) {
      console.error('Like failed:', error);
    }
    setTimeout(() => setCanUndo(false), 30000);
  };

  const swipeLeft = async () => {
    const profile = profiles[currentIndex];
    setLastSwiped(profile);
    setCanUndo(true);

    Animated.timing(position, {
      toValue: { x: -SCREEN_WIDTH - 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => advanceCard());

    try {
      await api.dislikeUser(profile._id);
    } catch (error) {
      console.error('Dislike failed:', error);
    }
    setTimeout(() => setCanUndo(false), 30000);
  };

  const handleSuperLike = async () => {
    if (superLikesLeft <= 0) {
      Alert.alert('No Super Likes', 'You have used all your super likes for today!');
      resetPosition();
      return;
    }

    const profile = profiles[currentIndex];
    setLastSwiped(profile);
    setCanUndo(true);

    Animated.timing(position, {
      toValue: { x: 0, y: -SCREEN_WIDTH },
      duration: 300,
      useNativeDriver: false,
    }).start(() => advanceCard());

    try {
      const result = await api.superLikeUser(profile._id);
      setSuperLikesLeft(result.superLikesRemaining);
      if (result.matched) {
        setMatchPopup({ name: result.matchedUser.name });
        setTimeout(() => setMatchPopup(null), 3000);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
    setTimeout(() => setCanUndo(false), 30000);
  };

  const handleUndo = async () => {
    if (!canUndo) return;
    try {
      await api.undoSwipe();
      setCanUndo(false);
      if (lastSwiped) {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      }
    } catch (error: any) {
      Alert.alert('Cannot Undo', error.message);
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
          style={[styles.card, {
            transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }],
          }]}
          {...panResponder.panHandlers}
        >
          <Animated.View style={[styles.likeStamp, { opacity: likeOpacity }]}>
            <Text style={styles.likeStampText}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.nopeStamp, { opacity: nopeOpacity }]}>
            <Text style={styles.nopeStampText}>NOPE</Text>
          </Animated.View>
          <CardContent profile={profile} currentUser={user} />
        </Animated.View>
      );
    }

    if (index === currentIndex + 1) {
      return (
        <Animated.View
          key={profile._id}
          style={[styles.card, styles.nextCard, { transform: [{ scale: nextCardScale }] }]}
        >
          <CardContent profile={profile} currentUser={user} />
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
        <View style={styles.headerRight}>
          {dailyPick && (
            <TouchableOpacity style={styles.dailyPickBtn} onPress={() => setShowDailyPick(true)}>
              <Ionicons name="star" size={20} color={COLORS.accent} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilters(true)}>
            <Ionicons name="options-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cardContainer}>
        {noMoreProfiles ? (
          <View style={styles.centered}>
            <Ionicons name="search-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No more profiles</Text>
            <Text style={styles.emptySubtitle}>Check back later for new people!</Text>
            <TouchableOpacity style={styles.refreshButton} onPress={() => loadProfiles()}>
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          profiles.map((profile, index) => renderCard(profile, index)).reverse()
        )}
      </View>

      {!noMoreProfiles && (
        <View style={styles.actions}>
          {canUndo && (
            <TouchableOpacity style={[styles.actionButton, styles.undoButton]} onPress={handleUndo}>
              <Ionicons name="arrow-undo" size={24} color={COLORS.accent} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.actionButton, styles.dislikeButton]} onPress={swipeLeft}>
            <Ionicons name="close" size={32} color={COLORS.error} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.superLikeButton]} onPress={handleSuperLike}>
            <Ionicons name="star" size={24} color={COLORS.accent} />
            <Text style={styles.superLikeCount}>{superLikesLeft}</Text>
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

      {/* Filter Modal */}
      <Modal visible={showFilters} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.filterLabel}>Mode</Text>
              <View style={styles.chipRow}>
                {['', 'dating', 'study-buddy'].map((m) => (
                  <TouchableOpacity key={m} style={[styles.chip, filterMode === m && styles.chipSelected]} onPress={() => setFilterMode(m)}>
                    <Text style={[styles.chipText, filterMode === m && styles.chipTextSelected]}>
                      {m === '' ? 'All' : m === 'dating' ? '💕 Dating' : '📚 Study Buddy'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>Department</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {DEPARTMENTS.map((d) => (
                    <TouchableOpacity key={d} style={[styles.chip, filterDept === d && styles.chipSelected]} onPress={() => setFilterDept(d)}>
                      <Text style={[styles.chipText, filterDept === d && styles.chipTextSelected]}>{d || 'All'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.filterLabel}>Year</Text>
              <View style={styles.chipRow}>
                {YEARS.map((y) => (
                  <TouchableOpacity key={y} style={[styles.chip, filterYear === y && styles.chipSelected]} onPress={() => setFilterYear(y)}>
                    <Text style={[styles.chipText, filterYear === y && styles.chipTextSelected]}>{y || 'All'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>Campus</Text>
              <View style={styles.chipRow}>
                {CAMPUSES.map((c) => (
                  <TouchableOpacity key={c} style={[styles.chip, filterCampus === c && styles.chipSelected]} onPress={() => setFilterCampus(c)}>
                    <Text style={[styles.chipText, filterCampus === c && styles.chipTextSelected]}>{c || 'All'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.filterActions}>
                <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
                  <Text style={styles.clearBtnText}>Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
                  <Text style={styles.applyBtnText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Daily Pick Modal */}
      <Modal visible={showDailyPick && dailyPick !== null} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Ionicons name="star" size={24} color={COLORS.accent} />
                <Text style={[styles.modalTitle, { color: COLORS.accent }]}>Daily Pick</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDailyPick(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {dailyPick && (
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: '100%', height: 250, borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.md }}>
                  {dailyPick.photos?.length > 0 ? (
                    <Image source={{ uri: dailyPick.photos[0] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
                      <Ionicons name="person" size={60} color={COLORS.textLight} />
                    </View>
                  )}
                </View>
                <Text style={styles.cardName}>{dailyPick.name}, {dailyPick.age}</Text>
                <Text style={{ ...FONTS.regular, color: COLORS.textSecondary, marginTop: 4 }}>{dailyPick.department} • {dailyPick.campus}</Text>
                {dailyPick.compatibility !== undefined && dailyPick.compatibility > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.secondary + '15', paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: RADIUS.full, marginTop: SPACING.sm }}>
                    <Ionicons name="heart" size={14} color={COLORS.secondary} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.secondary }}>{dailyPick.compatibility}% compatible</Text>
                  </View>
                )}
                <Text style={{ ...FONTS.regular, color: COLORS.textSecondary, marginTop: SPACING.sm, textAlign: 'center' }} numberOfLines={3}>{dailyPick.bio}</Text>
                <View style={{ flexDirection: 'row', gap: SPACING.lg, marginTop: SPACING.lg, marginBottom: SPACING.lg }}>
                  <TouchableOpacity style={[styles.actionButton, styles.dislikeButton]} onPress={() => { setShowDailyPick(false); api.dislikeUser(dailyPick._id); setDailyPick(null); }}>
                    <Ionicons name="close" size={28} color={COLORS.error} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.likeButton]} onPress={async () => {
                    setShowDailyPick(false);
                    try { const r = await api.likeUser(dailyPick._id); if (r.matched) { setMatchPopup({ name: r.matchedUser.name }); setTimeout(() => setMatchPopup(null), 3000); } } catch {}
                    setDailyPick(null);
                  }}>
                    <Ionicons name="heart" size={28} color={COLORS.success} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function CardContent({ profile, currentUser }: { profile: Profile; currentUser: any }) {
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
        {profile.isVerified && (
          <View style={{ position: 'absolute', top: 12, right: 12 }}>
            <Ionicons name="checkmark-circle" size={20} color="#3B82F6" />
          </View>
        )}
      </View>
      <View style={styles.cardInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs }}>
          <Text style={styles.cardName}>{profile.name}, {profile.age}</Text>
          {profile.compatibility !== undefined && profile.compatibility > 0 && (
            <View style={{ backgroundColor: COLORS.secondary + '20', paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.secondary }}>{profile.compatibility}%</Text>
            </View>
          )}
        </View>
        <View style={styles.cardDetail}>
          <Ionicons name="school-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.cardDetailText}>{profile.department} • {profile.year}</Text>
        </View>
        <View style={styles.cardDetail}>
          <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.cardDetailText}>{profile.campus}</Text>
          {currentUser?.campus === profile.campus && (
            <View style={{ backgroundColor: COLORS.success + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full, marginLeft: 4 }}>
              <Text style={{ fontSize: 10, color: COLORS.success, fontWeight: '600' }}>📍 Same Campus</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardBio} numberOfLines={2}>{profile.bio}</Text>
        {profile.profilePrompts && profile.profilePrompts.length > 0 && (
          <View style={{ backgroundColor: COLORS.primaryLight + '10', borderRadius: RADIUS.md, padding: SPACING.sm, marginTop: SPACING.sm }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.primary, marginBottom: 2 }}>{profile.profilePrompts[0].question}</Text>
            <Text style={{ fontSize: 13, color: COLORS.text }}>{profile.profilePrompts[0].answer}</Text>
          </View>
        )}
        {profile.interests && profile.interests.length > 0 && (
          <View style={styles.interestRow}>
            {profile.interests.slice(0, 4).map((interest) => (
              <View key={interest} style={[styles.interestBadge, currentUser?.interests?.includes(interest) && { backgroundColor: COLORS.success + '20', borderWidth: 1, borderColor: COLORS.success + '40' }]}>
                <Text style={[styles.interestText, currentUser?.interests?.includes(interest) && { color: COLORS.success }]}>{interest}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: SPACING.sm },
  headerTitle: { ...FONTS.h2, color: COLORS.primary, flex: 1 },
  headerRight: { flexDirection: 'row', gap: SPACING.sm },
  filterBtn: { padding: SPACING.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.full, ...SHADOWS.small },
  dailyPickBtn: { padding: SPACING.sm, backgroundColor: COLORS.accent + '15', borderRadius: RADIUS.full, ...SHADOWS.small },
  cardContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.md },
  card: { position: 'absolute', width: SCREEN_WIDTH - SPACING.lg * 2, height: '90%', borderRadius: RADIUS.xl, backgroundColor: COLORS.surface, ...SHADOWS.large, overflow: 'hidden' },
  nextCard: { top: 10 },
  cardInner: { flex: 1 },
  cardImageContainer: { flex: 1, backgroundColor: COLORS.border },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardImagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  cardInfo: { padding: SPACING.md },
  cardName: { ...FONTS.h2, color: COLORS.text, marginBottom: SPACING.xs },
  cardDetail: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 2 },
  cardDetailText: { ...FONTS.caption, color: COLORS.textSecondary, fontSize: 13 },
  cardBio: { ...FONTS.regular, color: COLORS.textSecondary, marginTop: SPACING.sm, lineHeight: 20 },
  interestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  interestBadge: { backgroundColor: COLORS.primaryLight + '20', paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  interestText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  likeStamp: { position: 'absolute', top: 40, left: 20, zIndex: 10, borderWidth: 3, borderColor: COLORS.success, borderRadius: RADIUS.sm, padding: SPACING.sm, transform: [{ rotate: '-15deg' }] },
  likeStampText: { fontSize: 28, fontWeight: '800', color: COLORS.success },
  nopeStamp: { position: 'absolute', top: 40, right: 20, zIndex: 10, borderWidth: 3, borderColor: COLORS.error, borderRadius: RADIUS.sm, padding: SPACING.sm, transform: [{ rotate: '15deg' }] },
  nopeStampText: { fontSize: 28, fontWeight: '800', color: COLORS.error },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.lg },
  actionButton: { width: 56, height: 56, borderRadius: RADIUS.full, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surface, ...SHADOWS.medium },
  dislikeButton: {},
  likeButton: {},
  superLikeButton: { backgroundColor: COLORS.accent + '15' },
  undoButton: { width: 44, height: 44, backgroundColor: COLORS.accent + '10' },
  superLikeCount: { fontSize: 9, fontWeight: '700', color: COLORS.accent, position: 'absolute', bottom: 6 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...FONTS.regular, color: COLORS.textSecondary, marginTop: SPACING.md },
  emptyTitle: { ...FONTS.h3, color: COLORS.text, marginTop: SPACING.md },
  emptySubtitle: { ...FONTS.regular, color: COLORS.textSecondary, marginTop: SPACING.xs },
  refreshButton: { marginTop: SPACING.lg, backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md },
  refreshButtonText: { ...FONTS.bold, color: COLORS.white },
  matchPopup: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  matchPopupContent: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: 'center', ...SHADOWS.large },
  matchTitle: { ...FONTS.h1, color: COLORS.secondary, marginTop: SPACING.md },
  matchSubtitle: { ...FONTS.regular, color: COLORS.textSecondary, marginTop: SPACING.xs },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { ...FONTS.h2, color: COLORS.text },
  filterLabel: { ...FONTS.medium, color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.text },
  chipTextSelected: { color: COLORS.white, fontWeight: '600' },
  filterActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl, marginBottom: SPACING.lg },
  clearBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  clearBtnText: { ...FONTS.bold, color: COLORS.textSecondary },
  applyBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  applyBtnText: { ...FONTS.bold, color: COLORS.white },
});
