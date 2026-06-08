import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import api from '../src/services/api';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const INTERESTED_IN = ['Male', 'Female', 'Everyone'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'PG 1st Year', 'PG 2nd Year', 'PhD'];
const CAMPUSES = ['Main Campus', 'Kengeri Campus', 'Bannerghatta Road Campus', 'Lavasa Campus', 'NCR Campus', 'Pune Campus'];
const INTEREST_OPTIONS = [
  'Music', 'Sports', 'Reading', 'Travel', 'Gaming', 'Cooking',
  'Photography', 'Movies', 'Art', 'Dance', 'Fitness', 'Coding',
  'Volunteering', 'Theater', 'Hiking', 'Fashion',
];

const PROMPT_QUESTIONS = [
  "My ideal date is...",
  "My hot take is...",
  "I'm looking for someone who...",
  "A fun fact about me is...",
  "The way to my heart is...",
  "My most controversial opinion is...",
];

const STUDY_SUBJECTS = [
  'Math', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
  'English', 'Economics', 'Psychology', 'History', 'Law',
  'Marketing', 'Finance', 'Data Science', 'Philosophy', 'Statistics',
];

export default function CompleteProfileScreen() {
  const { user, updateUser } = useAuth();
  const [bio, setBio] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [interestedIn, setInterestedIn] = useState('Everyone');
  const [year, setYear] = useState('');
  const [campus, setCampus] = useState('Main Campus');
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('dating');
  const [studySubjects, setStudySubjects] = useState<string[]>([]);
  const [prompts, setPrompts] = useState<{ question: string; answer: string }[]>([]);
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const [currentPromptAnswer, setCurrentPromptAnswer] = useState('');
  const [selectedPromptQ, setSelectedPromptQ] = useState('');

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : prev.length < 6
          ? [...prev, interest]
          : prev
    );
  };

  const toggleStudySubject = (subject: string) => {
    setStudySubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : prev.length < 5
          ? [...prev, subject]
          : prev
    );
  };

  const addPrompt = () => {
    if (!selectedPromptQ || !currentPromptAnswer.trim()) return;
    setPrompts((prev) => [...prev, { question: selectedPromptQ, answer: currentPromptAnswer.trim() }]);
    setCurrentPromptAnswer('');
    setSelectedPromptQ('');
    setShowPromptPicker(false);
  };

  const removePrompt = (index: number) => {
    setPrompts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!age || !gender || !bio.trim() || !year) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 30) {
      Alert.alert('Error', 'Age must be between 18 and 30');
      return;
    }

    setLoading(true);
    try {
      const data = await api.updateProfile({
        bio: bio.trim(),
        age: ageNum,
        gender,
        interestedIn,
        year,
        campus,
        interests,
        mode,
        studySubjects,
        profilePrompts: prompts,
      });
      updateUser(data);
      router.replace('/(tabs)/discover');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="person-circle-outline" size={48} color={COLORS.primary} />
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>Hey {user?.name}! Let's set up your profile.</Text>
      </View>

      {/* Bio */}
      <Text style={styles.label}>About You *</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Write a short bio about yourself..."
        placeholderTextColor={COLORS.textLight}
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={300}
      />
      <Text style={styles.charCount}>{bio.length}/300</Text>

      {/* Age */}
      <Text style={styles.label}>Age *</Text>
      <TextInput
        style={styles.inputField}
        placeholder="Your age"
        placeholderTextColor={COLORS.textLight}
        value={age}
        onChangeText={setAge}
        keyboardType="number-pad"
        maxLength={2}
      />

      {/* Gender */}
      <Text style={styles.label}>Gender *</Text>
      <View style={styles.chipRow}>
        {GENDERS.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.chip, gender === g && styles.chipSelected]}
            onPress={() => setGender(g)}
          >
            <Text style={[styles.chipText, gender === g && styles.chipTextSelected]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Interested In */}
      <Text style={styles.label}>Interested In</Text>
      <View style={styles.chipRow}>
        {INTERESTED_IN.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, interestedIn === opt && styles.chipSelected]}
            onPress={() => setInterestedIn(opt)}
          >
            <Text style={[styles.chipText, interestedIn === opt && styles.chipTextSelected]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Year */}
      <Text style={styles.label}>Year *</Text>
      <View style={styles.chipRow}>
        {YEARS.map((y) => (
          <TouchableOpacity
            key={y}
            style={[styles.chip, year === y && styles.chipSelected]}
            onPress={() => setYear(y)}
          >
            <Text style={[styles.chipText, year === y && styles.chipTextSelected]}>{y}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Campus */}
      <Text style={styles.label}>Campus</Text>
      <View style={styles.chipRow}>
        {CAMPUSES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, campus === c && styles.chipSelected]}
            onPress={() => setCampus(c)}
          >
            <Text style={[styles.chipText, campus === c && styles.chipTextSelected]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Interests */}
      <Text style={styles.label}>Interests (pick up to 6)</Text>
      <View style={styles.chipRow}>
        {INTEREST_OPTIONS.map((i) => (
          <TouchableOpacity
            key={i}
            style={[styles.chip, interests.includes(i) && styles.chipSelected]}
            onPress={() => toggleInterest(i)}
          >
            <Text style={[styles.chipText, interests.includes(i) && styles.chipTextSelected]}>{i}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Mode */}
      <Text style={styles.label}>Mode</Text>
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, mode === 'dating' && styles.chipSelected]}
          onPress={() => setMode('dating')}
        >
          <Text style={[styles.chipText, mode === 'dating' && styles.chipTextSelected]}>💕 Dating</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, mode === 'study-buddy' && styles.chipSelected]}
          onPress={() => setMode('study-buddy')}
        >
          <Text style={[styles.chipText, mode === 'study-buddy' && styles.chipTextSelected]}>📚 Study Buddy</Text>
        </TouchableOpacity>
      </View>

      {/* Study Subjects (visible in study-buddy mode) */}
      {mode === 'study-buddy' && (
        <>
          <Text style={styles.label}>Study Subjects (pick up to 5)</Text>
          <View style={styles.chipRow}>
            {STUDY_SUBJECTS.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, studySubjects.includes(s) && styles.chipSelected]}
                onPress={() => toggleStudySubject(s)}
              >
                <Text style={[styles.chipText, studySubjects.includes(s) && styles.chipTextSelected]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Profile Prompts */}
      <Text style={styles.label}>Profile Prompts (optional)</Text>
      {prompts.map((p, i) => (
        <View key={i} style={{ backgroundColor: COLORS.primaryLight + '10', borderRadius: 12, padding: 12, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.primary }}>{p.question}</Text>
            <TouchableOpacity onPress={() => removePrompt(i)}>
              <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 14, color: COLORS.text, marginTop: 4 }}>{p.answer}</Text>
        </View>
      ))}
      {prompts.length < 3 && (
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 }}
          onPress={() => setShowPromptPicker(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
          <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Add a prompt</Text>
        </TouchableOpacity>
      )}

      {/* Prompt Picker */}
      {showPromptPicker && (
        <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border }}>
          {!selectedPromptQ ? (
            <>
              <Text style={{ ...FONTS.medium, color: COLORS.text, marginBottom: 8 }}>Choose a question:</Text>
              {PROMPT_QUESTIONS.filter((q) => !prompts.find((p) => p.question === q)).map((q) => (
                <TouchableOpacity key={q} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border }} onPress={() => setSelectedPromptQ(q)}>
                  <Text style={{ color: COLORS.text }}>{q}</Text>
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <>
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.primary, marginBottom: 8 }}>{selectedPromptQ}</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Your answer..."
                placeholderTextColor={COLORS.textLight}
                value={currentPromptAnswer}
                onChangeText={setCurrentPromptAnswer}
                maxLength={200}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={{ flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' }} onPress={() => { setShowPromptPicker(false); setSelectedPromptQ(''); setCurrentPromptAnswer(''); }}>
                  <Text style={{ color: COLORS.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center' }} onPress={addPrompt}>
                  <Text style={{ color: COLORS.white, fontWeight: '600' }}>Add</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.buttonText}>Save & Continue</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  subtitle: {
    ...FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  label: {
    ...FONTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  inputField: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    backgroundColor: COLORS.surface,
    ...FONTS.regular,
    color: COLORS.text,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    minHeight: 80,
    textAlignVertical: 'top',
    ...FONTS.regular,
    color: COLORS.text,
  },
  charCount: {
    ...FONTS.caption,
    color: COLORS.textSecondary,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    ...FONTS.regular,
    color: COLORS.text,
    fontSize: 13,
  },
  chipTextSelected: {
    color: COLORS.white,
    fontWeight: '600',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    ...FONTS.bold,
    color: COLORS.white,
    fontSize: 16,
  },
});
