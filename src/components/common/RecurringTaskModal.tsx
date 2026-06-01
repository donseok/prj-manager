import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Play, RefreshCw } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import { cn, generateId } from '../../lib/utils';
import {
  loadRecurringRules,
  saveRecurringRule,
  deleteRecurringRule,
} from '../../lib/recurringRulesStorage';
import { generateImmediateTask } from '../../lib/recurringTasks';
import { useTaskStore } from '../../store/taskStore';
import type { RecurringRule, ProjectMember } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  members: ProjectMember[];
  onTasksGenerated?: (count: number) => void;
}

type FormState = Omit<RecurringRule, 'id' | 'projectId' | 'createdAt' | 'lastGeneratedAt'>;

const defaultForm: FormState = {
  templateTaskName: '',
  level: 4,
  frequency: 'weekly',
  dayOfWeek: 1,
  dayOfMonth: 1,
  isActive: true,
};

export default function RecurringTaskModal({
  isOpen,
  onClose,
  projectId,
  members,
  onTasksGenerated,
}: Props) {
  const { t } = useTranslation();
  const { tasks, addTask } = useTaskStore();
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);

  useEffect(() => {
    if (isOpen) {
      setRules(loadRecurringRules(projectId));
      setIsFormOpen(false);
      setEditingRule(null);
    }
  }, [isOpen, projectId]);

  // Candidate parent tasks based on selected level
  const parentCandidates = useMemo(() => {
    if (form.level <= 1) return [];
    return tasks.filter((t) => t.level === form.level - 1);
  }, [tasks, form.level]);

  const handleSave = () => {
    const now = new Date().toISOString();
    const rule: RecurringRule = {
      ...form,
      id: editingRule?.id ?? generateId(),
      projectId,
      createdAt: editingRule?.createdAt ?? now,
      lastGeneratedAt: editingRule?.lastGeneratedAt,
    };
    saveRecurringRule(rule);
    setRules(loadRecurringRules(projectId));
    setIsFormOpen(false);
    setEditingRule(null);
    setForm(defaultForm);
  };

  const handleEdit = (rule: RecurringRule) => {
    setEditingRule(rule);
    setForm({
      templateTaskName: rule.templateTaskName,
      parentId: rule.parentId,
      level: rule.level,
      frequency: rule.frequency,
      dayOfWeek: rule.dayOfWeek,
      dayOfMonth: rule.dayOfMonth,
      assigneeId: rule.assigneeId,
      output: rule.output,
      isActive: rule.isActive,
    });
    setIsFormOpen(true);
  };

  const handleDelete = (ruleId: string) => {
    deleteRecurringRule(ruleId);
    setRules(loadRecurringRules(projectId));
  };

  const handleToggleActive = (rule: RecurringRule) => {
    const updated = { ...rule, isActive: !rule.isActive };
    saveRecurringRule(updated);
    setRules(loadRecurringRules(projectId));
  };

  const handleGenerateNow = (rule: RecurringRule) => {
    const newTask = generateImmediateTask(rule, tasks);
    addTask(newTask);
    const now = new Date().toISOString();
    saveRecurringRule({ ...rule, lastGeneratedAt: now });
    setRules(loadRecurringRules(projectId));
    onTasksGenerated?.(1);
  };

  const handleNewRule = () => {
    setEditingRule(null);
    setForm(defaultForm);
    setIsFormOpen(true);
  };

  const frequencyDescription = (rule: RecurringRule) => {
    const dayLabel = t(`labels.dayOfWeek.${rule.dayOfWeek ?? 1}`);
    switch (rule.frequency) {
      case 'daily':
        return t('recurringTask.everyDay');
      case 'weekly':
        return t('recurringTask.everyWeek', { day: dayLabel });
      case 'biweekly':
        return t('recurringTask.everyBiweek', { day: dayLabel });
      case 'monthly':
        return t('recurringTask.everyMonth', { day: rule.dayOfMonth ?? 1 });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('recurringTask.title')} size="lg">
      <div className="p-6 space-y-4">
        {!isFormOpen ? (
          <>
            {/* Rule list */}
            {rules.length === 0 ? (
              <div className="py-8 text-center text-sm text-[color:var(--text-secondary)]">
                {t('recurringTask.empty')}
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={cn(
                      'app-panel rounded-[18px] p-4 transition-opacity',
                      !rule.isActive && 'opacity-50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[color:var(--text-primary)] truncate">
                          {rule.templateTaskName}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-[color:var(--text-secondary)]">
                          <span className="surface-badge">{frequencyDescription(rule)}</span>
                          <span className="surface-badge">{t(`labels.level.${rule.level}`)}</span>
                          {rule.output && <span className="surface-badge">{rule.output}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Active toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(rule)}
                          className={cn(
                            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                            rule.isActive
                              ? 'bg-[color:var(--accent-primary)]'
                              : 'bg-[color:var(--bg-tertiary)]'
                          )}
                        >
                          <span
                            className={cn(
                              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                              rule.isActive ? 'translate-x-6' : 'translate-x-1'
                            )}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleGenerateNow(rule)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-color)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)] transition-colors"
                          title={t('recurringTask.generateNow')}
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEdit(rule)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-color)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)] transition-colors"
                          title={t('recurringTask.edit')}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(rule.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                          title={t('recurringTask.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button variant="outline" onClick={handleNewRule} className="w-full">
              <Plus className="w-4 h-4" />
              {t('recurringTask.addRule')}
            </Button>
          </>
        ) : (
          /* Rule edit form */
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">
              {editingRule ? t('recurringTask.editRule') : t('recurringTask.newRule')}
            </h3>

            {/* Task name */}
            <div>
              <label className="field-label">{t('recurringTask.taskName')}</label>
              <input
                type="text"
                value={form.templateTaskName}
                onChange={(e) => setForm((f) => ({ ...f, templateTaskName: e.target.value }))}
                placeholder={t('recurringTask.namePlaceholder')}
                className="field-input mt-1"
              />
            </div>

            {/* Output */}
            <div>
              <label className="field-label">{t('recurringTask.output')}</label>
              <input
                type="text"
                value={form.output ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, output: e.target.value || undefined }))}
                placeholder={t('recurringTask.outputPlaceholder')}
                className="field-input mt-1"
              />
            </div>

            {/* Level */}
            <div>
              <label className="field-label">{t('recurringTask.level')}</label>
              <select
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: Number(e.target.value), parentId: undefined }))}
                className="field-select mt-1"
              >
                {[1, 2, 3, 4].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {t(`labels.level.${lvl}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Parent task */}
            {form.level > 1 && (
              <div>
                <label className="field-label">{t('recurringTask.parentTask')}</label>
                <select
                  value={form.parentId ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value || undefined }))}
                  className="field-select mt-1"
                >
                  <option value="">{t('recurringTask.noParent')}</option>
                  {parentCandidates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Assignee */}
            <div>
              <label className="field-label">{t('recurringTask.assignee')}</label>
              <select
                value={form.assigneeId ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, assigneeId: e.target.value || undefined }))}
                className="field-select mt-1"
              >
                <option value="">{t('recurringTask.unassigned')}</option>
                {members
                  .filter((m) => m.role !== 'viewer')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Frequency */}
            <div>
              <label className="field-label">{t('recurringTask.frequency')}</label>
              <div className="mt-1 flex gap-2">
                {(['daily', 'weekly', 'biweekly', 'monthly'] as const).map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, frequency: freq }))}
                    className={cn(
                      'rounded-full border px-4 py-2 text-sm font-medium transition-all',
                      form.frequency === freq
                        ? 'border-[rgba(15,118,110,0.4)] bg-[rgba(15,118,110,0.08)] text-[color:var(--accent-primary)]'
                        : 'border-[var(--border-color)] text-[color:var(--text-secondary)] hover:border-[rgba(15,118,110,0.2)]'
                    )}
                  >
                    {t(`labels.frequency.${freq}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Day of week (for weekly/biweekly) */}
            {(form.frequency === 'weekly' || form.frequency === 'biweekly') && (
              <div>
                <label className="field-label">{t('recurringTask.dayOfWeekLabel')}</label>
                <div className="mt-1 flex gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, dayOfWeek: d }))}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-all',
                        form.dayOfWeek === d
                          ? 'bg-[color:var(--accent-primary)] text-white'
                          : 'border border-[var(--border-color)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-tertiary)]'
                      )}
                    >
                      {t(`labels.dayOfWeek.${d}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Day of month */}
            {form.frequency === 'monthly' && (
              <div>
                <label className="field-label">{t('recurringTask.dayOfMonthLabel')}</label>
                <select
                  value={form.dayOfMonth ?? 1}
                  onChange={(e) => setForm((f) => ({ ...f, dayOfMonth: Number(e.target.value) }))}
                  className="field-select mt-1"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {t('recurringTask.dayOfMonthOption', { day: d })}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Form actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingRule(null);
                  setForm(defaultForm);
                }}
              >
                {t('recurringTask.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={!form.templateTaskName.trim()}>
                <RefreshCw className="w-4 h-4" />
                {editingRule ? t('recurringTask.update') : t('recurringTask.add')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
