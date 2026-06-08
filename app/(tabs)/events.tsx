import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../src/constants/theme';

const CATEGORIES = [
  { key: '', label: 'All', icon: 'apps' },
  { key: 'social', label: 'Social', icon: 'people' },
  { key: 'academic', label: 'Academic', icon: 'book' },
  { key: 'sports', label: 'Sports', icon: 'football' },
  { key: 'cultural', label: 'Cultural', icon: 'color-palette' },
  { key: 'party', label: 'Party', icon: 'musical-notes' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

const CAMPUSES = ['Main Campus', 'Kengeri Campus', 'Bannerghatta Road Campus', 'Lavasa Campus', 'NCR Campus', 'Pune Campus'];

interface EventItem {
  _id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  campus: string;
  category: string;
  createdBy: { _id: string; name: string };
  attendees: any[];
  maxAttendees: number;
}

export default function EventsScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [campus, setCampus] = useState('Main Campus');
  const [category, setCategory] = useState('social');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [selectedCategory]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await api.getEvents({
        category: selectedCategory || undefined,
      });
      setEvents(data);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = async (eventId: string) => {
    try {
      const result = await api.rsvpEvent(eventId);
      setEvents((prev) =>
        prev.map((e) =>
          e._id === eventId
            ? { ...e, attendees: result.attending ? [...e.attendees, { _id: user?._id }] : e.attendees.filter((a: any) => a._id !== user?._id) }
            : e
        )
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !description.trim() || !date || !location.trim()) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setCreating(true);
    try {
      const event = await api.createEvent({
        title: title.trim(),
        description: description.trim(),
        date: new Date(date).toISOString(),
        location: location.trim(),
        campus,
        category,
      });
      setEvents((prev) => [event, ...prev]);
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setDate('');
      setLocation('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const renderEvent = ({ item }: { item: EventItem }) => {
    const isAttending = item.attendees.some((a: any) => a._id === user?._id);
    const categoryInfo = CATEGORIES.find((c) => c.key === item.category) || CATEGORIES[6];

    return (
      <View style={styles.eventCard}>
        <View style={styles.eventHeader}>
          <View style={[styles.categoryIcon, { backgroundColor: COLORS.primary + '15' }]}>
            <Ionicons name={categoryInfo.icon as any} size={18} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eventTitle}>{item.title}</Text>
            <Text style={styles.eventMeta}>{categoryInfo.label} • by {item.createdBy.name}</Text>
          </View>
        </View>
        <Text style={styles.eventDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.eventDetails}>
          <View style={styles.eventDetailRow}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.eventDetailText}>{formatDate(item.date)}</Text>
          </View>
          <View style={styles.eventDetailRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.eventDetailText}>{item.location} • {item.campus}</Text>
          </View>
          <View style={styles.eventDetailRow}>
            <Ionicons name="people-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.eventDetailText}>
              {item.attendees.length} going{item.maxAttendees > 0 ? ` / ${item.maxAttendees} max` : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.rsvpButton, isAttending && styles.rsvpButtonActive]}
          onPress={() => handleRSVP(item._id)}
        >
          <Ionicons name={isAttending ? 'checkmark' : 'add'} size={18} color={isAttending ? COLORS.white : COLORS.primary} />
          <Text style={[styles.rsvpText, isAttending && styles.rsvpTextActive]}>
            {isAttending ? 'Going' : 'RSVP'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Events</Text>
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
            <Ionicons name={cat.icon as any} size={14} color={selectedCategory === cat.key ? COLORS.white : COLORS.textSecondary} />
            <Text style={[styles.categoryChipText, selectedCategory === cat.key && styles.categoryChipTextActive]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : events.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="calendar-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>No upcoming events</Text>
          <Text style={styles.emptySubtitle}>Create one to get started!</Text>
        </View>
      ) : (
        <FlatList data={events} keyExtractor={(item) => item._id} renderItem={renderEvent}
          contentContainerStyle={{ padding: SPACING.lg }} showsVerticalScrollIndicator={false} />
      )}

      {/* Create Event Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Event</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.label}>Title</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Event title" placeholderTextColor={COLORS.textLight} maxLength={100} />

              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription}
                placeholder="What's this event about?" placeholderTextColor={COLORS.textLight} multiline maxLength={500} />

              <Text style={styles.label}>Date (YYYY-MM-DD HH:MM)</Text>
              <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="2026-06-15 18:00" placeholderTextColor={COLORS.textLight} />

              <Text style={styles.label}>Location</Text>
              <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Where?" placeholderTextColor={COLORS.textLight} />

              <Text style={styles.label}>Campus</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {CAMPUSES.map((c) => (
                    <TouchableOpacity key={c} style={[styles.chip, campus === c && styles.chipSelected]} onPress={() => setCampus(c)}>
                      <Text style={[styles.chipText, campus === c && styles.chipTextSelected]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.label}>Category</Text>
              <View style={styles.chipRow}>
                {CATEGORIES.filter((c) => c.key).map((c) => (
                  <TouchableOpacity key={c.key} style={[styles.chip, category === c.key && styles.chipSelected]} onPress={() => setCategory(c.key)}>
                    <Text style={[styles.chipText, category === c.key && styles.chipTextSelected]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={[styles.submitBtn, creating && { opacity: 0.7 }]} onPress={handleCreate} disabled={creating}>
                {creating ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitBtnText}>Create Event</Text>}
              </TouchableOpacity>
            </ScrollView>
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
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, marginRight: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryChipText: { ...FONTS.caption, color: COLORS.textSecondary },
  categoryChipTextActive: { color: COLORS.white, fontWeight: '600' },
  eventCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.small },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm },
  categoryIcon: { width: 36, height: 36, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  eventTitle: { ...FONTS.bold, color: COLORS.text, fontSize: 16 },
  eventMeta: { ...FONTS.caption, color: COLORS.textSecondary, marginTop: 2 },
  eventDesc: { ...FONTS.regular, color: COLORS.textSecondary, marginBottom: SPACING.sm, lineHeight: 20 },
  eventDetails: { gap: 4, marginBottom: SPACING.md },
  eventDetailRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  eventDetailText: { ...FONTS.caption, color: COLORS.textSecondary },
  rsvpButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary },
  rsvpButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  rsvpText: { ...FONTS.bold, color: COLORS.primary, fontSize: 14 },
  rsvpTextActive: { color: COLORS.white },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { ...FONTS.h3, color: COLORS.text, marginTop: SPACING.md },
  emptySubtitle: { ...FONTS.regular, color: COLORS.textSecondary, marginTop: SPACING.xs },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { ...FONTS.h2, color: COLORS.text },
  label: { ...FONTS.medium, color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.sm },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, backgroundColor: COLORS.background, ...FONTS.regular, color: COLORS.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.text },
  chipTextSelected: { color: COLORS.white, fontWeight: '600' },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.lg },
  submitBtnText: { ...FONTS.bold, color: COLORS.white, fontSize: 16 },
});
