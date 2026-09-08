import { useEffect, useState } from "react";
import {
  Alert,
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
  removeTournamentPlayer,
  saveTeams,
  updateTournament,
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
  const { tournament, teams, players, loading } = useTournamentData();
  const [newPlayer, setNewPlayer] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [generationMode, setGenerationMode] = useState<
    "teamCount" | "teamSize"
  >("teamCount");
  const [teamCount, setTeamCount] = useState(4);
  const [playersPerTeam, setPlayersPerTeam] = useState("4");
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
        name: `Team ${teamNames[index] || index + 1}`,
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
      await updateTournament(tournament.id, { maxTeams: generated.length });
      await saveTeams(tournament.id, generated);
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
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <ScreenTitle eyebrow={`${teams.length} SAVED TEAMS`} title="Teams">
        <Text style={s.subtitle}>{tournament.name}</Text>
      </ScreenTitle>
      {organizer && teams.length > 0 && !showSetup && <Pressable style={[s.primary, { marginHorizontal: 20, marginBottom: 14 }]} onPress={() => setShowSetup(true)}><Ionicons name="shuffle" size={15} color="#FFF"/><Text style={s.primaryText}>Generate new teams</Text></Pressable>}
      {organizer && (showSetup || !teams.length) && (
        <View style={s.actions}>
          <View style={s.generationPanel}>
            <Text style={s.generationTitle}>Make random teams by</Text>
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
          <View key={team.id} style={s.card}>
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
          </View>
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
    </ScrollView>
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
