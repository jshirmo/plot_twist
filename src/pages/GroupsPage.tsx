import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { GroupItem } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { apiUrl } from '../lib/api';
import { collection, doc, setDoc, getDocs, query, where, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Users, Plus, UserPlus, Sparkles, Copy, Check, Film, ArrowRight } from 'lucide-react';

export const GroupsPage: React.FC = () => {
  const { user, signIn } = useAuth();
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<GroupItem | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [groupRecommendations, setGroupRecommendations] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const loadGroups = async () => {
    if (!user) return;
    setLoading(true);
    const path = 'groups';
    try {
      const q = query(collection(db, path), where('memberIds', 'array-contains', user.uid));
      const snap = await getDocs(q);
      const items: GroupItem[] = [];
      snap.forEach((d) => items.push(d.data() as GroupItem));
      setGroups(items);
      if (items.length > 0 && !selectedGroup) {
        setSelectedGroup(items[0]);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadGroups();
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim()) return;
    const groupId = `grp_${Date.now()}`;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const path = `groups/${groupId}`;

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
      setGroups([...groups, newGroup]);
      setSelectedGroup(newGroup);
      setNewGroupName('');
      setNotice(`Group "${newGroup.name}" created! Invite code: ${code}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleJoinGroupByCode = async () => {
    if (!user || !inviteCodeInput.trim()) return;
    const cleanCode = inviteCodeInput.trim().toUpperCase();
    const path = 'groups';

    try {
      const q = query(collection(db, path), where('inviteCode', '==', cleanCode));
      const snap = await getDocs(q);
      if (snap.empty) {
        setNotice('No group found with that invite code.');
        return;
      }

      const targetDoc = snap.docs[0];
      const targetGroup = targetDoc.data() as GroupItem;

      if (targetGroup.memberIds.includes(user.uid)) {
        setNotice('You are already a member of this group!');
        setSelectedGroup(targetGroup);
        return;
      }

      await updateDoc(doc(db, 'groups', targetDoc.id), {
        memberIds: arrayUnion(user.uid),
        updatedAt: new Date().toISOString(),
      });

      const updated = { ...targetGroup, memberIds: [...targetGroup.memberIds, user.uid] };
      setGroups([...groups, updated]);
      setSelectedGroup(updated);
      setInviteCodeInput('');
      setNotice(`Successfully joined "${updated.name}"!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleGenerateGroupRecommendations = async () => {
    if (!selectedGroup) return;
    setGenerating(true);
    try {
      const res = await fetch(apiUrl('/api/recommendations'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user!.getIdToken()}` },
        body: JSON.stringify({
          moodSettings: { darkness: 3, romance: 2, suspense: 4, plotTwists: 4, emotionalIntensity: 3 },
          formats: ['movie', 'tv'],
        }),
      });
      const data = await res.json();
      setGroupRecommendations(data.results || []);
    } catch (err) {
      console.error('Error generating group recommendations:', err);
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
          Create shared watchlists and collective recommendations with friends and family.
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
          Collaborate with friends to discover movies and shows that satisfy everyone's taste
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
            {groups.length === 0 ? (
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
          {selectedGroup ? (
            <div className="bg-[#10283F]/30 border border-[#10283F] rounded-2xl p-6 space-y-6">
              {/* Group Header & Invite Code */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#10283F] pb-4">
                <div>
                  <span className="text-xs text-[#D9B66F] font-semibold uppercase">Active Group</span>
                  <h2 className="text-2xl font-serif font-bold text-[#F7F2E9]">{selectedGroup.name}</h2>
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
                    Gemini AI balances all members' preferences to recommend titles everyone will enjoy.
                  </p>
                </div>
                <button
                  onClick={handleGenerateGroupRecommendations}
                  disabled={generating}
                  className="px-5 py-2.5 bg-[#D9B66F] text-[#091A2B] font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{generating ? 'Analyzing Group...' : 'Generate Shared Picks'}</span>
                </button>
              </div>

              {/* Group Recommendations Results */}
              {groupRecommendations.length > 0 && (
                <div className="space-y-4 pt-2">
                  <h3 className="font-serif font-bold text-base text-[#F7F2E9]">
                    Balanced Group Recommendations
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
