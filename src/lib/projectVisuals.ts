import { Factory, Layers3, Radio, Workflow, type LucideIcon } from 'lucide-react';
import i18n from '../i18n';
import type { Project } from '../types';

export interface ProjectVisualTone {
  accent: string;
  label: string;
  note: string;
  icon: LucideIcon;
  lightGradient: string;
  darkGradient: string;
}

function getDefaultProjectTone(): ProjectVisualTone {
  return {
    accent: '#0f766e',
    label: 'Workspace Flow',
    note: i18n.t('projectVisuals.operationCheck'),
    icon: Layers3,
    lightGradient: 'linear-gradient(135deg, rgba(15,118,110,0.12), rgba(244,252,250,0.94) 44%, rgba(255,255,255,0.9))',
    darkGradient: 'linear-gradient(135deg, rgba(15,118,110,0.2), rgba(21,32,31,0.96) 40%, rgba(24,29,36,0.94))',
  };
}

export function getProjectVisualTone(project: Project): ProjectVisualTone {
  const name = project.name.toLowerCase();

  if (name.includes('계량')) {
    return {
      accent: '#0f766e',
      label: 'Smart Utility',
      note: i18n.t('projectVisuals.fieldData'),
      icon: Radio,
      lightGradient: 'linear-gradient(135deg, rgba(15,118,110,0.14), rgba(238,251,248,0.96) 42%, rgba(255,255,255,0.92))',
      darkGradient: 'linear-gradient(135deg, rgba(15,118,110,0.22), rgba(21,35,32,0.96) 40%, rgba(24,29,36,0.94))',
    };
  }

  if (name.includes('pi')) {
    return {
      accent: '#d88b44',
      label: 'Process Innovation',
      note: i18n.t('projectVisuals.processRedesign'),
      icon: Workflow,
      lightGradient: 'linear-gradient(135deg, rgba(216,139,68,0.14), rgba(255,247,238,0.96) 42%, rgba(255,255,255,0.92))',
      darkGradient: 'linear-gradient(135deg, rgba(216,139,68,0.22), rgba(38,31,24,0.96) 40%, rgba(24,29,36,0.94))',
    };
  }

  if (name.includes('erp') && name.includes('mes')) {
    return {
      accent: '#2d7bd6',
      label: 'Core Integration',
      note: i18n.t('projectVisuals.coreIntegration'),
      icon: Layers3,
      lightGradient: 'linear-gradient(135deg, rgba(45,123,214,0.14), rgba(240,247,255,0.96) 42%, rgba(255,255,255,0.92))',
      darkGradient: 'linear-gradient(135deg, rgba(45,123,214,0.2), rgba(22,29,40,0.96) 40%, rgba(24,29,36,0.94))',
    };
  }

  if (name.includes('mes')) {
    return {
      accent: '#23547b',
      label: 'Manufacturing Ops',
      note: i18n.t('projectVisuals.manufacturingOps'),
      icon: Factory,
      lightGradient: 'linear-gradient(135deg, rgba(35,84,123,0.14), rgba(241,246,251,0.96) 42%, rgba(255,255,255,0.92))',
      darkGradient: 'linear-gradient(135deg, rgba(35,84,123,0.22), rgba(22,28,36,0.96) 40%, rgba(24,29,36,0.94))',
    };
  }

  return getDefaultProjectTone();
}

export function getProjectCardBackground(project: Project, isDark: boolean) {
  const tone = getProjectVisualTone(project);
  return isDark ? tone.darkGradient : tone.lightGradient;
}

export function getProjectTimeline(project: Project) {
  if (project.startDate && project.endDate) return `${project.startDate} ~ ${project.endDate}`;
  if (project.startDate) return `${project.startDate} ${i18n.t('projectVisuals.start')}`;
  if (project.endDate) return `${project.endDate} ${i18n.t('projectVisuals.target')}`;
  return i18n.t('projectVisuals.schedulePending');
}

export function getProjectSummary(project: Project) {
  if (!project.description) return i18n.t('projectVisuals.defaultSummary');

  const segments = project.description
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  return segments.join(' / ');
}
