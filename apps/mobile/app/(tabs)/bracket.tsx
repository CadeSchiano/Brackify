import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  generateDoubleEliminationBracket,
  generateRoundRobinSchedule,
  generateSingleEliminationBracket,
  recordMatchResult,
  type TournamentMatch,
} from "@brackify/firebase";
import { auth } from "../../firebase/client";
import { palette, ScreenTitle, TeamMark } from "../../components";
import { useTournamentData } from "../../tournament-data";

export default function BracketScreen() {
  const { tournament, teams, matches, loading } = useTournamentData();
  const [selected, setSelected] = useState<TournamentMatch | null>(null);
  const [a, setA] = useState("0");
  const [b, setB] = useState("0");
  const [busy, setBusy] = useState(false);
  const team = (id: string | null) => teams.find((value) => value.id === id);
  const organizer = auth.currentUser?.uid === tournament?.organizerId;
  const maxRound = Math.max(...matches.map((match) => match.round), 0);
  if (loading)
    return (
      <View style={s.empty}>
        <Text>Loading bracket…</Text>
      </View>
    );
  if (!tournament)
    return (
      <View style={s.empty}>
        <Text style={s.emptyTitle}>No active tournament</Text>
        <Text style={s.emptyCopy}>
          Your bracket will appear after you join or create a tournament.
        </Text>
      </View>
    );
  const generate = async () => {
    if (teams.length < 2) return Alert.alert("Generate teams first");
    setBusy(true);
    try {
      const data = teams.map(({ id, name, color, playerIds }) => ({
        id,
        name,
        color,
        playerIds,
      }));
      if (tournament.format === "Round robin")
        await generateRoundRobinSchedule(tournament.id, data);
      else if (tournament.format === "Double elimination")
        await generateDoubleEliminationBracket(tournament.id, data);
      else await generateSingleEliminationBracket(tournament.id, data);
    } catch (error) {
      Alert.alert(
        "Could not generate bracket",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!selected) return;
    const scoreA = Number(a);
    const scoreB = Number(b);
    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) return;
    setBusy(true);
    try {
      await recordMatchResult(tournament.id, selected.id, scoreA, scoreB);
      setSelected(null);
    } catch (error) {
      Alert.alert(
        "Could not save score",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <ScreenTitle
        eyebrow={`${tournament.name.toUpperCase()} · LIVE`}
        title="Bracket"
      />
      {tournament.format === "Double elimination" && <View style={s.notice}><Text style={s.noticeTitle}>Double elimination</Text><Text style={s.noticeSub}>Works with any team count. Byes advance automatically and teams must lose twice to be eliminated.</Text></View>}
      {matches.length ? (
        <>
          <View style={s.notice}>
            <Text style={s.noticeTitle}>Live tournament bracket</Text>
            <Text style={s.noticeSub}>
              {organizer
                ? "Tap a match to enter its score."
                : "Match results update automatically."}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.bracketBoard}>{Array.from({ length: maxRound }, (_, index) => index + 1).map(
            (round) => (
              <View key={round} style={[s.roundColumn, { paddingTop: (round - 1) * 42 }]}>
                <Text style={s.round}>
                  {round === maxRound ? "CHAMPIONSHIP" : `ROUND ${round}`}
                </Text>
                {matches
                  .filter((match) => match.round === round)
                  .map((match) => (
                    <Pressable
                      style={s.match}
                      key={match.id}
                      disabled={!organizer || !match.teamAId || !match.teamBId}
                      onPress={() => {
                        setSelected(match);
                        setA(String(match.scoreA || 0));
                        setB(String(match.scoreB || 0));
                      }}
                    >
                      <Row
                        team={
                          team(match.teamAId) ||
                          (match.teamAName
                            ? { name: match.teamAName, color: match.teamAColor || "#E4E7EC" }
                            : undefined)
                        }
                        score={match.scoreA}
                        winner={match.winnerId === match.teamAId}
                      />
                      <View style={s.line} />
                      <Row
                        team={
                          team(match.teamBId) ||
                          (match.teamBName
                            ? { name: match.teamBName, color: match.teamBColor || "#E4E7EC" }
                            : undefined)
                        }
                        score={match.scoreB}
                        winner={match.winnerId === match.teamBId}
                      />
                    </Pressable>
                  ))}
              </View>
            ),
          )}</ScrollView>
        </>
      ) : (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>Bracket not generated</Text>
          <Text style={s.emptyCopy}>
            {organizer
              ? "Generate the live schedule when your teams are ready."
              : "The organizer will generate it once teams are ready."}
          </Text>
          {organizer && (
            <Pressable style={s.primary} onPress={generate} disabled={busy}>
              <Text style={s.primaryText}>
                {busy ? "Generating…" : "Generate bracket"}
              </Text>
            </Pressable>
          )}
        </View>
      )}
      <Modal transparent visible={Boolean(selected)} animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Record score</Text>
            <Text style={s.modalCopy}>
              {team(selected?.teamAId || null)?.name} vs{" "}
              {team(selected?.teamBId || null)?.name}
            </Text>
            <View style={s.scores}>
              <TextInput
                style={s.scoreInput}
                value={a}
                onChangeText={setA}
                keyboardType="number-pad"
              />
              <Text style={s.vs}>—</Text>
              <TextInput
                style={s.scoreInput}
                value={b}
                onChangeText={setB}
                keyboardType="number-pad"
              />
            </View>
            <Pressable style={s.primary} onPress={save} disabled={busy}>
              <Text style={s.primaryText}>
                {busy ? "Saving…" : "Save & advance"}
              </Text>
            </Pressable>
            <Pressable onPress={() => setSelected(null)}>
              <Text style={s.cancel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
function Row({
  team,
  score,
  winner,
}: {
  team?: { name: string; color: string };
  score: number | null;
  winner: boolean;
}) {
  return (
    <View style={[s.row, winner && s.winner]}>
      <TeamMark
        label={
          team
            ? team.name
                .split(" ")
                .map((word) => word[0])
                .join("")
                .slice(0, 2)
            : "—"
        }
        color={team?.color || "#E4E7EC"}
      />
      <Text style={[s.name, winner && s.winnerName]}>
        {team?.name || "TBD"}
      </Text>
      <Text style={s.score}>{score ?? "—"}</Text>
    </View>
  );
}
const s: any = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingTop: 42, paddingBottom: 30 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: palette.ink },
  emptyCopy: { fontSize: 12, color: palette.muted, textAlign: "center" },
  notice: {
    marginHorizontal: 20,
    borderRadius: 11,
    padding: 15,
    backgroundColor: "#EAEBFF",
    marginBottom: 24,
  },
  noticeTitle: { fontSize: 13, fontWeight: "700", color: "#3E49BF" },
  noticeSub: { fontSize: 11, color: "#6570B2", marginTop: 3 },
  round: {
    marginHorizontal: 20,
    color: "#8390A0",
    fontWeight: "700",
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 12,
  },
  match: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: "#FFF",
    overflow: "hidden",
  },
  row: { padding: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  winner: { backgroundColor: "#F3FBD7" },
  name: { flex: 1, fontSize: 13, fontWeight: "600", color: "#3A4351" },
  winnerName: { color: "#51651A" },
  score: { fontSize: 17, fontWeight: "700", color: palette.ink },
  line: { height: 1, backgroundColor: palette.line, marginLeft: 12 },
  primary: {
    marginTop: 14,
    backgroundColor: palette.purple,
    borderRadius: 8,
    padding: 13,
    minWidth: 160,
    alignItems: "center",
  },
  primaryText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  overlay: {
    flex: 1,
    backgroundColor: "#11182775",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
  },
  modalTitle: { fontSize: 19, fontWeight: "700", color: palette.ink },
  modalCopy: { marginTop: 5, color: palette.muted, fontSize: 12 },
  scores: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 22,
  },
  scoreInput: {
    width: 62,
    height: 52,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    textAlign: "center",
    fontSize: 21,
    fontWeight: "700",
    color: palette.ink,
  },
  vs: { color: palette.muted, fontSize: 18 },
  cancel: {
    marginTop: 17,
    color: palette.muted,
    fontWeight: "600",
    fontSize: 12,
  },
});

Object.assign(s, StyleSheet.create({ bracketBoard: { paddingHorizontal: 20, paddingBottom: 10, gap: 16 }, roundColumn: { width: 238 }, }));
