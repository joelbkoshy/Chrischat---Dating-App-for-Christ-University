import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../src/constants/theme';

const CATEGORIES = [
  { key: '', label: 'All', icon: 'chatbubbles' },
  { key: 'crush', label: '💕 Crush', icon: 'heart' },
  { key: 'funny', label: '😂 Funny', icon: 'happy' },
  { key: 'academic', label: '📚 Academic', icon: 'book' },
  { key: 'rant', label: '😤 Rant', icon: 'flame' },
  { key: 'advice', label: '💡 Advice', icon: 'bulb' },
  { key: 'other', label: '💬 Other', icon: 'chatbubble' },
];

interface ConfessionItem {
  _id: string;
  text: string;
  category: string;
  campus?: string;
  likes: string[];
  createdAt: string;
}

export default function ConfessionsScreen() {
  const { user } = useAuth();
  const [confessions, setConfessions] = useState<ConfessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Create form
  const [confText, setConfText] = useState('');
  const [confCategory, setConfCategory] = useState('other');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadConfessions(1, true);
  }, [selectedCategory]);

  const loadConfessions = async (p: number, reset = false) => {
    try {
      if (reset) setLoading(true);
      const data = await api.getConfessions(p, {
        category: selectedCategory || undefined,
      });
      if (reset) {
        setConfessions(data.confessions);
      } else {
        setConfessions((prev) => [...prev, ...data.confessions]);
      }
      setPage(p);
      setHasMore(p < data.totalPages);
    } catch (error) {
      console.error('Failed to load confessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      loadConfessions(page + 1);
    }
  };

  const handleLike = async (id: string) => {
    try {
      const result = await api.likeConfession(id);
      setConfessions((prev) =>
        prev.map((c) =>
          c._id === id
            ? {
                ...c,
                likes: result.liked
                  ? [...c.likes, user?._id || '']
                  : c.likes.filter((l) => l !== user?._id),
              }
            : c
        )
      );
    } catch { }
  };

  const handleReport = async (id: string) => {
    try {
      await api.reportConfession(id);
      Alert.alert('Reported', 'This confession has been reported.');
    } catch { }
  };

  const handleCreate = async () => {
    if (!confText.trim()) {
      Alert.alert('Error', 'Write something!');
      return;
    }
    setCreating(true);
    try {
      const confession = await api.postConfession({
        text: confText.trim(),
        category: confCategory,
      });
      setConfessions((prev) => [confession, ...prev]);
      setShowCreate(false);
      setConfText('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to post');
    } finally {
      setCreating(false);
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getCategoryEmoji = (cat: string) => {
    const found = CATEGORIES.find((c) => c.key === cat);
    return found ? found.label.split(' ')[0] : '💬';
  };

  const renderConfession = ({ item }: { item: ConfessionItem }) => {
    const isLiked = item.likes.includes(user?._id || '');

    return (
      <View style={styles.confessionCard}>
        <View style={styles.confessionHeader}>
          <Text style={styles.confessionEmoji}>{getCategoryEmoji(item.category)}</Text>
          <Text style={styles.confessionTime}>{getTimeAgo(item.createdAt)}</Text>
        </View>
        <Text style={styles.confessionText}>{item.text}</Text>
        {item.campus && (
          <Text style={styles.confessionCampus}>📍 {item.campus}</Text>
        )}
        <View style={styles.confessionActions}>
          <TouchableOpacity style={styles.confessionAction} onPress={() => handleLike(item._id)}>
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={18} color={isLiked ? COLORS.secondary : COLORS.textSecondary} />
            <Text style={[styles.actionCount, isLiked && { color: COLORS.secondary }]}>{item.likes.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confessionAction} onPress={() => handleReport(item._id)}>
            <Ionicons name="flag-outline" size={16} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Confessions</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryBar} contentContainerStyle={{ paddingHorizontal: SPACING.lg }}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.categoryChip, selectedCategory === cat.key && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(cat.key)}
          >
            <Text style={[styles.categoryChipText, selectedCategory === cat.key && styles.categoryChipTextActive]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : confessions.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="chatbubbles-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>No confessions yet</Text>
          <Text style={styles.emptySubtitle}>Be the first to confess!</Text>
        </View>
      ) : (
        <FlatList
          data={confessions}
          keyExtractor={(item) => item._id}
          renderItem={renderConfession}
          contentContainerStyle={{ padding: SPACING.lg }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
        />
      )}

      {/* Create Confession Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Confession</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.anonNote}>🔒 Your identity stays anonymous</Text>

            <TextInput
              style={styles.confessionInput}
              value={confText}
              onChangeText={setConfText}
              placeholder="What's on your mind?"
              placeholderTextColor={COLORS.textLight}
              multiline
              maxLength={500}
            />
            <Text style={styles.charCount}>{confText.length}/500</Text>

            <Text style={styles.label}>Category</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.filter((c) => c.key).map((c) => (
                <TouchableOpacity key={c.key} style={[styles.chip, confCategory === c.key && styles.chipSelected]} onPress={() => setConfCategory(c.key)}>
                  <Text style={[styles.chipText, confCategory === c.key && styles.chipTextSelected]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.submitBtn, creating && { opacity: 0.7 }]} onPress={handleCreate} disabled={creating}>
              {creating ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitBtnText}>Post Anonymously</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  headerTitle: { ...FONTS.h1, color: COLORS.text },
  createBtn: { width: 40, height: 40, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  categoryBar: { maxHeight: 50, marginBottom: SPACING.sm },
  categoryChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, marginRight: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryChipText: { fontSize: 13, color: COLORS.textSecondary },
  categoryChipTextActive: { color: COLORS.white, fontWeight: '600' },
  confessionCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.small },
  confessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  confessionEmoji: { fontSize: 20 },
  confessionTime: { ...FONTS.caption, color: COLORS.textLight },
  confessionText: { ...FONTS.regular, color: COLORS.text, lineHeight: 22, marginBottom: SPACING.sm },
  confessionCampus: { ...FONTS.caption, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  confessionActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  confessionAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCount: { ...FONTS.caption, color: COLORS.textSecondary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { ...FONTS.h3, color: COLORS.text, marginTop: SPACING.md },
  emptySubtitle: { ...FONTS.regular, color: COLORS.textSecondary, marginTop: SPACING.xs },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { ...FONTS.h2, color: COLORS.text },
  anonNote: { ...FONTS.caption, color: COLORS.success, marginBottom: SPACING.md, textAlign: 'center' },
  confessionInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, minHeight: 120, textAlignVertical: 'top', ...FONTS.regular, color: COLORS.text, backgroundColor: COLORS.background },
  charCount: { ...FONTS.caption, color: COLORS.textSecondary, textAlign: 'right', marginTop: SPACING.xs },
  label: { ...FONTS.medium, color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.text },
  chipTextSelected: { color: COLORS.white, fontWeight: '600' },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.lg },
  submitBtnText: { ...FONTS.bold, color: COLORS.white, fontSize: 16 },
});
