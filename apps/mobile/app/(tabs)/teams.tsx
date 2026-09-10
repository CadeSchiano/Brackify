import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  addTournamentPlayer,
  deleteTournamentTeams,
  removeTournamentPlayer,
  saveTeams,
  type StoredTeam,
} from "@brackify/firebase";
import { auth } from "../../firebase/client";
import { palette, ScreenTitle, TeamMark } from "../../components";
import { useTournamentData } from "../../tournament-data";

const teamNames = [
  "Falcons",
  "Wolves",
  "Knights",
  "Ravens",
  "Sharks",
  "Titans",
  "Vipers",
  "Owls",
];
const nameCategories: Record<string, string[]> = { Animals: ["Falcons", "Wolves", "Ravens", "Sharks", "Tigers", "Cobras", "Owls", "Bears"], Fantasy: ["Dragons", "Knights", "Wizards", "Phoenixes", "Titans", "Giants", "Runes", "Griffins"], Gaming: ["Raiders", "Vipers", "Ninjas", "Spartans", "Rogues", "Legends", "Blitz", "Quest"], Sports: ["Strikers", "Rockets", "Chargers", "Comets", "Storm", "Heat", "Hawks", "United"], Space: ["Nova", "Orbits", "Comets", "Cosmos", "Eclipse", "Astros", "Quasar", "Galaxy"], Funny: ["Pickles", "Waffles", "Pandas", "Nachos", "Potatoes", "Unicorns", "Socks", "Bananas"] };
const colors = [
  "#D6FF3F",
  "#FF6B71",
  "#8A7CFF",
  "#55C8FF",
  "#FFC267",
  "#63D9B8",
  "#FF9A7B",
  "#81B9FF",
];
const teamColorOptions = [
  { name: "Lime", value: "#D6FF3F" }, { name: "Red", value: "#FF6B71" },
  { name: "Purple", value: "#8A7CFF" }, { name: "Blue", value: "#55C8FF" },
  { name: "Gold", value: "#FFC267" }, { name: "Green", value: "#63D9B8" },
  { name: "Coral", value: "#FF9A7B" }, { name: "Sky", value: "#81B9FF" },
];
const colorWheelOptions = [
  { name: "Red", value: "#FF5C5C" }, { name: "Orange", value: "#FF914D" },
  { name: "Gold", value: "#FFC267" }, { name: "Yellow", value: "#E8DB4A" },
  { name: "Green", value: "#63D9B8" }, { name: "Teal", value: "#45C9C3" },
  { name: "Sky", value: "#55C8FF" }, { name: "Blue", value: "#638CFF" },
  { name: "Purple", value: "#8A7CFF" }, { name: "Violet", value: "#B77CFF" },
  { name: "Pink", value: "#EF79B5" }, { name: "Coral", value: "#FF9A7B" },
];

function shuffle<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

