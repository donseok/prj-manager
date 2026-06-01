import { create } from 'zustand';
import type { Contact } from '../types';
import {
  loadContacts as repoLoadContacts,
  upsertContact as repoUpsertContact,
  deleteContactById as repoDeleteContact,
} from '../lib/dataRepository';

interface ContactState {
  contacts: Contact[];
  isLoading: boolean;

  loadContacts: () => Promise<void>;
  /** 추가/수정 공용 (id가 이미 있으면 교체, 없으면 앞에 추가) */
  saveContact: (contact: Contact) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
}

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  isLoading: false,

  loadContacts: async () => {
    set({ isLoading: true });
    const contacts = await repoLoadContacts();
    set({ contacts, isLoading: false });
  },

  saveContact: async (contact) => {
    const prev = get().contacts;
    const exists = prev.some((c) => c.id === contact.id);
    const optimistic = exists
      ? prev.map((c) => (c.id === contact.id ? contact : c))
      : [contact, ...prev];
    set({ contacts: optimistic });
    try {
      const saved = await repoUpsertContact(contact);
      set((state) => ({
        contacts: state.contacts.map((c) => (c.id === saved.id ? saved : c)),
      }));
    } catch (e) {
      set({ contacts: prev });
      throw e;
    }
  },

  removeContact: async (id) => {
    const prev = get().contacts;
    set({ contacts: prev.filter((c) => c.id !== id) });
    try {
      await repoDeleteContact(id);
    } catch (e) {
      set({ contacts: prev });
      throw e;
    }
  },
}));
