import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { UserCog, GraduationCap } from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <GraduationCap size={48} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Campus Connect</Text>
          <Text style={styles.subtitle}>Home Page</Text>
        </View>
        
        <Text style={styles.loginPrompt}>Choose your login type</Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/(auth)/admin-login')}
          >
            <View style={styles.buttonContent}>
              <UserCog size={32} color="#007AFF" />
              <Text style={styles.buttonText}>Admin Login</Text>
              <Text style={styles.buttonSubtext}>Access admin features</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/(auth)/student-login')}
          >
            <View style={styles.buttonContent}>
              <GraduationCap size={32} color="#007AFF" />
              <Text style={styles.buttonText}>Student Login</Text>
              <Text style={styles.buttonSubtext}>Access student portal</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: screenWidth * 0.04, // 4% padding on each side
    paddingVertical: screenHeight * 0.05,  // 5% top/bottom
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 380, // cap max width
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: screenHeight * 0.03, // tighter spacing
  },
  logo: {
    width: Math.max(screenWidth * 0.12, 55), // 12% width, min 55px
    height: Math.max(screenWidth * 0.12, 55),
    borderRadius: Math.max(screenWidth * 0.06, 27),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: screenHeight * 0.015,
  },
  title: {
    fontSize: Math.min(screenWidth * 0.065, 22), // slightly smaller cap
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Math.min(screenWidth * 0.04, 15),
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
    opacity: 0.85,
  },
  loginPrompt: {
    fontSize: Math.min(screenWidth * 0.045, 16),
    color: '#FFFFFF',
    marginBottom: screenHeight * 0.03,
    textAlign: 'center',
    opacity: 0.9,
  },
  buttonContainer: {
    width: '100%',
    gap: screenHeight * 0.02, // tighter gap between buttons
  },
  loginButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: screenHeight * 0.02, // smaller padding
    paddingHorizontal: screenWidth * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    minHeight: screenHeight * 0.07, // slightly smaller buttons
  },
  buttonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: Math.min(screenWidth * 0.045, 15),
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 6,
    marginBottom: 2,
    textAlign: 'center',
  },
  buttonSubtext: {
    fontSize: Math.min(screenWidth * 0.035, 13),
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 6,
  },
});