export default function TeamsScreen() {
  const { tournament, teams, players, loading, replaceTeams } = useTournamentData();
  const [newPlayer, setNewPlayer] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [generationMode, setGenerationMode] = useState<
    "teamCount" | "teamSize"
  >("teamCount");
  const [teamCount, setTeamCount] = useState(4);
  const [playersPerTeam, setPlayersPerTeam] = useState("4");
  const [nameCategory, setNameCategory] = useState("Animals");
  const [colorTeam, setColorTeam] = useState<StoredTeam | null>(null);
  useEffect(() => {
    if (!tournament) return;
    setTeamCount(tournament.maxTeams);
    setGenerationMode("teamCount");
  }, [tournament?.id, tournament?.maxTeams]);
  if (loading)
    return (
      <View style={s.empty}>
        <Text>Loading teams…</Text>
      </View>
    );
  if (!tournament)
    return (
      <View style={s.empty}>
        <Text style={s.emptyTitle}>No active tournament</Text>
        <Text style={s.emptyCopy}>
          Teams will appear here once you create or join a tournament.
        </Text>
      </View>
    );
  const organizer = auth.currentUser?.uid === tournament.organizerId;
  const generatedTeamCount =
    generationMode === "teamSize"
      ? Math.max(
          2,
          Math.ceil(players.length / Math.max(1, Number(playersPerTeam) || 1)),
        )
      : teamCount;
  const generate = async () => {
    if (players.length < 2)
      return Alert.alert(
        "Add players first",
        "A tournament needs at least two players before teams can be generated.",
      );
    const shuffled = shuffle(players);
    const generated: StoredTeam[] = Array.from(
      { length: generatedTeamCount },
      (_, index) => ({
        id: `team-${index + 1}`,
        name: `Team ${(nameCategories[nameCategory] || teamNames)[index] || index + 1}`,
        color: colors[index % colors.length],
        playerIds: shuffled
          .filter(
            (_, playerIndex) => playerIndex % generatedTeamCount === index,
          )
          .map((player) => player.id),
      }),
    ).filter((team) => team.playerIds.length);
    setBusy(true);
    try {
      await saveTeams(tournament.id, generated);
      // The Firestore listener will confirm this shortly, but showing the saved
      // result immediately prevents a successful generation from looking empty.
      replaceTeams(generated);
      setFeedback(`${generated.length} random teams saved and synced.`);
      setShowSetup(false);
    } catch (error) {
      Alert.alert(
        "Could not save teams",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const add = async () => {
    const name = newPlayer.trim();
    if (!name) return;
    setBusy(true);
    setFeedback("");
    try {
      await addTournamentPlayer(tournament.id, name);
      setNewPlayer("");
      setFeedback(`${name} added to the shared roster.`);
    } catch (error) {
      Alert.alert(
        "Could not add player",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = (player: { id: string; name: string }) =>
    Alert.alert(
      "Remove player?",
      `${player.name} will be removed from the roster and any assigned team.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            setFeedback("");
            try {
              await removeTournamentPlayer(tournament.id, player.id);
              setFeedback(`${player.name} removed from the roster.`);
            } catch (error) {
              Alert.alert(
                "Could not remove player",
                error instanceof Error ? error.message : "Please try again.",
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  const editTeam = (team: StoredTeam) => Alert.alert("Edit team", team.name, [{ text: "Cancel", style: "cancel" }, { text: "Rename", onPress: () => Alert.prompt("Team name", "Enter a custom name", async name => { if (!name?.trim()) return; const updated = teams.map(item => item.id === team.id ? { ...item, name: name.trim() } : item); await saveTeams(tournament.id, updated); replaceTeams(updated) }, "plain-text", team.name) }, { text: "Choose color", onPress: () => setColorTeam(team) }])
  const setTeamColor = async (color: string) => {
    if (!colorTeam) return;
    try { const updated = teams.map(item => item.id === colorTeam.id ? { ...item, color } : item); await saveTeams(tournament.id, updated); replaceTeams(updated); setColorTeam(null); }
    catch (error) { Alert.alert("Could not save color", error instanceof Error ? error.message : "Please try again."); }
  };
  return (
    <KeyboardAvoidingView style={s.screen} behavior="padding">
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <ScreenTitle eyebrow={`${teams.length} SAVED TEAMS`} title="Teams">
        <Text style={s.subtitle}>{tournament.name}</Text>
      </ScreenTitle>
      {organizer && teams.length > 0 && !showSetup && <Pressable style={[s.primary, { marginHorizontal: 20, marginBottom: 14 }]} onPress={() => setShowSetup(true)}><Ionicons name="shuffle" size={15} color="#FFF"/><Text style={s.primaryText}>Generate new teams</Text></Pressable>}
      {organizer && (showSetup || !teams.length) && (
        <View style={s.actions}>
          <View style={s.generationPanel}>
            <Text style={s.generationTitle}>Make random teams by</Text>
            <Text style={s.generationTitle}>Team-name category</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={s.categoryRow}>{Object.keys(nameCategories).map(category => <Pressable key={category} style={[s.categoryButton, nameCategory === category && s.categoryButtonActive]} onPress={() => setNameCategory(category)}><Text style={[s.categoryText, nameCategory === category && s.categoryTextActive]}>{category}</Text></Pressable>)}</View></ScrollView>
            <View style={s.modeRow}>
              <Pressable
                style={[
                  s.modeButton,
                  generationMode === "teamCount" && s.modeButtonActive,
                ]}
                onPress={() => setGenerationMode("teamCount")}
              >
                <Text
                  style={[
                    s.modeText,
                    generationMode === "teamCount" && s.modeTextActive,
                  ]}
                >
                  Number of teams
                </Text>
              </Pressable>
              <Pressable
                style={[
                  s.modeButton,
                  generationMode === "teamSize" && s.modeButtonActive,
                ]}
                onPress={() => setGenerationMode("teamSize")}
              >
                <Text
                  style={[
                    s.modeText,
                    generationMode === "teamSize" && s.modeTextActive,
                  ]}
                >
                  Players per team
                </Text>
              </Pressable>
            </View>
            {generationMode === "teamCount" ? (
              <View style={s.countRow}>
                {[2, 4, 6, 8].map((count) => (
                  <Pressable
                    key={count}
                    style={[
                      s.countButton,
                      teamCount === count && s.countButtonActive,
                    ]}
                    onPress={() => setTeamCount(count)}
                  >
                    <Text
                      style={[
                        s.countText,
                        teamCount === count && s.countTextActive,
                      ]}
                    >
                      {count}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={s.sizeRow}>
                <TextInput
                  style={s.sizeInput}
                  value={playersPerTeam}
                  onChangeText={setPlayersPerTeam}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={s.sizeCopy}>
                  {players.length
                    ? `${generatedTeamCount} teams will be made from ${players.length} players.`
                    : "Add players to preview teams."}
                </Text>
              </View>
            )}
          </View>
          <Pressable
            style={[s.primary, busy && s.disabled]}
            disabled={busy}
            onPress={generate}
          >
            <Ionicons name="shuffle" size={16} color="#FFF" />
            <Text style={s.primaryText}>
              {teams.length ? "Randomize teams again" : "Generate random teams"}
            </Text>
          </Pressable>
          {teams.length > 0 && <Pressable style={{ alignItems: "center", padding: 8 }} onPress={() => Alert.alert("Delete teams?", "This removes team assignments but keeps your player roster.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteTournamentTeams(tournament.id).then(() => replaceTeams([])).catch(error => Alert.alert("Could not delete teams", error instanceof Error ? error.message : "Please try again.")) }])}><Text style={{ color: "#C44955", fontSize: 12, fontWeight: "700" }}>Delete teams</Text></Pressable>}
          <View style={s.addRow}>
            <TextInput
              style={s.input}
              value={newPlayer}
              onChangeText={setNewPlayer}
              onSubmitEditing={add}
              placeholder="Add a player"
              placeholderTextColor="#9AA4B2"
              returnKeyType="done"
            />
            <Pressable style={s.addButton} onPress={add} disabled={busy}>
              <Text style={s.addText}>Add</Text>
            </Pressable>
          </View>
          <Text style={s.rosterCounter}>{players.length} {players.length === 1 ? "name" : "names"} in this tournament</Text>
          {feedback ? <Text style={s.feedback}>{feedback}</Text> : null}
        </View>
      )}
      {(showSetup || !teams.length) && <View style={s.roster}>
        <View style={s.rosterHead}>
          <View>
            <Text style={s.rosterTitle}>Shared roster</Text>
            <Text style={s.rosterCopy}>
              {players.length} {players.length === 1 ? "player" : "players"}{" "}
              saved live
            </Text>
          </View>
          <Ionicons name="cloud-done-outline" size={20} color="#5263F5" />
        </View>
        {players.length ? (
          players.map((player, index) => (
            <View style={s.rosterRow} key={player.id}>
              <View
                style={[
                  s.rosterNumber,
                  { backgroundColor: colors[index % colors.length] },
                ]}
              >
                <Text>{player.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <Text style={s.rosterName}>{player.name}</Text>
              {organizer && (
                <Pressable
                  hitSlop={8}
                  onPress={() => remove(player)}
                  disabled={busy}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={21}
                    color="#8C97A8"
                  />
                </Pressable>
              )}
            </View>
          ))
        ) : (
          <Text style={s.rosterEmpty}>
            No players yet. Add each player above and they will appear here
            immediately.
          </Text>
        )}
      </View>}
      {teams.length ? (
        teams.map((team) => (
          <Pressable key={team.id} style={s.card} onPress={() => organizer && editTeam(team)}>
            <TeamMark
              label={team.name
                .split(" ")
                .map((word) => word[0])
                .join("")
                .slice(0, 2)}
              color={team.color}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{team.name}</Text>
              {team.playerIds.map((id) => (
                <Text key={id} style={s.player}>
                  •{" "}
                  {players.find((player) => player.id === id)?.name ||
                    "Unknown player"}
                </Text>
              ))}
            </View>
          </Pressable>
        ))
      ) : (
        <View style={s.emptyInline}>
          <Text style={s.emptyTitle}>Teams not generated</Text>
          <Text style={s.emptyCopy}>
            {organizer
              ? "Your roster is saved above. Generate balanced teams whenever you are ready."
              : "The organizer will publish teams when they are ready."}
          </Text>
        </View>
      )}
      <Modal visible={Boolean(colorTeam)} transparent animationType="fade" onRequestClose={() => setColorTeam(null)}>
        <View style={s.colorOverlay}><View style={s.colorModal}><Text style={s.colorModalTitle}>Choose a team color</Text><Text style={s.colorModalCopy}>{colorTeam?.name}</Text><View style={s.colorWheel}>{colorWheelOptions.map((option, index) => { const angle = (index / colorWheelOptions.length) * Math.PI * 2 - Math.PI / 2; return <Pressable key={option.value} accessibilityLabel={option.name} style={[s.wheelColor, { backgroundColor: option.value, left: 88 + Math.cos(angle) * 78, top: 88 + Math.sin(angle) * 78 }, colorTeam?.color === option.value && s.wheelColorSelected]} onPress={() => void setTeamColor(option.value)} /> })}<View style={[s.wheelCenter, { backgroundColor: colorTeam?.color || palette.purple }]}><Text style={s.wheelCenterText}>Tap a color</Text></View></View><Text style={s.colorHint}>Or choose a favorite</Text><View style={s.colorGrid}>{teamColorOptions.map(option => <Pressable key={option.value} accessibilityLabel={option.name} style={[s.colorOption, { backgroundColor: option.value }, colorTeam?.color === option.value && s.colorOptionSelected]} onPress={() => void setTeamColor(option.value)}><Text style={s.colorOptionText}>{option.name}</Text></Pressable>)}</View><Pressable onPress={() => setColorTeam(null)}><Text style={s.colorCancel}>Cancel</Text></Pressable></View></View>
      </Modal>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
const s: any = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingTop: 42, paddingBottom: 30 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: palette.canvas,
    gap: 8,
  },
  emptyInline: { margin: 20, alignItems: "center", padding: 25, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: palette.ink },
  emptyCopy: { fontSize: 12, color: palette.muted, textAlign: "center" },
  subtitle: { fontSize: 12, color: palette.muted, marginTop: 5 },
  actions: { marginHorizontal: 20, marginBottom: 16, gap: 10 },
  primary: {
    backgroundColor: palette.purple,
    borderRadius: 9,
    minHeight: 45,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  disabled: { opacity: 0.6 },
  addRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: palette.ink,
  },
  addButton: {
    backgroundColor: "#EAEBFF",
    borderRadius: 8,
    paddingHorizontal: 17,
    justifyContent: "center",
  },
  addText: { color: palette.purple, fontWeight: "700", fontSize: 12 },
  feedback: { color: "#168362", fontSize: 11, fontWeight: "600", marginTop: 2 },
  rosterCounter: { color: palette.muted, fontSize: 11, fontWeight: "600", textAlign: "right" },
  roster: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 11,
    overflow: "hidden",
  },
  rosterHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
    borderColor: palette.line,
  },
  rosterTitle: { color: palette.ink, fontSize: 14, fontWeight: "700" },
  rosterCopy: { color: palette.muted, fontSize: 10, marginTop: 2 },
  rosterRow: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderColor: "#F0F1F4",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rosterNumber: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  rosterName: { flex: 1, color: "#374151", fontSize: 12, fontWeight: "600" },
  rosterEmpty: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 17,
    padding: 14,
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  name: { color: "#374151", fontSize: 14, fontWeight: "700", marginBottom: 6 },
  player: { color: palette.muted, fontSize: 11, lineHeight: 19 },
  colorOverlay: { flex: 1, backgroundColor: "rgba(20, 30, 50, .45)", justifyContent: "center", padding: 24 },
  colorModal: { backgroundColor: "#FFF", borderRadius: 18, padding: 22 },
  colorModalTitle: { color: palette.ink, fontSize: 19, fontWeight: "800", textAlign: "center" },
  colorModalCopy: { color: palette.muted, fontSize: 13, textAlign: "center", marginTop: 5, marginBottom: 18 },
  colorWheel: { width: 212, height: 212, alignSelf: "center", position: "relative", marginBottom: 12 },
  wheelColor: { position: "absolute", width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "#FFF" },
  wheelColorSelected: { borderColor: palette.ink, borderWidth: 4 },
  wheelCenter: { position: "absolute", width: 92, height: 92, left: 60, top: 60, borderRadius: 46, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "#FFF" },
  wheelCenterText: { color: palette.ink, fontSize: 11, fontWeight: "800" },
  colorHint: { color: palette.muted, fontSize: 11, fontWeight: "700", marginBottom: 8 },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 22 },
  colorOption: { width: "47%", minHeight: 52, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "transparent" },
  colorOptionSelected: { borderColor: palette.ink },
  colorOptionText: { color: palette.ink, fontSize: 12, fontWeight: "800" },
  colorCancel: { color: palette.purple, textAlign: "center", fontSize: 14, fontWeight: "800" },
});

Object.assign(
  s,
  StyleSheet.create({
    generationPanel: {
      backgroundColor: "#FFF",
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 10,
      padding: 12,
      gap: 9,
    },
    generationTitle: { color: palette.ink, fontSize: 12, fontWeight: "700" },
    modeRow: { flexDirection: "row", gap: 7 },
    modeButton: {
      flex: 1,
      minHeight: 34,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: palette.line,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    modeButtonActive: {
      borderColor: palette.purple,
      backgroundColor: "#EAEBFF",
    },
    modeText: { color: palette.muted, fontSize: 10, fontWeight: "700" },
    modeTextActive: { color: palette.purple },
    countRow: { flexDirection: "row", gap: 7 },
    countButton: {
      flex: 1,
      minHeight: 32,
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
    },
    countButtonActive: {
      backgroundColor: palette.purple,
      borderColor: palette.purple,
    },
    countText: { color: palette.ink, fontSize: 12, fontWeight: "700" },
    countTextActive: { color: "#FFF" },
    sizeRow: { flexDirection: "row", alignItems: "center", gap: 9 },
    sizeInput: {
      width: 50,
      height: 35,
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 7,
      textAlign: "center",
      color: palette.ink,
      fontWeight: "700",
    },
    sizeCopy: { flex: 1, color: palette.muted, fontSize: 10, lineHeight: 14 },
  }),
);
