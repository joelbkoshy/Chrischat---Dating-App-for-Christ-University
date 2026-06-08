import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  Switch,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/context/AuthContext';
import api, { getImageUrl } from '../../src/services/api';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../src/constants/theme';

const BADGE_ICONS: Record<string, string> = {
  'First Swipe': '👆',
  'First Match': '💕',
  'Profile Pro': '⭐',
  '10 Conversations': '💬',
};

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [badges, setBadges] = useState<any[]>([]);
  const [showBlocked, setShowBlocked] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [boosting, setBoosting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadProfile();
    loadBadges();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      setProfile(data);
      setIsVisible(data.isVisible !== false);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const loadBadges = async () => {
    try {
      const data = await api.getBadges();
      setBadges(data);
    } catch { }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const toggleVisibility = async () => {
    try {
      const result = await api.toggleVisibility();
      setIsVisible(result.isVisible);
    } catch {
      Alert.alert('Error', 'Failed to toggle visibility');
    }
  };

  const handleBoost = async () => {
    Alert.alert('Boost Profile', 'Your profile will be shown to more people for 30 minutes!', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Boost!',
        onPress: async () => {
          setBoosting(true);
          try {
            await api.boostProfile();
            Alert.alert('Boosted!', 'Your profile is now boosted for 30 minutes!');
          } catch {
            Alert.alert('Error', 'Failed to boost');
          } finally {
            setBoosting(false);
          }
        },
      },
    ]);
  };

  const pickAndUploadPhoto = async (source: 'library' | 'camera') => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission required', 'Camera access is needed.'); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 5] });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission required', 'Media library access is needed.'); return; }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 5], allowsMultipleSelection: true, selectionLimit: 6 });
      }
      if (result.canceled || !result.assets?.length) return;
      setUploading(true);
      const formData = new FormData();
      for (const asset of result.assets) {
        const ext = asset.uri.split('.').pop() || 'jpg';
        formData.append('photos', {
          uri: asset.uri,
          name: `photo-${Date.now()}.${ext}`,
          type: `image/${ext}`,
        } as any);
      }
      const data = await api.uploadPhotos(formData);
      setProfile((prev: any) => prev ? { ...prev, photos: data.photos } : prev);
      Alert.alert('Success', 'Photos uploaded!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload');
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (index: number) => {
    Alert.alert('Delete Photo', 'Remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.deletePhoto(index);
            setProfile((prev: any) => {
              if (!prev) return prev;
              const photos = [...prev.photos];
              photos.splice(index, 1);
              return { ...prev, photos };
            });
          } catch { Alert.alert('Error', 'Failed to delete photo'); }
        },
      },
    ]);
  };

  const loadBlockedUsers = async () => {
    try {
      const data = await api.getBlockedUsers();
      setBlockedUsers(data);
      setShowBlocked(true);
    } catch {
      Alert.alert('Error', 'Failed to load blocked users');
    }
  };

  const handleUnblock = async (id: string) => {
    try {
      await api.unblockUser(id);
      setBlockedUsers((prev) => prev.filter((u) => u._id !== id));
    } catch {
      Alert.alert('Error', 'Failed to unblock');
    }
  };

  const displayProfile = profile || user;
  const mode = displayProfile?.mode || 'dating';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            {displayProfile?.photos && displayProfile.photos.length > 0 ? (
              <Image source={{ uri: getImageUrl(displayProfile.photos[0]) }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={48} color={COLORS.textLight} />
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs }}>
            <Text style={styles.profileName}>
              {displayProfile?.name}{displayProfile?.age ? `, ${displayProfile.age}` : ''}
            </Text>
            {displayProfile?.isVerified && (
              <Ionicons name="checkmark-circle" size={18} color="#3B82F6" />
            )}
          </View>
          <Text style={styles.profileDept}>{displayProfile?.department}</Text>
          {displayProfile?.campus && (
            <View style={styles.campusBadge}>
              <Ionicons name="location" size={12} color={COLORS.primary} />
              <Text style={styles.campusText}>{displayProfile.campus}</Text>
            </View>
          )}
          <View style={styles.modeBadge}>
            <Text style={styles.modeText}>
              {mode === 'dating' ? '💕 Dating Mode' : '📚 Study Buddy Mode'}
            </Text>
          </View>
        </View>

        {/* Photos Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <View style={styles.photoGrid}>
            {displayProfile?.photos?.map((photo: string, i: number) => (
              <TouchableOpacity key={i} style={styles.photoThumb} onLongPress={() => deletePhoto(i)}>
                <Image source={{ uri: getImageUrl(photo) }} style={styles.photoThumbImage} />
                <TouchableOpacity style={styles.photoDeleteBadge} onPress={() => deletePhoto(i)}>
                  <Ionicons name="close-circle" size={20} color={COLORS.error} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
            {(!displayProfile?.photos || displayProfile.photos.length < 6) && (
              <TouchableOpacity style={styles.photoAddButton} onPress={() => {
                Alert.alert('Add Photo', 'Choose a source', [
                  { text: 'Camera', onPress: () => pickAndUploadPhoto('camera') },
                  { text: 'Library', onPress: () => pickAndUploadPhoto('library') },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={28} color={COLORS.primary} />
                    <Text style={{ color: COLORS.primary, fontSize: 11, marginTop: 4 }}>Add</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Badges */}
        {badges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Badges</Text>
            <View style={styles.badgeRow}>
              {badges.map((badge, i) => (
                <View key={i} style={styles.badgeItem}>
                  <Text style={styles.badgeIcon}>{BADGE_ICONS[badge.name] || '🏅'}</Text>
                  <Text style={styles.badgeName}>{badge.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {displayProfile?.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{displayProfile.bio}</Text>
          </View>
        )}

        {/* Profile Prompts */}
        {displayProfile?.profilePrompts && displayProfile.profilePrompts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prompts</Text>
            {displayProfile.profilePrompts.map((p: any, i: number) => (
              <View key={i} style={styles.promptItem}>
                <Text style={styles.promptQuestion}>{p.question}</Text>
                <Text style={styles.promptAnswer}>{p.answer}</Text>
              </View>
            ))}
          </View>
        )}

        {displayProfile?.interests && displayProfile.interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.interestRow}>
              {displayProfile.interests.map((interest: string) => (
                <View key={interest} style={styles.interestBadge}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailRow}>
            <Ionicons name="school-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>{displayProfile?.year || 'Not set'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>Interested in: {displayProfile?.interestedIn || 'Everyone'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="mail-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>{displayProfile?.email}</Text>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.settingRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
              <Ionicons name="eye-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.detailText}>Profile Visible</Text>
            </View>
            <Switch
              value={isVisible}
              onValueChange={toggleVisibility}
              trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
              thumbColor={isVisible ? COLORS.primary : COLORS.textLight}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity style={styles.boostButton} onPress={handleBoost} disabled={boosting}>
          <Ionicons name="flash" size={20} color={COLORS.accent} />
          <Text style={styles.boostButtonText}>Boost Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push('/complete-profile')}
        >
          <Ionicons name="create-outline" size={20} color={COLORS.primary} />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.blockedButton} onPress={loadBlockedUsers}>
          <Ionicons name="ban-outline" size={20} color={COLORS.textSecondary} />
          <Text style={styles.blockedButtonText}>Blocked Users</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Blocked Users Modal */}
      <Modal visible={showBlocked} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Blocked Users</Text>
              <TouchableOpacity onPress={() => setShowBlocked(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {blockedUsers.length === 0 ? (
              <Text style={{ ...FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', padding: SPACING.lg }}>
                No blocked users
              </Text>
            ) : (
              <FlatList
                data={blockedUsers}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <View style={styles.blockedItem}>
                    <Text style={{ ...FONTS.regular, color: COLORS.text, flex: 1 }}>{item.name}</Text>
                    <TouchableOpacity onPress={() => handleUnblock(item._id)}>
                      <Text style={{ ...FONTS.bold, color: COLORS.primary, fontSize: 13 }}>Unblock</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  header: { marginBottom: SPACING.lg },
  headerTitle: { ...FONTS.h1, color: COLORS.text },
  profileCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.xl,
    alignItems: 'center', ...SHADOWS.medium, marginBottom: SPACING.lg,
  },
  avatarLarge: {
    width: 100, height: 100, borderRadius: RADIUS.full, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: SPACING.md,
  },
  avatarImage: { width: '100%', height: '100%' },
  profileName: { ...FONTS.h2, color: COLORS.text },
  profileDept: { ...FONTS.regular, color: COLORS.primary, marginTop: SPACING.xs },
  campusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm,
    backgroundColor: COLORS.primaryLight + '15', paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs, borderRadius: RADIUS.full,
  },
  campusText: { ...FONTS.caption, color: COLORS.primary, fontWeight: '600' },
  modeBadge: {
    marginTop: SPACING.sm, backgroundColor: COLORS.accent + '15',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.full,
  },
  modeText: { ...FONTS.caption, color: COLORS.accent, fontWeight: '600' },
  section: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginBottom: SPACING.md, ...SHADOWS.small,
  },
  sectionTitle: { ...FONTS.h3, color: COLORS.text, marginBottom: SPACING.sm },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  photoThumb: { width: 95, height: 120, borderRadius: RADIUS.md, overflow: 'hidden', position: 'relative' },
  photoThumbImage: { width: '100%', height: '100%' },
  photoDeleteBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 10 },
  photoAddButton: { width: 95, height: 120, borderRadius: RADIUS.md, borderWidth: 2, borderColor: COLORS.primary, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  bioText: { ...FONTS.regular, color: COLORS.textSecondary, lineHeight: 22 },
  promptItem: {
    backgroundColor: COLORS.primaryLight + '10', borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  promptQuestion: { fontSize: 12, fontWeight: '600', color: COLORS.primary, marginBottom: 4 },
  promptAnswer: { ...FONTS.regular, color: COLORS.text },
  interestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  interestBadge: {
    backgroundColor: COLORS.primaryLight + '20', paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs, borderRadius: RADIUS.full,
  },
  interestText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  detailText: { ...FONTS.regular, color: COLORS.textSecondary },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  badgeItem: { alignItems: 'center', gap: 4 },
  badgeIcon: { fontSize: 28 },
  badgeName: { ...FONTS.caption, color: COLORS.textSecondary, fontSize: 10 },
  boostButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.accent + '15', borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.accent,
  },
  boostButtonText: { ...FONTS.bold, color: COLORS.accent },
  editButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.primary,
  },
  editButtonText: { ...FONTS.bold, color: COLORS.primary },
  blockedButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  blockedButtonText: { ...FONTS.bold, color: COLORS.textSecondary },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.error,
  },
  logoutText: { ...FONTS.bold, color: COLORS.error },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: { ...FONTS.h2, color: COLORS.text },
  blockedItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
});
