import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/services/api';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../src/constants/theme';

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      setProfile(data);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
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

  const displayProfile = profile || user;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            {displayProfile?.photos && displayProfile.photos.length > 0 ? (
              <Image source={{ uri: displayProfile.photos[0] }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={48} color={COLORS.textLight} />
            )}
          </View>
          <Text style={styles.profileName}>
            {displayProfile?.name}{displayProfile?.age ? `, ${displayProfile.age}` : ''}
          </Text>
          <Text style={styles.profileDept}>{displayProfile?.department}</Text>
          {displayProfile?.campus && (
            <View style={styles.campusBadge}>
              <Ionicons name="location" size={12} color={COLORS.primary} />
              <Text style={styles.campusText}>{displayProfile.campus}</Text>
            </View>
          )}
        </View>

        {displayProfile?.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{displayProfile.bio}</Text>
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
            <Text style={styles.detailText}>
              Interested in: {displayProfile?.interestedIn || 'Everyone'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="mail-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>{displayProfile?.email}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push('/complete-profile')}
        >
          <Ionicons name="create-outline" size={20} color={COLORS.primary} />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  headerTitle: {
    ...FONTS.h1,
    color: COLORS.text,
  },
  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.medium,
    marginBottom: SPACING.lg,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.full,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileName: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  profileDept: {
    ...FONTS.regular,
    color: COLORS.primary,
    marginTop: SPACING.xs,
  },
  campusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primaryLight + '15',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  campusText: {
    ...FONTS.caption,
    color: COLORS.primary,
    fontWeight: '600',
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  bioText: {
    ...FONTS.regular,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  interestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  interestBadge: {
    backgroundColor: COLORS.primaryLight + '20',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  interestText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailText: {
    ...FONTS.regular,
    color: COLORS.textSecondary,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  editButtonText: {
    ...FONTS.bold,
    color: COLORS.primary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  logoutText: {
    ...FONTS.bold,
    color: COLORS.error,
  },
});
