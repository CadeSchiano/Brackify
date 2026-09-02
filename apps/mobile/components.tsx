import { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

export const palette = { ink: '#172031', muted: '#7C8797', purple: '#5263F5', lime: '#D6FF3F', line: '#E7EAF0', surface: '#FFFFFF', canvas: '#F6F7F9' }

export function ScreenTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return <View style={styles.titleWrap}>{eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}<Text style={styles.title}>{title}</Text>{children}</View>
}

export function TeamMark({ label, color }: { label: string; color: string }) { return <View style={[styles.mark, { backgroundColor: color }]}><Text style={styles.markText}>{label}</Text></View> }

const styles = StyleSheet.create({
  titleWrap: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 },
  eyebrow: { fontSize: 10, fontWeight: '700', color: '#718098', letterSpacing: 1.1, marginBottom: 7 },
  title: { fontSize: 27, fontWeight: '700', color: '#172031', letterSpacing: -0.4 },
  mark: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#1D2836', fontSize: 10, fontWeight: '800' },
})
