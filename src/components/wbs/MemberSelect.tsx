import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, ChevronDown, X, UserCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ProjectMember } from '../../types';

interface MemberSelectProps {
  members: ProjectMember[];
  value: string | null;
  onChange: (memberId: string | null) => void;
  onCreateMember: (name: string) => string;
}

export default function MemberSelect({ members, value, onChange, onCreateMember }: MemberSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const newNameInputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; openUp: boolean }>({
    top: 0,
    left: 0,
    width: 0,
    openUp: false,
  });

  const selectedMember = members.find((m) => m.id === value);
  const filtered = members.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setPosition({
      top: openUp ? rect.top : rect.bottom + 2,
      left: rect.left,
      width: Math.max(rect.width, 220),
      openUp,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleScroll = () => updatePosition();
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isCreating && newNameInputRef.current) {
      newNameInputRef.current.focus();
    }
  }, [isCreating]);

  // 외부 클릭으로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearch('');
        setIsCreating(false);
        setNewName('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Escape로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCreating) {
          setIsCreating(false);
          setNewName('');
        } else {
          setIsOpen(false);
          setSearch('');
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isCreating]);

  const handleSelect = (memberId: string | null) => {
    onChange(memberId);
    setIsOpen(false);
    setSearch('');
    setIsCreating(false);
    setNewName('');
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    setNewName(search);
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const newId = onCreateMember(name);
    onChange(newId);
    setIsOpen(false);
    setSearch('');
    setIsCreating(false);
    setNewName('');
  };

  const dropdown = isOpen
    ? createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] overflow-hidden rounded-xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] shadow-[0_20px_48px_-14px_rgba(0,0,0,0.32)]"
          style={{
            top: position.openUp ? undefined : position.top,
            bottom: position.openUp ? window.innerHeight - position.top + 2 : undefined,
            left: position.left,
            width: position.width,
          }}
        >
          {/* 검색 */}
          <div className="flex items-center gap-2 border-b border-[var(--border-color)] px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)]" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="멤버 검색..."
              className="flex-1 bg-transparent text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length === 1) {
                  handleSelect(filtered[0].id);
                }
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* 멤버 목록 */}
          <div className="max-h-[180px] overflow-auto py-1">
            {/* 배정 해제 옵션 */}
            <button
              onClick={() => handleSelect(null)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[color:var(--bg-tertiary)]',
                !value && 'bg-[rgba(15,118,110,0.06)]'
              )}
            >
              <span className="text-[color:var(--text-muted)]">-</span>
              <span className="text-[color:var(--text-secondary)]">배정 안함</span>
            </button>

            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => handleSelect(m.id)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[color:var(--bg-tertiary)]',
                  value === m.id && 'bg-[rgba(15,118,110,0.06)]'
                )}
              >
                <UserCircle className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
                <span className="truncate text-[color:var(--text-primary)]">{m.name}</span>
              </button>
            ))}

            {filtered.length === 0 && search && (
              <div className="px-3 py-2 text-center text-xs text-[color:var(--text-muted)]">
                일치하는 멤버가 없습니다
              </div>
            )}
          </div>

          {/* 새 멤버 추가 */}
          <div className="border-t border-[var(--border-color)]">
            {isCreating ? (
              <div className="flex items-center gap-2 px-3 py-2">
                <input
                  ref={newNameInputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="이름 입력"
                  className="flex-1 rounded-md border border-[var(--border-color)] bg-[color:var(--bg-primary)] px-2 py-1.5 text-sm text-[color:var(--text-primary)] outline-none focus:border-[var(--accent-primary)] placeholder:text-[color:var(--text-muted)]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') {
                      setIsCreating(false);
                      setNewName('');
                    }
                  }}
                />
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="rounded-md bg-[image:var(--gradient-primary)] px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-40"
                >
                  추가
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartCreate}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[color:var(--accent-primary)] transition-colors hover:bg-[color:var(--bg-tertiary)]"
              >
                <Plus className="h-4 w-4" />
                새 멤버 추가
              </button>
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          'flex w-full items-center justify-between gap-1 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-[color:var(--bg-tertiary)]',
          isOpen && 'bg-[color:var(--bg-tertiary)]'
        )}
      >
        <span className={cn('truncate', selectedMember ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-muted)]')}>
          {selectedMember?.name || '-'}
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)] transition-transform', isOpen && 'rotate-180')} />
      </button>
      {dropdown}
    </>
  );
}
