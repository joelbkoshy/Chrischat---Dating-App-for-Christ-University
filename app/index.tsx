import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import { COLORS } from '../src/constants/theme';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (!user.isProfileComplete) {
    return <Redirect href="/complete-profile" />;
  }

  return <Redirect href="/(tabs)/discover" />;
}
