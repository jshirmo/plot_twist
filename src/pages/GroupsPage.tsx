import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { GroupItem } from '../types';
import { getUserRatingFeedback } from '../lib/mediaService';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Users, Plus, UserPlus, Sparkles, Copy, Check, ArrowRight } from 'lucide-react';

export const GroupsPage: React.FC = () => {
  const { user, userProfile, signIn } = useAuth();
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<GroupItem | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [groupRecommendations, setGroupRecommendations] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setGroups([]);
    setSelectedGroup(null);
    setGroupRecommendations([]);
    setLoading(Boolean(user));
    if (!user) return () => { active = false; };

    const load = async () => {
      try {
        // Firestore security rules only allow members to list their own groups.
        const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', user.uid));
        const snap = await getDocs(q);
        if (!active) return;
        const items = snap.docs.map((d) => d.data() as GroupItem);
        setGroups(items);
        setSelectedGroup(items[0] ?? null);
      } catch (err) {
        console.error('Error fetching groups:', err);
        if (active) setNotice('Could not load your groups. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [user?.uid]);

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim() || busy) return;
    setBusy(true);
    setNotice(null);

    // Use cryptographic randomness for the invite code. For newly created groups,
    // the group document ID is derivable from the code so a joiner can update
    // membership without first reading a member-only Firestore document.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const randomBytes = new Uint32Array(6);
    crypto.getRandomValues(randomBytes);
    const code = Array.from(randomBytes, (value) => alphabet[value % alphabet.length]).join('');
    const groupId = `grp_${code}`;
    const newGroup: GroupItem = {
      id: groupId,
      name: newGroupName.trim(),
      ownerId: user.uid,
      inviteCode: code,
      memberIds: [user.uid],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'groups', groupId), newGroup);
      setGroups((prev) => [...prev, newGroup]);
      setSelectedGroup(newGroup);
      setGroupRecommendations([]);
      setNewGroupName('');
      setNotice(`Created "${newGroup.name}". Share your six-character invite code.`);
    } catch (err) {
      console.error('Error creating group:', err);
      setNotice('Could not create this group. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoinGroupByCode = async () => {
    if (!user || busy) return;
    const cleanCode = inviteCodeInput.trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(cleanCode)) {
      setNotice('Enter a valid six-character invite code.');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const groupRef = doc(db, 'groups', `grp_${cleanCode}`);
      // Do not query or read a group before membership: security rules disallow it.
      await updateDoc(groupRef, {
        memberIds: arrayUnion(user.uid),
        updatedAt: new Date().toISOString(),
      });
      const snap = await getDoc(groupRef);
      if (!snap.exists()) throw new Error('Group missing after join');
      const joined = snap.data() as GroupItem;
      setGroups((prev) => prev.some((group) => group.id === joined.id) ? prev : [...prev, joined]);
      setSelectedGroup(joined);
      setGroupRecommendations([]);
      setInviteCodeInput('');
      setNotice(`Joined "${joined.name}".`);
    } catch (err) {
      console.error('Error joining group:', err);
      setNotice('Could not join. Check the code, or ask the owner to recreate an older group.');
    } finally {
      setBusy(false);
    }
  };

  const handleLeaveGroup = async (group: GroupItem) => {
    if (!user || busy || !group.memberIds.includes(user.uid)) return;
    const isOwner = group.ownerId === user.uid;
    if (isOwner && !window.confirm('You own this group. Delete it for every member?')) return;

    setBusy(true);
    setNotice(null);
    try {
      const groupRef = doc(db, 'groups', group.id);
      if (isOwner) {
        await deleteDoc(groupRef);
      } else {
        await updateDoc(groupRef, {
          memberIds: arrayRemove(user.uid),
          updatedAt: new Date().toISOString(),
        });
      }
      const remaining = groups.filter((item) => item.id !== group.id);
      setGroups(remaining);
      setSelectedGroup(remaining[0] ?? null);
      setGroupRecommendations([]);
      setNotice(isOwner ? 'Group deleted.' : 'You left the group.');
    } catch (err) {
      console.error('Error leaving group:', err);
      setNotice('Could not leave this group. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      setNotice('Could not copy the code. Please copy it manually.');
    }
  };

  const handleGenerateGroupRecommendations = async () => {
    if (!selectedGroup || !user || generating) return;
    setGenerating(true);
    setNotice(null);
    setGroupRecommendations([]);
    try {
      const ratingFeedback = await getUserRatingFeedback(user.uid);

      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moodSettings: { darkness: 3, romance: 2, suspense: 4, plotTwists: 4, emotionalIntensity: 3 },
          tasteProfile: userProfile?.tasteProfile,
          formats: ['movie', 'tv', 'book', 'podcast'],
          ratingFeedback,
          groupId: selectedGroup.id,
        }),
      });
      if (!res.ok) throw new Error(`Recommendations returned ${res.status}`);
      const data = await res.json();
      setGroupRecommendations(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      console.error('Error generating group recommendations:', err);
      setNotice('Could not generate picks. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6">
        <Users className="w-12 h-12 text-[#D9B66F] mx-auto" />
        <h2 className="text-3xl font-serif font-bold text-[#F7F2E9]">
          Sign In to Access Groups
        </h2>
        <p className="text-sm text-[#F7F2E9]/70">
          Create groups with friends and discover stories to enjoy together.
        </p>
        <button
          onClick={() => signIn()}
          className="px-6 py-3 bg-[#D9B66F] text-[#091A2B] font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-[#10283F] pb-6 space-y-2">
        <h1 className="text-3xl font-serif font-bold text-[#F7F2E9]">Group Recommendations</h1>
        <p className="text-xs text-[#F7F2E9]/70">
          Organize groups and explore books, movies, shows, and podcasts together
        </p>
      </div>

      {notice && (
        <div className="p-3 bg-[#10283F] border border-[#D9B66F]/50 rounded-xl text-xs text-[#D9B66F]">
          {notice}
        </div>
      )}

      {/* Main Grid: Groups Sidebar & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Create & Join Groups */}
        <div className="space-y-6">
          {/* Create Group Box */}
          <div className="bg-[#10283F]/30 border border-[#10283F] rounded-2xl p-5 space-y-3">
            <h3 className="font-serif font-bold text-sm text-[#F7F2E9] flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#D9B66F]" />
              <span>Create a New Group</span>
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Movie Night Crew"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="flex-1 bg-[#091A2B] border border-[#10283F] rounded-lg px-3 py-2 text-xs text-[#F7F2E9] focus:outline-none focus:border-[#D9B66F]"
              />
              <button
                onClick={handleCreateGroup}
                disabled={busy}
                className="px-3.5 py-2 bg-[#D9B66F] text-[#091A2B] font-bold text-xs rounded-lg hover:bg-[#D9B66F]/90 cursor-pointer"
              >
                Create
              </button>
            </div>
          </div>

          {/* Join Group with Code */}
          <div className="bg-[#10283F]/30 border border-[#10283F] rounded-2xl p-5 space-y-3">
            <h3 className="font-serif font-bold text-sm text-[#F7F2E9] flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#2C7A7B]" />
              <span>Join with Invite Code</span>
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter 6-character code"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value)}
                className="flex-1 uppercase tracking-wider bg-[#091A2B] border border-[#10283F] rounded-lg px-3 py-2 text-xs text-[#F7F2E9] focus:outline-none focus:border-[#D9B66F]"
              />
              <button
                onClick={handleJoinGroupByCode}
                disabled={busy}
                className="px-3.5 py-2 bg-[#2C7A7B] text-white font-bold text-xs rounded-lg hover:bg-[#2C7A7B]/90 cursor-pointer"
              >
                Join
              </button>
            </div>
          </div>

          {/* User's Groups List */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#D9B66F] block">
              Your Groups ({groups.length})
            </span>
            {loading ? (
              <p className="text-xs text-[#F7F2E9]/60">Loading your groups...</p>
            ) : groups.length === 0 ? (
              <p className="text-xs text-[#F7F2E9]/50">You aren't in any groups yet.</p>
            ) : (
              groups.map((grp) => (
                <button
                  key={grp.id}
                  onClick={() => setSelectedGroup(grp)}
                  className={`w-full p-4 rounded-xl border text-left transition-colors flex items-center justify-between cursor-pointer ${
                    selectedGroup?.id === grp.id
                      ? 'bg-[#10283F] border-[#D9B66F] text-[#F7F2E9]'
                      : 'bg-[#10283F]/20 border-[#10283F] text-[#F7F2E9]/70 hover:border-[#10283F]'
                  }`}
                >
                  <div>
                    <h4 className="font-serif font-bold text-sm">{grp.name}</h4>
                    <span className="text-xs text-[#F7F2E9]/50">{grp.memberIds.length} members</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#D9B66F]" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Selected Group Details & AI Recommendations */}
        <div className="lg:col-span-2 space-y-6">
          {selectedGroup && selectedGroup.memberIds.includes(user.uid) ? (
            <div className="bg-[#10283F]/30 border border-[#10283F] rounded-2xl p-6 space-y-6">
              {/* Group Header & Invite Code */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#10283F] pb-4">
                <div>
                  <span className="text-xs text-[#D9B66F] font-semibold uppercase">Active Group</span>
                  <h2 className="text-2xl font-serif font-bold text-[#F7F2E9]">{selectedGroup.name}</h2>
                  <button onClick={() => handleLeaveGroup(selectedGroup)} disabled={busy} className="mt-2 text-xs text-rose-300 disabled:opacity-50 cursor-pointer">{selectedGroup.ownerId === user.uid ? "Delete Group" : "Leave Group"}</button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#F7F2E9]/60">Invite Code:</span>
                  <div className="px-3 py-1 bg-[#091A2B] border border-[#10283F] rounded-lg text-xs font-mono font-bold text-[#D9B66F]">
                    {selectedGroup.inviteCode}
                  </div>
                  <button
                    onClick={() => handleCopyCode(selectedGroup.inviteCode)}
                    className="p-1.5 bg-[#10283F] hover:bg-[#10283F]/80 text-[#D9B66F] rounded-lg transition-colors cursor-pointer"
                    title="Copy invite code"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Shared Recommendation Action */}
              <div className="bg-[#091A2B] border border-[#10283F] rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-serif font-bold text-sm text-[#F7F2E9]">
                    Find Group Compromise Pick
                  </h4>
                  <p className="text-xs text-[#F7F2E9]/70">
                    Preview picks based on your own preferences. Group-wide matching requires Ben's backend integration.
                  </p>
                </div>
                <button
                  onClick={handleGenerateGroupRecommendations}
                  disabled={generating}
                  className="px-5 py-2.5 bg-[#D9B66F] text-[#091A2B] font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{generating ? 'Finding Picks...' : 'Preview Picks'}</span>
                </button>
              </div>

              {/* Group Recommendations Results */}
              {groupRecommendations.length > 0 && (
                <div className="space-y-4 pt-2">
                  <h3 className="font-serif font-bold text-base text-[#F7F2E9]">
                    Recommendation Preview
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {groupRecommendations.slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        className="bg-[#091A2B] border border-[#10283F] rounded-xl p-4 flex gap-3 hover:border-[#D9B66F]/40 transition-colors"
                      >
                        <img
                          src={item.posterUrl}
                          alt={item.title}
                          className="w-16 h-24 object-cover rounded-lg bg-[#10283F] shrink-0"
                        />
                        <div className="space-y-1 flex-1">
                          <span className="text-[10px] text-[#D9B66F] font-semibold uppercase">{item.mediaType}</span>
                          <h4 className="font-serif font-bold text-sm text-[#F7F2E9] line-clamp-1">{item.title}</h4>
                          <span className="text-xs text-[#F7F2E9]/50 block">{item.genres.slice(0, 2).join(', ')}</span>
                          <p className="text-[11px] text-[#F7F2E9]/70 line-clamp-2 italic pt-1">
                            "{item.aiExplanation}"
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#10283F]/30 border border-[#10283F] rounded-2xl p-12 text-center text-xs text-[#F7F2E9]/60">
              Select or create a group to view shared recommendations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
