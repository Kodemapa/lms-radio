import { StatusBar } from 'expo-status-bar';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  // CLAUDE.md rule 4: capture blocking is on for the whole app, always.
  // Android: FLAG_SECURE (screenshots and recordings come out black).
  // iOS: hides content from screen recording and mirroring.
  usePreventScreenCapture();

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        ObGyn e-LMS
      </Text>
      <Text style={styles.body}>
        Screen capture is blocked in this app. Sign-in, courses and the protected player are
        next on the roadmap.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
});
