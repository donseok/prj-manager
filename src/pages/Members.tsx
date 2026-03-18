import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Trash2, UserCircle, Edit2, Check, X } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { generateId, storage } from '../lib/utils';
import type { ProjectMember } from '../types';

export default function Members() {
  const { projectId } = useParams<{ projectId: string }>();
  const { members, setMembers, addMember, updateMember, removeMember, currentProject } = useProjectStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newMember, setNewMember] = useState<{ name: string; role: ProjectMember['role'] }>({ name: '', role: 'member' });

  // 로컬 스토리지에서 멤버 로드
  useEffect(() => {
    if (projectId) {
      const savedMembers = storage.get<ProjectMember[]>(`members-${projectId}`, []);
      setMembers(savedMembers);
    }
  }, [projectId, setMembers]);

  // 멤버 변경 시 저장
  useEffect(() => {
    if (projectId && members.length >= 0) {
      storage.set(`members-${projectId}`, members);
    }
  }, [projectId, members]);

  const handleAddMember = () => {
    if (!newMember.name.trim()) return;

    const member: ProjectMember = {
      id: generateId(),
      projectId: projectId!,
      name: newMember.name,
      role: newMember.role,
      createdAt: new Date().toISOString(),
    };

    addMember(member);
    setShowAddModal(false);
    setNewMember({ name: '', role: 'member' });
  };

  const handleDeleteMember = (id: string) => {
    if (confirm('멤버를 삭제하시겠습니까?')) {
      removeMember(id);
    }
  };

  const handleStartEdit = (member: ProjectMember) => {
    setEditingId(member.id);
    setEditName(member.name);
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      updateMember(id, { name: editName });
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleRoleChange = (id: string, role: ProjectMember['role']) => {
    updateMember(id, { role });
  };

  const roleLabels: Record<ProjectMember['role'], string> = {
    owner: '소유자',
    admin: '관리자',
    member: '멤버',
    viewer: '뷰어',
  };

  const roleColors: Record<ProjectMember['role'], string> = {
    owner: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
    admin: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
    member: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
    viewer: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">멤버 관리</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {currentProject?.name} 프로젝트의 참여자를 관리합니다
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          멤버 추가
        </Button>
      </div>

      {/* 멤버 목록 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {members.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <UserCircle className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                  </div>

                  {editingId === member.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(member.id);
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                      />
                      <button
                        onClick={() => handleSaveEdit(member.id)}
                        className="p-1 hover:bg-green-100 dark:hover:bg-green-900 rounded text-green-600 dark:text-green-400"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600 dark:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        추가됨: {new Date(member.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* 역할 선택 */}
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value as ProjectMember['role'])}
                    className={`px-3 py-1 rounded-full text-sm font-medium border-0 cursor-pointer ${roleColors[member.role]}`}
                  >
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>

                  {/* 액션 버튼 */}
                  {editingId !== member.id && (
                    <>
                      <button
                        onClick={() => handleStartEdit(member)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <UserCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">아직 멤버가 없습니다</p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              첫 멤버 추가
            </Button>
          </div>
        )}
      </div>

      {/* 멤버 추가 모달 */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="멤버 추가"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이름 *</label>
            <input
              type="text"
              value={newMember.name}
              onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="멤버 이름을 입력하세요"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">역할</label>
            <select
              value={newMember.role}
              onChange={(e) => setNewMember({ ...newMember, role: e.target.value as ProjectMember['role'] })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="member">멤버</option>
              <option value="admin">관리자</option>
              <option value="viewer">뷰어</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              취소
            </Button>
            <Button onClick={handleAddMember} disabled={!newMember.name.trim()}>
              추가
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
