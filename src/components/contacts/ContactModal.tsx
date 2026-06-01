import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Plus, Upload, X } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import type { Contact } from '../../types';
import { useProjectStore } from '../../store/projectStore';
import { useAuthStore } from '../../store/authStore';
import { fileToResizedDataUrl } from '../../lib/contactImage';
import { generateId } from '../../lib/utils';
import { cn } from '../../lib/utils';

interface ContactModalProps {
  isOpen: boolean;
  contact?: Contact | null; // null/undefined이면 신규
  onClose: () => void;
  onSave: (contact: Contact) => void | Promise<void>;
}

type TextField =
  | 'name' | 'company' | 'department' | 'title' | 'mobile'
  | 'phone' | 'fax' | 'email' | 'address' | 'website' | 'memo';

function getInitialForm(contact: Contact | null | undefined): Record<TextField, string> {
  return {
    name: contact?.name ?? '',
    company: contact?.company ?? '',
    department: contact?.department ?? '',
    title: contact?.title ?? '',
    mobile: contact?.mobile ?? '',
    phone: contact?.phone ?? '',
    fax: contact?.fax ?? '',
    email: contact?.email ?? '',
    address: contact?.address ?? '',
    website: contact?.website ?? '',
    memo: contact?.memo ?? '',
  };
}

export default function ContactModal({ isOpen, contact, onClose, onSave }: ContactModalProps) {
  const { t } = useTranslation();
  const projects = useProjectStore((s) => s.projects);
  const userId = useAuthStore((s) => s.user?.id ?? '');

  const [form, setForm] = useState(() => getInitialForm(contact));
  const [tags, setTags] = useState<string[]>(contact?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [linkedProjectIds, setLinkedProjectIds] = useState<string[]>(contact?.linkedProjectIds ?? []);
  const [cardImage, setCardImage] = useState<string | undefined>(contact?.cardImage);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(contact);

  const setField = (key: TextField, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addTag = () => {
    const v = tagInput.trim();
    if (v && !tags.includes(v)) setTags((prev) => [...prev, v]);
    setTagInput('');
  };

  const removeTag = (tag: string) => setTags((prev) => prev.filter((x) => x !== tag));

  const toggleProject = (id: string) =>
    setLinkedProjectIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const handleImage = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      setCardImage(await fileToResizedDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError(t('contacts.nameRequired'));
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError(t('contacts.invalidEmail'));
      return;
    }
    const now = new Date().toISOString();
    const next: Contact = {
      id: contact?.id ?? generateId(),
      name: form.name.trim(),
      company: form.company.trim() || undefined,
      department: form.department.trim() || undefined,
      title: form.title.trim() || undefined,
      mobile: form.mobile.trim() || undefined,
      phone: form.phone.trim() || undefined,
      fax: form.fax.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      website: form.website.trim() || undefined,
      tags,
      memo: form.memo.trim() || undefined,
      cardImage,
      linkedProjectIds,
      createdBy: contact?.createdBy || userId,
      createdAt: contact?.createdAt ?? now,
      updatedAt: now,
    };
    setError(null);
    setSaving(true);
    try {
      await onSave(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const field = (key: TextField, labelKey: string) => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[color:var(--text-secondary)]">
        {t(`contacts.fields.${labelKey}`)}
      </label>
      <input
        type="text"
        value={form[key]}
        onChange={(e) => setField(key, e.target.value)}
        className="field-input w-full py-2.5"
      />
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? t('contacts.editContact') : t('contacts.addContact')}
      size="2xl"
    >
      <div className="space-y-4 p-6">
        {error && (
          <div className="rounded-lg border border-[var(--accent-danger)]/30 bg-[rgba(203,75,95,0.1)] px-3 py-2 text-sm text-[color:var(--accent-danger)]">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field('name', 'name')}
          {field('company', 'company')}
          {field('department', 'department')}
          {field('title', 'title')}
          {field('mobile', 'mobile')}
          {field('phone', 'phone')}
          {field('fax', 'fax')}
          {field('email', 'email')}
          {field('website', 'website')}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[color:var(--text-secondary)]">
            {t('contacts.fields.address')}
          </label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            className="field-input w-full py-2.5"
          />
        </div>

        {/* 태그 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[color:var(--text-secondary)]">
            {t('contacts.fields.tags')}
          </label>
          {tags.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-[color:var(--bg-secondary)] px-2.5 py-1 text-xs text-[color:var(--text-primary)]"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    aria-label={`${tag} ${t('contacts.delete')}`}
                    className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder={t('contacts.tagInputPlaceholder')}
            className="field-input w-full py-2.5"
          />
        </div>

        {/* 연결 프로젝트 */}
        {projects.length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[color:var(--text-secondary)]">
              {t('contacts.fields.linkedProjects')}
            </label>
            <div className="flex flex-wrap gap-2">
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProject(p.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                    linkedProjectIds.includes(p.id)
                      ? 'border-[var(--accent-primary)] bg-[rgba(15,118,110,0.12)] text-[color:var(--text-primary)]'
                      : 'border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] hover:border-[rgba(15,118,110,0.2)]',
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 메모 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[color:var(--text-secondary)]">
            {t('contacts.fields.memo')}
          </label>
          <textarea
            value={form.memo}
            onChange={(e) => setField('memo', e.target.value)}
            rows={3}
            className="field-input w-full resize-none py-2.5"
          />
        </div>

        {/* 명함 사진 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[color:var(--text-secondary)]">
            {t('contacts.fields.cardImage')}
          </label>
          <div className="flex items-center gap-3">
            {cardImage && (
              <img
                src={cardImage}
                alt=""
                className="h-20 rounded-lg border border-[var(--border-color)] object-cover"
              />
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[color:var(--text-secondary)] transition-all hover:-translate-y-0.5 hover:border-[rgba(15,118,110,0.28)] hover:text-[color:var(--text-primary)]">
              <Upload className="h-4 w-4" />
              {t('contacts.uploadImage')}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImage(e.target.files?.[0])}
              />
            </label>
            {cardImage && (
              <button
                type="button"
                onClick={() => setCardImage(undefined)}
                className="text-sm text-[color:var(--accent-danger)] hover:underline"
              >
                {t('contacts.removeImage')}
              </button>
            )}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 border-t border-[var(--border-color)] pt-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('contacts.cancel')}
          </Button>
          <Button onClick={handleSubmit} isLoading={saving}>
            {isEdit ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {t('contacts.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
