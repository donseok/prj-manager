import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Mail, Phone, Building2, Loader2, Pencil, Trash2 } from 'lucide-react';
import type { Contact } from '../types';
import { useContactStore } from '../store/contactStore';
import { useProjectStore } from '../store/projectStore';
import Button from '../components/common/Button';
import ConfirmModal from '../components/common/ConfirmModal';
import ContactModal from '../components/contacts/ContactModal';

export default function Contacts() {
  const { t } = useTranslation();
  const contacts = useContactStore((s) => s.contacts);
  const isLoading = useContactStore((s) => s.isLoading);
  const loadContacts = useContactStore((s) => s.loadContacts);
  const saveContact = useContactStore((s) => s.saveContact);
  const removeContact = useContactStore((s) => s.removeContact);
  const projects = useProjectStore((s) => s.projects);

  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const allTags = useMemo(
    () => Array.from(new Set(contacts.flatMap((c) => c.tags))).sort(),
    [contacts],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      const matchesQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.company ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q);
      const matchesTag = !tagFilter || c.tags.includes(tagFilter);
      const matchesProject = !projectFilter || c.linkedProjectIds.includes(projectFilter);
      return matchesQuery && matchesTag && matchesProject;
    });
  }, [contacts, query, tagFilter, projectFilter]);

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditing(c);
    setModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeContact(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-[color:var(--text-primary)]">
            {t('contacts.title')}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{t('contacts.subtitle')}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" />
          {t('contacts.addContact')}
        </Button>
      </div>

      {/* 검색/필터 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-secondary)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('contacts.searchPlaceholder')}
            aria-label={t('contacts.searchPlaceholder')}
            className="field-input w-full py-2.5 pl-9"
          />
        </div>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          aria-label={t('contacts.filterByTag')}
          className="field-select py-2.5"
        >
          <option value="">{t('contacts.allTags')}</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          aria-label={t('contacts.filterByProject')}
          className="field-select py-2.5"
        >
          <option value="">{t('contacts.allProjects')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20 text-[color:var(--text-secondary)]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-color)] py-20 text-center text-[color:var(--text-secondary)]">
          <p className="font-medium text-[color:var(--text-primary)]">{t('contacts.empty')}</p>
          <p className="mt-1 text-sm">{t('contacts.emptyHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="group rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4"
            >
              {c.cardImage && (
                <img src={c.cardImage} alt="" className="mb-3 h-28 w-full rounded-lg object-cover" />
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[color:var(--text-primary)]">{c.name}</p>
                  {(c.company || c.title) && (
                    <p className="flex items-center gap-1 truncate text-sm text-[color:var(--text-secondary)]">
                      <Building2 className="h-3 w-3 shrink-0" />
                      {[c.company, c.title].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    aria-label={t('contacts.editContact')}
                    className="rounded-lg p-1.5 text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-secondary)] hover:text-[color:var(--text-primary)]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(c)}
                    aria-label={t('contacts.delete')}
                    className="rounded-lg p-1.5 text-[color:var(--accent-danger)] hover:bg-[color:var(--bg-secondary)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-1 text-sm text-[color:var(--text-secondary)]">
                {c.mobile && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 shrink-0" />
                    {c.mobile}
                  </p>
                )}
                {c.email && (
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    {c.email}
                  </p>
                )}
              </div>
              {c.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[color:var(--bg-secondary)] px-2 py-0.5 text-xs text-[color:var(--text-primary)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <ContactModal
          isOpen={modalOpen}
          contact={editing}
          onClose={() => setModalOpen(false)}
          onSave={saveContact}
        />
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={t('contacts.delete')}
        description={t('contacts.deleteConfirm')}
        confirmLabel={t('contacts.delete')}
        confirmVariant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
