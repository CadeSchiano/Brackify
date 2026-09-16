// @ts-nocheck
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { palette, ScreenTitle, TeamMark } from "../../components";
import { useTournamentData } from "../../tournament-data";
import {
  createTournament,
  joinTournamentByCode,
  updateTournament,
  type StoredTournament,
} from "@brackify/firebase";
import { auth } from "../../firebase/client";
import { signOut } from "firebase/auth";
import { uploadMobileTournamentImage } from "../../cloudinary";

export default function HomeScreen() {
  const router = useRouter();
  const {
    tournament,
    tournaments,
    teams,
    players,
    matches,
    loading,
    selectTournament,
  } = useTournamentData();
  const [switching, setSwitching] = useState(false);
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [editing, setEditing] = useState(false);
  const guest = Boolean(auth.currentUser?.isAnonymous);
  const requireAccount = () => Alert.alert(
    "Create an account to organize",
    "Guests can join and follow tournaments. Create an account to make or manage one.",
    [{ text: "Not now", style: "cancel" }, { text: "Create account", onPress: () => { void signOut(auth); router.replace('/(auth)'); } }],
  );
  const nextMatch = matches.find(
    (match) => match.teamAId && match.teamBId && !match.winnerId,
  );
  const findTeam = (id: string | null) => teams.find((team) => team.id === id);
  const left = findTeam(nextMatch?.teamAId || null);
  const right = findTeam(nextMatch?.teamBId || null);
  if (loading)
    return (
      <View style={styles.empty}>
        <Text>Loading your tournaments…</Text>
      </View>
    );
  const join = async () => {
    if (!auth.currentUser) return;
    setJoinError("");
    try {
      await joinTournamentByCode(auth.currentUser.uid, code);
      setJoining(false);
      setCode("");
    } catch (error) {
      setJoinError(
        error instanceof Error ? error.message : "Could not join tournament.",
      );
    }
  };
  if (!tournament)
    return (
      <View style={styles.empty}>
        <Ionicons name="trophy-outline" size={32} color="#5263F5" />
        <Text style={styles.emptyTitle}>No tournament yet</Text>
        <Text style={styles.emptyCopy}>
          {guest ? "Join a tournament with an invite code, or create an account to organize one." : "Create your own tournament or join one with an invite code."}
        </Text>
        <Pressable style={styles.joinButton} onPress={() => guest ? requireAccount() : setCreating(true)}>
          <Text style={styles.joinButtonText}>Create tournament</Text>
        </Pressable>
        <Pressable onPress={() => setJoining(true)}>
          <Text style={styles.secondaryAction}>Join with invite code</Text>
        </Pressable>
        <JoinModal
          visible={joining}
          code={code}
          setCode={setCode}
          error={joinError}
          onClose={() => setJoining(false)}
          onJoin={join}
        />
        <CreateTournamentModal
          visible={creating}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            selectTournament(id);
            setCreating(false);
          }}
        />
      </View>
    );
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topline}>
        <Text style={styles.brand}>brackify</Text>
        <View style={styles.topActions}>
          {auth.currentUser?.uid === tournament.organizerId && (
            <Pressable style={styles.editIcon} onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" color="#5263F5" size={18} />
            </Pressable>
          )}
          {!guest && <Pressable
            style={styles.createIcon}
            onPress={() => setCreating(true)}
          >
            <Ionicons name="add" color="#FFF" size={20} />
          </Pressable>}
          <View style={styles.avatar}>
            <Text>{authInitials()}</Text>
          </View>
        </View>
      </View>
      <ScreenTitle eyebrow="● LIVE TOURNAMENT" title={tournament.name} />
      {tournaments.length > 1 && (
        <View style={styles.switcherWrap}>
          <Pressable
            style={styles.switcher}
            onPress={() => setSwitching((value) => !value)}
          >
            <Text>Switch tournament</Text>
            <Ionicons
              name={switching ? "chevron-up" : "chevron-down"}
              color="#5263F5"
              size={15}
            />
          </Pressable>
          {switching && (
            <View style={styles.switchList}>
              {tournaments.map((item) => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.switchItem,
                    item.id === tournament.id && styles.switchItemActive,
                  ]}
                  onPress={() => {
                    selectTournament(item.id);
                    setSwitching(false);
                  }}
                >
                  <Text style={styles.switchItemTitle}>{item.name}</Text>
                  <Text style={styles.switchItemSub}>
                    {item.description || item.game}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
      <Pressable style={styles.hero} onPress={() => router.push("/bracket")}>
        <View style={styles.heroTop}>
          <View style={styles.trophy}>
            <Ionicons name="trophy" color="#172031" size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>
              {tournament.description || tournament.game}
            </Text>
            <Text style={styles.heroSub}>
              {tournament.format} · {teams.length} teams
            </Text>
          </View>
          <Ionicons name="chevron-forward" color="#B4BDCA" size={20} />
        </View>
        <View style={styles.heroMeta}>
          <Ionicons name="location-outline" color="#B4BDCA" size={15} />
          <Text style={styles.heroMetaText}>
            {tournament.location || "Location TBA"}
          </Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.heroMetaText}>
            {tournament.date || "Date TBA"}
          </Text>
        </View>
        <Text style={styles.percent}>
          {players.length} PLAYERS · {teams.length} TEAMS
        </Text>
      </Pressable>
      <Pressable style={styles.shareButton} onPress={() => setSharing(true)}>
        <Ionicons name="share-outline" color="#5263F5" size={17} />
        <Text style={styles.shareText}>Invite players</Text>
      </Pressable>
      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionTitle}>Up next</Text>
          <Text style={styles.sectionSub}>
            {nextMatch
              ? `Round ${nextMatch.round} · Match ${nextMatch.position}`
              : "Bracket complete or not generated yet."}
          </Text>
        </View>
        <Text style={styles.live}>LIVE</Text>
      </View>
      {nextMatch && left && right ? (
        <View style={styles.match}>
          <Row team={left} score={nextMatch.scoreA} />
          <View style={styles.divider} />
          <Row team={right} score={nextMatch.scoreB} />
          <Pressable
            style={styles.matchButton}
            onPress={() => router.push("/bracket")}
          >
            <Text>View live bracket</Text>
            <Ionicons name="arrow-forward" color="#5263F5" size={16} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.noMatch}>
          <Text>Waiting for the organizer to generate the bracket.</Text>
        </View>
      )}
      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionTitle}>Teams</Text>
          <Text style={styles.sectionSub}>Live team assignments</Text>
        </View>
        <Pressable onPress={() => router.push("/teams")}>
          <Text style={styles.link}>See teams</Text>
        </Pressable>
      </View>
      {teams.slice(0, 2).map((team) => (
        <View style={styles.teamCard} key={team.id}>
          <TeamMark label={initials(team.name)} color={team.color} />
          <View style={{ flex: 1 }}>
            <Text style={styles.teamCardTitle}>{team.name}</Text>
            <Text style={styles.sectionSub}>
              {team.playerIds.length} players
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color="#95A0AF" />
        </View>
      ))}
      <CreateTournamentModal
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          selectTournament(id);
          setCreating(false);
        }}
      />
      <ShareTournamentModal
        visible={sharing}
        tournamentName={tournament.name}
        code={tournament.inviteCode}
        onClose={() => setSharing(false)}
      />
      <EditTournamentModal
        visible={editing}
        tournament={tournament}
        onClose={() => setEditing(false)}
      />
    </ScrollView>
  );
}
function JoinModal({
  visible,
  code,
  setCode,
  error,
  onClose,
  onJoin,
}: {
  visible: boolean;
  code: string;
  setCode: (value: string) => void;
  error: string;
  onClose: () => void;
  onJoin: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Join tournament</Text>
          <Text style={styles.modalCopy}>
            Enter your organizer’s invite code.
          </Text>
          <TextInput
            style={styles.codeInput}
            autoCapitalize="characters"
            maxLength={8}
            value={code}
            onChangeText={(value) => setCode(value.toUpperCase())}
            placeholder="ABCD1234"
            placeholderTextColor="#A0A9B6"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.joinButton} onPress={onJoin}>
            <Text style={styles.joinButtonText}>Join</Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
function ShareTournamentModal({
  visible,
  tournamentName,
  code,
  onClose,
}: {
  visible: boolean;
  tournamentName: string;
  code: string;
  onClose: () => void;
}) {
  const message = `Join ${tournamentName} on Brackify with invite code ${code}.`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(message)}`;
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Invite players</Text>
          <Text style={styles.modalCopy}>
            Scan the code or share this invite code.
          </Text>
          <Image style={styles.qr} source={{ uri: qrUrl }} />
          <Text style={styles.inviteCode}>{code}</Text>
          <Pressable
            style={styles.joinButton}
            onPress={() => Share.share({ message })}
          >
            <Text style={styles.joinButtonText}>Share invite</Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text style={styles.cancel}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
function EditTournamentModal({
  visible,
  tournament,
  onClose,
}: {
  visible: boolean;
  tournament: StoredTournament;
  onClose: () => void;
}) {
  const [name, setName] = useState(tournament.name);
  const [game, setGame] = useState(tournament.game);
  const [location, setLocation] = useState(tournament.location);
  const [date, setDate] = useState(tournament.date);
  const [visibility, setVisibility] = useState(tournament.visibility);
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState(tournament.imageUrl || "");
  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateTournament(tournament.id, {
        name: name.trim(),
        description: game.trim() || "Tournament",
        game: game.trim() || "General",
        location: location.trim(),
        date: date.trim(),
        visibility,
        imageUrl,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };
  const chooseImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return Alert.alert(
        "Photo permission needed",
        "Allow photo access to choose a tournament image.",
      );
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (result.canceled) return;
    setSaving(true);
    try {
      const url = await uploadMobileTournamentImage(
        result.assets[0].uri,
        result.assets[0].mimeType || "image/jpeg",
      );
      setImageUrl(url);
      await updateTournament(tournament.id, { imageUrl: url });
    } catch (error) {
      Alert.alert(
        "Image upload failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  const endTournament = () => Alert.alert("End tournament?", "It will be removed from active dashboards, while its teams and results stay saved.", [{ text: "Cancel", style: "cancel" }, { text: "End tournament", style: "destructive", onPress: async () => { setSaving(true); try { await updateTournament(tournament.id, { status: "completed" }); onClose() } catch (error) { Alert.alert("Could not end tournament", error instanceof Error ? error.message : "Please try again.") } finally { setSaving(false) } } }]);
  return (
    <Modal transparent visible={visible} animationType="slide">
      <View style={styles.modalOverlay}>
        <ScrollView contentContainerStyle={styles.createModal}>
          <Text style={styles.modalTitle}>Edit tournament</Text>
          <Pressable
            style={styles.imagePicker}
            onPress={chooseImage}
            disabled={saving}
          >
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.tournamentImage}
              />
            ) : (
              <>
                <Ionicons name="image-outline" size={24} color="#5263F5" />
                <Text style={styles.imageText}>Add tournament image</Text>
              </>
            )}
          </Pressable>
          <TextInput
            style={styles.fieldInput}
            value={name}
            onChangeText={setName}
            placeholder="Tournament name"
          />
          <TextInput
            style={styles.fieldInput}
            value={game}
            onChangeText={setGame}
            placeholder="Game or sport"
          />
          <TextInput
            style={styles.fieldInput}
            value={location}
            onChangeText={setLocation}
            placeholder="Location"
          />
          <TextInput
            style={styles.fieldInput}
            value={date}
            onChangeText={setDate}
            placeholder="Date and time"
          />
          <View style={styles.choiceRow}>
            {(["private", "public"] as const).map((value) => (
              <Pressable
                key={value}
                style={[
                  styles.choice,
                  visibility === value && styles.choiceSelected,
                ]}
                onPress={() => setVisibility(value)}
              >
                <Text
                  style={[
                    styles.choiceText,
                    visibility === value && styles.choiceTextSelected,
                  ]}
                >
                  {value === "private" ? "Private" : "Public"}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.joinButton} disabled={saving} onPress={save}>
            <Text style={styles.joinButtonText}>
              {saving ? "Saving…" : "Save changes"}
            </Text>
          </Pressable>
          <Pressable disabled={saving} onPress={endTournament} style={{ alignItems: "center", padding: 14 }}><Text style={{ color: "#C44955", fontSize: 12, fontWeight: "700" }}>End tournament</Text></Pressable>
          <Pressable onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
function CreateTournamentModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [game, setGame] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [players, setPlayers] = useState("");
  const [format, setFormat] = useState<
    "Single elimination" | "Round robin" | "Double elimination"
  >("Single elimination");
  const [teamCount, setTeamCount] = useState(4);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const create = async () => {
    const user = auth.currentUser;
    const names = players
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (!user || !name.trim() || names.length < 2)
      return setError("Add a tournament name and at least two player names.");
    setSaving(true);
    setError("");
    try {
      const tournament = await createTournament(user.uid, {
        name: name.trim(),
        description: game.trim() || "Tournament",
        game: game.trim() || "General",
        location: location.trim(),
        date: date.trim(),
        format,
        visibility: "private",
        maxTeams: teamCount,
        playerNames: names,
      });
      onCreated(tournament.id);
    } catch {
      setError(
        "Could not create the tournament. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal transparent visible={visible} animationType="slide">
      <View style={styles.modalOverlay}>
        <ScrollView contentContainerStyle={styles.createModal}>
          <Text style={styles.modalTitle}>Create tournament</Text>
          <Text style={styles.modalCopy}>
            This tournament will sync everywhere you use Brackify.
          </Text>
          <TextInput
            style={styles.fieldInput}
            value={name}
            onChangeText={setName}
            placeholder="Tournament name"
            placeholderTextColor="#A0A9B6"
          />
          <TextInput
            style={styles.fieldInput}
            value={game}
            onChangeText={setGame}
            placeholder="Game or sport"
            placeholderTextColor="#A0A9B6"
          />
          <TextInput
            style={styles.fieldInput}
            value={location}
            onChangeText={setLocation}
            placeholder="Location (optional)"
            placeholderTextColor="#A0A9B6"
          />
          <TextInput
            style={styles.fieldInput}
            value={date}
            onChangeText={setDate}
            placeholder="Date and time (optional)"
            placeholderTextColor="#A0A9B6"
          />
          <Text style={styles.fieldLabel}>Format</Text>
          <View style={styles.choiceRow}>
            {(
              [
                "Single elimination",
                "Round robin",
                "Double elimination",
              ] as const
            ).map((value) => (
              <Pressable
                key={value}
                style={[
                  styles.choice,
                  format === value && styles.choiceSelected,
                ]}
                onPress={() => setFormat(value)}
              >
                <Text
                  style={[
                    styles.choiceText,
                    format === value && styles.choiceTextSelected,
                  ]}
                >
                  {value.replace(" elimination", "")}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Teams</Text>
          <View style={styles.choiceRow}>
            {[2, 4, 8].map((value) => (
              <Pressable
                key={value}
                style={[
                  styles.choice,
                  teamCount === value && styles.choiceSelected,
                ]}
                onPress={() => setTeamCount(value)}
              >
                <Text
                  style={[
                    styles.choiceText,
                    teamCount === value && styles.choiceTextSelected,
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[styles.fieldInput, styles.playersInput]}
            value={players}
            onChangeText={setPlayers}
            placeholder="Player names, separated by commas or new lines"
            placeholderTextColor="#A0A9B6"
            multiline
            textAlignVertical="top"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.joinButton, saving && styles.disabled]}
            disabled={saving}
            onPress={create}
          >
            <Text style={styles.joinButtonText}>
              {saving ? "Creating…" : "Create tournament"}
            </Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
function Row({
  team,
  score,
}: {
  team: { name: string; color: string };
  score: number | null;
}) {
  return (
    <View style={styles.matchRow}>
      <TeamMark label={initials(team.name)} color={team.color} />
      <Text style={styles.teamName}>{team.name}</Text>
      <Text style={styles.score}>{score ?? "—"}</Text>
    </View>
  );
}
function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}
function authInitials() {
  return (auth.currentUser?.displayName || auth.currentUser?.email || "U")
    .split(" ")
    .map((value) => value[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingBottom: 30 },
  empty: {
    flex: 1,
    padding: 32,
    backgroundColor: palette.canvas,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyTitle: { color: palette.ink, fontSize: 18, fontWeight: "700" },
  emptyCopy: {
    color: palette.muted,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
  },
  joinButton: {
    marginTop: 8,
    minWidth: 150,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: palette.purple,
    alignItems: "center",
  },
  joinButtonText: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "#11182775",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
  },
  modalTitle: { color: palette.ink, fontSize: 20, fontWeight: "700" },
  modalCopy: { color: palette.muted, fontSize: 12, marginTop: 5 },
  codeInput: {
    width: "100%",
    marginVertical: 18,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    padding: 12,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 3,
    color: palette.ink,
  },
  error: { color: "#B44343", fontSize: 11, marginBottom: 8 },
  cancel: {
    color: palette.muted,
    marginTop: 17,
    fontSize: 12,
    fontWeight: "600",
  },
  topline: {
    paddingHorizontal: 20,
    paddingTop: 59,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    fontSize: 21,
    color: palette.ink,
    fontWeight: "800",
    letterSpacing: -1,
  },
  avatar: {
    width: 33,
    height: 33,
    borderRadius: 17,
    backgroundColor: "#FFC267",
    alignItems: "center",
    justifyContent: "center",
  },
  switcherWrap: { marginHorizontal: 20, marginBottom: 12 },
  switcher: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  switchList: {
    marginTop: 8,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 10,
    overflow: "hidden",
  },
  switchItem: { padding: 11, borderBottomWidth: 1, borderColor: palette.line },
  switchItemActive: { backgroundColor: "#F0F1FF" },
  switchItemTitle: { color: palette.ink, fontSize: 12, fontWeight: "700" },
  switchItemSub: { color: palette.muted, fontSize: 10, marginTop: 2 },
  hero: {
    marginHorizontal: 20,
    backgroundColor: "#121B2A",
    borderRadius: 15,
    padding: 18,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  trophy: {
    height: 40,
    width: 40,
    borderRadius: 10,
    backgroundColor: palette.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: "#FFF", fontSize: 17, fontWeight: "700" },
  heroSub: { color: "#ABB5C6", marginTop: 3, fontSize: 11 },
  heroMeta: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  heroMetaText: { color: "#B4BDCA", fontSize: 11 },
  dot: { color: palette.lime, marginHorizontal: 3 },
  percent: {
    color: palette.lime,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.7,
    marginTop: 17,
  },
  sectionHead: {
    paddingHorizontal: 20,
    marginTop: 27,
    marginBottom: 11,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { color: palette.ink, fontSize: 17, fontWeight: "700" },
  sectionSub: { color: palette.muted, fontSize: 11, marginTop: 3 },
  live: {
    color: "#21A97D",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  link: { color: palette.purple, fontSize: 12, fontWeight: "700" },
  match: {
    marginHorizontal: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    overflow: "hidden",
  },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  teamName: { flex: 1, color: "#374151", fontSize: 13, fontWeight: "600" },
  score: { color: palette.ink, fontSize: 17, fontWeight: "700" },
  divider: { height: 1, backgroundColor: palette.line, marginLeft: 14 },
  matchButton: {
    borderTopWidth: 1,
    borderColor: palette.line,
    padding: 13,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  noMatch: {
    marginHorizontal: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
    borderRadius: 12,
  },
  teamCard: {
    marginHorizontal: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  teamCardTitle: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
  },
});

Object.assign(
  styles,
  StyleSheet.create({
    secondaryAction: {
      color: palette.purple,
      marginTop: 16,
      fontSize: 12,
      fontWeight: "700",
    },
    topActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    createIcon: {
      width: 33,
      height: 33,
      borderRadius: 17,
      backgroundColor: palette.purple,
      alignItems: "center",
      justifyContent: "center",
    },
    createModal: {
      width: "100%",
      maxHeight: "92%",
      backgroundColor: "#FFF",
      borderRadius: 14,
      padding: 24,
    },
    fieldInput: {
      width: "100%",
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 8,
      padding: 12,
      color: palette.ink,
      fontSize: 13,
      marginTop: 12,
    },
    fieldLabel: {
      marginTop: 16,
      color: palette.ink,
      fontSize: 12,
      fontWeight: "700",
    },
    choiceRow: { flexDirection: "row", gap: 7, marginTop: 8 },
    choice: {
      flex: 1,
      minHeight: 38,
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 5,
    },
    choiceSelected: { backgroundColor: "#EAEBFF", borderColor: palette.purple },
    choiceText: { color: palette.muted, fontSize: 10, fontWeight: "700" },
    choiceTextSelected: { color: palette.purple },
    playersInput: { height: 92 },
  }),
);

Object.assign(
  styles,
  StyleSheet.create({
    shareButton: {
      marginHorizontal: 20,
      marginTop: 10,
      padding: 12,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: "#DDE1F8",
      backgroundColor: "#FFF",
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 7,
    },
    shareText: { color: palette.purple, fontSize: 12, fontWeight: "700" },
    qr: { width: 180, height: 180, marginVertical: 16 },
    inviteCode: {
      fontSize: 23,
      fontWeight: "800",
      letterSpacing: 3,
      color: palette.purple,
      marginBottom: 4,
    },
  }),
);

Object.assign(
  styles,
  StyleSheet.create({
    editIcon: {
      width: 33,
      height: 33,
      borderRadius: 17,
      backgroundColor: "#EAEBFF",
      alignItems: "center",
      justifyContent: "center",
    },
  }),
);

Object.assign(
  styles,
  StyleSheet.create({
    imagePicker: {
      height: 118,
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: "#BFC6F7",
      backgroundColor: "#F6F7FF",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      overflow: "hidden",
    },
    imageText: { color: palette.purple, fontSize: 12, fontWeight: "700" },
    tournamentImage: { width: "100%", height: "100%" },
  }),
);
