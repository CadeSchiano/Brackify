import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { TournamentProvider } from '../../tournament-data'

const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size}/>

export default function TabLayout() {
  return <TournamentProvider><Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#5263F5', tabBarInactiveTintColor: '#98A1AF', tabBarStyle: { height: 76, paddingTop: 8, borderTopColor: '#E8EBEF' }, tabBarLabelStyle: { fontSize: 10, fontWeight: '600' } }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline') }}/>
    <Tabs.Screen name="bracket" options={{ title: 'Bracket', tabBarIcon: icon('trophy-outline') }}/>
    <Tabs.Screen name="teams" options={{ title: 'Teams', tabBarIcon: icon('people-outline') }}/>
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-outline') }}/>
  </Tabs></TournamentProvider>
}
